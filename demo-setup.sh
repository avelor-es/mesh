#!/usr/bin/env bash
# Creates the demo environment for VHS recording
set -e

cd /tmp
rm -rf mesh-demo
mkdir mesh-demo
cd mesh-demo

cat > mesh.yml << 'EOF'
services:
  app: 3000
  api: 4000
  admin: 5001

rules:
  api:
    - path: /payments
      method: POST
      status: 503
      rate: 35
    - path: /auth/login
      status: 401
      rate: 20
    - path: /slow
      delay: 2000
      rate: 100
EOF

node -e '
var state = {
  pid: 1,
  configPath: "/tmp/mesh-demo/mesh.yml",
  services: { app: 3000, api: 4000, admin: 5001 },
  rules: {
    api: [
      { path: "/payments", method: "POST", status: 503, rate: 35 },
      { path: "/auth/login", status: 401, rate: 20 },
      { path: "/slow", delay: 2000, rate: 100 }
    ]
  },
  https: false
};
require("fs").writeFileSync("/tmp/.mesh.json", JSON.stringify(state));
'
