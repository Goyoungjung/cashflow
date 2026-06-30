const router = require('express').Router();
const auth = require('../middleware/auth');
const supabase = require('../config/supabase');

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });

router.use(auth);

// 설정 조회 (없으면 기본값 반환)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  return ok(res, data ?? { budget_alert_on: true, auto_reflect: true });
});

// 설정 저장 (upsert)
router.put('/', async (req, res) => {
  const allowed = ['budget_alert_on', 'auto_reflect'];
  const updates = { user_id: req.user.id, updated_at: new Date().toISOString() };
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(updates, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) return fail(res, 'DB_ERROR', error.message, 500);
  return ok(res, data);
});

module.exports = router;
