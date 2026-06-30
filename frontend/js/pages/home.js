import { budgets, transactions } from '../api/index.js';
import { getState, setState } from '../store.js';

export async function loadHome() {
  const { year, month } = getState();
  setState({ loading: true, error: null });

  const [summary, calendar] = await Promise.all([
    budgets.summary(year, month),
    transactions.calendar(year, month),
  ]).catch((e) => { setState({ loading: false, error: e.message }); return []; });

  if (!summary) return;
  setState({ summary, calendar, loading: false });
}

export function renderKpis(summary) {
  return [
    { label: '이번 달 수입', value: summary.total_income, color: 'var(--income)' },
    { label: '이번 달 지출', value: summary.total_expense, color: 'var(--expense)' },
    { label: '순수익', value: summary.total_income - summary.total_expense, color: 'var(--text)' },
    { label: '예산 잔액', value: summary.remaining, color: summary.remaining >= 0 ? 'var(--income)' : 'var(--expense)' },
  ];
}

export function renderBudgetRing(summary) {
  const pct = Math.min(summary.used_rate, 100);
  const circumference = 2 * Math.PI * 58;
  const dashArray = `${(pct / 100) * circumference} ${circumference}`;
  const color = pct >= 90 ? 'var(--expense)' : pct >= 70 ? 'var(--warn)' : 'var(--blue)';
  return { pct, dashArray, color };
}
