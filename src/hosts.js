import { readFileSync, writeFileSync } from 'fs'

const HOSTS_FILE  = '/etc/hosts'
const MESH_START  = '# mesh:start'
const MESH_END    = '# mesh:end'

export function writeHosts(services) {
  const current = readFileSync(HOSTS_FILE, 'utf8')

  // Remove any previous mesh block
  const clean = removeMeshBlock(current)

  const entries = Object.keys(services)
    .map(name => `127.0.0.1 ${name}.test`)
    .join('\n')

  const next = `${clean.trimEnd()}\n\n${MESH_START}\n${entries}\n${MESH_END}\n`

  writeFileSync(HOSTS_FILE, next, 'utf8')
}

export function removeHosts() {
  try {
    const current = readFileSync(HOSTS_FILE, 'utf8')
    writeFileSync(HOSTS_FILE, removeMeshBlock(current).trimEnd() + '\n', 'utf8')
  } catch {
    // Best-effort cleanup
  }
}

function removeMeshBlock(content) {
  return content.replace(
    new RegExp(`\\n?${MESH_START}[\\s\\S]*?${MESH_END}\\n?`, 'g'),
    ''
  )
}
