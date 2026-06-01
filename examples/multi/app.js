// node app.js
import http from 'http'

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>mesh · multi example</title>
</head>
<body>
<h1>mesh · multi</h1>
<p>Four services. Open each link to see the response — failure rules are active on <code>api.test</code> and <code>worker.test</code>.</p>

<h2>api.test</h2>
<ul>
  <li><a href="http://api.test/products">/products</a> — no rules</li>
  <li><a href="http://api.test/orders">/orders</a> — 500 at 20%</li>
  <li><a href="http://api.test/payments">/payments</a> — 503 + 1200ms delay at 35%</li>
</ul>

<h2>admin.test</h2>
<ul>
  <li><a href="http://admin.test/stats">/stats</a> — no rules</li>
  <li><a href="http://admin.test/users">/users</a> — no rules</li>
</ul>

<h2>worker.test</h2>
<ul>
  <li><a href="http://worker.test/jobs">/jobs</a> — 429 at 40%</li>
  <li><a href="http://worker.test/health">/health</a> — no rules</li>
</ul>
</body>
</html>`

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(html)
}).listen(3000, () => console.log('app     :3000'))
