# Database Architecture Guide

## The Golden Rule
**Start with PostgreSQL.** It handles relational data, JSON (JSONB), full-text search,
geospatial (PostGIS), and time-series well. Switch to a specialized DB only when Postgres
genuinely can't handle the use case — not just because it "sounds cooler."

---

## Database Categories

### Relational (SQL)

**PostgreSQL** — The default choice
- ACID compliant, battle-tested, open source
- Supports: complex queries, joins, transactions, triggers, stored procedures
- Also supports: JSONB (semi-structured), full-text search, geospatial (PostGIS)
- Use for: e-commerce, SaaS, user data, financial records, anything with relationships
- Connection pooling: PgBouncer (required in production)
- ORM options: SQLAlchemy (Python), Prisma/TypeORM/Sequelize (Node), GORM (Go), Hibernate (Java)

**MySQL / MariaDB**
- Fine alternative to Postgres, slightly weaker feature set
- Use when: existing MySQL infrastructure, team familiarity, some hosting constraints
- Avoid: if you need advanced Postgres features (JSONB, CTEs, window functions)

**SQLite**
- Use ONLY for: local dev, embedded apps, testing, single-user desktop apps
- Never use in production for multi-user web apps

---

### Document (NoSQL)

**MongoDB**
- Best for: Flexible schemas, CMS, user profiles, product catalogs with variable attributes
- Strength: No migrations for schema changes, nested documents, horizontal scaling
- Weakness: No joins (must denormalize or use $lookup — slow), eventual consistency risks,
  easy to create inconsistent data if not careful
- Use when: Schema changes frequently, data is naturally hierarchical, team prefers JSON

**DynamoDB (AWS)**
- Best for: Serverless, massive scale, simple access patterns, AWS-native apps
- Weakness: Very rigid access patterns (design your keys carefully upfront), complex to model
- Use when: You need infinite scale with AWS, access patterns are simple and known

---

### Cache / Session Stores

**Redis**
- Use for: Sessions, caching, rate limiting counters, pub/sub, queues (with Redis Streams or BullMQ)
- Not a primary database — complement your main DB, not replace it
- Always set TTL (expiry) on keys
- Run in persistent mode (AOF or RDB snapshots) if data matters

**Memcached**
- Simpler than Redis, cache-only (no persistence, no data structures beyond strings)
- Use only if you specifically don't need Redis features

---

### Search Engines

**Elasticsearch / OpenSearch**
- Use for: Full-text search, log analytics, complex faceted search
- NOT a primary database — sync from your main DB (Postgres/Mongo)
- Use Meilisearch for simpler, easier-to-operate full-text search

---

### Time-Series

**TimescaleDB**
- PostgreSQL extension — easiest migration path if you're already on Postgres
- Use for: IoT data, metrics, audit logs, analytics

**InfluxDB**
- Dedicated time-series DB
- Use for: Infrastructure metrics, sensor data, high-write-throughput time-series

---

### Graph

**Neo4j**
- Use for: Social networks, recommendation engines, fraud detection, knowledge graphs
- Query language: Cypher
- Overkill for most apps — consider PostgreSQL recursive CTEs first

---

## Schema Design Rules

1. **Normalize first** — then denormalize where performance demands it
2. **Use UUIDs** for primary keys (not auto-increment integers) if you might shard or expose IDs in URLs
3. **Index foreign keys** — always. Every column used in WHERE/JOIN/ORDER BY needs an index.
4. **Never store computed values** — calculate in queries or application layer
5. **Use NOT NULL constraints** aggressively — nullable columns create complexity
6. **Store timestamps** in UTC, always (created_at, updated_at on every table)
7. **Soft deletes** — consider `deleted_at` instead of hard DELETE for audit trails

---

## Common Multi-DB Architectures

### Standard Web App
```
PostgreSQL (primary data)
    + Redis (sessions, cache, rate limits)
```

### Search-Heavy App
```
PostgreSQL (source of truth)
    + Redis (cache)
    + Elasticsearch (search index, synced from Postgres)
```

### Real-Time App
```
PostgreSQL (persistent data)
    + Redis (pub/sub, presence, rate limits)
    + Redis Streams or Kafka (event queue)
```

### High-Scale Read-Heavy
```
PostgreSQL Primary (writes)
    + PostgreSQL Read Replicas (reads)
    + Redis (cache layer in front of replicas)
```

---

## Security for Databases

- Never expose DB port to the internet — only accessible from app servers (private VPC)
- Use separate DB users per service with least-privilege permissions
- Encrypt data at rest (Postgres: pgcrypto or disk-level encryption)
- Encrypt data in transit (SSL/TLS connections required)
- Regular automated backups with tested restore procedures
- Never log SQL queries containing sensitive data (passwords, tokens)
