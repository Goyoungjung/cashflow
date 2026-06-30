import { api } from './client.js';

export const budgets = {
  get(year, month) {
    return api.get(`/api/budgets?year=${year}&month=${month}`);
  },

  summary(year, month) {
    return api.get(`/api/budgets/summary?year=${year}&month=${month}`);
  },

  save(year, month, total_amount, category_budgets = []) {
    return api.post('/api/budgets', { year, month, total_amount, category_budgets });
  },
};
