# Language Selection Deep Guide

## Decision Factors (ranked by importance)

### 1. Team Expertise
This is the #1 factor. A team that knows Python well will outperform a team struggling with Go,
even if Go is "better" for the use case. Never choose a language the team doesn't know
unless the project has a long ramp-up period.

### 2. Problem Domain Match

**Python**
- Best for: ML/AI integration, data processing, rapid prototyping, scientific computing
- Frameworks: FastAPI (async, fast, modern), Django (batteries-included, ORM, admin), Flask (minimal)
- Weakness: Not great for CPU-bound parallelism due to GIL; slower raw throughput than Go/Java
- Use FastAPI when: You need async, auto-generated OpenAPI docs, Pydantic validation
- Use Django when: You need an admin panel, ORM, auth system out of the box

**Node.js**
- Best for: Real-time apps, I/O-bound services, teams that know JS/TS, BFF (backend for frontend)
- Frameworks: Express (minimal), Fastify (fast, schema-based), NestJS (opinionated, enterprise)
- Weakness: Single-threaded (use worker threads or cluster for CPU work); callback complexity
- Use NestJS when: Large team, need dependency injection, modular architecture
- Use Fastify when: Raw performance is important, want schema validation built in

**Go**
- Best for: High concurrency, microservices, CLI tools, network services, performance-critical APIs
- Frameworks: Gin, Echo, Chi (all lightweight routers — Go has no "full framework")
- Strength: Compiles to a single binary, extremely fast, built-in goroutines for concurrency
- Weakness: Verbose error handling, less mature ORM ecosystem than Python/Node
- Use Go when: You need 10k+ concurrent connections, low-latency microservices

**Java / Spring Boot**
- Best for: Enterprise, large teams, complex domain logic, financial/banking systems
- Strength: Strong typing, mature ecosystem, excellent tooling, Spring Security
- Weakness: Verbose, slow startup (mitigated by Spring Native / GraalVM), heavy
- Use when: Team is experienced with Java, enterprise contracts require it, long-lived project

**Rust**
- Best for: Systems programming, WebAssembly, extreme performance requirements
- Weakness: Steep learning curve, slow compile times, overkill for most web apps
- Use when: You need C-level performance with memory safety (rare for typical web backends)

**C# / ASP.NET Core**
- Best for: Windows ecosystem, .NET shops, enterprise apps, game backends (Unity)
- Strength: Excellent typing, fast, good async, Blazor for full-stack
- Use when: Team is in .NET ecosystem or client requires it

---

## Framework Comparison Table

| Framework | Language | Speed | Learning Curve | Best For |
|---|---|---|---|---|
| FastAPI | Python | High | Low | Modern APIs, ML backends |
| Django | Python | Medium | Medium | Full-featured web apps |
| NestJS | TypeScript | High | Medium-High | Enterprise Node apps |
| Express | JavaScript | High | Very Low | Prototypes, simple APIs |
| Gin | Go | Very High | Medium | High-perf microservices |
| Spring Boot | Java | High | High | Enterprise systems |
| ASP.NET Core | C# | High | Medium | .NET ecosystem |

---

## Anti-patterns to warn users about

- "I'll use PHP because I know it" — valid, but warn about modern PHP vs legacy pitfalls
- "Let me use Rust for my first backend" — almost always overkill, steer toward Go if performance matters
- Mixing languages in a monolith — choose one language per service
- Using a framework the whole team is unfamiliar with under deadline pressure
