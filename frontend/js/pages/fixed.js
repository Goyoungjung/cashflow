import { fixedExpenses, settings } from '../api/index.js';
import { getState, setState } from '../store.js';

export async function loadFixed() {
  setState({ loading: true, error: null });

  const [list, userSettings] = await Promise.all([
    fixedExpenses.list(),
    settings.get(),
  ]).catch((e) => { setState({ loading: false, error: e.message }); return []; });

  if (!list) return;
  setState({ fixedExpenses: list, userSettings, loading: false });
}

export async function toggleAutoReflect(value) {
  const data = await settings.save({ auto_reflect: value });
  setState({ userSettings: data });
}

export async function toggleFixedActive(id, is_active) {
  const updated = await fixedExpenses.update(id, { is_active });
  setState((s) => ({
    fixedExpenses: s.fixedExpenses.map((f) => (f.id === id ? { ...f, ...updated } : f)),
  }));
}

export async function deleteFixed(id) {
  await fixedExpenses.remove(id);
  setState((s) => ({ fixedExpenses: s.fixedExpenses.filter((f) => f.id !== id) }));
}

export async function applyThisMonth() {
  const { year, month } = getState();
  return fixedExpenses.apply(year, month);
}
