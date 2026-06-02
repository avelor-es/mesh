import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeHosts, removeHosts, removeMeshBlock } from '../src/hosts.js'

function tmpFile(dir, content = '') {
  const p = join(dir, 'hosts')
  writeFileSync(p, content, 'utf8')
  return p
}

// ── removeMeshBlock ────────────────────────────────────────────────────────────

describe('removeMeshBlock', () => {
  test('leaves file without mesh block unchanged', () => {
    const input = '127.0.0.1 localhost\n'
    assert.equal(removeMeshBlock(input), input)
  })

  test('removes a mesh block', () => {
    const input = '127.0.0.1 localhost\n\n# mesh:start\n127.0.0.1 app.test\n# mesh:end\n'
    const result = removeMeshBlock(input)
    assert.ok(!result.includes('mesh:start'))
    assert.ok(!result.includes('app.test'))
    assert.ok(result.includes('127.0.0.1 localhost'))
  })

  test('removes multiple mesh blocks', () => {
    const block  = '\n# mesh:start\n127.0.0.1 x.test\n# mesh:end\n'
    const input  = `base${block}middle${block}end`
    const result = removeMeshBlock(input)
    assert.ok(!result.includes('mesh:start'))
    assert.ok(result.includes('base'))
    assert.ok(result.includes('middle'))
    assert.ok(result.includes('end'))
  })
})

// ── writeHosts / removeHosts ───────────────────────────────────────────────────

describe('writeHosts + removeHosts', () => {
  let dir, hostsFile

  before(() => { dir = mkdtempSync(join(tmpdir(), 'mesh-hosts-')) })
  after(() => rmSync(dir, { recursive: true }))
  beforeEach(() => { hostsFile = tmpFile(dir, '127.0.0.1 localhost\n') })

  test('appends a mesh block with service entries', () => {
    writeHosts({ app: 3000, api: 4000 }, hostsFile)
    const content = readFileSync(hostsFile, 'utf8')
    assert.ok(content.includes('127.0.0.1 app.test'))
    assert.ok(content.includes('127.0.0.1 api.test'))
    assert.ok(content.includes('# mesh:start'))
    assert.ok(content.includes('# mesh:end'))
  })

  test('preserves existing content', () => {
    writeHosts({ app: 3000 }, hostsFile)
    const content = readFileSync(hostsFile, 'utf8')
    assert.ok(content.includes('127.0.0.1 localhost'))
  })

  test('replaces previous mesh block on re-write', () => {
    writeHosts({ app: 3000 }, hostsFile)
    writeHosts({ app: 3000, api: 4000 }, hostsFile)
    const content = readFileSync(hostsFile, 'utf8')
    const count = (content.match(/# mesh:start/g) ?? []).length
    assert.equal(count, 1)
    assert.ok(content.includes('127.0.0.1 api.test'))
  })

  test('removeHosts strips the mesh block', () => {
    writeHosts({ app: 3000 }, hostsFile)
    removeHosts(hostsFile)
    const content = readFileSync(hostsFile, 'utf8')
    assert.ok(!content.includes('mesh:start'))
    assert.ok(!content.includes('app.test'))
    assert.ok(content.includes('127.0.0.1 localhost'))
  })

  test('removeHosts is idempotent', () => {
    writeHosts({ app: 3000 }, hostsFile)
    removeHosts(hostsFile)
    removeHosts(hostsFile)
    const content = readFileSync(hostsFile, 'utf8')
    assert.ok(!content.includes('mesh:start'))
  })
})
