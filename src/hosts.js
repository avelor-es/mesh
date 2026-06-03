import { readFileSync, writeFileSync } from 'fs'

const HOSTS_FILE  = '/etc/hosts'
const MESH_START  = '# mesh:start'
const MESH_END    = '# mesh:end'

export function writeHosts(services, hostsFile = HOSTS_FILE) {
  const current = readFileSync(hostsFile, 'utf8')
  const clean   = removeMeshBlock(current)
  const entries = Object.keys(services)
    .flatMap(name => [`127.0.0.1 ${name}.test`, `::1 ${name}.test`])
    .join('\n')
  const next = `${clean.trimEnd()}\n\n${MESH_START}\n${entries}\n${MESH_END}\n`
  writeFileSync(hostsFile, next, 'utf8')
}

export function removeHosts(hostsFile = HOSTS_FILE) {
  try {
    const current = readFileSync(hostsFile, 'utf8')
    writeFileSync(hostsFile, removeMeshBlock(current).trimEnd() + '\n', 'utf8')
  } catch {
    // Best-effort cleanup
  }
}

export function removeMeshBlock(content) {
  return content.replace(
    new RegExp(`\\n?${MESH_START}[\\s\\S]*?${MESH_END}\\n?`, 'g'),
    ''
  )
}
