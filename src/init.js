import { existsSync, writeFileSync, readFileSync, appendFileSync } from 'fs'
import { resolve } from 'path'

const TEMPLATE = `services:
  app: 3000
  api: 4000

# rules:
#   api:
#     - path: /payments
#       status: 503
#       rate: 30
#     - path: /slow-endpoint
#       delay: 2000
#       rate: 100
#     - path: /flaky
#       status: 500
#       delay: 800
#       rate: 25
`

export function init(cwd = process.cwd()) {
  const path = resolve(cwd, 'mesh.yml')

  if (existsSync(path)) {
    console.error('mesh: mesh.yml already exists')
    process.exit(1)
  }

  writeFileSync(path, TEMPLATE, 'utf8')
  console.log('mesh: created mesh.yml')

  const gitignorePath = resolve(cwd, '.gitignore')
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8')
    if (!content.includes('.mesh')) {
      appendFileSync(gitignorePath, '\n.mesh/\n')
      console.log('mesh: added .mesh/ to .gitignore')
    }
  }

  console.log('      edit your services and run: sudo mesh route')
}
