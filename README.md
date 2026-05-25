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
    "url": "https://nowsecure.nl",
    "mode": "full"
  }'
```

response:

```json
{
  "status": true,
  "data": {
    "cookies": [...],
    "headers": {
      "user-agent": "Mozilla/5.0...",
      "cookie": "cf_clearance=...",
      "cf-clearance": "..."
    },
    "cookie": "cf_clearance=...; __cflb=...",
    "user_agent": "Mozilla/5.0...",
    "cf_clearance": "...",
    "fingerprint": "win10-intel",
    "elapsed_ms": 8432
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
