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

    // Due date row
    const dueRow = document.createElement('div');
    const status = dueDateStatus(task.due);
    dueRow.className = 'task-due' + (status === 'overdue' ? ' overdue' : status === 'due-today' ? ' due-today' : '');

    const calIcon = document.createElement('i');
    calIcon.className = 'fa-regular fa-calendar';
    dueRow.appendChild(calIcon);

    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueInput.className = 'due-input';
    dueInput.value = task.due || '';
    dueInput.setAttribute('aria-label', 'Due date');
    if (task.due) {
      dueInput.title = status === 'overdue' ? 'Overdue!' : status === 'due-today' ? 'Due today!' : '';
    }

    // Show formatted label, click to change
    const dueLabel = document.createElement('span');
    dueLabel.textContent = task.due ? formatDue(task.due) : 'Set date';
    dueLabel.style.cursor = 'pointer';
    dueLabel.style.opacity = task.due ? '1' : '0.5';
    dueLabel.addEventListener('click', () => dueInput.showPicker?.() || dueInput.click());

    dueInput.style.display = 'none';
    dueInput.addEventListener('change', () => {
      task.due = dueInput.value || null;
      save();
      render();
    });

    dueRow.appendChild(dueLabel);
    dueRow.appendChild(dueInput);
    meta.appendChild(dueRow);

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

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.value = task.text;
    editInput.maxLength = 120;
    meta.replaceChild(editInput, span);

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
        if (document.activeElement !== saveBtn) commitEdit();
      }, 150);
    });
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

  function setupDragAndDrop() {
    const items = taskList.querySelectorAll('.task-item');
    items.forEach(item => {
      item.addEventListener('dragstart', onDragStart);
      item.addEventListener('dragover',  onDragOver);
      item.addEventListener('dragleave', onDragLeave);
      item.addEventListener('drop',      onDrop);
      item.addEventListener('dragend',   onDragEnd);
    });
  }

  function onDragStart(e) {
    dragSrcId = this.dataset.id;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcId);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this.dataset.id !== dragSrcId) {
      this.classList.add('drag-over');
    }
  }

  function onDragLeave() {
    this.classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    const targetId = this.dataset.id;
    if (!dragSrcId || dragSrcId === targetId) return;

    const srcIdx = tasks.findIndex(t => t.id === dragSrcId);
    const tgtIdx = tasks.findIndex(t => t.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const [moved] = tasks.splice(srcIdx, 1);
    tasks.splice(tgtIdx, 0, moved);
    save();
    render();
  }

  function onDragEnd() {
    taskList.querySelectorAll('.task-item').forEach(i => {
      i.classList.remove('dragging', 'drag-over');
    });
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