# mesh

Local dev proxy. Named services instead of ports. Failure injection without mocks.

```
app.test   → :3000
api.test   → :4000
admin.test → :5000
```

No more `:3000`, `:4000`, `:5000` open in different tabs. No more mixing them up.

---

## Install

```bash
npm install -g @avelor/mesh
```

Requires Node.js 18+. For HTTPS, install [mkcert](https://github.com/FiloSottile/mkcert).

---

## Usage

```bash
mesh init         # create mesh.yml in current directory
sudo mesh start   # start proxy in background
mesh status       # show running services
sudo mesh stop    # stop the proxy
sudo mesh route   # start in foreground (useful for debugging)
```

`mesh start` runs on `:80` and `:443` (if mkcert is available), writes the hostname entries to `/etc/hosts`, and cleans them up automatically on stop.

---

## mesh.yml

```yaml
services:
  app: 3000
  api: 4000
  admin: 5000
```

That's enough to get started. Services are available at `app.test`, `api.test`, `admin.test`.

### Failure rules

Test how your app handles errors — no mocks, no code changes.

```yaml
services:
  app: 3000
  api: 4000

rules:
  api:
    - path: /payments
      method: POST
      status: 503
      body:
        error: Payment service unavailable
        retryAfter: 30
      rate: 30
    - path: /auth/login
      status: 401
      rate: 20
    - path: /slow-endpoint
      delay: 2000
      rate: 100
    - path: /flaky
      status: 500
      delay: 800
      rate: 25
```

| Field    | Description                                                   |
|----------|---------------------------------------------------------------|
| `path`   | Request path prefix to match                                  |
| `method` | HTTP method to match (GET, POST, PUT, PATCH, DELETE…)         |
| `status` | HTTP status code to return (400, 401, 500, etc.)              |
| `body`   | Response body — object (sent as JSON) or string (plain text)  |
| `delay`  | Milliseconds to wait before responding                        |
| `rate`   | Percentage of matching requests to affect (1–100)             |

`status` and `delay` can be combined: wait N ms, then fail with that status. Without `body`, the default is `{ "error": "<status text>", "injected": true }`.

### Subdomains

Multiple names can point to the same port:

```yaml
services:
  app: 3000
  tenant1.app: 3000
  tenant2.app: 3000
  api: 4000
```

Rules apply per name, so `tenant1.app` and `tenant2.app` can have different failure scenarios.

---

## HTTPS

If [mkcert](https://github.com/FiloSottile/mkcert) is installed, `mesh route` automatically generates a locally-trusted certificate for all your `.test` domains and serves them over HTTPS. Port `:80` redirects to `:443`.

```bash
# macOS
brew install mkcert

# Linux
apt install mkcert
```

If mkcert is not found, mesh falls back to HTTP only.

Generated certificates are stored in `.mesh/` (added to `.gitignore` by `mesh init`).

---

## Examples

See [`examples/basic`](examples/basic) and [`examples/multi`](examples/multi) for working setups with a frontend and API server.

```bash
# terminal 1
cd examples/basic
node api.js

# terminal 2
cd examples/basic
node app.js

# terminal 3 (from examples/basic)
sudo mesh route
```

Then open `https://app.test`.

---

## How it works

`mesh route` runs a local HTTP/HTTPS proxy on `127.0.0.1`. Incoming requests are matched by hostname, forwarded to the configured port, and optionally intercepted by failure rules before reaching the target service.

`/etc/hosts` entries are written on start and removed on exit (`SIGINT` / `SIGTERM`).

---

## License

MIT
