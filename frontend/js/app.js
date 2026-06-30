import { getSession, signOut } from './api/auth.js';
import { transactions } from './api/index.js';
import { getState, setState, subscribe } from './store.js';
import { loadHome } from './pages/home.js';
import { loadList, groupByDate, deleteTransaction } from './pages/list.js';
import { loadStats } from './pages/stats.js';
import { loadBudget, saveBudget } from './pages/budget.js';
import { loadFixed, toggleAutoReflect, toggleFixedActive, deleteFixed } from './pages/fixed.js';
import { loadCards, addCard, deleteCard } from './pages/cards.js';
import { settings } from './api/index.js';

const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

// ── 탭 전환 ───────────────────────────────────────────────
async function goTab(tab) {
  setState({ tab });
  const { year, month } = getState();
  switch (tab) {
    case 'home':   await loadHome(); break;
    case 'list':   await loadList(); break;
    case 'stats':  await loadStats(); break;
    case 'budget': await loadBudget(); break;
    case 'fixed':  await loadFixed(); break;
    case 'cards':  await loadCards(); break;
  }
  render();
}

// ── 월 이동 ───────────────────────────────────────────────
async function changeMonth(delta) {
  const { year, month } = getState();
  const d = new Date(year, month - 1 + delta, 1);
  setState({ year: d.getFullYear(), month: d.getMonth() + 1 });
  await goTab(getState().tab);
}

// ── 내역 추가 ─────────────────────────────────────────────
async function saveTransaction(form) {
  const { year, month } = getState();
  const pad = (n) => String(n).padStart(2, '0');
  const transaction_date = form.transaction_date || `${year}-${pad(month)}-${pad(form.day)}`;
  await transactions.create({
    type: form.type,
    amount: Number(form.amount),
    transaction_date,
    category: form.category,
    card_id: form.card_id ?? null,
    memo: form.memo ?? null,
    is_fixed: form.fixed ?? false,
  });
  // 홈이면 summary 갱신, 리스트면 목록 갱신
  const tab = getState().tab;
  if (tab === 'home') await loadHome();
  if (tab === 'list') await loadList();
  render();
}

// ── 내역 수정 ─────────────────────────────────────────────
async function updateTransaction(id, patch) {
  await transactions.update(id, patch);
  await loadList();
  render();
}

// ── 설정 토글 ─────────────────────────────────────────────
async function toggleBudgetAlert(value) {
  await settings.save({ budget_alert_on: value });
  setState((s) => ({ userSettings: { ...s.userSettings, budget_alert_on: value } }));
  render();
}

// ── 예산 저장 ─────────────────────────────────────────────
async function onSaveBudget(totalAmount, catBudgets) {
  await saveBudget(totalAmount, catBudgets);
  await loadHome();
  render();
}

// ── 렌더링 (DOM 업데이트) ──────────────────────────────────
function render() {
  const s = getState();
  document.documentElement.setAttribute('data-theme', s.theme);

  // 로딩 표시
  document.getElementById('loading-bar').style.opacity = s.loading ? '1' : '0';

  // 탭 활성화
  document.querySelectorAll('[data-tab]').forEach((el) => {
    const active = el.dataset.tab === s.tab;
    el.setAttribute('data-active', active ? 'true' : 'false');
  });

  // 월 헤더
  document.getElementById('month-label').textContent =
    `${s.year}년 ${s.month}월`;

  // 탭별 콘텐츠 보임/숨김
  ['home', 'list', 'stats', 'budget', 'fixed', 'cards'].forEach((tab) => {
    const el = document.getElementById(`page-${tab}`);
    if (el) el.style.display = s.tab === tab ? '' : 'none';
  });

  // 각 페이지 렌더 함수 호출
  if (s.tab === 'home' && s.summary) renderHome(s);
  if (s.tab === 'list') renderList(s);
  if (s.tab === 'stats') renderStats(s);
  if (s.tab === 'budget' && s.summary) renderBudget(s);
  if (s.tab === 'fixed') renderFixed(s);
  if (s.tab === 'cards') renderCards(s);
}

// ── 홈 렌더 ──────────────────────────────────────────────
function renderHome(s) {
  const { summary, calendar } = s;

  document.getElementById('kpi-income').textContent = won(summary.total_income);
  document.getElementById('kpi-expense').textContent = won(summary.total_expense);
  document.getElementById('kpi-net').textContent = won(summary.total_income - summary.total_expense);
  document.getElementById('kpi-remain').textContent = won(summary.remaining);

  const pct = Math.min(summary.used_rate, 100);
  const c = 2 * Math.PI * 58;
  document.getElementById('budget-ring').style.strokeDasharray = `${(pct / 100) * c} ${c}`;
  document.getElementById('budget-pct').textContent = `${Math.round(pct)}%`;
  document.getElementById('budget-total').textContent = won(summary.total_budget);
  document.getElementById('budget-used').textContent = won(summary.total_expense);
  document.getElementById('budget-remain').textContent = won(summary.remaining);

  // 카테고리별 지출
  const catList = document.getElementById('cat-list');
  if (catList && summary.by_category.length) {
    const maxAmt = Math.max(...summary.by_category.map((c) => c.expense));
    catList.innerHTML = summary.by_category
      .filter((c) => c.expense > 0)
      .sort((a, b) => b.expense - a.expense)
      .map((c) => `
        <div class="cat-row">
          <span class="cat-name">${c.category}</span>
          <span class="cat-amount">${won(c.expense)}</span>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${maxAmt > 0 ? (c.expense / maxAmt) * 100 : 0}%"></div>
          </div>
          ${c.budget > 0 ? `<span class="cat-pct">${Math.round((c.expense / c.budget) * 100)}%</span>` : ''}
        </div>`).join('');
  }
}

// ── 리스트 렌더 ──────────────────────────────────────────
function renderList(s) {
  const groups = groupByDate(s.transactions.items);
  const listEl = document.getElementById('tx-list');
  if (!listEl) return;

  if (!groups.length) {
    listEl.innerHTML = '<div class="empty">해당 조건의 내역이 없어요</div>';
    return;
  }

  listEl.innerHTML = groups.map(({ date, items }) => {
    const dayTotal = items.reduce((sum, t) =>
      t.type === 'EXPENSE' ? sum - t.amount : sum + Number(t.amount), 0);
    return `
      <div class="group-header">
        <span>${date}</span>
        <span style="color:${dayTotal >= 0 ? 'var(--income)' : 'var(--expense)'}">${dayTotal >= 0 ? '+' : ''}${fmt(dayTotal)}원</span>
      </div>
      ${items.map((t) => `
        <div class="tx-row" data-id="${t.id}">
          <div class="tx-info">
            <div class="tx-name">${t.memo || t.category}</div>
            <div class="tx-sub">${t.category} · ${t.cards?.name ?? '현금'}</div>
          </div>
          <div class="tx-amount" style="color:${t.type === 'INCOME' ? 'var(--income)' : 'var(--expense)'}">
            ${t.type === 'INCOME' ? '+' : '-'}${won(t.amount)}
          </div>
          <div class="tx-actions">
            <button onclick="app.editTx('${t.id}')">✏️</button>
            <button onclick="app.deleteTx('${t.id}')">🗑</button>
          </div>
        </div>`).join('')}`;
  }).join('');
}

// ── 통계 렌더 ────────────────────────────────────────────
function renderStats(s) {
  const cardStatEl = document.getElementById('card-stat-list');
  if (cardStatEl && s.cardStats.length) {
    const max = s.cardStats[0].total;
    cardStatEl.innerHTML = s.cardStats.map((c) => `
      <div class="card-stat-row">
        <span>${c.card_name}</span>
        <span>${won(c.total)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${max > 0 ? (c.total / max) * 100 : 0}%"></div></div>
      </div>`).join('');
  }

  const catStatEl = document.getElementById('donut-legend');
  if (catStatEl && s.categoryStats.length) {
    const total = s.categoryStats.reduce((s, c) => s + c.total, 0);
    catStatEl.innerHTML = s.categoryStats.map((c) => `
      <div class="legend-row">
        <span>${c.category}</span>
        <span>${Math.round((c.total / total) * 1000) / 10}%</span>
        <span>${won(c.total)}</span>
      </div>`).join('');
  }
}

// ── 예산 렌더 ────────────────────────────────────────────
function renderBudget(s) {
  const { summary } = s;
  if (!summary) return;
  const input = document.getElementById('budget-input');
  if (input && !input.matches(':focus')) input.value = fmt(summary.total_budget);
}

// ── 고정지출 렌더 ─────────────────────────────────────────
function renderFixed(s) {
  const el = document.getElementById('fixed-list');
  if (!el) return;
  const total = s.fixedExpenses.filter((f) => f.is_active).reduce((sum, f) => sum + Number(f.amount), 0);
  document.getElementById('fixed-total').textContent = won(total);

  const autoToggle = document.getElementById('auto-reflect-toggle');
  if (autoToggle) autoToggle.checked = s.userSettings.auto_reflect;

  el.innerHTML = s.fixedExpenses.map((f) => `
    <div class="fixed-row">
      <span class="fixed-name">${f.name}</span>
      <span class="fixed-meta">${f.billing_day}일 · ${f.cards?.name ?? '현금'}</span>
      <span class="fixed-amount">${won(f.amount)}</span>
      <label class="toggle">
        <input type="checkbox" ${f.is_active ? 'checked' : ''} onchange="app.toggleFixed('${f.id}', this.checked)">
        <span></span>
      </label>
      <button onclick="app.deleteFixed('${f.id}')">🗑</button>
    </div>`).join('');
}

// ── 카드 렌더 ────────────────────────────────────────────
function renderCards(s) {
  const el = document.getElementById('card-grid');
  if (!el) return;
  el.innerHTML = s.cards.map((c) => `
    <div class="card-chip" style="background:${c.color_code}">
      <div class="card-chip-name">${c.name}</div>
      <div class="card-chip-issuer">${c.issuer}</div>
      ${c.monthly_expense != null ? `<div class="card-chip-used">${won(c.monthly_expense)} 사용</div>` : ''}
      <button onclick="app.deleteCard('${c.id}')">✕</button>
    </div>`).join('');
}

// ── 테마 토글 ────────────────────────────────────────────
function toggleTheme() {
  const theme = getState().theme === 'light' ? 'dark' : 'light';
  setState({ theme });
  localStorage.setItem('cf_theme', theme);
  render();
}

// ── 초기화 ───────────────────────────────────────────────
async function init() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/login.html';
    return;
  }
  subscribe(render);
  await goTab('home');
}

// 전역 노출 (인라인 onclick 핸들러용)
window.app = {
  goTab,
  changeMonth,
  saveTransaction,
  updateTransaction,
  deleteTx: async (id) => { await deleteTransaction(id); render(); },
  editTx: (id) => { console.log('edit', id); /* 모달 열기 */ },
  toggleFixed: (id, val) => toggleFixedActive(id, val).then(render),
  deleteFixed: (id) => deleteFixed(id).then(render),
  deleteCard: (id) => deleteCard(id).then(render),
  toggleTheme,
  toggleAutoReflect: (val) => toggleAutoReflect(val).then(render),
  toggleBudgetAlert,
  saveBudget: onSaveBudget,
  signOut: () => signOut().then(() => { window.location.href = '/login.html'; }),
};

init();
