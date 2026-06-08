import { spawn } from 'child_process'
import net       from 'net'

const RESET  = '\x1b[0m'
const DIM    = '\x1b[2m'
const CYAN   = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'

export function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

// Detects a localhost URL in a log line and returns the port number, or null.
// Matches patterns like: http://localhost:4321  or  http://127.0.0.1:4321
const LOCAL_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|::1):(\d+)/

function detectPort(line) {
  const m = LOCAL_URL_RE.exec(line)
  return m ? parseInt(m[1], 10) : null
}

export function startServices(managed, { onPortChange } = {}) {
  // managed: { [name]: { command: string, port: number } }
  if (!Object.keys(managed).length) return { stop() {} }

  let stopping = false
  const children = new Map()

  function logLine(name, line) {
    if (!line.trim()) return
    const time = new Date().toTimeString().slice(0, 8)
    process.stdout.write(`  ${DIM}${time}${RESET}  ${CYAN}${name}${RESET}  ${DIM}│${RESET} ${line}\n`)
  }

  function launch(name, command, assignedPort, restartCount = 0, startedAt = Date.now()) {
    const child = spawn(command, [], {
      env:   { ...process.env, PORT: String(assignedPort) },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    children.set(name, child)

    let activePort    = assignedPort
    let portConfirmed = false
    let buffer        = ''

    function flush(chunk) {
      buffer += String(chunk)
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        logLine(name, line)
        // If the process started on a different port than we assigned,
        // update the routing table so the proxy reaches the right server.
        if (!portConfirmed) {
          const detected = detectPort(line)
          if (detected) {
            portConfirmed = true
            if (detected !== activePort) {
              activePort = detected
              const time = new Date().toTimeString().slice(0, 8)
              console.log(
                `  ${DIM}${time}${RESET}  ${YELLOW}${name}${RESET}  ` +
                `${DIM}→ :${detected} (ignored PORT=${assignedPort})${RESET}`
              )
              onPortChange?.(name, detected)
            }
          }
        }
      }
    }

    child.stdout.on('data', flush)
    child.stderr.on('data', flush)

    child.on('exit', (code, signal) => {
      if (buffer.trim()) logLine(name, buffer)
      buffer = ''
      if (stopping) return

      const uptime    = Date.now() - startedAt
      const nextCount = uptime > 10_000 ? 0 : restartCount + 1
      const delay     = Math.min(1000 * 2 ** nextCount, 10_000)
      const time      = new Date().toTimeString().slice(0, 8)

      console.log(
        `  ${DIM}${time}${RESET}  ${RED}${name}${RESET}  ` +
        `${DIM}exited (${code ?? signal}) — restarting in ${delay / 1000}s${RESET}`
      )

      setTimeout(() => {
        if (!stopping) launch(name, command, assignedPort, nextCount, Date.now())
      }, delay)
    })

    const time = new Date().toTimeString().slice(0, 8)
    const label = restartCount === 0 ? CYAN : YELLOW
    console.log(`  ${DIM}${time}${RESET}  ${label}${name}${RESET}  ${DIM}→ :${assignedPort}  $ ${command}${RESET}`)
  }

  for (const [name, { command, port }] of Object.entries(managed)) {
    launch(name, command, port)
  }

  return {
    stop() {
      stopping = true
      for (const child of children.values()) {
        try { child.kill('SIGTERM') } catch {}
      }
    },
  }
}
