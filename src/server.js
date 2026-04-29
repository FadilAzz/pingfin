require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const internalRoutes = require('./routes/internal');
const { startPoller } = require('./services/poller');
const { fail } = require('./utils/response');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic rate limit on the API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // 300 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Health
app.get('/health', (req, res) => res.json({ ok: true, status: 200, message: 'alive' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', internalRoutes);

// Static GUI
app.use(express.static(path.join(__dirname, '..', 'public')));

// 404 for /api
app.use('/api', (req, res) => fail(res, { status: 404, message: 'Endpoint not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  return fail(res, { status: 500, message: err.message || 'Server error' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`╔════════════════════════════════════════════╗`);
  console.log(`║  Pingfin Bank API running                  ║`);
  console.log(`║  http://localhost:${PORT.toString().padEnd(25, ' ')}║`);
  console.log(`║  BIC: ${(process.env.BANK_BIC || '').padEnd(37, ' ')}║`);
  console.log(`╚════════════════════════════════════════════╝`);
  startPoller();
});
