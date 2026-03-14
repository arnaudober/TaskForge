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

    // Due date row — wrap a real visible date input with a label overlay
    const dueRow = document.createElement('div');
    const status = dueDateStatus(task.due);
    dueRow.className = 'task-due' + (status === 'overdue' ? ' overdue' : status === 'due-today' ? ' due-today' : '');

    const calIcon = document.createElement('i');
    calIcon.className = 'fa-regular fa-calendar';
    dueRow.appendChild(calIcon);

    // Wrapper so we can overlay the label on top of the native input
    const dueWrap = document.createElement('label');
    dueWrap.className = 'due-wrap';
    dueWrap.title = status === 'overdue' ? 'Overdue!' : status === 'due-today' ? 'Due today!' : 'Set due date';

    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueInput.className = 'due-input-native';
    dueInput.value = task.due || '';
    dueInput.setAttribute('aria-label', 'Due date');

    const dueLabel = document.createElement('span');
    dueLabel.className = 'due-label';
    dueLabel.textContent = task.due ? formatDue(task.due) : 'Set date';

    dueInput.addEventListener('change', (e) => {
      e.stopPropagation();
      task.due = dueInput.value || null;
      save();
      render();
    });

    // Prevent drag from starting when interacting with date
    dueWrap.addEventListener('mousedown', e => e.stopPropagation());
    dueWrap.addEventListener('dragstart', e => e.stopPropagation());

    dueWrap.appendChild(dueLabel);
    dueWrap.appendChild(dueInput);
    dueRow.appendChild(dueWrap);
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
    if (this.dataset.id === dragSrcId) return;
    clearDropIndicators();
    const rect = this.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    this._dropBefore = e.clientY < midY;
    if (this._dropBefore) {
      this.classList.add('drop-before');
    } else {
      this.classList.add('drop-after');
    }
  }

  function onDragLeave(e) {
    if (!this.contains(e.relatedTarget)) {
      this.classList.remove('drop-before', 'drop-after');
      this._dropBefore = undefined;
    }
  }

  function clearDropIndicators() {
    taskList.querySelectorAll('.task-item').forEach(i => {
      i.classList.remove('drop-before', 'drop-after');
    });
  }

  function onDrop(e) {
    e.preventDefault();
    clearDropIndicators();
    const targetId = this.dataset.id;
    if (!dragSrcId || dragSrcId === targetId) return;

    const srcIdx = tasks.findIndex(t => t.id === dragSrcId);
    let tgtIdx   = tasks.findIndex(t => t.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const targetEl = taskList.querySelector(`[data-id="${targetId}"]`);
    const insertBefore = targetEl && targetEl._dropBefore;

    const [moved] = tasks.splice(srcIdx, 1);
    tgtIdx = tasks.findIndex(t => t.id === targetId);
    tasks.splice(insertBefore ? tgtIdx : tgtIdx + 1, 0, moved);
    save();
    render();
  }

  function onDragEnd() {
    taskList.querySelectorAll('.task-item').forEach(i => {
      i.classList.remove('dragging', 'drop-before', 'drop-after');
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