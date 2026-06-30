import { cards } from '../api/index.js';
import { getState, setState } from '../store.js';

export async function loadCards() {
  const { year, month } = getState();
  setState({ loading: true, error: null });

  const data = await cards.list(year, month).catch((e) => {
    setState({ loading: false, error: e.message });
    return null;
  });
  if (!data) return;
  setState({ cards: data, loading: false });
}

export async function addCard({ name, issuer, color_code }) {
  const data = await cards.create({ name, issuer, color_code });
  setState((s) => ({ cards: [...s.cards, data] }));
  return data;
}

export async function deleteCard(id) {
  await cards.remove(id);
  setState((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
}
