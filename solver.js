'use strict';

let browserInstance = null;

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const CHROME_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1280,800',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--disable-extensions'
];

async function getBrowser(proxy) {
    if (browserInstance) return browserInstance;

    const args = [...CHROME_ARGS];
    if (proxy) args.push(`--proxy-server=${proxy}`);

    browserInstance = await puppeteer.launch({
        headless: 'new',
        args,
        executablePath: process.env.CHROME_PATH || undefined,
        ignoreHTTPSErrors: true
    });

    browserInstance.on('disconnected', () => {
        browserInstance = null;
    });

    return browserInstance;
}

async function waitForCFPass(page, timeout) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        const title = await page.title().catch(() => '');
        const url = page.url();

        const isCF =
            title.includes('Just a moment') ||
            title.includes('Checking your browser') ||
            title.includes('Please Wait') ||
            url.includes('challenge');

        if (!isCF) return true;

        await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error('CF challenge tidak selesai dalam ' + timeout + 'ms');
}

async function extractTurnstileToken(page) {
    return page.evaluate(() => {

        const input = document.querySelector('[name="cf-turnstile-response"]');
        if (input?.value) return input.value;

        if (window._cf_chl_opt?.cRay) return null;

        return window.__turnstileToken || null;
    });
}

async function solve({ url, mode, timeout, proxy }) {

    timeout = timeout || 30000;
    mode = mode || 'full';

    const browser = await getBrowser(proxy);
    const page = await browser.newPage();

    page.setDefaultNavigationTimeout(timeout);
    page.setDefaultTimeout(timeout);

    try {

        await page.setViewport({ width: 1280, height: 800 });

        const userAgent =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

        await page.setUserAgent(userAgent);

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Accept':
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        });

        let turnstileToken = null;

        if (mode === 'turnstile-min') {

            await page.setRequestInterception(true);

            page.on('request', req => req.continue());

            page.on('response', async response => {
                const resUrl = response.url();

                if (resUrl.includes('challenges.cloudflare.com/turnstile')) {
                    try {
                        const body = await response.text();
                        const match = body.match(/"token":"([^"]+)"/);
                        if (match) turnstileToken = match[1];
                    } catch (_) {}
                }
            });
        }

        // navigasi
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout
        });

        await waitForCFPass(page, timeout);

        await new Promise(r => setTimeout(r, 1500));

        // ngumpulin data
        const cookies = await page.cookies();
        const cfClearance = cookies.find(c => c.name === 'cf_clearance');
        const ua = await page.evaluate(() => navigator.userAgent);

        if (mode === 'turnstile-min') {

            if (!turnstileToken) {
                turnstileToken = await extractTurnstileToken(page);
            }

            if (!turnstileToken && cfClearance) {
                turnstileToken = cfClearance.value;
            }

            return {
                token: turnstileToken,
                user_agent: ua
            };
        }

        if (mode === 'cf_clearance') {

            if (!cfClearance)
                throw new Error('cf_clearance cookie not found');

            return {
                cf_clearance: cfClearance.value,
                user_agent: ua
            };
        }

        if (mode === 'screenshot') {

            const screenshot = await page.screenshot({
                encoding: 'base64',
                fullPage: false
            });

            return {
                screenshot,
                cookies,
                user_agent: ua
            };
        }

        // full mode
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        return {
            cookies,
            headers: {
                'user-agent': ua,
                'cookie': cookieStr,
                'cf-clearance': cfClearance?.value || ''
            },
            cookie: cookieStr,
            user_agent: ua
        };

    } catch (err) {

        if (browserInstance) {
            try { await browserInstance.close(); } catch {}
            browserInstance = null;
        }

        throw err;

    } finally {

        try { await page.close(); } catch {}

    }
}

module.exports = { solve };
