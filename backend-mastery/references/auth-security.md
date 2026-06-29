# Authentication, Authorization & Security Hardening

## Authentication Implementation

### Password Storage
```
NEVER:  MD5, SHA1, SHA256, bcrypt cost < 10, plain text
ALWAYS: bcrypt (cost 12) or Argon2id
```

bcrypt example (Node.js):
```js
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;
const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
const match = await bcrypt.compare(plainPassword, hash);
```

Argon2id (Python, recommended for new projects):
```python
from argon2 import PasswordHasher
ph = PasswordHasher()
hash = ph.hash(password)
ph.verify(hash, password)  # raises exception if wrong
```

---

### JWT Strategy

**Access Token**: short-lived (15 min), stateless
**Refresh Token**: long-lived (7-30 days), stored in httpOnly cookie, tracked in DB

```
Never store JWT in localStorage — vulnerable to XSS.
Store access token in memory (JS variable), refresh token in httpOnly cookie.
```

Refresh token rotation: every time a refresh token is used, issue a new one and
invalidate the old. If a refresh token is used twice, it means theft — invalidate
the entire family.

JWT secret: minimum 256-bit random string. Rotate periodically.
Use RS256 (asymmetric) if multiple services need to verify tokens.

---

### OAuth2 / Social Login

Don't implement OAuth2 from scratch. Use:
- Node.js: Passport.js with official strategies
- Python: Authlib, python-social-auth
- Java: Spring Security OAuth2

Always verify the `state` parameter to prevent CSRF in OAuth flows.
Always verify the token on your server — never trust client-passed tokens.

---

## Authorization

### RBAC (Role-Based Access Control)
Best for most apps:
```
User → Roles → Permissions
Example: User has role "editor" → role has permission "articles:write"
```

### ABAC (Attribute-Based Access Control)
Best for complex rules:
```
"User can edit post IF user.id == post.author_id AND post.status == 'draft'"
```

**Always verify ownership server-side:**
```js
// WRONG - trusts client
const post = await Post.findById(req.body.postId);

// RIGHT - verifies ownership
const post = await Post.findOne({ _id: req.body.postId, authorId: req.user.id });
if (!post) return res.status(403).json({ error: 'Forbidden' });
```

---

## OWASP Top 10 — Implementation Guide

### A01: Broken Access Control
- Enforce authorization on every request, server-side
- Default DENY — whitelist what's allowed, not blacklist what's forbidden
- Rate limit and monitor for IDOR (Insecure Direct Object Reference) patterns

### A02: Cryptographic Failures
- TLS 1.2+ only (disable TLS 1.0, 1.1)
- Don't use weak ciphers (RC4, DES, 3DES)
- Encrypt sensitive data at rest (PII, financial data, health data)
- Never log sensitive data

### A03: Injection
SQL injection prevention (ALWAYS parameterize):
```python
# WRONG
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

# RIGHT
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
```

NoSQL injection — validate and sanitize MongoDB query operators:
```js
// WRONG - user can pass { $gt: "" } as email
User.findOne({ email: req.body.email })

// RIGHT - validate input type first
if (typeof req.body.email !== 'string') return res.status(400)...
```

### A04: Insecure Design
- Threat model before building (who attacks, what do they want)
- Defense in depth — multiple layers, not just one
- Don't trust any user input, even from authenticated users

### A05: Security Misconfiguration
- Default credentials changed on ALL services
- Debug mode OFF in production
- Error messages generic to client (no stack traces)
- Security headers set (see below)
- Unnecessary services/ports disabled

### A06: Vulnerable Components
```bash
# Node.js
npm audit
npx snyk test

# Python
pip-audit
safety check

# Java
./mvnw dependency:check (OWASP plugin)
```

Run these in CI/CD pipeline. Fail build on critical vulnerabilities.

### A07: Identification and Authentication Failures
- Account lockout or exponential backoff after failed login attempts
- Multi-factor authentication for sensitive actions
- Secure password reset (token-based, short TTL, single use)
- Don't enumerate users (same response for "user not found" and "wrong password")

### A08: Software and Data Integrity Failures
- Verify integrity of dependencies (lockfiles, checksums)
- Code signing for releases
- Subresource Integrity (SRI) for CDN scripts

### A09: Security Logging and Monitoring
Log these events:
- Login successes and failures (with IP, timestamp, user agent)
- Password changes and resets
- Permission changes
- High-value data access
- Rate limit violations

Don't log: passwords, tokens, credit card numbers, PII in raw form

### A10: Server-Side Request Forgery (SSRF)
- Validate and whitelist URLs before making server-side HTTP requests
- Don't allow user-supplied URLs to internal services
- Block requests to 169.254.x.x (cloud metadata endpoints)

---

## Security Headers

```nginx
# Nginx config
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; ...";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()";
```

Node.js: use `helmet` middleware (wraps all above).
Python Django: use `django-csp` and `SecurityMiddleware`.

---

## Rate Limiting

```js
// Express + express-rate-limit
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // 5 attempts per minute
  message: { error: 'Too many login attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/auth/login', authLimiter, loginController);
```

Apply tighter limits to: login, register, password reset, OTP endpoints.
Apply general limits to all endpoints (e.g., 100 req/min per IP).

Store rate limit counters in Redis for multi-instance deployments.

---

## Environment & Secrets

```bash
# .env (never commit — add to .gitignore)
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
JWT_SECRET=your-256-bit-random-secret
REDIS_URL=redis://localhost:6379

# .env.example (commit this — no real values)
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-here
REDIS_URL=redis://host:6379
```

For production: use AWS Secrets Manager, HashiCorp Vault, or at minimum
platform environment variables (never hardcoded in source).

---

## Pre-Launch Security Checklist

- [ ] All inputs validated and sanitized
- [ ] Parameterized queries everywhere (zero string-concatenated SQL)
- [ ] Passwords hashed with bcrypt/Argon2id
- [ ] JWT in httpOnly cookies, not localStorage
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS enforced, HTTP redirects to HTTPS
- [ ] Security headers set
- [ ] No stack traces exposed to client
- [ ] No secrets in git history
- [ ] Dependencies audited (npm audit / pip-audit)
- [ ] Database not publicly accessible
- [ ] Least privilege DB users
- [ ] Error logging to server, not client
- [ ] Session invalidation on logout
- [ ] CORS configured correctly (not `*` in production)
