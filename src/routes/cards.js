const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../config/supabase');

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });

router.use(auth);

router.get('/', async (req, res) => {
  const { year, month } = req.query;

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: true });
  if (error) return fail(res, 'DB_ERROR', error.message, 500);

  if (!year || !month) return ok(res, data);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
  const { data: txRows } = await supabase
    .from('transactions')
    .select('card_id, amount')
    .eq('user_id', req.user.id)
    .eq('type', 'EXPENSE')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .not('card_id', 'is', null);

  const spendMap = {};
  for (const tx of txRows || []) {
    spendMap[tx.card_id] = (spendMap[tx.card_id] || 0) + Number(tx.amount);
  }
  return ok(res, data.map((c) => ({ ...c, monthly_expense: spendMap[c.id] || 0 })));
});

router.post('/', async (req, res) => {
  const { name, issuer, color_code } = req.body;
  if (!name || !issuer) return fail(res, 'INVALID_PARAMS', 'name, issuer는 필수입니다.');
  const { data, error } = await supabase
    .from('cards')
    .insert({ user_id: req.user.id, name, issuer, color_code })
    .select()
    .single();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  return res.status(201).json({ success: true, data });
});

router.put('/:id', async (req, res) => {
  const { name, issuer, color_code, is_active } = req.body;
  const { data, error } = await supabase
    .from('cards')
    .update({ name, issuer, color_code, is_active })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  if (!data) return fail(res, 'NOT_FOUND', '카드를 찾을 수 없습니다.', 404);
  return ok(res, data);
});

router.delete('/:id', async (req, res) => {
  const { error, count } = await supabase
    .from('cards')
    .delete({ count: 'exact' })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  if (count === 0) return fail(res, 'NOT_FOUND', '카드를 찾을 수 없습니다.', 404);
  return ok(res, null);
});

module.exports = router;
