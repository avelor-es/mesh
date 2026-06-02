import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig } from '../src/config.js'

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'mesh-test-'))
}

function writeYml(dir, content) {
  const p = join(dir, 'mesh.yml')
  writeFileSync(p, content, 'utf8')
  return p
}

// ── valid configs ──────────────────────────────────────────────────────────────

describe('loadConfig — valid', () => {
  let dir
  before(() => { dir = tmpDir() })
  after(() => rmSync(dir, { recursive: true }))

  test('parses services', () => {
    writeYml(dir, 'services:\n  app: 3000\n  api: 4000\n')
    const { services } = loadConfig(dir)
    assert.deepEqual(services, { app: 3000, api: 4000 })
  })

  test('accepts subdomain-style names', () => {
    writeYml(dir, 'services:\n  tenant1.app: 3000\n')
    const { services } = loadConfig(dir)
    assert.equal(services['tenant1.app'], 3000)
  })

  test('returns empty rules when omitted', () => {
    writeYml(dir, 'services:\n  app: 3000\n')
    const { rules } = loadConfig(dir)
    assert.deepEqual(rules, {})
  })

  test('parses rules with defaults', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - path: /pay',
      '      status: 503',
    ].join('\n'))
    const { rules } = loadConfig(dir)
    assert.equal(rules.api[0].status, 503)
    assert.equal(rules.api[0].rate, 100)
    assert.equal(rules.api[0].path, '/pay')
    assert.equal(rules.api[0].method, null)
    assert.equal(rules.api[0].body, null)
  })

  test('parses method (normalises to uppercase)', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - path: /pay',
      '      method: post',
      '      status: 503',
    ].join('\n'))
    const { rules } = loadConfig(dir)
    assert.equal(rules.api[0].method, 'POST')
  })

  test('parses object body', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - path: /pay',
      '      status: 503',
      '      body:',
      '        error: down',
    ].join('\n'))
    const { rules } = loadConfig(dir)
    assert.deepEqual(rules.api[0].body, { error: 'down' })
  })

  test('parses string body', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - path: /pay',
      '      status: 400',
      '      body: bad input',
    ].join('\n'))
    const { rules } = loadConfig(dir)
    assert.equal(rules.api[0].body, 'bad input')
  })

  test('default path is /', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - status: 503',
    ].join('\n'))
    const { rules } = loadConfig(dir)
    assert.equal(rules.api[0].path, '/')
  })

  test('configPath is returned', () => {
    writeYml(dir, 'services:\n  app: 3000\n')
    const { configPath } = loadConfig(dir)
    assert.ok(configPath.endsWith('mesh.yml'))
  })
})

// ── validation errors ──────────────────────────────────────────────────────────

describe('loadConfig — validation errors', () => {
  let dir
  before(() => { dir = tmpDir() })
  after(() => rmSync(dir, { recursive: true }))

  test('throws when mesh.yml not found', () => {
    assert.throws(() => loadConfig('/tmp/definitely-does-not-exist-mesh'), /not found/)
  })

  test('throws when services is missing', () => {
    writeYml(dir, 'rules: {}')
    assert.throws(() => loadConfig(dir), /must define/)
  })

  test('throws on invalid service name', () => {
    writeYml(dir, 'services:\n  "My App": 3000\n')
    assert.throws(() => loadConfig(dir), /invalid service name/)
  })

  test('throws on port out of range', () => {
    writeYml(dir, 'services:\n  app: 99999\n')
    assert.throws(() => loadConfig(dir), /invalid port/)
  })

  test('throws on non-numeric port', () => {
    writeYml(dir, 'services:\n  app: "three-thousand"\n')
    assert.throws(() => loadConfig(dir), /invalid port/)
  })

  test('throws when rule references unknown service', () => {
    writeYml(dir, [
      'services:',
      '  app: 3000',
      'rules:',
      '  api:',
      '    - status: 503',
    ].join('\n'))
    assert.throws(() => loadConfig(dir), /unknown service/)
  })

  test('throws on invalid method', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - path: /x',
      '      method: BREW',
      '      status: 503',
    ].join('\n'))
    assert.throws(() => loadConfig(dir), /valid HTTP method/)
  })

  test('throws on non-integer status', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - status: "five-hundred"',
    ].join('\n'))
    assert.throws(() => loadConfig(dir), /status must be/)
  })

  test('throws on rate out of range', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - status: 503',
      '      rate: 150',
    ].join('\n'))
    assert.throws(() => loadConfig(dir), /rate must be/)
  })

  test('throws on negative delay', () => {
    writeYml(dir, [
      'services:',
      '  api: 4000',
      'rules:',
      '  api:',
      '    - delay: -100',
    ].join('\n'))
    assert.throws(() => loadConfig(dir), /delay must be/)
  })
})
