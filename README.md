# cf-bypass

cloudflare bypass using puppeteer stealth. supports `cf_clearance`, turnstile, dan full session extraction.

dirancang untuk kebutuhan scraping, automation, dan testing bypass cloudflare challenge.

---

## tech stack

- Node.js + Express
- Puppeteer Extra + Stealth Plugin
- Docker (recommended)

---

## features

- bypass cloudflare otomatis via puppeteer stealth
- multiple mode: `turnstile-min`, `cf_clearance`, `full`, `screenshot`
- browser reuse — hemat resource, tidak spawn ulang tiap request
- rate limit & authentication built-in
- docker ready

---

## setup

### docker (recommended)

```bash
git clone https://github.com/vandebry10-star/cf-bypass.git
cd cf-bypass
```

edit environment di `docker-compose.yml`:

```yaml
environment:
  - PORT=3000
  - AUTH_KEY=your_secret_key
```

jalankan:

```bash
docker compose up -d --build
docker compose logs -f
```

### tanpa docker

```bash
npm install
node index.js
```

server berjalan di `http://localhost:3000`

---

## authentication

semua endpoint dilindungi api key. gunakan salah satu cara:

```
# header
x-auth-key: your_secret_key

# query param
?key=your_secret_key
```

default key: `alwayskercfbypass`

---

## endpoint

### `GET /`
health check.

---

### `POST /solve`

request body:

```json
{
  "url": "https://target.com",
  "mode": "full",
  "timeout": 30000
}
```

| mode | deskripsi |
|---|---|
| `turnstile-min` | ambil token captcha saja |
| `cf_clearance` | generate cf_clearance cookie |
| `full` | cookies + headers lengkap |
| `screenshot` | screenshot halaman (base64) |

---

## example

```bash
curl -X POST http://localhost:3000/solve \
  -H "Content-Type: application/json" \
  -H "x-auth-key: your_secret_key" \
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
    "cookies": [],
    "headers": {
      "user-agent": "Mozilla/5.0...",
      "cookie": "cf_clearance=..."
    },
    "cookie": "cf_clearance=...",
    "user_agent": "Mozilla/5.0..."
  }
}
```

---

## documentation preview

**full bypass (cf_clearance + headers)**

<p align="center">
  <img src="https://cloud.yardansh.com/7YV2AN.jpg" />
</p>

output: cf_clearance cookie, headers, user-agent.

---

**authentication check**

<p align="center">
  <img src="https://cloud.yardansh.com/A8AWlo.jpg" />
</p>

request dengan key salah akan ditolak dengan response `unauthorized`.

---

**cf_clearance mode**

<p align="center">
  <img src="https://cloud.yardansh.com/14jph9.jpg" />
</p>

lebih cepat dibanding `full` mode. cocok untuk inject ke client (axios/fetch).

---

**screenshot mode**

<p align="center">
  <img src="https://cloud.yardansh.com/vItc1S.jpg" />
</p>

berguna untuk debug — memastikan challenge sudah terlewati. output berupa base64 image.

---

## limits & catatan

- max 2 concurrent solve
- rate limit: 5 request / menit / ip
- disarankan minimal 1GB RAM
- `cf_clearance` bisa expired — regenerate jika perlu
- gunakan hanya pada target yang benar-benar pakai cloudflare
- hindari spam request

---

## environment

| variable | default | deskripsi |
|---|---|---|
| `PORT` | `3000` | port server |
| `AUTH_KEY` | `alwayskercfbypass` | api key |

---

## disclaimer

tool ini ditujukan untuk research, testing, dan pembelajaran. penggunaan di luar itu menjadi tanggung jawab masing-masing.

---

## contributing

pull request terbuka untuk improvement.

---

## license

MIT
