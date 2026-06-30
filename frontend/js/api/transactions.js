import { api } from './client.js';

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v != null && p.set(k, v));
  return p.toString() ? `?${p}` : '';
}

export const transactions = {
  list({ year, month, type, card_id, category, cursor, limit } = {}) {
    return api.get(`/api/transactions${qs({ year, month, type, card_id, category, cursor, limit })}`);
  },

  calendar(year, month) {
    return api.get(`/api/transactions/calendar${qs({ year, month })}`);
  },

  create({ type, amount, transaction_date, category, card_id, memo, is_fixed, fixed_expense_id }) {
    return api.post('/api/transactions', {
      type, amount, transaction_date, category,
      card_id: card_id ?? null,
      memo: memo ?? null,
      is_fixed: is_fixed ?? false,
      fixed_expense_id: fixed_expense_id ?? null,
    });
  },

  update(id, patch) {
    return api.put(`/api/transactions/${id}`, patch);
  },

  remove(id) {
    return api.delete(`/api/transactions/${id}`);
  },
};
