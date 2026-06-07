import { execFileSync, spawnSync } from 'child_process'
import { chownSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// When running under sudo, restore file ownership to the invoking user
// so that .mesh/ doesn't end up owned by root.
function fixOwnership(...paths) {
  const uid = parseInt(process.env.SUDO_UID ?? '')
  const gid = parseInt(process.env.SUDO_GID ?? '')
  if (!uid || !gid) return
  for (const p of paths) {
    try { chownSync(p, uid, gid) } catch {}
  }
}

function mkcertInstalled() {
  return spawnSync('which', ['mkcert']).status === 0
}

function caInstalled() {
  try {
    const caRoot = execFileSync('mkcert', ['-CAROOT'], { encoding: 'utf8' }).trim()
    return existsSync(resolve(caRoot, 'rootCA.pem'))
  } catch {
    return false
  }
}

function cachedDomains(dir) {
  try {
    return JSON.parse(readFileSync(resolve(dir, 'domains.json'), 'utf8'))
  } catch {
    return []
  }
}

export function ensureCerts(services, cwd = process.cwd()) {
  if (!mkcertInstalled()) {
    console.warn('mesh: mkcert not found — running HTTP only')
    console.warn('      macOS:  brew install mkcert')
    console.warn('      Linux:  apt install mkcert  /  snap install mkcert')
    console.warn('')
    return null
  }

  const dir      = resolve(cwd, '.mesh')
  const certFile = resolve(dir, 'cert.pem')
  const keyFile  = resolve(dir, 'key.pem')

  mkdirSync(dir, { recursive: true })
  fixOwnership(dir)

  if (!caInstalled()) {
    execFileSync('mkcert', ['-install'], { stdio: 'ignore' })
  }

  const domains     = Object.keys(services).map(n => `${n}.test`).sort()
  const cached      = cachedDomains(dir).sort()
  const domainsFile = resolve(dir, 'domains.json')

  const needsRegen = JSON.stringify(domains) !== JSON.stringify(cached)
    || !existsSync(certFile)
    || !existsSync(keyFile)

  if (needsRegen) {
    execFileSync('mkcert', ['-cert-file', certFile, '-key-file', keyFile, ...domains], { stdio: 'ignore' })
    writeFileSync(domainsFile, JSON.stringify(domains))
    fixOwnership(certFile, keyFile, domainsFile)
  }

  return { certFile, keyFile }
}
