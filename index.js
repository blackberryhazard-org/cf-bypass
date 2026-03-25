'use strict';

const express = require('express');
const { solve } = require('./solver');

const rateLimit = require('express-rate-limit');
const pLimit = require('p-limit').default;

const limit = pLimit(2); // maksimal 2 solve paralel

const app = express();

const PORT = process.env.PORT || 3000; // custom port
const AUTH = process.env.AUTH_KEY || "customyourkey"; //custom key

app.use(express.json());

// auth check
app.use((req, res, next) => {

    const key = req.headers['x-auth-key'] || req.query.key;

    if (!key || key !== AUTH) {
        return res.status(401).json({
            status: false,
            message: "Unauthorized"
        });
    }

    next();
});

// rate limit biar ga meletup :v
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: false,
        message: "too many requests, wait a moment.."
    }
});

app.use(limiter);

// health check (tanpa path)
app.get('/', (req, res) => {

    res.json({
        status: true,
        service: "ok"
    });

});

// slover endpoint
app.post('/solve', async (req, res) => {

    let { url, mode = 'full', timeout = 30000, proxy } = req.body;

    if (!url) {
        return res.status(400).json({
            status: false,
            message: 'url diperlukan'
        });
    }

    // limit timeout biar ga abuse
    if (timeout > 60000) timeout = 60000;

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const start = Date.now();

    console.log(`[${new Date().toISOString()}] ${ip} → solve ${url}`);

    try {

        const result = await limit(() =>
            solve({ url, mode, timeout, proxy })
        );

        result.elapsed_ms = Date.now() - start;

        console.log(`[OK] ${url} → ${result.elapsed_ms}ms`);

        res.json({
            status: true,
            data: result
        });

    } catch (e) {

        console.error(`[ERR] ${url} → ${e.message}`);

        res.status(500).json({
            status: false,
            message: e.message
        });

    }

});

// start serper
app.listen(PORT, () => {

    console.log(`wesker bypass listening on port ${PORT}`);

    if (AUTH)
        console.log(`Auth: enabled (x-auth-key header)`);

});
