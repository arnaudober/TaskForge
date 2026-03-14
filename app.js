(() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let tasks = JSON.parse(localStorage.getItem('taskforge-tasks') || '[]');
  let currentFilter = 'all';
  let toastTimer = null;
  let undoSnapshot = null; // { tasks, deletedTask }

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const form        = document.getElementById('task-form');
  const input       = document.getElementById('task-input');
  const taskList    = document.getElementById('task-list');
  const taskCount   = document.getElementById('task-count');
  const clearBtn    = document.getElementById('clear-completed');
  const themeToggle = document.getElementById('theme-toggle');
  const filterBtns  = document.querySelectorAll('.filter-btn');
  const emptyState  = document.getElementById('empty-state');
  const toast       = document.getElementById('toast');
  const html        = document.documentElement;

  // ── Theme ──────────────────────────────────────────────────────────────────
  const savedTheme = localStorage.getItem('taskforge-theme') || 'light';
  html.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('taskforge-theme', next);
    updateThemeIcon(next);
  });

  function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  function save() {
    localStorage.setItem('taskforge-tasks', JSON.stringify(tasks));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render(newId) {
    taskList.innerHTML = '';

    const filtered = tasks.filter(t => {
      if (currentFilter === 'active')    return !t.completed;
      if (currentFilter === 'completed') return  t.completed;
      return true;
    });

    if (filtered.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      filtered.forEach(task => {
        const li = createElement(task, task.id === newId);
        taskList.appendChild(li);
      });
    }

    updateFooter();
    setupDragAndDrop();
  }

  // ── Due date helpers ───────────────────────────────────────────────────────
  function dueDateStatus(due) {
    if (!due) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (due < today)  return 'overdue';
    if (due === today) return 'due-today';
    return 'upcoming';
  }

  function formatDue(due) {
    if (!due) return '';
    const [y, m, d] = due.split('-');
    const today = new Date().toISOString().slice(0, 10);
    if (due === today) return 'Today';
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (due === tomorrow) return 'Tomorrow';
    return new Date(due + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function createElement(task, bounce = false) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '') + (bounce ? ' bounce' : '');
    li.dataset.id = task.id;
    li.draggable = true;

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', 'Mark task complete');

    // Meta (text + due)
    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;
    meta.appendChild(span);

    // Due date badge (read-only, shown only when a date is set)
    if (task.due) {
      const status = dueDateStatus(task.due);
      const dueRow = document.createElement('div');
      dueRow.className = 'task-due' + (status === 'overdue' ? ' overdue' : status === 'due-today' ? ' due-today' : '');
      const calIcon = document.createElement('i');
      calIcon.className = 'fa-regular fa-calendar';
      const dueLabel = document.createElement('span');
      dueLabel.textContent = formatDue(task.due);
      dueRow.appendChild(calIcon);
      dueRow.appendChild(dueLabel);
      meta.appendChild(dueRow);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon btn-edit';
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-delete';
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(meta);
    li.appendChild(actions);

    return li;
  }

  function updateFooter() {
    const active = tasks.filter(t => !t.completed).length;
    taskCount.textContent = `${active} task${active !== 1 ? 's' : ''} left`;
  }

  // ── Add Task ───────────────────────────────────────────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const task = {
      id: Date.now().toString(),
      text,
      completed: false,
      due: null
    };

    tasks.unshift(task);
    save();
    render(task.id);
    input.value = '';
    input.focus();
  });

  // ── Event Delegation on List ───────────────────────────────────────────────
  taskList.addEventListener('click', e => {
    const li = e.target.closest('.task-item');
    if (!li) return;
    const id = li.dataset.id;

    // Delete
    if (e.target.closest('.btn-delete')) {
      const task = tasks.find(t => t.id === id);
      undoSnapshot = { tasks: JSON.parse(JSON.stringify(tasks)), deletedTask: task };
      li.classList.add('removing');
      li.addEventListener('animationend', () => {
        tasks = tasks.filter(t => t.id !== id);
        save();
        render();
        showToast(`"${task.text.slice(0, 28)}${task.text.length > 28 ? '…' : ''}" deleted`, true);
      }, { once: true });
      return;
    }

    // Edit
    if (e.target.closest('.btn-edit')) {
      startEdit(li, id);
      return;
    }

    // Checkbox
    if (e.target.classList.contains('task-checkbox')) {
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.completed = e.target.checked;
        save();
        li.classList.toggle('completed', task.completed);
        updateFooter();
      }
    }
  });

  // ── Edit ───────────────────────────────────────────────────────────────────
  function startEdit(li, id) {
    const meta = li.querySelector('.task-meta');
    const span = li.querySelector('.task-text');
    const actions = li.querySelector('.task-actions');
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Disable drag while editing, highlight edit state
    li.draggable = false;
    li.classList.add('editing');

    // Replace text span with input
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.value = task.text;
    editInput.maxLength = 120;
    meta.replaceChild(editInput, span);

    // Remove existing due badge if any
    const existingDue = meta.querySelector('.task-due');
    if (existingDue) meta.removeChild(existingDue);

    // Due date row with button to open modal
    const dueRow = document.createElement('div');
    dueRow.className = 'task-due-edit';

    const calIcon = document.createElement('i');
    calIcon.className = 'fa-regular fa-calendar';
    dueRow.appendChild(calIcon);

    const duePicker = document.createElement('button');
    duePicker.type = 'button';
    duePicker.className = 'due-pick-btn';
    duePicker.textContent = task.due ? formatDue(task.due) : 'Set date';
    if (task.due) {
      const s = dueDateStatus(task.due);
      if (s === 'overdue') duePicker.classList.add('overdue');
      else if (s === 'due-today') duePicker.classList.add('due-today');
    }
    duePicker.addEventListener('mousedown', e => e.stopPropagation());
    duePicker.addEventListener('click', e => {
      e.stopPropagation();
      openDateModal(task, (picked) => {
        task.due = picked;
        duePicker.textContent = picked ? formatDue(picked) : 'Set date';
        duePicker.className = 'due-pick-btn';
        if (picked) {
          const s = dueDateStatus(picked);
          if (s === 'overdue') duePicker.classList.add('overdue');
          else if (s === 'due-today') duePicker.classList.add('due-today');
        }
      });
    });
    dueRow.appendChild(duePicker);
    meta.appendChild(dueRow);

    // Replace edit btn with save btn
    const editBtn = actions.querySelector('.btn-edit');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-icon btn-save';
    saveBtn.setAttribute('aria-label', 'Save task');
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    actions.replaceChild(saveBtn, editBtn);

    editInput.focus();
    editInput.select();

    function commitEdit() {
      const newText = editInput.value.trim();
      if (newText) task.text = newText;
      save();
      render();
    }

    saveBtn.addEventListener('click', commitEdit);
    editInput.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
      if (e.key === 'Escape') { render(); }
    });
    editInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (document.activeElement !== saveBtn && !document.querySelector('.date-modal')) commitEdit();
      }, 150);
    });
  }

  // ── Date Modal ─────────────────────────────────────────────────────────────
  function openDateModal(task, onPick) {
    // Remove any existing modal
    const existing = document.querySelector('.date-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'date-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'date-modal';

    const title = document.createElement('p');
    title.className = 'date-modal-title';
    title.textContent = 'Set due date';
    modal.appendChild(title);

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'date-modal-input';
    dateInput.value = task.due || '';
    modal.appendChild(dateInput);

    const btns = document.createElement('div');
    btns.className = 'date-modal-btns';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'date-modal-btn date-modal-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      onPick(null);
      overlay.remove();
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'date-modal-btn date-modal-confirm';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', () => {
      onPick(dateInput.value || null);
      overlay.remove();
    });

    btns.appendChild(clearBtn);
    btns.appendChild(confirmBtn);
    modal.appendChild(btns);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    // Focus the input to open picker on supporting browsers
    setTimeout(() => dateInput.focus(), 50);
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(message, withUndo = false) {
    clearTimeout(toastTimer);
    toast.innerHTML = '';

    const msg = document.createElement('span');
    msg.textContent = message;
    toast.appendChild(msg);

    if (withUndo) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', () => {
        if (undoSnapshot) {
          tasks = undoSnapshot.tasks;
          save();
          render();
          undoSnapshot = null;
        }
        hideToast();
      });
      toast.appendChild(undoBtn);
    }

    toast.classList.add('show');
    toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    toast.classList.remove('show');
    undoSnapshot = null;
  }

  // ── Drag and Drop (reorder) ────────────────────────────────────────────────
  let dragSrcId = null;

  // Single reusable drop-line element
  const dropLine = document.createElement('div');
  dropLine.className = 'drop-line';

  function removeDropLine() {
    if (dropLine.parentNode) dropLine.parentNode.removeChild(dropLine);
  }

  function setupDragAndDrop() {
    const items = taskList.querySelectorAll('.task-item');
    items.forEach(item => {
      item.addEventListener('dragstart', onDragStart);
      item.addEventListener('dragend',   onDragEnd);
    });
    taskList.addEventListener('dragover', onListDragOver);
    taskList.addEventListener('dragleave', onListDragLeave);
    taskList.addEventListener('drop', onListDrop);
  }

  function onDragStart(e) {
    dragSrcId = this.dataset.id;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcId);
  }

  function onListDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragSrcId) return;

    // Find which item we're over
    const items = [...taskList.querySelectorAll('.task-item:not(.dragging)')];
    let insertBeforeEl = null;

    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        insertBeforeEl = item;
        break;
      }
    }

    // Place the drop line
    if (insertBeforeEl) {
      taskList.insertBefore(dropLine, insertBeforeEl);
    } else {
      taskList.appendChild(dropLine);
    }
  }

  function onListDragLeave(e) {
    if (!taskList.contains(e.relatedTarget)) {
      removeDropLine();
    }
  }

  function onListDrop(e) {
    e.preventDefault();
    if (!dragSrcId) return;

    const srcIdx = tasks.findIndex(t => t.id === dragSrcId);
    if (srcIdx === -1) { removeDropLine(); return; }

    // Find what element comes after the drop line
    const nextEl = dropLine.nextElementSibling;
    removeDropLine();

    const [moved] = tasks.splice(srcIdx, 1);

    if (nextEl && nextEl.dataset.id) {
      const tgtIdx = tasks.findIndex(t => t.id === nextEl.dataset.id);
      tasks.splice(tgtIdx === -1 ? tasks.length : tgtIdx, 0, moved);
    } else {
      tasks.push(moved);
    }

    save();
    render();
  }

  function onDragEnd() {
    removeDropLine();
    taskList.querySelectorAll('.task-item').forEach(i => i.classList.remove('dragging'));
    dragSrcId = null;
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // ── Clear Completed ────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    tasks = tasks.filter(t => !t.completed);
    save();
    render();
  });

  // ── Initial render ─────────────────────────────────────────────────────────
  render();
})();