const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../config/supabase');

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });

router.use(auth);

router.get('/category', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return fail(res, 'INVALID_PARAMS', 'year, month가 필요합니다.');

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('transactions')
    .select('category, amount')
    .eq('user_id', req.user.id)
    .eq('type', 'EXPENSE')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);
  if (error) return fail(res, 'DB_ERROR', error.message, 500);

  const map = {};
  for (const tx of data) {
    map[tx.category] = (map[tx.category] || 0) + Number(tx.amount);
  }
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  const result = Object.entries(map)
    .map(([category, amount]) => ({
      category,
      total: amount,
      rate: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
  return ok(res, result);
});

router.get('/card', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return fail(res, 'INVALID_PARAMS', 'year, month가 필요합니다.');

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, card_id, cards(id, name, issuer)')
    .eq('user_id', req.user.id)
    .eq('type', 'EXPENSE')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);
  if (error) return fail(res, 'DB_ERROR', error.message, 500);

  const map = {};
  for (const tx of data) {
    const key = tx.card_id || 'CASH';
    if (!map[key]) {
      map[key] = {
        card_id: tx.card_id,
        card_name: tx.cards?.name || '현금/기타',
        issuer: tx.cards?.issuer || 'CASH',
        total: 0,
      };
    }
    map[key].total += Number(tx.amount);
  }
  return ok(res, Object.values(map).sort((a, b) => b.total - a.total));
});

router.get('/monthly', async (req, res) => {
  const months = req.query.months ? Number(req.query.months) : 6;
  const now = new Date();

  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const startDate = `${buckets[0].year}-${String(buckets[0].month).padStart(2, '0')}-01`;
  const last = buckets[buckets.length - 1];
  const endDate = new Date(last.year, last.month, 0).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, transaction_date')
    .eq('user_id', req.user.id)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);
  if (error) return fail(res, 'DB_ERROR', error.message, 500);

  const map = {};
  for (const { year, month } of buckets) {
    map[`${year}-${month}`] = { year, month, income: 0, expense: 0 };
  }
  for (const tx of data || []) {
    const d = new Date(tx.transaction_date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!map[key]) continue;
    if (tx.type === 'INCOME') map[key].income += Number(tx.amount);
    else map[key].expense += Number(tx.amount);
  }

  const result = buckets.map(({ year, month }) => {
    const e = map[`${year}-${month}`];
    return { year, month, income: e.income, expense: e.expense, net: e.income - e.expense };
  });
  return ok(res, result);
});

module.exports = router;
