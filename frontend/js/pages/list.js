import { transactions } from '../api/index.js';
import { getState, setState } from '../store.js';

export async function loadList(filter = 'all') {
  const { year, month } = getState();
  setState({ loading: true, error: null });

  const params = { year, month };
  if (filter === 'income') params.type = 'INCOME';
  if (filter === 'expense') params.type = 'EXPENSE';

  const data = await transactions.list(params).catch((e) => {
    setState({ loading: false, error: e.message });
    return null;
  });
  if (!data) return;
  setState({ transactions: data, loading: false });
}

export async function loadMore() {
  const { year, month, transactions: prev } = getState();
  if (!prev.has_more) return;

  const data = await transactions.list({ year, month, cursor: prev.next_cursor });
  setState((s) => ({
    transactions: {
      items: [...s.transactions.items, ...data.items],
      next_cursor: data.next_cursor,
      has_more: data.has_more,
    },
  }));
}

export function groupByDate(items) {
  const map = {};
  for (const tx of items) {
    const key = tx.transaction_date;
    if (!map[key]) map[key] = [];
    map[key].push(tx);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, items: list }));
}

export async function deleteTransaction(id) {
  await transactions.remove(id);
  setState((s) => ({
    transactions: {
      ...s.transactions,
      items: s.transactions.items.filter((t) => t.id !== id),
    },
  }));
}
