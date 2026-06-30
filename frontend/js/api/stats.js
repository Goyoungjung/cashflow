import { api } from './client.js';

export const stats = {
  category(year, month) {
    return api.get(`/api/stats/category?year=${year}&month=${month}`);
  },

  card(year, month) {
    return api.get(`/api/stats/card?year=${year}&month=${month}`);
  },

  monthly(months = 6) {
    return api.get(`/api/stats/monthly?months=${months}`);
  },
};
