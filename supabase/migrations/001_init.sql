-- 카드/결제수단
CREATE TABLE cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  color_code TEXT DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 예산
CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- 카테고리별 예산 (선택)
CREATE TABLE category_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE(budget_id, category)
);

-- 거래 내역
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  amount DECIMAL(12,2) NOT NULL,
  transaction_date DATE NOT NULL,
  category TEXT NOT NULL,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  memo TEXT,
  is_fixed BOOLEAN DEFAULT false,
  fixed_expense_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 고정지출
CREATE TABLE fixed_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'OTHER',
  billing_day INT NOT NULL CHECK (billing_day BETWEEN 1 AND 31),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 데이터만 접근
CREATE POLICY "users_own_cards" ON cards
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_budgets" ON budgets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_fixed_expenses" ON fixed_expenses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_category_budgets" ON category_budgets
  FOR ALL USING (
    budget_id IN (SELECT id FROM budgets WHERE user_id = auth.uid())
  );

-- 인덱스
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date);
CREATE INDEX idx_transactions_cursor ON transactions(user_id, created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER fixed_expenses_updated_at BEFORE UPDATE ON fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- pg_cron: 매월 1일 00:00 KST(= 전날 15:00 UTC) 고정지출 자동반영
-- Supabase 대시보드 → Database → Extensions 에서 pg_cron 활성화 후 실행
-- SELECT cron.schedule(
--   'apply-fixed-expenses-monthly',
--   '0 15 28-31 * *',
--   $$
--     INSERT INTO transactions (user_id, type, amount, transaction_date, category, card_id, memo, is_fixed, fixed_expense_id)
--     SELECT
--       fe.user_id,
--       'EXPENSE',
--       fe.amount,
--       DATE_TRUNC('month', NOW() + INTERVAL '9 hours')::DATE
--         + LEAST(fe.billing_day - 1,
--                 DATE_PART('days', DATE_TRUNC('month', NOW() + INTERVAL '9 hours')
--                   + INTERVAL '1 month' - INTERVAL '1 day')::INT - 1
--               ),
--       fe.category,
--       fe.card_id,
--       '[고정] ' || fe.name,
--       true,
--       fe.id
--     FROM fixed_expenses fe
--     WHERE fe.is_active = true
--       AND DATE_PART('day', NOW() AT TIME ZONE 'Asia/Seoul') = 1
--       AND NOT EXISTS (
--         SELECT 1 FROM transactions t
--         WHERE t.fixed_expense_id = fe.id
--           AND DATE_TRUNC('month', t.transaction_date) =
--               DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Seoul')
--       );
--   $$
-- );
