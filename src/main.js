import {
  loadState,
  getTasks,
  addTask,
  updateTask,
  removeTask,
  moveTask,
  isReminded,
  markReminded,
  uid,
  todayKey,
  formatDateCN,
  weekdayCN,
  dateFromKey,
  addDaysToKey,
  relativeDayCN,
} from './store.js';
import { dayStats, computeStreak, lastNDays } from './stats.js';
import { playBeep, currentHHMM } from './reminder.js';

const { getCurrentWindow } = window.__TAURI__.window;
const { LogicalSize } = window.__TAURI__.dpi;

const appWindow = getCurrentWindow();

const els = {
  dateLabel: document.getElementById('date-label'),
  weekdayLabel: document.getElementById('weekday-label'),
  btnPrevDay: document.getElementById('btn-prev-day'),
  btnNextDay: document.getElementById('btn-next-day'),
  btnToday: document.getElementById('btn-today'),
  progressText: document.getElementById('progress-text'),
  progressFill: document.getElementById('progress-fill'),
  streak: document.getElementById('streak'),
  taskList: document.getElementById('task-list'),
  emptyHint: document.getElementById('empty-hint'),
  collapsedTasks: document.getElementById('collapsed-tasks'),
  historyBars: document.getElementById('history-bars'),
  btnAllPlans: document.getElementById('btn-all-plans'),
  allPlans: document.getElementById('all-plans'),
  allPlansBody: document.getElementById('all-plans-body'),
  btnAllClose: document.getElementById('btn-all-close'),
  inputTitle: document.getElementById('input-title'),
  inputDate: document.getElementById('input-date'),
  inputStart: document.getElementById('input-start'),
  inputEnd: document.getElementById('input-end'),
  btnAdd: document.getElementById('btn-add'),
  btnCollapse: document.getElementById('btn-collapse'),
  btnClose: document.getElementById('btn-close'),
  toast: document.getElementById('toast'),
};

const WIDTH = 380;
const FULL_H = 600;
const COLLAPSED_H = 150;

let state = loadState();
let collapsed = false;
let editingId = null;
let selectedKey = todayKey();

function isViewingToday() {
  return selectedKey === todayKey();
}

function render() {
  const now = new Date();
  const viewDate = dateFromKey(selectedKey);

  els.dateLabel.textContent = formatDateCN(viewDate);
  els.weekdayLabel.textContent = `${weekdayCN(viewDate)} · ${relativeDayCN(selectedKey)}`;
  els.btnToday.hidden = isViewingToday();
  els.inputDate.value = selectedKey;

  const tasks = getTasks(state, selectedKey);
  const stats = dayStats(tasks);
  els.progressText.textContent = `${relativeDayCN(selectedKey)} ${stats.done}/${stats.total}`;
  els.progressFill.style.width = stats.pct + '%';

  const streak = computeStreak(state, todayKey(now));
  els.streak.textContent = streak > 0 ? `连续打卡 ${streak} 天` : '';

  renderTasks(tasks, now);
  renderCollapsed(tasks, now);
  renderHistory(todayKey(now));
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.start && b.start) return a.start < b.start ? -1 : 1;
    if (a.start) return -1;
    if (b.start) return 1;
    return 0;
  });
}

function renderCollapsed(tasks, now) {
  els.collapsedTasks.innerHTML = '';

  if (!tasks.length) {
    const hint = document.createElement('div');
    hint.className = 'cv-empty';
    hint.textContent = `${relativeDayCN(selectedKey)}还没有计划`;
    els.collapsedTasks.appendChild(hint);
    return;
  }

  const hhmm = currentHHMM(now);
  for (const t of sortTasks(tasks)) {
    const row = document.createElement('div');
    row.className = 'cv-row' + (t.done ? ' done' : '');

    const check = document.createElement('button');
    check.className = 'cv-check';
    check.textContent = '✓';
    check.title = '标记完成';
    check.addEventListener('click', () => toggleTask(selectedKey, t.id));

    row.appendChild(check);
    if (t.start) {
      const time = document.createElement('span');
      time.className = 'cv-time' + (isOverdue(t, hhmm) ? ' overdue' : '');
      time.textContent = t.start;
      row.appendChild(time);
    }

    const title = document.createElement('span');
    title.className = 'cv-title';
    title.textContent = t.title;
    row.appendChild(title);

    els.collapsedTasks.appendChild(row);
  }
}

function renderTasks(tasks, now) {
  els.taskList.innerHTML = '';
  els.emptyHint.textContent = `${relativeDayCN(selectedKey)}还没有计划，添加一个吧`;
  els.emptyHint.style.display = tasks.length ? 'none' : 'block';

  const sorted = sortTasks(tasks);
  const hhmm = currentHHMM(now);
  const viewToday = isViewingToday();

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
    check.addEventListener('click', () => toggleTask(selectedKey, t.id));

    const body = document.createElement('div');
    body.className = 'task-body';
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = t.title;
    body.appendChild(title);
    if (t.start) {
      const time = document.createElement('div');
      time.className = 'task-time' + (viewToday && isOverdue(t, hhmm) ? ' overdue' : '');
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
      removeTask(state, selectedKey, t.id);
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

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = selectedKey;
  dateInput.title = '计划日期';

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
    saveEdit(task.id, titleInput.value, dateInput.value, startInput.value, endInput.value)
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
  form.appendChild(dateInput);
  form.appendChild(timeRow);
  form.appendChild(actions);
  return form;
}

function saveEdit(id, title, dateKey, start, end) {
  const t = title.trim();
  if (!t) {
    editingId = null;
    render();
    return;
  }
  const toKey = dateKey || selectedKey;
  if (toKey !== selectedKey) {
    moveTask(state, selectedKey, toKey, id, { title: t, start: start || null, end: end || null });
    selectedKey = toKey;
  } else {
    updateTask(state, selectedKey, id, { title: t, start: start || null, end: end || null });
  }
  editingId = null;
  render();
}

function toggleTask(key, id) {
  const t = getTasks(state, key).find((x) => x.id === id);
  if (t) updateTask(state, key, id, { done: !t.done });
  render();
  if (!els.allPlans.hidden) renderAllPlans();
}

function renderHistory(todayStr) {
  els.historyBars.innerHTML = '';
  for (const d of lastNDays(state, todayStr, 7)) {
    const col = document.createElement('div');
    col.className = 'history-bar' + (d.isToday ? ' today' : '');

    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.title = `${d.key}：完成 ${d.done}/${d.total}`;
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.height = d.total ? d.pct + '%' : '0%';
    bar.appendChild(fill);

    const day = document.createElement('span');
    day.className = 'day';
    day.textContent = d.day;

    col.appendChild(bar);
    col.appendChild(day);
    col.addEventListener('click', () => {
      selectedKey = d.key;
      editingId = null;
      render();
    });

    els.historyBars.appendChild(col);
  }
}

function renderAllPlans() {
  els.allPlansBody.innerHTML = '';
  const keys = Object.keys(state.tasks)
    .filter((k) => (state.tasks[k] || []).length > 0)
    .sort();
  const now = new Date();
  const hhmm = currentHHMM(now);

  if (!keys.length) {
    const empty = document.createElement('div');
    empty.className = 'ov-empty';
    empty.textContent = '还没有任何计划';
    els.allPlansBody.appendChild(empty);
    return;
  }

  for (const key of keys) {
    const tasks = getTasks(state, key);
    const stats = dayStats(tasks);
    const viewDate = dateFromKey(key);

    const group = document.createElement('div');
    group.className = 'ov-group';

    const head = document.createElement('div');
    head.className = 'ov-head' + (key === todayKey() ? ' today' : '');

    const title = document.createElement('span');
    title.className = 'ov-date';
    title.textContent = formatDateCN(viewDate);

    const rel = document.createElement('span');
    rel.className = 'ov-rel';
    rel.textContent = relativeDayCN(key);

    const stat = document.createElement('span');
    stat.className = 'ov-stat';
    stat.textContent = `${stats.done}/${stats.total}`;

    head.appendChild(title);
    head.appendChild(rel);
    head.appendChild(stat);
    head.addEventListener('click', () => {
      selectedKey = key;
      editingId = null;
      closeAllPlans();
      render();
    });
    group.appendChild(head);

    for (const t of sortTasks(tasks)) {
      const row = document.createElement('div');
      row.className = 'ov-row' + (t.done ? ' done' : '');

      const check = document.createElement('button');
      check.className = 'cv-check';
      check.textContent = '✓';
      check.title = '标记完成';
      check.addEventListener('click', () => toggleTask(key, t.id));
      row.appendChild(check);

      const titleEl = document.createElement('span');
      titleEl.className = 'ov-title';
      titleEl.textContent = t.title;
      row.appendChild(titleEl);

      if (t.start) {
        const time = document.createElement('span');
        time.className = 'ov-time' + (key === todayKey() && isOverdue(t, hhmm) ? ' overdue' : '');
        time.textContent = t.end ? `${t.start} - ${t.end}` : t.start;
        row.appendChild(time);
      }

      group.appendChild(row);
    }

    els.allPlansBody.appendChild(group);
  }
}

function openAllPlans() {
  renderAllPlans();
  els.allPlans.hidden = false;
}

function closeAllPlans() {
  els.allPlans.hidden = true;
}

function addFromInput() {
  const title = els.inputTitle.value.trim();
  if (!title) return;
  const key = els.inputDate.value || selectedKey;
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

function changeDay(delta) {
  selectedKey = addDaysToKey(selectedKey, delta);
  editingId = null;
  closeAllPlans();
  render();
}

async function toggleCollapse() {
  collapsed = !collapsed;
  els.btnCollapse.textContent = collapsed ? '▴' : '▾';
  document.body.classList.toggle('collapsed', collapsed);
  if (collapsed) closeAllPlans();
  try {
    await appWindow.setSize(new LogicalSize(WIDTH, collapsed ? COLLAPSED_H : FULL_H));
  } catch (e) {}
}

// 窗口内任意非交互区域按下左键即可拖动
function bindWindowDrag() {
  document.body.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, select, textarea, a, .task, .cv-row, .ov-row, .ov-head, .edit-form, .history-bar, .overlay')) return;
    appWindow.startDragging().catch(() => {});
  });
}

function bindEvents() {
  bindWindowDrag();

  els.btnPrevDay.addEventListener('click', () => changeDay(-1));
  els.btnNextDay.addEventListener('click', () => changeDay(1));
  els.btnToday.addEventListener('click', () => {
    selectedKey = todayKey();
    editingId = null;
    render();
  });
  els.inputDate.addEventListener('change', () => {
    if (!els.inputDate.value) return;
    selectedKey = els.inputDate.value;
    editingId = null;
    render();
  });

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

  els.btnAllPlans.addEventListener('click', openAllPlans);
  els.btnAllClose.addEventListener('click', closeAllPlans);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.allPlans.hidden) closeAllPlans();
  });
}

function init() {
  bindEvents();
  render();
  checkReminders();
  setInterval(() => {
    checkReminders();
    if (editingId === null && els.allPlans.hidden) render();
  }, 30000);
}

init();
