export function matchRule(rules, serviceName, pathname, method) {
  const serviceRules = rules[serviceName]
  if (!serviceRules) return null

  for (const rule of serviceRules) {
    if (!pathname.startsWith(rule.path)) continue
    if (rule.method && rule.method !== method.toUpperCase()) continue
    if (rule.rate === 0) continue
    if (Math.random() * 100 > rule.rate) continue
    return rule
  }

  return null
}

export function applyRule(rule, res) {
  return new Promise(resolve => {
    const respond = () => {
      if (rule.status) {
        const body  = rule.body ?? { error: statusText(rule.status), injected: true }
        const isObj = typeof body !== 'string'
        const raw   = isObj ? JSON.stringify(body) : body
        const type  = isObj ? 'application/json' : 'text/plain'
        res.writeHead(rule.status, { 'Content-Type': type })
        res.end(raw)
      }
      resolve(rule.status != null)
    }

    if (rule.delay) {
      setTimeout(respond, rule.delay)
    } else {
      respond()
    }
  })
}

function statusText(code) {
  const map = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  }
  return map[code] ?? 'Error'
}
