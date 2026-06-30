const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../config/supabase');

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });

router.use(auth);

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*, cards(id, name, issuer, color_code)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: true });
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  return ok(res, data);
});

router.post('/', async (req, res) => {
  const { name, amount, card_id, category, billing_day, is_active } = req.body;
  if (!name || !amount || !category || !billing_day)
    return fail(res, 'INVALID_PARAMS', 'name, amount, category, billing_day는 필수입니다.');

  const { data, error } = await supabase
    .from('fixed_expenses')
    .insert({
      user_id: req.user.id, name, amount,
      card_id: card_id || null, category, billing_day,
      is_active: is_active !== undefined ? is_active : true,
    })
    .select('*, cards(id, name, issuer, color_code)')
    .single();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  return res.status(201).json({ success: true, data });
});

router.put('/:id', async (req, res) => {
  const fields = ['name', 'amount', 'card_id', 'category', 'billing_day', 'is_active'];
  const updates = { updated_at: new Date().toISOString() };
  fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const { data, error } = await supabase
    .from('fixed_expenses')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('*, cards(id, name, issuer, color_code)')
    .single();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  if (!data) return fail(res, 'NOT_FOUND', '고정지출을 찾을 수 없습니다.', 404);
  return ok(res, data);
});

router.delete('/:id', async (req, res) => {
  const { error, count } = await supabase
    .from('fixed_expenses')
    .delete({ count: 'exact' })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  if (count === 0) return fail(res, 'NOT_FOUND', '고정지출을 찾을 수 없습니다.', 404);
  return ok(res, null);
});

// 이번 달 미반영 고정지출 일괄 반영
router.post('/apply', async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

  const { data: activeList, error: feErr } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('is_active', true);
  if (feErr) return fail(res, 'DB_ERROR', feErr.message, 500);

  const { data: applied } = await supabase
    .from('transactions')
    .select('fixed_expense_id')
    .eq('user_id', req.user.id)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .not('fixed_expense_id', 'is', null);

  const appliedIds = new Set((applied || []).map((t) => t.fixed_expense_id));
  const lastDay = new Date(year, month, 0).getDate();
  const toInsert = activeList
    .filter((fe) => !appliedIds.has(fe.id))
    .map((fe) => ({
      user_id: req.user.id,
      type: 'EXPENSE',
      amount: fe.amount,
      transaction_date: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(fe.billing_day, lastDay)).padStart(2, '0')}`,
      category: fe.category,
      card_id: fe.card_id || null,
      memo: `[고정] ${fe.name}`,
      is_fixed: true,
      fixed_expense_id: fe.id,
    }));

  if (toInsert.length === 0) return ok(res, { applied: 0, transactions: [] });

  const { data: inserted, error: insertErr } = await supabase
    .from('transactions')
    .insert(toInsert)
    .select();
  if (insertErr) return fail(res, 'DB_ERROR', insertErr.message, 500);
  return ok(res, { applied: inserted.length, transactions: inserted });
});

module.exports = router;
