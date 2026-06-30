const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../config/supabase');
const { getSummary } = require('../services/budgetService');

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });

router.use(auth);

router.get('/', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return fail(res, 'INVALID_PARAMS', 'year, month가 필요합니다.');
  const { data, error } = await supabase
    .from('budgets')
    .select('*, category_budgets(*)')
    .eq('user_id', req.user.id)
    .eq('year', Number(year))
    .eq('month', Number(month))
    .maybeSingle();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  return ok(res, data);
});

router.post('/', async (req, res) => {
  const { year, month, total_amount, category_budgets } = req.body;
  if (!year || !month || total_amount === undefined)
    return fail(res, 'INVALID_PARAMS', 'year, month, total_amount가 필요합니다.');

  const { data: budget, error: upsertErr } = await supabase
    .from('budgets')
    .upsert(
      { user_id: req.user.id, year, month, total_amount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,year,month' }
    )
    .select()
    .single();
  if (upsertErr) return fail(res, 'DB_ERROR', upsertErr.message, 500);

  if (Array.isArray(category_budgets) && category_budgets.length > 0) {
    const rows = category_budgets.map((cb) => ({
      budget_id: budget.id,
      category: cb.category,
      amount: cb.amount,
    }));
    const { error: cbErr } = await supabase
      .from('category_budgets')
      .upsert(rows, { onConflict: 'budget_id,category' });
    if (cbErr) return fail(res, 'DB_ERROR', cbErr.message, 500);
  }

  const { data: result, error: fetchErr } = await supabase
    .from('budgets')
    .select('*, category_budgets(*)')
    .eq('id', budget.id)
    .single();
  if (fetchErr) return fail(res, 'DB_ERROR', fetchErr.message, 500);
  return res.status(201).json({ success: true, data: result });
});

router.get('/summary', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return fail(res, 'INVALID_PARAMS', 'year, month가 필요합니다.');
  try {
    const summary = await getSummary(req.user.id, Number(year), Number(month));
    return ok(res, summary);
  } catch (err) {
    return fail(res, 'SUMMARY_FAILED', err.message, 500);
  }
});

module.exports = router;
