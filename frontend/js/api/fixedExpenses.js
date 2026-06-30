import { api } from './client.js';

export const fixedExpenses = {
  list() {
    return api.get('/api/fixed-expenses');
  },

  create({ name, amount, card_id, category, billing_day, is_active = true }) {
    return api.post('/api/fixed-expenses', { name, amount, card_id: card_id ?? null, category, billing_day, is_active });
  },

  update(id, patch) {
    return api.put(`/api/fixed-expenses/${id}`, patch);
  },

  remove(id) {
    return api.delete(`/api/fixed-expenses/${id}`);
  },

  apply(year, month) {
    return api.post(`/api/fixed-expenses/apply?year=${year}&month=${month}`);
  },
};
