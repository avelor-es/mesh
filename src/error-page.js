export function wantsHtml(req) {
  return (req.headers.accept ?? '').includes('text/html')
}

export function errorPage(status, name, { services = null, port = null, protocol = 'http' } = {}) {
  const is404 = status === 404
  const heading = is404
    ? `<span class="hl">${name}.test</span> not found`
    : `<span class="hl">${name}.test</span> is not responding`
  const message = is404
    ? 'No service is configured for this hostname.'
    : `The service is configured but not reachable on <span class="mono">:${port}</span>. Is it running?`

  const servicesBlock = (is404 && services && Object.keys(services).length)
    ? `<div class="services">
        <div class="label">configured services</div>
        ${Object.entries(services).map(([n, p]) =>
          `<div class="row">
            <a class="name" href="${protocol}://${n}.test">${n}.test</a>
            <span class="port">:${p}</span>
          </div>`
        ).join('')}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mesh — ${status}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d0d;
      color: #555;
      font-family: 'SF Mono', ui-monospace, 'Cascadia Code', monospace;
      font-size: 13px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
    }
    .wrap { width: 100%; max-width: 440px; }
    .status { color: #2a2a2a; font-size: 11px; letter-spacing: 0.08em; margin-bottom: 28px; }
    h1 { color: #ccc; font-size: 16px; font-weight: 500; line-height: 1.5; margin-bottom: 10px; }
    .hl { color: #e2e2e2; }
    p { line-height: 1.7; }
    .mono { font-family: inherit; color: #888; }
    .services { margin-top: 40px; }
    .label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #2a2a2a; margin-bottom: 14px; }
    .row { display: flex; align-items: baseline; gap: 10px; padding: 7px 0; border-top: 1px solid #181818; }
    .name { color: #4ade80; text-decoration: none; }
    .name:hover { color: #86efac; }
    .port { color: #2e2e2e; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="status">mesh / ${status}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    ${servicesBlock}
  </div>
</body>
</html>`
}
