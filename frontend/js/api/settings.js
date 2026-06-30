import { api } from './client.js';

export const settings = {
  get() {
    return api.get('/api/settings');
  },

  save(patch) {
    return api.put('/api/settings', patch);
  },
};
