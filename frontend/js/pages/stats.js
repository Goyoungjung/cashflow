import { stats } from '../api/index.js';
import { getState, setState } from '../store.js';

export async function loadStats(period = 'this') {
  const now = getState();
  let year = now.year, month = now.month;
  if (period === 'last') {
    const d = new Date(year, month - 2, 1);
    year = d.getFullYear(); month = d.getMonth() + 1;
  }

  setState({ loading: true, error: null });
  const months = period === '3months' ? 3 : 1;

  const [categoryStats, cardStats, monthlyStats] = await Promise.all([
    stats.category(year, month),
    stats.card(year, month),
    stats.monthly(months === 1 ? 6 : months),
  ]).catch((e) => { setState({ loading: false, error: e.message }); return []; });

  if (!categoryStats) return;
  setState({ categoryStats, cardStats, monthlyStats, loading: false });
}

export function buildDonutSegments(categoryStats) {
  const COLORS = ['#3182F6','#22C55E','#F97316','#9B7BFF','#FF6B6B','#2DC6A6','#F59E0B','#98A2B3'];
  const total = categoryStats.reduce((s, c) => s + c.total, 0);
  const circumference = 2 * Math.PI * 54;
  let offset = 0;

  return categoryStats.map((c, i) => {
    const dash = (c.total / total) * circumference;
    const seg = { ...c, color: COLORS[i % COLORS.length], dash, offset, circumference };
    offset += dash;
    return seg;
  });
}

export function buildMonthlyPath(monthlyStats, budgetAmount, svgWidth = 920, svgHeight = 180) {
  if (!monthlyStats.length) return { linePath: '', areaPath: '', budgetLineY: 0 };

  const maxVal = Math.max(...monthlyStats.map((m) => m.expense), budgetAmount, 1);
  const pts = monthlyStats.map((m, i) => ({
    cx: (i / (monthlyStats.length - 1)) * svgWidth,
    cy: svgHeight - (m.expense / maxVal) * svgHeight * 0.85,
    ...m,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx},${p.cy}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].cx},${svgHeight} L0,${svgHeight} Z`;
  const budgetLineY = svgHeight - (budgetAmount / maxVal) * svgHeight * 0.85;

  return { linePath, areaPath, budgetLineY, dots: pts };
}
