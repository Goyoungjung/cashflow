require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startScheduler } = require('./services/fixedExpenseScheduler');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

app.use('/api/cards', require('./routes/cards'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/fixed-expenses', require('./routes/fixedExpenses'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/settings', require('./routes/settings'));

app.use((req, res) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '요청한 리소스를 찾을 수 없습니다.' } })
);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'test') startScheduler();
});

module.exports = app;
