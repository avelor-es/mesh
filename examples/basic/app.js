// Simple frontend server — run with: node app.js
import http from 'http'

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>mesh · basic example</title>
  <style>
    body { font-family: monospace; max-width: 600px; margin: 60px auto; padding: 0 1rem; background: #0d0d0d; color: #b8b5b0; }
    h1   { font-size: 1rem; color: #555; margin-bottom: 2rem; }
    button { background: #1a1a1a; border: 1px solid #2a2a2a; color: #888; padding: .5rem 1rem; cursor: pointer; font-family: monospace; margin-right: .5rem; margin-bottom: .5rem; }
    button:hover { border-color: #444; color: #ccc; }
    pre { background: #111; border: 1px solid #1e1e1e; padding: 1rem; margin-top: 1.5rem; overflow: auto; font-size: .8rem; line-height: 1.6; min-height: 80px; }
    .ok  { color: #5a8a5a; }
    .err { color: #8a3a3a; }
  </style>
</head>
<body>
  <h1>mesh · basic example</h1>
  <p style="color:#555;font-size:.85rem;margin-bottom:1.5rem">
    Calls go to <code>api.test</code> — failure rules are active.
  </p>

  <button onclick="call('/users')">GET /users</button>
  <button onclick="call('/auth/login')">GET /auth/login</button>
  <button onclick="call('/slow')">GET /slow</button>
  <button onclick="call('/health')">GET /health</button>

  <pre id="out">ready.</pre>

  <script>
    async function call(path) {
      const out = document.getElementById('out')
      out.className = ''
      out.textContent = 'fetching ' + path + '...'
      const t = Date.now()
      try {
        const res  = await fetch('https://api.test' + path)
        const data = await res.json()
        const ms   = Date.now() - t
        out.className = res.ok ? 'ok' : 'err'
        out.textContent = res.status + ' ' + path + '  (' + ms + 'ms)\\n\\n' + JSON.stringify(data, null, 2)
      } catch (e) {
        out.className = 'err'
        out.textContent = 'error: ' + e.message
      }
    }
  </script>
</body>
</html>`

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(html)
}).listen(3000, () => console.log('app running on :3000'))
