const listeners = new Set();
let state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  tab: 'home',
  theme: localStorage.getItem('cf_theme') ?? 'light',

  // 서버 데이터
  summary: null,
  calendar: {},
  transactions: { items: [], next_cursor: null, has_more: false },
  categoryStats: [],
  cardStats: [],
  monthlyStats: [],
  cards: [],
  fixedExpenses: [],
  userSettings: { budget_alert_on: true, auto_reflect: true },

  // UI 임시 상태
  loading: false,
  error: null,
};

export function getState() { return state; }

export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
