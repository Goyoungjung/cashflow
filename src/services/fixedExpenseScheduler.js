const cron = require('node-cron');
const supabase = require('../config/supabase');

async function applyForAllUsers(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
  const lastDay = new Date(year, month, 0).getDate();

  const { data: activeList, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;

  // auto_reflect=false 인 사용자 제외 (설정 없으면 기본 true)
  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id, auto_reflect')
    .eq('auto_reflect', false);
  const optedOut = new Set((settings || []).map((s) => s.user_id));

  const { data: alreadyApplied } = await supabase
    .from('transactions')
    .select('fixed_expense_id, user_id')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .not('fixed_expense_id', 'is', null);

  const appliedSet = new Set(
    (alreadyApplied || []).map((t) => `${t.user_id}:${t.fixed_expense_id}`)
  );

  const toInsert = activeList
    .filter((fe) => !appliedSet.has(`${fe.user_id}:${fe.id}`) && !optedOut.has(fe.user_id))
    .map((fe) => ({
      user_id: fe.user_id,
      type: 'EXPENSE',
      amount: fe.amount,
      transaction_date: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(fe.billing_day, lastDay)).padStart(2, '0')}`,
      category: fe.category,
      card_id: fe.card_id || null,
      memo: `[고정] ${fe.name}`,
      is_fixed: true,
      fixed_expense_id: fe.id,
    }));

  if (toInsert.length === 0) return 0;

  const { data: inserted, error: insertErr } = await supabase
    .from('transactions')
    .insert(toInsert)
    .select();
  if (insertErr) throw insertErr;
  return inserted.length;
}

function startScheduler() {
  // KST 1일 00:00 = UTC 전월 말일 15:00 → '0 15 28-31 * *' + 말일 여부 체크
  cron.schedule('0 15 28-31 * *', async () => {
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    if (kstNow.getUTCDate() !== 1) return; // 실제 KST 1일에만 실행
    const year = kstNow.getUTCFullYear();
    const month = kstNow.getUTCMonth() + 1;
    try {
      const count = await applyForAllUsers(year, month);
      console.log(`[Scheduler] ${year}-${month} 고정지출 ${count}건 반영 완료`);
    } catch (err) {
      console.error('[Scheduler] 고정지출 자동반영 오류:', err.message);
    }
  });
  console.log('[Scheduler] 고정지출 자동반영 등록 (매월 1일 00:00 KST)');
}

module.exports = { startScheduler, applyForAllUsers };
