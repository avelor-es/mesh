import http             from 'http'
import https            from 'https'
import { readFileSync } from 'fs'
import httpProxy        from 'http-proxy'
import { matchRule, applyRule } from './rules.js'
import { wantsHtml, errorPage } from './error-page.js'

const RESET  = '\x1b[0m'
const DIM    = '\x1b[2m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const CYAN   = '\x1b[36m'

export function startProxy(services, rules, certs = null) {
  const proxy = httpProxy.createProxyServer({ xfwd: true })

  proxy.on('error', (err, req, res) => {
    const { name, target } = resolveService(req.headers.host)
    log(RED, 'ERR', name, req.url, `→ ${err.code ?? err.message}`)
    if (!res.headersSent) {
      const protocol = certs ? 'https' : 'http'
      if (wantsHtml(req)) {
        res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(errorPage(502, name, { port: target, protocol }))
      } else {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Service unavailable', service: name }))
      }
    }
  })

  function resolveService(host) {
    const hostname = (host ?? '').replace(/:\d+$/, '')
    const name     = hostname.endsWith('.test') ? hostname.slice(0, -5) : hostname
    return { name, target: services[name] }
  }

  async function handle(req, res) {
    const { name, target } = resolveService(req.headers.host)

    if (!target) {
      const protocol = certs ? 'https' : 'http'
      if (wantsHtml(req)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(errorPage(404, name, { services, protocol }))
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Unknown service: ${name}` }))
      }
      return
    }

    const pathname = new URL(req.url, 'http://x').pathname

    const rule = matchRule(rules, name, pathname, req.method)

    if (rule) {
      const injected = await applyRule(rule, res)
      if (injected) {
        const label = rule.delay ? `${rule.delay}ms+${rule.status}` : `${rule.status}`
        log(YELLOW, label, name, pathname, `→ injected`)
        return
      }
      log(YELLOW, `${rule.delay}ms`, name, pathname, `→ :${target} (delayed)`)
    }

    proxy.web(req, res, { target: `http://127.0.0.1:${target}` })
    if (!rule) log(DIM, '→', name, pathname, `→ :${target}`)
  }

  function handleUpgrade(req, socket, head) {
    const { name, target } = resolveService(req.headers.host)
    if (!target) { socket.destroy(); return }
    proxy.ws(req, socket, head, { target: `ws://127.0.0.1:${target}` }, err => {
      if (err) log(RED, 'WSE', name, req.url, `→ ${err.code ?? err.message}`)
    })
    log(DIM, 'WS', name, req.url, `→ :${target}`)
  }

  const httpServer = http.createServer((req, res) => {
    if (certs) {
      const host = (req.headers.host ?? '').replace(/:80$/, '')
      res.writeHead(301, { Location: `https://${host}${req.url}` })
      res.end()
      return
    }
    handle(req, res)
  })

  httpServer.on('upgrade', handleUpgrade)

  httpServer.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error('mesh: port 80 is already in use — stop whatever is running on it and retry')
      process.exit(1)
    }
    throw err
  })

  httpServer.listen(80, '127.0.0.1', () => onReady(services, rules, certs))

  let httpsServer = null

  if (certs) {
    httpsServer = https.createServer(
      { cert: readFileSync(certs.certFile), key: readFileSync(certs.keyFile) },
      handle
    )
    httpsServer.on('upgrade', handleUpgrade)
    httpsServer.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error('mesh: port 443 is already in use — stop whatever is running on it and retry')
        process.exit(1)
      }
      throw err
    })
    httpsServer.listen(443, '127.0.0.1')
  }

  return { http: httpServer, https: httpsServer }
}

function onReady(services, rules, certs) {
  const pad      = Math.max(...Object.keys(services).map(s => s.length))
  const protocol = certs ? 'https' : 'http'

  console.log('')
  console.log(`  ${CYAN}mesh${RESET}  ${certs ? 'https + http→https redirect' : 'http only'}`)
  console.log('')
  for (const [name, port] of Object.entries(services)) {
    console.log(`  ${GREEN}${name.padEnd(pad)}.test${RESET}  ${DIM}→ :${port}  ${protocol}://${name}.test${RESET}`)
  }
  if (Object.keys(rules).length) {
    console.log('')
    for (const [svc, ruleList] of Object.entries(rules)) {
      for (const r of ruleList) {
        const type      = r.status ? `${r.status}` : `${r.delay}ms delay`
        const methodStr = r.method ? `${r.method} ` : ''
        console.log(`  ${YELLOW}${svc}${r.path}${RESET}  ${DIM}${methodStr}${r.rate}% → ${type}${RESET}`)
      }
    }
  }
  console.log('')
}

function log(color, label, service, path, tail) {
  const time = new Date().toTimeString().slice(0, 8)
  console.log(`  ${DIM}${time}${RESET}  ${color}${label}${RESET}  ${service}${DIM}${path}${RESET}  ${DIM}${tail}${RESET}`)
}
