import { api } from './client.js';

export const cards = {
  list(year, month) {
    const q = year && month ? `?year=${year}&month=${month}` : '';
    return api.get(`/api/cards${q}`);
  },

  create({ name, issuer, color_code }) {
    return api.post('/api/cards', { name, issuer, color_code });
  },

  update(id, patch) {
    return api.put(`/api/cards/${id}`, patch);
  },

  remove(id) {
    return api.delete(`/api/cards/${id}`);
  },
};
