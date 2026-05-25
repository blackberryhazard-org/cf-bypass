'use strict';

const { addExtra }  = require('puppeteer-extra');
const rebrowser     = require('rebrowser-puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const puppeteer = addExtra(rebrowser);
puppeteer.use(StealthPlugin());

const log = {
  info : (...a) => console.log('[CF-SOLVER]', ...a),
  warn : (...a) => console.warn('[CF-SOLVER][WARN]', ...a),
  error: (...a) => console.error('[CF-SOLVER][ERR]', ...a),
};

let _browser      = null;
let _browserProxy = null;

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
  '--disable-infobars',
  '--disable-notifications',
  '--disable-popup-blocking',
  '--disable-background-networking',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-ipc-flooding-protection',
  '--disable-hang-monitor',
  '--disable-prompt-on-repost',
  '--disable-sync',
  '--disable-translate',
  '--disable-client-side-phishing-detection',
  '--disable-component-update',
  '--disable-domain-reliability',
  '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
  '--metrics-recording-only',
  '--no-first-run',
  '--no-default-browser-check',
  '--password-store=basic',
  '--use-mock-keychain',
  '--window-size=1366,768',
  '--hide-scrollbars',
  '--mute-audio',
];

async function getBrowser(proxy) {
  if (_browser && _browser.isConnected() && _browserProxy === (proxy || null)) {
    return _browser;
  }
  if (_browser) {
    try { await _browser.close(); } catch {}
    _browser = null;
  }

  const args = [...CHROME_ARGS];
  if (proxy) args.push(`--proxy-server=${proxy}`);

  log.info('Launching browser...');

  _browser = await puppeteer.launch({
    headless         : true,
    args,
    executablePath   : process.env.CHROME_PATH || undefined,
    ignoreHTTPSErrors: true,
    defaultViewport  : null,
    pipe             : true,
  });

  _browserProxy = proxy || null;

  _browser.on('disconnected', () => {
    log.warn('Browser disconnected');
    _browser      = null;
    _browserProxy = null;
  });

  return _browser;
}

const sleep      = ms => new Promise(r => setTimeout(r, ms));
const randInt    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const humanDelay = () => sleep(randInt(800, 2000));

const CHROME_VERSIONS = [121, 122, 123, 124];

const FINGERPRINT_PRESETS = [
  {
    label             : 'win10-intel',
    osToken           : 'Windows NT 10.0; Win64; x64',
    navigatorPlatform : 'Win32',
    secChUaPlatform   : 'Windows',
    webglVendor       : 'Google Inc. (Intel)',
    webglRenderer     : 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    hwConcurrencyPool : [4, 8],
    deviceMemoryPool  : [8, 16],
  },
  {
    label             : 'linux-mesa',
    osToken           : 'X11; Linux x86_64',
    navigatorPlatform : 'Linux x86_64',
    secChUaPlatform   : 'Linux',
    webglVendor       : 'Mesa/X.org',
    webglRenderer     : 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
    hwConcurrencyPool : [4, 8],
    deviceMemoryPool  : [8, 16],
  },
];

function pickFingerprint() {
  const base = FINGERPRINT_PRESETS[randInt(0, FINGERPRINT_PRESETS.length - 1)];
  const cv   = CHROME_VERSIONS[randInt(0, CHROME_VERSIONS.length - 1)];
  return {
    ...base,
    chromeVersion: cv,
    ua           : `Mozilla/5.0 (${base.osToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${cv}.0.0.0 Safari/537.36`,
    languages    : ['en-US', 'en'],
    hwConcurrency: base.hwConcurrencyPool[randInt(0, base.hwConcurrencyPool.length - 1)],
    deviceMemory : base.deviceMemoryPool[randInt(0, base.deviceMemoryPool.length - 1)],
  };
}

async function simulateMouse(page) {
  try {
    const vp = page.viewport() || { width: 1366, height: 768 };
    const steps = randInt(4, 8);
    for (let i = 0; i < steps; i++) {
      await page.mouse.move(
        randInt(100, vp.width  - 100),
        randInt(100, vp.height - 100),
        { steps: randInt(5, 12) }
      );
      await sleep(randInt(80, 250));
    }
  } catch {}
}

async function hardenFingerprint(page, fp) {
  await page.evaluateOnNewDocument((fp) => {
    const overrides = {
      webdriver           : false,
      languages           : fp.languages,
      platform            : fp.navigatorPlatform,
      hardwareConcurrency : fp.hwConcurrency,
      deviceMemory        : fp.deviceMemory,
      maxTouchPoints      : 0,
      appVersion          : fp.ua.replace('Mozilla/', ''),
      userAgent           : fp.ua,
    };
    for (const [k, v] of Object.entries(overrides)) {
      try {
        Object.defineProperty(navigator, k, { get: () => v, configurable: true });
      } catch {}
    }

    const origQuery = window.Permissions?.prototype?.query;
    if (origQuery) {
      window.Permissions.prototype.query = function(params) {
        if (['notifications', 'push', 'midi', 'camera', 'microphone', 'geolocation'].includes(params?.name)) {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return origQuery.call(this, params);
      };
    }

    const seed = Math.floor(Math.random() * 1e9);
    let rngState = seed;
    const seededRand = () => {
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState / 0x7fffffff;
    };

    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      const ctx = this.getContext('2d');
      if (ctx) {
        try {
          const pixel = ctx.getImageData(0, 0, 1, 1).data;
          if (pixel[3] !== 0) {
            ctx.fillStyle = `rgba(${Math.floor(seededRand()*2)},${Math.floor(seededRand()*2)},${Math.floor(seededRand()*2)},0.003)`;
            ctx.fillRect(seededRand() * this.width, seededRand() * this.height, 1, 1);
          }
        } catch {}
      }
      return origToDataURL.apply(this, arguments);
    };

    const VENDOR   = fp.webglVendor;
    const RENDERER = fp.webglRenderer;
    const patchWebGL = (proto) => {
      const orig = proto.getParameter;
      proto.getParameter = function(param) {
        if (param === 37445) return VENDOR;
        if (param === 37446) return RENDERER;
        return orig.call(this, param);
      };
    };
    if (typeof WebGLRenderingContext  !== 'undefined') patchWebGL(WebGLRenderingContext.prototype);
    if (typeof WebGL2RenderingContext !== 'undefined') patchWebGL(WebGL2RenderingContext.prototype);

    const origCreateAnalyser = AudioContext.prototype?.createAnalyser;
    if (origCreateAnalyser) {
      AudioContext.prototype.createAnalyser = function() {
        const analyser = origCreateAnalyser.call(this);
        const origGetFloatFreq = analyser.getFloatFrequencyData.bind(analyser);
        analyser.getFloatFrequencyData = function(array) {
          origGetFloatFreq(array);
          for (let i = 0; i < array.length; i++) {
            array[i] += (seededRand() + seededRand() - 1) * 0.00005;
          }
        };
        return analyser;
      };
    }

    try {
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50 + Math.floor(seededRand() * 100),
          downlink: 5 + seededRand() * 10,
          saveData: false,
          onchange: null,
        }),
        configurable: true,
      });
    } catch {}

    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  }, fp);
}

async function setHeaders(page, fp, referer) {
  const cv = fp.chromeVersion;
  await page.setExtraHTTPHeaders({
    'Accept'                   : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language'          : 'en-US,en;q=0.9',
    'Accept-Encoding'          : 'gzip, deflate, br',
    'Cache-Control'            : 'no-cache',
    'Pragma'                   : 'no-cache',
    'Sec-Ch-Ua'                : `"Chromium";v="${cv}", "Not A(Brand";v="24", "Google Chrome";v="${cv}"`,
    'Sec-Ch-Ua-Mobile'         : '?0',
    'Sec-Ch-Ua-Platform'       : `"${fp.secChUaPlatform}"`,
    'Sec-Fetch-Dest'           : 'document',
    'Sec-Fetch-Mode'           : 'navigate',
    'Sec-Fetch-Site'           : referer ? 'same-origin' : 'none',
    'Sec-Fetch-User'           : '?1',
    'Upgrade-Insecure-Requests': '1',
    ...(referer ? { 'Referer': referer } : {}),
  });
}

async function isChallenging(page) {
  try {
    const title    = await page.title();
    const url      = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');

    const cfSignals = [
      title.includes('Just a moment'),
      title.includes('Checking your browser'),
      title.includes('Please Wait'),
      title.includes('Attention Required'),
      url.includes('/cdn-cgi/challenge-platform'),
      url.includes('challenge'),
      bodyText.includes('Checking if the site connection is secure'),
      bodyText.includes('Please enable JS and disable any ad blocker'),
      bodyText.includes('DDoS protection by'),
    ];
    return cfSignals.some(Boolean);
  } catch {
    return false;
  }
}

async function waitCFClear(page, timeout = 35000) {
  const deadline = Date.now() + timeout;
  let checks     = 0;

  while (Date.now() < deadline) {
    checks++;
    const challenging = await isChallenging(page);
    if (!challenging) {
      log.info(`CF cleared after ${checks} checks`);
      await sleep(1500);
      return true;
    }
    if (checks % 3 === 0) await simulateMouse(page);
    await sleep(1200);
  }
  throw new Error(`CF challenge timeout after ${timeout}ms`);
}

function extractCFCookies(cookies) {
  return {
    cf_clearance: cookies.find(c => c.name === 'cf_clearance'),
  };
}

async function navigateWithRetry(page, url, opts = {}, maxRetry = 2) {
  const waitUntil = opts.waitUntil || 'domcontentloaded';
  const timeout   = opts.timeout   || 35000;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      log.info(`Navigation attempt ${attempt}/${maxRetry}: ${url}`);
      const resp = await page.goto(url, { waitUntil, timeout });
      const status = resp?.status();

      if (status === 403 && attempt < maxRetry) {
        log.warn(`Got 403, retry with referer injection...`);
        const origin = new URL(url).origin;
        await page.setExtraHTTPHeaders({ 'Referer': origin + '/' });
        await sleep(randInt(1500, 2500));
        continue;
      }
      return resp;
    } catch (e) {
      if (attempt === maxRetry) throw e;
      log.warn(`Navigation failed (${e.message}), retry in 2s...`);
      await sleep(2000);
    }
  }
}

async function extractTurnstile(page) {
  return page.evaluate(() => {
    const input = document.querySelector('[name="cf-turnstile-response"]');
    if (input?.value) return input.value;
    if (window.__turnstileToken) return window.__turnstileToken;
    return null;
  }).catch(() => null);
}

async function solve({ url, mode, timeout, proxy }) {
  timeout = timeout || 35000;
  mode    = mode    || 'full';

  log.info(`Solving: ${url} [mode=${mode}]`);

  const browser = await getBrowser(proxy);
  const fp      = pickFingerprint();

  const context = await browser.createBrowserContext();
  const page    = await context.newPage();

  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  try {
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await page.setUserAgent(fp.ua);
    await hardenFingerprint(page, fp);
    await setHeaders(page, fp);

    if (mode === 'turnstile-min') {
      await page.evaluateOnNewDocument(() => {
        window.__turnstileToken = '';
        const hookTurnstile = () => {
          if (!window.turnstile || window.turnstile.__hooked) return;
          const origRender = window.turnstile.render.bind(window.turnstile);
          window.turnstile.render = function(container, params) {
            if (params && typeof params.callback === 'function') {
              const origCb = params.callback;
              params.callback = function(token) {
                window.__turnstileToken = token;
                return origCb(token);
              };
            }
            return origRender(container, params);
          };
          window.turnstile.__hooked = true;
        };
        Object.defineProperty(window, 'turnstile', {
          configurable: true,
          set(v) { this.__ts = v; setTimeout(hookTurnstile, 0); },
          get()  { return this.__ts; }
        });
      });

      await navigateWithRetry(page, url, { waitUntil: 'networkidle2', timeout });
      await waitCFClear(page, timeout);
      await humanDelay();

      let turnstileToken = null;
      try {
        await page.waitForFunction(() => !!window.__turnstileToken, { timeout: 30000 });
        turnstileToken = await page.evaluate(() => window.__turnstileToken);
      } catch {}

      if (!turnstileToken) {
        turnstileToken = await page.evaluate(() =>
          document.querySelector('#turnstile_response')?.value
          || document.querySelector('[name="turnstile"]')?.value
          || ''
        ).catch(() => '');
      }

      if (!turnstileToken) throw new Error('Turnstile token tidak ditemukan');

      const liveUA = await page.evaluate(() => navigator.userAgent).catch(() => fp.ua);
      return { token: turnstileToken, user_agent: liveUA, fingerprint: fp.label };
    }

    if (mode === 'screenshot') {
      await navigateWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout });
      await sleep(2000);
      const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
      const cookies    = await page.cookies();
      const liveUA     = await page.evaluate(() => navigator.userAgent).catch(() => fp.ua);
      return { screenshot, cookies, user_agent: liveUA, fingerprint: fp.label };
    }

    // cf_clearance + full
    await navigateWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout });
    await simulateMouse(page);
    await waitCFClear(page, timeout);
    await sleep(randInt(1000, 2000));
    await simulateMouse(page);

    let cookies = await page.cookies();
    let { cf_clearance } = extractCFCookies(cookies);

    if (!cf_clearance) {
      log.warn('cf_clearance belum ada, tunggu...');
      await sleep(2500);
      await simulateMouse(page);
      cookies      = await page.cookies();
      cf_clearance = extractCFCookies(cookies).cf_clearance;
    }

    if (mode === 'cf_clearance') {
      if (!cf_clearance || !cf_clearance.value) {
        throw new Error('cf_clearance cookie tidak ditemukan');
      }
      const liveUA = await page.evaluate(() => navigator.userAgent).catch(() => fp.ua);
      return {
        cf_clearance: cf_clearance.value,
        user_agent  : liveUA,
        fingerprint : fp.label,
      };
    }

    const liveUA    = await page.evaluate(() => navigator.userAgent).catch(() => fp.ua);
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    return {
      cookies,
      cookie      : cookieStr,
      user_agent  : liveUA,
      cf_clearance: cf_clearance?.value || null,
      headers     : {
        'user-agent'  : liveUA,
        'cookie'      : cookieStr,
        'cf-clearance': cf_clearance?.value || '',
      },
      fingerprint : fp.label,
    };

  } catch (err) {
    log.error(`Solve failed: ${err.message}`);
    if (_browser && !_browser.isConnected()) {
      _browser      = null;
      _browserProxy = null;
    }
    throw err;
  } finally {
    try { await page.close(); }    catch {}
    try { await context.close(); } catch {}
  }
}

async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch {}
    _browser      = null;
    _browserProxy = null;
  }
}

module.exports = { solve, closeBrowser };
