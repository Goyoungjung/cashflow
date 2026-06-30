import { budgets } from '../api/index.js';
import { getState, setState } from '../store.js';

export async function loadBudget() {
  const { year, month } = getState();
  setState({ loading: true, error: null });

  const data = await budgets.get(year, month).catch((e) => {
    setState({ loading: false, error: e.message });
    return null;
  });
  setState({ summary: data ? { ...getState().summary, ...data } : getState().summary, loading: false });
}

export async function saveBudget(totalAmount, categoryBudgets) {
  const { year, month } = getState();
  const data = await budgets.save(year, month, totalAmount, categoryBudgets);
  setState((s) => ({ summary: { ...s.summary, total_budget: totalAmount } }));
  return data;
}

export function buildCategoryBudgetRows(budgetData, categoryStats) {
  const spendMap = Object.fromEntries((categoryStats ?? []).map((c) => [c.category, c.total]));
  return (budgetData?.category_budgets ?? []).map((cb) => {
    const spent = spendMap[cb.category] ?? 0;
    const pct = cb.amount > 0 ? Math.round((spent / cb.amount) * 100) : 0;
    return { ...cb, spent, pct };
  });
}
