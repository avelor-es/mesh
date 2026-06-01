#!/usr/bin/env node
import { watch, existsSync, readFileSync } from 'fs'
import { dirname, resolve }                from 'path'
import { createRequire }                   from 'module'
import { loadConfig }              from '../src/config.js'
import { writeHosts, removeHosts } from '../src/hosts.js'
import { startProxy }              from '../src/proxy.js'
import { ensureCerts }             from '../src/certs.js'
import { init }                    from '../src/init.js'

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

if (cmd !== 'route') {
  console.error('Usage:')
  console.error('  mesh init                      create mesh.yml in current directory')
  console.error('  sudo mesh route                start proxy')
  console.error('  sudo mesh route --config <path>  use a specific config file')
  process.exit(1)
}

if (process.getuid?.() !== 0) {
  console.error('mesh: requires sudo to write /etc/hosts and bind ports 80/443')
  console.error('      both are cleaned up automatically on exit')
  console.error('      sudo mesh route')
  process.exit(1)
}

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

// ── Crash safety — clean /etc/hosts even on unexpected exit ───────────────────

function shutdown(code = 0) {
  removeHosts()
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
