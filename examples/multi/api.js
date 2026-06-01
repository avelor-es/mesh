// node api.js
import http from 'http'

const routes = {
  '/products': { items: [{ id: 1, name: 'Widget', price: 49 }, { id: 2, name: 'Gadget', price: 99 }] },
  '/orders':   { orders: [{ id: 'ORD-001', status: 'shipped' }, { id: 'ORD-002', status: 'pending' }] },
  '/payments': { transaction: 'TXN-8821', status: 'ok', amount: 149 },
}

http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  const body = routes[req.url]
  if (!body) { res.writeHead(404); res.end(JSON.stringify({ error: 'not found' })); return }
  res.writeHead(200)
  res.end(JSON.stringify(body))
}).listen(4000, () => console.log('api     :4000'))
