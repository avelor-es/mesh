// Simple API server — run with: node api.js
import http from 'http'

const routes = {
  'GET /users':      () => [{ id: 1, name: 'Ada Lovelace' }, { id: 2, name: 'Grace Hopper' }],
  'GET /auth/login': () => ({ token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...' }),
  'GET /slow':       () => ({ data: 'this endpoint is slow in production too' }),
  'GET /health':     () => ({ ok: true }),
}

http.createServer((req, res) => {
  const key    = `${req.method} ${req.url.split('?')[0]}`
  const handler = routes[key]

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (!handler) {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  res.writeHead(200)
  res.end(JSON.stringify(handler()))
}).listen(4000, () => console.log('api running on :4000'))
