export function matchRule(rules, serviceName, pathname) {
  const serviceRules = rules[serviceName]
  if (!serviceRules) return null

  for (const rule of serviceRules) {
    if (!pathname.startsWith(rule.path)) continue
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
        res.writeHead(rule.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: statusText(rule.status), injected: true }))
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
