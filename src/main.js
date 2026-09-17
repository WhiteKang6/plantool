import {
  loadState,
  getTasks,
  addTask,
  updateTask,
  removeTask,
  isReminded,
  markReminded,
  uid,
  todayKey,
  formatDateCN,
  weekdayCN,
} from './store.js';
import { dayStats, computeStreak, lastNDays } from './stats.js';
import { playBeep, currentHHMM } from './reminder.js';

const { getCurrentWindow } = window.__TAURI__.window;
const { LogicalSize } = window.__TAURI__.dpi;

const appWindow = getCurrentWindow();

const els = {
  dateLabel: document.getElementById('date-label'),
  weekdayLabel: document.getElementById('weekday-label'),
  progressText: document.getElementById('progress-text'),
  progressFill: document.getElementById('progress-fill'),
  streak: document.getElementById('streak'),
  taskList: document.getElementById('task-list'),
  emptyHint: document.getElementById('empty-hint'),
  historyBars: document.getElementById('history-bars'),
  inputTitle: document.getElementById('input-title'),
  inputStart: document.getElementById('input-start'),
  inputEnd: document.getElementById('input-end'),
  btnAdd: document.getElementById('btn-add'),
  btnCollapse: document.getElementById('btn-collapse'),
  btnClose: document.getElementById('btn-close'),
  toast: document.getElementById('toast'),
};

const WIDTH = 380;
const FULL_H = 560;
const COLLAPSED_H = 120;

let state = loadState();
let collapsed = false;
let editingId = null;

function render() {
  const now = new Date();
  const key = todayKey(now);

  els.dateLabel.textContent = formatDateCN(now);
  els.weekdayLabel.textContent = weekdayCN(now);

  const tasks = getTasks(state, key);
  const stats = dayStats(tasks);
  els.progressText.textContent = `今日 ${stats.done}/${stats.total}`;
  els.progressFill.style.width = stats.pct + '%';

  const streak = computeStreak(state, key);
  els.streak.textContent = streak > 0 ? `连续打卡 ${streak} 天` : '';

  renderTasks(tasks, key, now);
  renderHistory(key);
}

function renderTasks(tasks, key, now) {
  els.taskList.innerHTML = '';
  els.emptyHint.style.display = tasks.length ? 'none' : 'block';

  const sorted = [...tasks].sort((a, b) => {
    if (a.start && b.start) return a.start < b.start ? -1 : 1;
    if (a.start) return -1;
    if (b.start) return 1;
    return 0;
  });

  const hhmm = currentHHMM(now);

  for (const t of sorted) {
    const li = document.createElement('li');
    li.className = 'task' + (t.done ? ' done' : '');
    li.dataset.id = t.id;

    if (editingId === t.id) {
      li.appendChild(renderEditForm(t));
      els.taskList.appendChild(li);
      continue;
    }

    const check = document.createElement('button');
    check.className = 'check';
    check.textContent = '✓';
    check.title = '标记完成';
    check.addEventListener('click', () => toggleTask(key, t.id));

    const body = document.createElement('div');
    body.className = 'task-body';
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = t.title;
    body.appendChild(title);
    if (t.start) {
      const time = document.createElement('div');
      time.className = 'task-time' + (isOverdue(t, hhmm) ? ' overdue' : '');
      time.textContent = t.end ? `${t.start} - ${t.end}` : t.start;
      body.appendChild(time);
    }

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.textContent = '✎';
    editBtn.title = '编辑';
    editBtn.addEventListener('click', () => {
      editingId = t.id;
      render();
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn del';
    delBtn.textContent = '✕';
    delBtn.title = '删除';
    delBtn.addEventListener('click', () => {
      removeTask(state, key, t.id);
      render();
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(check);
    li.appendChild(body);
    li.appendChild(actions);
    els.taskList.appendChild(li);
  }
}

function isOverdue(task, hhmm) {
  return !!task.start && !task.done && task.start < hhmm;
}

function renderEditForm(task) {
  const form = document.createElement('div');
  form.className = 'edit-form';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = task.title;
  titleInput.placeholder = '任务名称';

  const timeRow = document.createElement('div');
  timeRow.className = 'edit-actions';
  const startInput = document.createElement('input');
  startInput.type = 'time';
  startInput.value = task.start || '';
  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.value = task.end || '';
  timeRow.appendChild(startInput);
  timeRow.appendChild(endInput);

  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.addEventListener('click', () =>
    saveEdit(task.id, titleInput.value, startInput.value, endInput.value)
  );
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.addEventListener('click', () => {
    editingId = null;
    render();
  });
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  form.appendChild(titleInput);
  form.appendChild(timeRow);
  form.appendChild(actions);
  return form;
}

function saveEdit(id, title, start, end) {
  const key = todayKey();
  const t = title.trim();
  if (!t) {
    editingId = null;
    render();
    return;
  }
  updateTask(state, key, id, { title: t, start: start || null, end: end || null });
  editingId = null;
  render();
}

function toggleTask(key, id) {
  const t = getTasks(state, key).find((x) => x.id === id);
  if (t) updateTask(state, key, id, { done: !t.done });
  render();
}

function renderHistory(key) {
  els.historyBars.innerHTML = '';
  for (const d of lastNDays(state, key, 7)) {
    const col = document.createElement('div');
    col.className = 'history-bar' + (d.isToday ? ' today' : '');

    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.height = d.total ? d.pct + '%' : '0%';
    bar.appendChild(fill);

    const day = document.createElement('span');
    day.className = 'day';
    day.textContent = d.day;

    col.appendChild(bar);
    col.appendChild(day);
    els.historyBars.appendChild(col);
  }
}

function addFromInput() {
  const title = els.inputTitle.value.trim();
  if (!title) return;
  const key = todayKey();
  addTask(state, key, {
    id: uid(),
    title,
    start: els.inputStart.value || null,
    end: els.inputEnd.value || null,
    done: false,
    createdAt: Date.now(),
  });
  els.inputTitle.value = '';
  els.inputStart.value = '';
  els.inputEnd.value = '';
  els.inputTitle.focus();
  render();
}

function checkReminders() {
  const now = new Date();
  const key = todayKey(now);
  const hhmm = currentHHMM(now);
  const tasks = getTasks(state, key);
  let triggered = false;
  for (const t of tasks) {
    if (t.done || !t.start || t.start !== hhmm) continue;
    if (isReminded(state, key, t.id)) continue;
    markReminded(state, key, t.id);
    showToast(`该开始啦：${t.title}`);
    triggered = true;
  }
  if (triggered) playBeep();
}

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 6000);
}

async function toggleCollapse() {
  collapsed = !collapsed;
  els.btnCollapse.textContent = collapsed ? '▴' : '▾';
  document.body.classList.toggle('collapsed', collapsed);
  try {
    await appWindow.setSize(new LogicalSize(WIDTH, collapsed ? COLLAPSED_H : FULL_H));
  } catch (e) {}
}

function bindEvents() {
  els.btnAdd.addEventListener('click', addFromInput);
  els.inputTitle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addFromInput();
  });
  els.btnCollapse.addEventListener('click', toggleCollapse);
  els.btnClose.addEventListener('click', async () => {
    try {
      await appWindow.close();
    } catch (e) {}
  });
}

function init() {
  bindEvents();
  render();
  checkReminders();
  setInterval(() => {
    checkReminders();
    if (editingId === null) render();
  }, 30000);
}

init();
