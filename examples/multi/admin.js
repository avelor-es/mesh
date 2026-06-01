// node admin.js
import http from 'http'

const routes = {
  '/stats': { users: 1284, revenue: 48200, uptime: '99.1%' },
  '/users': [{ id: 1, email: 'ada@example.com', role: 'admin' }, { id: 2, email: 'grace@example.com', role: 'editor' }],
}

http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  const body = routes[req.url]
  if (!body) { res.writeHead(404); res.end(JSON.stringify({ error: 'not found' })); return }
  res.writeHead(200)
  res.end(JSON.stringify(body))
}).listen(4001, () => console.log('admin   :4001'))
