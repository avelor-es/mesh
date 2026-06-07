import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import yaml from 'js-yaml'

const NAME_RE    = /^[a-z0-9][a-z0-9.-]*$/
const METHODS    = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export function findConfigFile(cwd = process.cwd()) {
  for (const name of ['mesh.yml', 'mesh.yaml']) {
    const p = resolve(cwd, name)
    if (existsSync(p)) return p
  }
  throw new Error(`mesh.yml not found in ${cwd} — run 'mesh init' to create one`)
}

export function loadConfig(cwdOrFile = process.cwd()) {
  let path
  if (cwdOrFile.endsWith('.yml') || cwdOrFile.endsWith('.yaml')) {
    path = resolve(cwdOrFile)
    if (!existsSync(path)) throw new Error(`config file not found: ${path}`)
  } else {
    path = findConfigFile(cwdOrFile)
  }

  const data = yaml.load(readFileSync(path, 'utf8'))

  if (!data?.services || typeof data.services !== 'object') {
    throw new Error('mesh.yml must define at least one service')
  }

  const services = {}
  for (const [name, raw] of Object.entries(data.services)) {
    if (!NAME_RE.test(name)) {
      throw new Error(`invalid service name "${name}" — only a-z, 0-9, hyphens and dots allowed`)
    }
    if (typeof raw === 'string') {
      if (!raw.trim()) throw new Error(`service "${name}" command cannot be empty`)
      services[name] = raw.trim()
    } else if (typeof raw === 'number') {
      if (!Number.isInteger(raw) || raw < 1 || raw > 65535) {
        throw new Error(`invalid port for service "${name}": ${raw}`)
      }
      services[name] = raw
    } else {
      throw new Error(`invalid port for service "${name}": ${raw}`)
    }
  }

  const rules = {}
  for (const [name, list] of Object.entries(data.rules ?? {})) {
    if (!services[name]) throw new Error(`rule references unknown service "${name}"`)
    rules[name] = (list ?? []).map((r, i) => {
      const prefix = `rules.${name}[${i}]`
      if (r.status !== undefined && (typeof r.status !== 'number' || !Number.isInteger(r.status))) {
        throw new Error(`${prefix}.status must be an integer`)
      }
      if (r.rate !== undefined && (typeof r.rate !== 'number' || r.rate < 0 || r.rate > 100)) {
        throw new Error(`${prefix}.rate must be a number between 0 and 100`)
      }
      if (r.delay !== undefined && (typeof r.delay !== 'number' || r.delay < 0)) {
        throw new Error(`${prefix}.delay must be a positive number`)
      }
      if (r.method !== undefined && !METHODS.has(r.method.toUpperCase())) {
        throw new Error(`${prefix}.method must be a valid HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)`)
      }
      return {
        path:   r.path   ?? '/',
        method: r.method ? r.method.toUpperCase() : null,
        status: r.status ?? null,
        delay:  r.delay  ?? null,
        rate:   r.rate   ?? 100,
        body:   r.body   ?? null,
      }
    })
  }

  return { services, rules, configPath: path }
}
