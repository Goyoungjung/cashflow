const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../config/supabase');

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });

router.use(auth);

// 캘린더 뷰 (/calendar를 /:id보다 먼저 등록)
router.get('/calendar', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return fail(res, 'INVALID_PARAMS', 'year, month가 필요합니다.');

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, transaction_date')
    .eq('user_id', req.user.id)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);
  if (error) return fail(res, 'DB_ERROR', error.message, 500);

  const result = {};
  for (const tx of data) {
    const key = tx.transaction_date;
    if (!result[key]) result[key] = { income: 0, expense: 0 };
    if (tx.type === 'INCOME') result[key].income += Number(tx.amount);
    else result[key].expense += Number(tx.amount);
  }
  return ok(res, result);
});

// 목록 조회 (cursor 페이징)
router.get('/', async (req, res) => {
  const { year, month, type, card_id, category, cursor, limit = 20 } = req.query;

  let query = supabase
    .from('transactions')
    .select('*, cards(id, name, issuer, color_code)', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(Number(limit) + 1);

  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
    query = query.gte('transaction_date', startDate).lte('transaction_date', endDate);
  }
  if (type) query = query.eq('type', type);
  if (card_id) query = query.eq('card_id', card_id);
  if (category) query = query.eq('category', category);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) return fail(res, 'DB_ERROR', error.message, 500);

  const hasMore = data.length > Number(limit);
  const items = hasMore ? data.slice(0, Number(limit)) : data;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return ok(res, { items, next_cursor: nextCursor, has_more: hasMore });
});

// 등록
router.post('/', async (req, res) => {
  const { type, amount, transaction_date, category, card_id, memo, is_fixed, fixed_expense_id } = req.body;
  if (!type || !amount || !transaction_date || !category)
    return fail(res, 'INVALID_PARAMS', 'type, amount, transaction_date, category는 필수입니다.');

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: req.user.id,
      type, amount, transaction_date, category,
      card_id: card_id || null,
      memo: memo || null,
      is_fixed: is_fixed || false,
      fixed_expense_id: fixed_expense_id || null,
    })
    .select('*, cards(id, name, issuer, color_code)')
    .single();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  return res.status(201).json({ success: true, data });
});

// 수정
router.put('/:id', async (req, res) => {
  const { type, amount, transaction_date, category, card_id, memo, is_fixed } = req.body;
  const updates = {};
  if (type !== undefined) updates.type = type;
  if (amount !== undefined) updates.amount = amount;
  if (transaction_date !== undefined) updates.transaction_date = transaction_date;
  if (category !== undefined) updates.category = category;
  if (card_id !== undefined) updates.card_id = card_id || null;
  if (memo !== undefined) updates.memo = memo;
  if (is_fixed !== undefined) updates.is_fixed = is_fixed;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('*, cards(id, name, issuer, color_code)')
    .single();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  if (!data) return fail(res, 'NOT_FOUND', '거래 내역을 찾을 수 없습니다.', 404);
  return ok(res, data);
});

// 삭제
router.delete('/:id', async (req, res) => {
  const { error, count } = await supabase
    .from('transactions')
    .delete({ count: 'exact' })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  if (count === 0) return fail(res, 'NOT_FOUND', '거래 내역을 찾을 수 없습니다.', 404);
  return ok(res, null);
});

module.exports = router;
