#!/usr/bin/env node
import { watch, existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { spawn, spawnSync }                from 'child_process'
import { dirname, resolve }                from 'path'
import { createRequire }                   from 'module'
import { loadConfig }              from '../src/config.js'
import { writeHosts, removeHosts } from '../src/hosts.js'
import { startProxy }              from '../src/proxy.js'
import { ensureCerts }             from '../src/certs.js'
import { init }                    from '../src/init.js'

const STATE_FILE = '/tmp/.mesh.json'

// Re-exec the current command under sudo if not already root.
// Uses sudo -E to preserve PATH so mkcert and other tools remain findable.
function autoSudo() {
  if (process.getuid?.() === 0) return
  const result = spawnSync('sudo', ['-E', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit' })
  process.exit(result.status ?? 1)
}

const RESET  = '\x1b[0m'
const DIM    = '\x1b[2m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const cmd  = args.find(a => !a.startsWith('-'))

const configIdx  = args.indexOf('--config')
const configArg  = configIdx !== -1 ? args[configIdx + 1] : null

if (args.includes('--version') || args.includes('-v')) {
  const { version } = createRequire(import.meta.url)('../package.json')
  console.log(version)
  process.exit(0)
}

if (cmd === 'init') {
  init()
  process.exit(0)
}

if (cmd === 'start') {
  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    let alive = false
    try { process.kill(state.pid, 0); alive = true } catch (e) { if (e.code === 'EPERM') alive = true }
    if (alive) {
      console.error(`mesh: already running (pid ${state.pid}) — run mesh stop first`)
      process.exit(1)
    }
  } catch { /* not running */ }

  autoSudo()

  const forwardArgs = args.filter(a => a !== 'start')
  const child = spawn(process.execPath, [process.argv[1], 'route', ...forwardArgs], {
    detached: true,
    stdio:    'ignore',
  })

  const pid      = child.pid
  const deadline = Date.now() + 5000

  ;(function poll() {
    let alive = true
    try { process.kill(pid, 0) } catch (e) { if (e.code !== 'EPERM') alive = false }

    if (!alive) {
      console.error('mesh: failed to start — check your mesh.yml and that ports 80/443 are free')
      process.exit(1)
    }

    try {
      const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
      if (state.pid === pid) {
        child.unref()
        console.log(`mesh: started (pid ${pid})`)
        process.exit(0)
      }
    } catch { /* not ready yet */ }

    if (Date.now() >= deadline) {
      child.kill()
      console.error('mesh: timed out waiting for proxy to start')
      process.exit(1)
    }

    setTimeout(poll, 50)
  })()
}

if (cmd === 'stop') {
  let state
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    console.error('mesh: not running')
    process.exit(1)
  }
  try {
    process.kill(state.pid, 'SIGTERM')
    console.log(`mesh: stopped (pid ${state.pid})`)
  } catch (err) {
    if (err.code === 'EPERM') {
      autoSudo()
    }
    if (err.code === 'ESRCH') {
      try { unlinkSync(STATE_FILE) } catch {}
      console.error('mesh: not running (stale state removed)')
      process.exit(1)
    }
    console.error('mesh:', err.message)
    process.exit(1)
  }
  process.exit(0)
}

if (cmd === 'status') {
  let state
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    console.error('mesh: not running')
    process.exit(1)
  }

  let alive = false
  try {
    process.kill(state.pid, 0)
    alive = true
  } catch (err) {
    if (err.code === 'EPERM') alive = true
  }

  if (!alive) {
    try { unlinkSync(STATE_FILE) } catch {}
    console.error('mesh: not running (stale state removed)')
    process.exit(1)
  }

  const protocol = state.https ? 'https' : 'http'
  const pad = Math.max(...Object.keys(state.services).map(s => s.length))
  console.log('')
  console.log(`  ${CYAN}mesh${RESET}  running  ${DIM}pid ${state.pid}${RESET}`)
  console.log('')
  for (const [name, port] of Object.entries(state.services)) {
    console.log(`  ${GREEN}${name.padEnd(pad)}.test${RESET}  ${DIM}→ :${port}  ${protocol}://${name}.test${RESET}`)
  }
  const rules = state.rules ?? {}
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
  process.exit(0)
}

if (cmd !== 'route') {
  console.error('Usage:')
  console.error('  mesh init                       create mesh.yml in current directory')
  console.error('  mesh start                      start proxy in background')
  console.error('  mesh start --config <path>      use a specific config file')
  console.error('  mesh stop                       stop the background proxy')
  console.error('  mesh status                     show running services')
  console.error('  mesh route                      start proxy in foreground (debug)')
  process.exit(1)
}

autoSudo()

// ── Load config ───────────────────────────────────────────────────────────────

let config
try {
  config = loadConfig(configArg ?? process.cwd())
} catch (err) {
  console.error('mesh:', err.message)
  process.exit(1)
}

const { services, rules, configPath } = config

writeHosts(services)

const configDir = dirname(resolve(configPath))
const certs     = ensureCerts(services, configDir)
const servers   = startProxy(services, rules, certs)

writeFileSync(STATE_FILE, JSON.stringify({ pid: process.pid, configPath, services, rules, https: !!certs }))

// ── Crash safety — clean /etc/hosts even on unexpected exit ───────────────────

function shutdown(code = 0) {
  removeHosts()
  try { unlinkSync(STATE_FILE) } catch {}
  servers.http.close()
  servers.https?.close()
  process.exit(code)
}

process.on('SIGINT',  () => { console.log('\n  mesh  cleaning up...'); shutdown(0) })
process.on('SIGTERM', () => shutdown(0))

process.on('uncaughtException', err => {
  console.error('\n  mesh  uncaught exception:', err.message)
  shutdown(1)
})

process.on('unhandledRejection', err => {
  console.error('\n  mesh  unhandled rejection:', err?.message ?? err)
  shutdown(1)
})

// ── Hot-reload ────────────────────────────────────────────────────────────────

let reloadTimer
watch(configPath, () => {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    try {
      const next = loadConfig(configPath)

      const hasNewServices = Object.keys(next.services).some(k => !services[k])

      Object.keys(services).forEach(k => delete services[k])
      Object.assign(services, next.services)
      Object.keys(rules).forEach(k => delete rules[k])
      Object.assign(rules, next.rules)

      writeHosts(services)
      writeFileSync(STATE_FILE, JSON.stringify({ pid: process.pid, configPath, services, rules, https: !!certs }))

      if (certs && hasNewServices) {
        const newCerts = ensureCerts(services, configDir)
        if (newCerts && servers.https) {
          servers.https.setSecureContext({
            cert: readFileSync(newCerts.certFile),
            key:  readFileSync(newCerts.keyFile),
          })
        }
      }

      console.log('\n  mesh  config reloaded\n')
    } catch (err) {
      console.error('\n  mesh  config reload failed:', err.message, '\n')
    }
  }, 100)
})
