// node worker.js
import http from 'http'

const routes = {
  '/jobs':   { queued: 14, processing: 3, failed: 1 },
  '/health': { ok: true },
}

http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  const body = routes[req.url]
  if (!body) { res.writeHead(404); res.end(JSON.stringify({ error: 'not found' })); return }
  res.writeHead(200)
  res.end(JSON.stringify(body))
}).listen(4002, () => console.log('worker  :4002'))
