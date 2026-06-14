---
name: go-patterns
description: Idiomatic Go patterns for the luban-backend-go service — project layout, error handling, concurrency, context propagation, HTTP handlers, testing, and dual-backend parity with the Java implementation.
origin: luban
---

# Go Development Patterns

Patterns for `luban-backend-go` (`packages/backend/luban-backend-go`, go mod). The Go backend is the second implementation of the luban backend contract; the Java backend (`luban-backend`) is the other. Both MUST behave identically — see `docs/DUAL_BACKEND_PARITY.md`.

## When to Activate

- Writing or modifying any `.go` file under `packages/backend/luban-backend-go`.
- Adding an HTTP handler, service, repository, or migration in Go.
- Touching anything that has a Java counterpart — verify parity.
- Writing Go tests.

## Project Layout

Follow the standard Go layout. Keep handlers thin, services stateless, repositories the only DB touchpoint.

```
packages/backend/luban-backend-go/
├── cmd/
│   └── server/main.go        # entrypoint: wire deps, start HTTP server
├── internal/
│   ├── handler/              # HTTP handlers (net/http or chi/gin) — parse, validate, call service, render
│   ├── service/              # business logic, no transport awareness
│   ├── repository/           # DB access, the ONLY package importing database/sql or the ORM
│   ├── model/                # domain structs
│   └── config/               # config loading (env, files)
├── migrations/               # Go-based or golang-migrate .sql migrations
├── go.mod
└── go.sum
```

Rules:
- `internal/` keeps packages unimportable from outside the module — prefer it over `pkg/` unless a public API is genuinely needed.
- No circular imports: `handler → service → repository → model`. Model imports nothing internal.
- One responsibility per package; do not dump helpers into `util/`.

## Error Handling

Go errors are values. Handle them explicitly, never discard.

### Always check, always wrap

```go
// BAD
rows, err := db.Query(ctx, q)
// err ignored

// GOOD
rows, err := db.Query(ctx, q)
if err != nil {
    return fmt.Errorf("querying materials: %w", err)
}
defer rows.Close()
```

### Sentinel vs typed errors

Prefer `errors.Is`/`errors.As` so wrapping is transparent:

```go
var ErrMaterialNotFound = errors.New("material not found")

// GOOD — comparable through wrapping
if errors.Is(err, ErrMaterialNotFound) {
    return nil, ErrMaterialNotFound // map to 404 at the handler layer
}
```

### Define domain errors at the service boundary; map to HTTP at the handler

```go
// service returns domain errors only
func (s *Service) GetMaterial(ctx context.Context, id string) (*model.Material, error) { ... }

// handler maps domain error -> HTTP status. Keeps parity rules centralized.
switch {
case errors.Is(err, service.ErrMaterialNotFound):
    writeJSON(w, http.StatusNotFound, errBody("MATERIAL_NOT_FOUND", err))
case err != nil:
    writeJSON(w, http.StatusInternalServerError, errBody("INTERNAL", err))
}
```

### No panic in request paths

`panic`/`log.Fatal` belong in `main` startup only. In handlers and libraries, return an error.

## Concurrency

### The race detector is authoritative

Always test with `-race`:

```bash
go test ./... -race -cover
```

A data race is a bug, full stop. Never silence the detector.

### Guard shared mutable state

```go
// BAD — concurrent map write panics
m := map[string]int{}
go func() { m["a"] = 1 }()

// GOOD
var mu sync.RWMutex
m := map[string]int{}
go func() {
    mu.Lock()
    defer mu.Unlock()
    m["a"] = 1
}()
```

### Goroutine lifecycle: always a termination path

```go
// BAD — leaks if ctx never cancels or ch never sends
go func() {
    v := <-ch
    process(v)
}()

// GOOD — honors context cancellation
go func() {
    select {
    case v := <-ch:
        process(v)
    case <-ctx.Done():
        return
    }
}()
```

### `sync.WaitGroup` to await goroutines

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Add(1)
    go func(it Item) {
        defer wg.Done()
        process(ctx, it)
    }(item)
}
wg.Wait()
```

## Context Propagation

- The first parameter of any function that does I/O or may block is `ctx context.Context`.
- Never create `context.Background()`/`context.TODO()` inside a request path to "get rid of" a deadline — propagate what you were given.
- Honor cancellation: in loops and long operations, `select` on `ctx.Done()`.

```go
// GOOD
func (r *Repository) Stream(ctx context.Context, out chan<- Event) {
    defer close(out)
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            out <- Event{}
        }
    }
}
```

## HTTP Handlers

### Defer close, check errors immediately

```go
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
    defer r.Body.Close()
    var req CreateRequest
    if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
        writeJSON(w, http.StatusBadRequest, errBody("BAD_REQUEST", err))
        return
    }
    // ...
}
```

### Limit request bodies

Use `io.LimitReader` to prevent unbounded memory use. Reject payloads above the documented limit with `413`.

### Don't leak the underlying error to clients

Map internal errors to a stable error code + generic message; log the detail server-side.

## Resource Cleanup

`defer` close immediately after the error check:

```go
rows, err := db.Query(ctx, q)
if err != nil {
    return fmt.Errorf("query: %w", err)
}
defer rows.Close()   // right here, before any early return below
```

## Configuration & Secrets

- Read secrets from env or a config file, never hardcode.
- Fail fast at startup if required config is missing.
- Do not log secrets or full DSNs.

## Dual-Backend Parity (MUST)

For every Go handler/service that implements a contract also implemented in Java:

1. **Response body**: identical field names, casing, nesting, null-vs-omitted semantics.
2. **Status codes & error codes**: same condition → same status + same code.
3. **State machines**: identical allowed transitions.
4. **Pagination**: same defaults, ordering, edge-case behavior.
5. **Validation**: same field rules and rejection messages.

When parity cannot be verified from the Go side alone, mark the finding "parity-needs-verification" and require a cross-check against the Java implementation before merge.

```go
// Example: pagination defaults must match Java
const (
    DefaultPageSize = 20   // must equal luban-backend's default
    MaxPageSize     = 100
)
```

## Testing

### Table-driven, locatable names

```go
func TestParse(t *testing.T) {
    cases := []struct {
        name    string
        input   string
        want    int
        wantErr bool
    }{
        {name: "decimal", input: "42", want: 42},
        {name: "empty", input: "", wantErr: true},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            got, err := Parse(tc.input)
            if (err != nil) != tc.wantErr {
                t.Fatalf("Parse(%q) err = %v, wantErr %v", tc.input, err, tc.wantErr)
            }
            if got != tc.want {
                t.Errorf("Parse(%q) = %d, want %d", tc.input, got, tc.want)
            }
        })
    }
}
```

### Run with -race and coverage

```bash
go test ./... -race -cover
```

Coverage target for `luban-backend-go`: 75% (see `docs/TESTING_SPEC.md`).

### No skipped tests without approval

`t.Skip` requires explicit user approval and a tracking issue (luban no-skip contract).

### Sub-packages with concurrency: use `t.Parallel()`

Mark independent sub-tests parallel; do NOT mark parallel any test that mutates shared state or shared DB rows.

## Build, Format, Vet (run from package root before finishing)

```bash
gofmt -w .
go vet ./...
go build ./...
go test ./... -race -cover
```

If `golangci-lint` is configured, run `golangci-lint run ./...` too.

## Common Anti-Patterns

- `interface{}`/`any` for known shapes — define a struct.
- Receiver inconsistency (mixing value/pointer receivers on one type).
- Exported symbols without doc comments.
- `init()` doing I/O or starting goroutines.
- `_ = err` without a justification comment.
- `fmt.Errorf("...: %v", err)` losing wrap chain — use `%w`.
- Returning bare `error` from handlers — wrap to a domain error and map at the edge.
- Reading whole request bodies without `io.LimitReader`.
- `context.Background()` inside a request path.

## Encoding (MUST)

All `.go` files are UTF-8 without BOM. Verify if mojibake appears.
