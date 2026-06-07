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

export function startServices(managed) {
  // managed: { [name]: { command: string, port: number } }
  if (!Object.keys(managed).length) return { stop() {} }

  let stopping = false
  const children = new Map()

  function logLine(name, line) {
    if (!line.trim()) return
    const time = new Date().toTimeString().slice(0, 8)
    process.stdout.write(`  ${DIM}${time}${RESET}  ${CYAN}${name}${RESET}  ${DIM}│${RESET} ${line}\n`)
  }

  function launch(name, command, port, restartCount = 0, startedAt = Date.now()) {
    const child = spawn(command, [], {
      env:   { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    children.set(name, child)

    let buffer = ''
    function flush(chunk) {
      buffer += String(chunk)
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) logLine(name, line)
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
        if (!stopping) launch(name, command, port, nextCount, Date.now())
      }, delay)
    })

    const time = new Date().toTimeString().slice(0, 8)
    const label = restartCount === 0 ? CYAN : YELLOW
    console.log(`  ${DIM}${time}${RESET}  ${label}${name}${RESET}  ${DIM}→ :${port}  $ ${command}${RESET}`)
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
