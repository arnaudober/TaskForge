# TaskForge

A lightweight, zero-dependency to-do app built with **Vanilla JS**, **HTML**, and **CSS** — no frameworks, no build tools, just clean code.

![TaskForge screenshot](https://raw.githubusercontent.com/arnaudober/taskforge/main/screenshot.png)

---

## ✨ Features

- **Add, edit & delete tasks** — inline editing with keyboard support (`Enter` to save, `Escape` to cancel)
- **Task grouping** — tasks automatically grouped by *Overdue*, *Today*, *Tomorrow*, *Upcoming*, and *No due date*
- **Due dates** — set deadlines via a clean date modal; overdue and today tasks are visually highlighted
- **Drag to reorder** — drag-and-drop reordering with a visual drop indicator
- **Undo delete** — toast notification with one-click undo after deleting a task
- **Filters** — view *All*, *Active*, or *Completed* tasks
- **Persistence** — all tasks saved to `localStorage`, survive page refresh
- **Micro-animations** — smooth slide-in, bounce, and fade-out transitions
- **Responsive** — works on mobile with larger tap targets

---

## 🚀 Getting Started

No installation required. Just open `index.html` in your browser:

```bash
git clone https://github.com/your-username/taskforge.git
cd taskforge
open index.html
```

Or serve it locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## 🗂 Project Structure

```
taskforge/
├── index.html   # App markup
├── styles.css   # All styles (CSS variables, layout, animations)
└── app.js       # All logic (tasks, drag-drop, filters, localStorage)
```

---

## 🛠 Built With

- Vanilla JavaScript (ES6+, IIFE, no modules)
- CSS custom properties & flexbox
- [Font Awesome 6](https://fontawesome.com/) for icons
- `localStorage` for persistence

---

## 📄 License

[MIT](LICENSE)
