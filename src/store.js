const KEY = 'plantool-data-v1';

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateCN(date = new Date()) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function weekdayCN(date = new Date()) {
  return `周${WEEKDAYS[date.getDay()]}`;
}

export function dateFromKey(key) {
  return new Date(key + 'T00:00:00');
}

export function addDaysToKey(key, delta) {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + delta);
  return todayKey(d);
}

export function diffDaysFromToday(key) {
  const a = dateFromKey(todayKey()).getTime();
  const b = dateFromKey(key).getTime();
  return Math.round((b - a) / 86400000);
}

export function relativeDayCN(key) {
  const diff = diffDaysFromToday(key);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  return diff > 0 ? `${diff} 天后` : `${-diff} 天前`;
}

function emptyState() {
  return { version: 1, tasks: {}, reminded: {} };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.tasks) return { ...emptyState(), ...s };
    }
  } catch (e) {}
  return emptyState();
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getTasks(state, key) {
  return state.tasks[key] || [];
}

function setTasks(state, key, tasks) {
  state.tasks[key] = tasks;
  saveState(state);
}

export function addTask(state, key, task) {
  const tasks = getTasks(state, key).slice();
  tasks.push(task);
  setTasks(state, key, tasks);
}

export function updateTask(state, key, id, patch) {
  const tasks = getTasks(state, key).map((t) => (t.id === id ? { ...t, ...patch } : t));
  setTasks(state, key, tasks);
}

export function removeTask(state, key, id) {
  setTasks(
    state,
    key,
    getTasks(state, key).filter((t) => t.id !== id)
  );
}

export function moveTask(state, fromKey, toKey, id, patch = {}) {
  const task = getTasks(state, fromKey).find((t) => t.id === id);
  if (!task) return;
  removeTask(state, fromKey, id);
  addTask(state, toKey, { ...task, ...patch });
}

export function isReminded(state, key, id) {
  return (state.reminded[key] || []).includes(id);
}

export function markReminded(state, key, id) {
  if (!state.reminded[key]) state.reminded[key] = [];
  if (!state.reminded[key].includes(id)) {
    state.reminded[key].push(id);
    saveState(state);
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
