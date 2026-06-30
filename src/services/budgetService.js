const supabase = require('../config/supabase');

async function getSummary(userId, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

  const [{ data: budget }, { data: txRows }] = await Promise.all([
    supabase
      .from('budgets')
      .select('*, category_budgets(*)')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('type, amount, category')
      .eq('user_id', userId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate),
  ]);

  const transactions = txRows || [];
  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalBudget = budget ? Number(budget.total_amount) : 0;

  const catBudgetMap = {};
  (budget?.category_budgets || []).forEach((cb) => {
    catBudgetMap[cb.category] = Number(cb.amount);
  });

  const catExpenseMap = {};
  transactions
    .filter((t) => t.type === 'EXPENSE')
    .forEach((t) => {
      catExpenseMap[t.category] = (catExpenseMap[t.category] || 0) + Number(t.amount);
    });

  const allCategories = new Set([
    ...Object.keys(catBudgetMap),
    ...Object.keys(catExpenseMap),
  ]);
  const byCategory = Array.from(allCategories).map((category) => {
    const budgetAmt = catBudgetMap[category] || 0;
    const expense = catExpenseMap[category] || 0;
    return {
      category,
      budget: budgetAmt,
      expense,
      rate: budgetAmt > 0 ? Math.round((expense / budgetAmt) * 1000) / 10 : null,
    };
  });

  return {
    total_budget: totalBudget,
    total_income: totalIncome,
    total_expense: totalExpense,
    remaining: totalBudget - totalExpense,
    used_rate: totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 1000) / 10 : 0,
    by_category: byCategory,
  };
}

module.exports = { getSummary };
