# API Design Reference

## REST API Design

### URL Structure
```
# Resources are nouns, not verbs
GET    /api/v1/users          # list users
POST   /api/v1/users          # create user
GET    /api/v1/users/:id      # get user
PUT    /api/v1/users/:id      # replace user (full update)
PATCH  /api/v1/users/:id      # partial update
DELETE /api/v1/users/:id      # delete user

# Nested resources
GET    /api/v1/users/:id/posts        # user's posts
POST   /api/v1/users/:id/posts        # create post for user
GET    /api/v1/users/:id/posts/:postId

# Keep nesting to 2 levels max
```

### Response Shapes

Success:
```json
{
  "data": { ... },
  "meta": { "total": 100, "page": 1, "perPage": 20 }
}
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [{ "field": "email", "message": "Required" }]
  }
}
```

### HTTP Status Codes
```
200 OK              — GET, PATCH, PUT success
201 Created         — POST success (include Location header)
204 No Content      — DELETE success
400 Bad Request     — malformed request, missing fields
401 Unauthorized    — not authenticated (no/invalid token)
403 Forbidden       — authenticated but not authorized
404 Not Found       — resource doesn't exist
409 Conflict        — duplicate (e.g., email already registered)
422 Unprocessable   — validation errors on valid JSON
429 Too Many Requests — rate limited
500 Internal Error  — unexpected server error (never expose details)
```

### Pagination
```
# Offset-based (simple, works for most cases)
GET /api/v1/posts?page=2&perPage=20

# Cursor-based (better for real-time data, large datasets)
GET /api/v1/posts?cursor=eyJpZCI6MTAwfQ==&limit=20

# Always include in response:
{
  "data": [...],
  "meta": {
    "total": 500,
    "page": 2,
    "perPage": 20,
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTIwfQ=="
  }
}
```

### Filtering & Sorting
```
GET /api/v1/products?category=electronics&minPrice=100&maxPrice=500
GET /api/v1/users?sort=createdAt&order=desc
GET /api/v1/posts?status=published&authorId=42
```

Validate all filter parameters server-side. Never pass raw filter strings to ORM queries.

---

## GraphQL

Use when:
- Multiple clients (mobile, web, third-party) with different data needs
- Complex nested data with many relationships
- Want to avoid over-fetching or under-fetching

Tools: Apollo Server, Pothos (Node), Strawberry (Python), gqlgen (Go)

Key patterns:
- Use DataLoader to batch DB queries (prevents N+1 query problem)
- Implement query complexity limits (prevent DoS via deep nesting)
- Use persisted queries in production
- Disable introspection in production if API is private

---

## gRPC (for internal microservices)

Use when:
- Service-to-service communication (not browser clients)
- Need high throughput and low latency
- Want strong contracts via Protocol Buffers

```proto
service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc CreateUser (CreateUserRequest) returns (User);
  rpc ListUsers (ListUsersRequest) returns (stream User);
}
```

---

## WebSockets (real-time)

Libraries:
- Node.js: Socket.io (with fallbacks), ws (raw)
- Python: FastAPI WebSockets, Django Channels
- Go: Gorilla WebSocket

Patterns:
- Authenticate the WebSocket connection at the HTTP upgrade phase
- Use rooms/namespaces for grouping connections
- Use Redis pub/sub to broadcast across multiple server instances
- Implement heartbeat/ping-pong to detect dead connections
- Always handle reconnection on client side

---

## API Versioning Strategies

**URL versioning** (recommended): `/api/v1/`, `/api/v2/`
- Explicit, cacheable, easy to route
- Downside: duplicates routes

**Header versioning**: `Accept: application/vnd.myapi.v2+json`
- Cleaner URLs
- Harder to test in browser

**Don't version prematurely** — but design APIs to be extensible (additive changes are non-breaking).

Breaking changes: removing fields, changing field types, changing behavior
Non-breaking: adding optional fields, adding new endpoints

---

## Input Validation Libraries

| Language | Library | Notes |
|---|---|---|
| Node/TS | Zod | TypeScript-native, excellent DX |
| Node/JS | Joi | Mature, feature-rich |
| Python | Pydantic | FastAPI's default, very powerful |
| Go | go-playground/validator | Struct tags, widely used |
| Java | Bean Validation (Hibernate Validator) | Standard Java EE |

Always validate:
- Types (string vs number vs array)
- Required vs optional
- String length limits
- Number ranges
- Enum values
- Email/URL format
- File size and MIME type for uploads
