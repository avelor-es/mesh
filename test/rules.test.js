import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { matchRule, applyRule } from '../src/rules.js'

function mockRes() {
  const res = { status: null, headers: {}, body: null }
  res.writeHead = (status, headers) => { res.status = status; Object.assign(res.headers, headers) }
  res.end       = (body) => { res.body = body }
  return res
}

const rules = {
  api: [
    { path: '/pay',   method: 'POST', status: 503, delay: null, rate: 100, body: null },
    { path: '/auth',  method: null,   status: 401, delay: null, rate: 100, body: null },
    { path: '/slow',  method: null,   status: null, delay: 200, rate: 100, body: null },
    { path: '/never', method: null,   status: 500, delay: null, rate: 0,   body: null },
    { path: '/body',  method: null,   status: 422, delay: null, rate: 100, body: { code: 'INVALID' } },
    { path: '/text',  method: null,   status: 400, delay: null, rate: 100, body: 'bad input' },
  ],
}

// ── matchRule ──────────────────────────────────────────────────────────────────

describe('matchRule', () => {
  test('returns null for unknown service', () => {
    assert.equal(matchRule(rules, 'missing', '/pay', 'POST'), null)
  })

  test('returns null when path does not match', () => {
    assert.equal(matchRule(rules, 'api', '/other', 'GET'), null)
  })

  test('matches by path prefix', () => {
    const rule = matchRule(rules, 'api', '/auth/login', 'GET')
    assert.equal(rule?.status, 401)
  })

  test('matches exact path', () => {
    const rule = matchRule(rules, 'api', '/auth', 'GET')
    assert.equal(rule?.status, 401)
  })

  test('filters by method — correct method matches', () => {
    const rule = matchRule(rules, 'api', '/pay', 'POST')
    assert.equal(rule?.status, 503)
  })

  test('filters by method — wrong method does not match', () => {
    assert.equal(matchRule(rules, 'api', '/pay', 'GET'), null)
  })

  test('method matching is case-insensitive', () => {
    const rule = matchRule(rules, 'api', '/pay', 'post')
    assert.equal(rule?.status, 503)
  })

  test('rate: 0 never matches', () => {
    for (let i = 0; i < 50; i++) {
      assert.equal(matchRule(rules, 'api', '/never', 'GET'), null)
    }
  })

  test('rate: 100 always matches', () => {
    for (let i = 0; i < 20; i++) {
      assert.ok(matchRule(rules, 'api', '/auth', 'GET') !== null)
    }
  })
})

// ── applyRule ──────────────────────────────────────────────────────────────────

describe('applyRule', () => {
  test('injects status with default body when body is null', async () => {
    const res  = mockRes()
    const rule = { status: 503, delay: null, body: null }
    const injected = await applyRule(rule, res)
    assert.equal(injected, true)
    assert.equal(res.status, 503)
    assert.equal(res.headers['Content-Type'], 'application/json')
    const parsed = JSON.parse(res.body)
    assert.equal(parsed.injected, true)
    assert.ok(parsed.error)
  })

  test('injects object body as JSON', async () => {
    const res  = mockRes()
    const rule = { status: 422, delay: null, body: { code: 'INVALID' } }
    await applyRule(rule, res)
    assert.equal(res.status, 422)
    assert.equal(res.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(res.body), { code: 'INVALID' })
  })

  test('injects string body as text/plain', async () => {
    const res  = mockRes()
    const rule = { status: 400, delay: null, body: 'bad input' }
    await applyRule(rule, res)
    assert.equal(res.status, 400)
    assert.equal(res.headers['Content-Type'], 'text/plain')
    assert.equal(res.body, 'bad input')
  })

  test('delay-only rule does not write response', async () => {
    const res  = mockRes()
    const rule = { status: null, delay: 10, body: null }
    const injected = await applyRule(rule, res)
    assert.equal(injected, false)
    assert.equal(res.status, null)
  })

  test('delay + status waits then responds', async () => {
    const res   = mockRes()
    const rule  = { status: 503, delay: 30, body: null }
    const start = Date.now()
    await applyRule(rule, res)
    assert.ok(Date.now() - start >= 25)
    assert.equal(res.status, 503)
  })
})
