# Deployment & Infrastructure Guide

## Minimum Production Setup

```
Internet → DNS (Cloudflare) → Load Balancer → Nginx → App Server(s) → Database
                                                              ↕
                                                         Redis Cache
```

---

## Docker & Containerization

Every backend should have a Dockerfile. Example (Node.js):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 3000
CMD ["node", "src/index.js"]
```

Key Docker security rules:
- Never run as root in container
- Use specific version tags, not `latest`
- Multi-stage builds to reduce image size
- `.dockerignore` to exclude node_modules, .env, .git

---

## Nginx Configuration (Production)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
}
```

---

## Cloud Platform Guide

### AWS (Most Common)
- **Compute**: EC2 (VMs), ECS/EKS (containers), Lambda (serverless)
- **Database**: RDS (Postgres/MySQL managed), DynamoDB (NoSQL), ElastiCache (Redis)
- **Storage**: S3 (files), EFS (shared filesystem)
- **Networking**: VPC, Security Groups, ALB (load balancer), CloudFront (CDN)
- **Secrets**: Secrets Manager
- **CI/CD**: CodePipeline or GitHub Actions → ECR → ECS

### GCP
- **Compute**: Cloud Run (containers, serverless), GKE (Kubernetes), Compute Engine
- **Database**: Cloud SQL (Postgres/MySQL), Firestore (NoSQL), Memorystore (Redis)
- **Storage**: Cloud Storage
- **Best for**: ML workloads (TPUs, Vertex AI), global apps

### Hetzner / DigitalOcean / Linode (Budget-friendly)
- Best for: startups, solo projects, cost-sensitive deployments
- Use with: Coolify or Dokku (self-hosted PaaS on a VPS)
- Much cheaper than AWS for small-medium scale

---

## CI/CD (GitHub Actions example)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build and push Docker image
        run: |
          docker build -t myapp:${{ github.sha }} .
          docker push registry/myapp:${{ github.sha }}

      - name: Deploy to server
        run: ssh deploy@server "docker pull ... && docker-compose up -d"
```

---

## Monitoring Stack

**Errors**: Sentry (free tier available) — captures exceptions with stack traces and context
**Metrics**: Prometheus + Grafana — for custom app metrics, infrastructure metrics
**Logs**: 
- Small scale: stdout → Papertrail or Logtail
- Medium scale: ELK stack (Elasticsearch + Logstash + Kibana) or Loki + Grafana
**Uptime**: UptimeRobot or Betterstack (free tier available)
**APM**: Datadog or New Relic for full observability (paid)

Structured logging example (Node.js with pino):
```js
const logger = require('pino')();
logger.info({ userId: 42, action: 'login', ip: req.ip }, 'User logged in');
// Output: {"level":30,"time":...,"userId":42,"action":"login","msg":"User logged in"}
```

---

## Environment Management

| Environment | Purpose | Config |
|---|---|---|
| Development | Local coding | .env file, local DB |
| Staging | Pre-production testing | Mirrors production config |
| Production | Real users | Secrets manager, hardened |

Never test against production. Always have staging that mirrors production.
