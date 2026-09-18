import { todayKey } from './store.js';

export function dayStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function computeStreak(state, todayStr) {
  const d = new Date(todayStr + 'T00:00:00');
  const todayTasks = state.tasks[todayStr] || [];
  const todayComplete = todayTasks.length > 0 && todayTasks.every((t) => t.done);
  if (!todayComplete) d.setDate(d.getDate() - 1);

  let streak = 0;
  while (true) {
    const key = todayKey(d);
    const tasks = state.tasks[key] || [];
    if (tasks.length > 0 && tasks.every((t) => t.done)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function lastNDays(state, todayStr, n = 7) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(todayStr + 'T00:00:00');
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const tasks = state.tasks[key] || [];
    const s = dayStats(tasks);
    out.push({ key, pct: s.pct, total: s.total, done: s.done, day: d.getDate(), isToday: key === todayStr });
  }
  return out;
}
