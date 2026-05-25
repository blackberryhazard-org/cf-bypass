# cf-bypass

cloudflare bypass API pakai **rebrowser-puppeteer** + stealth plugin, dengan fingerprint hardening (UA ↔ platform ↔ WebGL ↔ canvas/audio noise). support `turnstile-min`, `cf_clearance`, `full`, dan `screenshot` mode.

dirancang untuk scraping, automation, dan testing bypass cloudflare challenge.

---

## tech stack

- Node.js + Express
- rebrowser-puppeteer (CDP leak fix)
- puppeteer-extra + Stealth Plugin
- Fingerprint preset (Win10 / Linux)
- Docker ready

---

## features

- bypass cloudflare otomatis (incl. Turnstile interactive)
- fingerprint koheren: UA, navigator.platform, Sec-Ch-Ua, WebGL vendor/renderer
- canvas + audio fingerprint noise (seeded per-session)
- mouse movement simulation
- per-request browser context (isolasi cookies antar request)
- 4 mode output: `turnstile-min`, `cf_clearance`, `full`, `screenshot`
- rate limit & optional auth key
- graceful shutdown

---

## setup

### docker (recommended)

```bash
git clone https://github.com/vandebry10-star/cf-bypass.git
cd cf-bypass
docker compose up -d --build
docker compose logs -f
```

### tanpa docker

```bash
npm install
node index.js
```

server jalan di `http://localhost:3000`.

---

## authentication

opsional. set env `AUTH_KEY=...` di `docker-compose.yml`. kalau kosong = no-auth.

kalau aktif, kirim:

```
# header
x-auth-key: <YOUR_KEY>

# atau query
?key=<YOUR_KEY>
```

---

## endpoint

### `GET /`
health check.

### `POST /solve`

request body:

```json
{
  "url": "https://target.com",
  "mode": "full",
  "timeout": 30000,
  "proxy": "http://user:pass@host:port"
}
```

| mode | output |
|---|---|
| `turnstile-min` | `{ token, user_agent }` |
| `cf_clearance` | `{ cf_clearance, user_agent }` |
| `full` | `{ cookies, headers, cookie, user_agent, cf_clearance }` |
| `screenshot` | `{ screenshot (base64), cookies, user_agent }` |

`proxy` opsional. format: `http://user:pass@host:port` atau `http://host:port`.

---

## example

```bash
curl -X POST http://localhost:3000/solve \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://safelinku.com",
    "mode": "full"
  }'
```

### response — `mode: full` (real output)

```json
{
  "status": true,
  "data": {
    "cookies": [
      {
        "name": "cf_clearance",
        "value": "ifdiTVGnYMVCan.bJf25A5xo_Sv.Jj8C_U36oThq1Nk-1779692826-1.2.1.1-...truncated...",
        "domain": ".safelinku.com",
        "path": "/",
        "expires": 1811228826.577286,
        "size": 417,
        "httpOnly": true,
        "secure": true,
        "session": false,
        "sameSite": "None",
        "priority": "Medium",
        "sourceScheme": "Secure",
        "partitionKey": "https://safelinku.com"
      },
      {
        "name": "SID",
        "value": "QcbPCA2DuCGgNQDJ37eQZupLxNuImedGFCMxwOsc",
        "domain": "safelinku.com",
        "path": "/",
        "expires": 1779779225.86031,
        "size": 43,
        "httpOnly": true,
        "secure": false,
        "session": false,
        "sameSite": "Lax",
        "priority": "Medium",
        "sourceScheme": "Secure"
      },
      {
        "name": "XSRF-TOKEN",
        "value": "eyJpdiI6IjBLbEJyYVl6eE80VkZUK3hObVpaUnc9PSIsInZhbHVlIjoi...truncated...",
        "domain": "safelinku.com",
        "path": "/",
        "expires": 1779779225.860152,
        "size": 352,
        "httpOnly": false,
        "secure": true,
        "session": false,
        "sameSite": "Lax",
        "priority": "Medium",
        "sourceScheme": "Secure"
      },
      {
        "name": "_ga_QSHLHEKBT5",
        "value": "GS2.1.s1779692826$o1$g0$t1779692826$j60$l0$h0",
        "domain": ".safelinku.com",
        "path": "/",
        "expires": 1814252826.143819,
        "size": 59,
        "httpOnly": false,
        "secure": false,
        "session": false,
        "priority": "Medium",
        "sourceScheme": "Secure"
      },
      {
        "name": "_ga",
        "value": "GA1.1.363019776.1779692826",
        "domain": ".safelinku.com",
        "path": "/",
        "expires": 1814252826.14419,
        "size": 29,
        "httpOnly": false,
        "secure": false,
        "session": false,
        "priority": "Medium",
        "sourceScheme": "Secure"
      }
    ],
    "cookie": "cf_clearance=ifdiTVGnYM...; SID=QcbPCA2DuC...; XSRF-TOKEN=eyJpdiI6...; _ga_QSHLHEKBT5=GS2.1.s1779692826...; _ga=GA1.1.363019776.1779692826",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "cf_clearance": "ifdiTVGnYMVCan.bJf25A5xo_Sv.Jj8C_U36oThq1Nk-1779692826-1.2.1.1-...truncated...",
    "headers": {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "cookie": "cf_clearance=...; SID=...; XSRF-TOKEN=...; _ga=...",
      "cf-clearance": "ifdiTVGnYMVCan.bJf25A5xo_Sv.Jj8C_U36oThq1Nk-1779692826-1.2.1.1-...truncated..."
    },
    "fingerprint": "win10-intel",
    "elapsed_ms": 7628
  }
}
```

### node.js client

```js
async function solveCF(url, mode = 'full') {
  const res = await fetch('http://YOUR_VPS:3000/solve', {
    method : 'POST',
    headers: { 'content-type': 'application/json' },
    body   : JSON.stringify({ url, mode }),
  });
  const data = await res.json();
  if (!data?.status) throw new Error(`solve gagal: ${data.message}`);
  return data.data;
}

const { headers } = await solveCF('https://example.com');
// pakai headers buat axios/fetch next request
```

---

## mode notes

penting — tiap mode return field yang beda, pilih sesuai use case.

### `full`
**return:** `cookies[]`, `cookie` (string siap pakai), `headers{}`, `user_agent`, `cf_clearance`, `fingerprint`, `elapsed_ms`

session paling lengkap. cocok kalau lo mau replay request ke target site (axios/fetch) pakai cookie + user-agent yang sama persis dengan browser yang udah solve challenge. `headers.cookie` udah di-join siap masuk ke `Cookie:` header.

**catatan:**
- `cf_clearance` valid hanya untuk kombinasi (IP + user_agent + accept-language). kalau request berikutnya beda salah satu → ditolak.
- pakai `headers` apa adanya, jangan utak-atik UA.
- cookie lain di `cookies[]` (SID, XSRF-TOKEN, dll) berasal dari target — bawa juga kalau target butuh login state.

---

### `cf_clearance`
**return:** `cf_clearance`, `user_agent`, `fingerprint`, `elapsed_ms`

versi ringan dari `full`. cuma keluarin `cf_clearance` cookie + user agent. cocok kalau lo cuma butuh tembus CF challenge dan gak butuh cookie aplikasi target (SID, csrf token, dll).

**catatan:**
- selalu pasang `cf_clearance` ke `Cookie: cf_clearance=<value>` header.
- harus pair sama `user_agent` — kalau UA beda, cookie ditolak.

---

### `turnstile-min`
**return:** `token`, `user_agent`, `fingerprint`, `elapsed_ms`

ambil Turnstile token saja (yang biasanya di-submit ke form sebagai `cf-turnstile-response`). cara kerjanya nge-hook `window.turnstile.render` lalu intercept callback token-nya.

**catatan:**
- token Turnstile **sekali pakai** (one-shot), expired dalam ~5 menit.
- cuma jalan di site yang expose `window.turnstile` global (situs yang explicit pakai widget Turnstile, bukan managed challenge biasa).
- kalau site cuma kasih managed CF challenge tanpa widget turnstile, mode ini bakal timeout → pakai `cf_clearance` aja.

---

### `screenshot`
**return:** `screenshot` (base64 PNG, viewport 1366×768), `cookies[]`, `user_agent`, `fingerprint`, `elapsed_ms`

screenshot halaman setelah navigation selesai. dipakai untuk debug — lihat apakah challenge benar-benar terlewati, apakah ada CAPTCHA yang macet, atau apakah ada blokir lain.

**catatan:**
- tidak otomatis `waitCFClear` — kalau lagi challenge, hasilnya bisa "Just a moment..." page. itu sengaja, biar bisa lihat state mentah.
- ukuran response besar (~300–500KB base64 per request). jangan dipakai untuk produksi rutin.

---

### perbandingan singkat

| mode | output utama | one-shot? | size response | use case |
|---|---|---|---|---|
| `full` | cookies + headers + cf_clearance | tidak (~30 menit) | sedang | scrape / replay request |
| `cf_clearance` | cf_clearance saja | tidak (~30 menit) | kecil | inject ke client http |
| `turnstile-min` | turnstile token | **ya** (~5 menit) | kecil | submit form bertoken |
| `screenshot` | base64 PNG + cookies | per-request | besar | debug visual |

---

## limits & catatan

- max 2 concurrent solve (CONCURRENCY = 2)
- rate limit: 10 request / menit / ip
- timeout max 60 detik per solve
- disarankan VPS min 1GB RAM
- `cf_clearance` umumnya valid ~30 menit. regenerate bila perlu
- mode `turnstile-min` hanya untuk site yang expose turnstile callback ke `window.turnstile`
- tidak untuk DDoS, spam, atau bypass paywall. gunakan dengan tanggung jawab

---

## environment

| variable | default | deskripsi |
|---|---|---|
| `PORT` | `3000` | port server |
| `AUTH_KEY` | _(kosong)_ | api key. kosong = no-auth |
| `CHROME_PATH` | auto | path Chrome/Chromium binary |

---

## disclaimer

tool ini untuk research, testing, dan pembelajaran. tanggung jawab penggunaan ada di pengguna masing-masing.

---

## license

MIT
