import { execFileSync, spawnSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

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

  if (!caInstalled()) {
    execFileSync('mkcert', ['-install'], { stdio: 'ignore' })
  }

  const domains = Object.keys(services).map(n => `${n}.test`).sort()
  const cached  = cachedDomains(dir).sort()

  const needsRegen = JSON.stringify(domains) !== JSON.stringify(cached)
    || !existsSync(certFile)
    || !existsSync(keyFile)

  if (needsRegen) {
    execFileSync('mkcert', ['-cert-file', certFile, '-key-file', keyFile, ...domains], { stdio: 'ignore' })
    writeFileSync(resolve(dir, 'domains.json'), JSON.stringify(domains))
  }

  return { certFile, keyFile }
}
