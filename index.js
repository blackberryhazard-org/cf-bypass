'use strict';

const express   = require('express');
const rateLimit = require('express-rate-limit');
const pLimit    = require('p-limit').default;

const { solve, closeBrowser } = require('./solver');

const CONCURRENCY = 2;
const limit       = pLimit(CONCURRENCY);

const app = express();

const PORT = process.env.PORT     || 3000;
const AUTH = process.env.AUTH_KEY || '';

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: true, service: 'ok' });
});

app.use((req, res, next) => {
  if (!AUTH) return next();
  const key = req.headers['x-auth-key'] || req.query.key;
  if (!key || key !== AUTH) {
    return res.status(401).json({ status: false, message: 'Unauthorized' });
  }
  next();
});

const limiter = rateLimit({
  windowMs       : 60 * 1000,
  max            : 10,
  standardHeaders: true,
  legacyHeaders  : false,
  message        : { status: false, message: 'Too many requests, wait a moment..' }
});

app.use(limiter);

app.post('/solve', async (req, res) => {
  let { url, mode = 'full', timeout = 30000, proxy } = req.body;

  if (!url) {
    return res.status(400).json({ status: false, message: 'url diperlukan' });
  }

  if (timeout > 60000) timeout = 60000;

  const ip    = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const start = Date.now();

  console.log(`[${new Date().toISOString()}] ${ip} → solve ${url} [${mode}]`);

  try {
    const result = await limit(() => solve({ url, mode, timeout, proxy }));
    result.elapsed_ms = Date.now() - start;

    console.log(`[OK] ${url} → ${result.elapsed_ms}ms`);
    res.json({ status: true, data: result });

  } catch (e) {
    console.error(`[ERR] ${url} → ${e.message}`);
    res.status(500).json({ status: false, message: e.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`cf-bypass listening on port ${PORT}`);
  console.log(`concurrency: ${CONCURRENCY} parallel solve`);
  if (AUTH) {
    console.log('Auth: enabled (x-auth-key header)');
  } else {
    console.warn('Auth: DISABLED — set AUTH_KEY env to enable');
  }
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] signal=${signal}, draining...`);

  server.close(() => console.log('[shutdown] http closed'));

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && limit.activeCount + limit.pendingCount > 0) {
    await new Promise(r => setTimeout(r, 200));
  }

  try { await closeBrowser(); } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
