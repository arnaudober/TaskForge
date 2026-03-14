(() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let tasks = JSON.parse(localStorage.getItem('taskforge-tasks') || '[]');
  let currentFilter = 'all';

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const form        = document.getElementById('task-form');
  const input       = document.getElementById('task-input');
  const taskList    = document.getElementById('task-list');
  const taskCount   = document.getElementById('task-count');
  const clearBtn    = document.getElementById('clear-completed');
  const themeToggle = document.getElementById('theme-toggle');
  const filterBtns  = document.querySelectorAll('.filter-btn');
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
  function render() {
    taskList.innerHTML = '';

    const filtered = tasks.filter(t => {
      if (currentFilter === 'active')    return !t.completed;
      if (currentFilter === 'completed') return  t.completed;
      return true;
    });

    filtered.forEach(task => {
      const li = createElement(task);
      taskList.appendChild(li);
    });

    updateFooter();
  }

  function createElement(task) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.dataset.id = task.id;

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', 'Mark task complete');

    // Text
    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;

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
    li.appendChild(span);
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
      completed: false
    };

    tasks.unshift(task);
    save();
    render();
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
      li.classList.add('removing');
      li.addEventListener('animationend', () => {
        tasks = tasks.filter(t => t.id !== id);
        save();
        render();
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
    const span = li.querySelector('.task-text');
    const actions = li.querySelector('.task-actions');
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Replace span with input
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.value = task.text;
    editInput.maxLength = 120;
    li.replaceChild(editInput, span);

    // Replace edit button with save button
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
      if (e.key === 'Escape') { render(); } // cancel
    });
    editInput.addEventListener('blur', () => {
      // Small delay so save button click fires first
      setTimeout(() => {
        if (document.activeElement !== saveBtn) commitEdit();
      }, 150);
    });
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