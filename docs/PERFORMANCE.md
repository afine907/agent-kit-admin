# Performance Considerations

## Server

### Database
- Use async SQLAlchemy throughout — no sync calls in async context
- Connection pooling via SQLAlchemy's built-in pool
- Indexes on frequently queried columns (see `docs/architecture/04-data-model.md`)
- Soft delete queries always include `WHERE deleted_at IS NULL` filter

### API
- Pagination on all list endpoints (default page size: 20, max: 100)
- Rate limiting middleware prevents abuse
- Cache-Control headers on package metadata (5 min TTL)

### MinIO
- Tarballs streamed, not buffered in memory
- Content-Length header set for progress bars

## CLI

### Startup
- Lazy imports for non-used commands
- i18n loaded once, cached
- Agent adapter detection is fast (file existence check)

### Network
- HTTP keep-alive for multiple requests
- Retry with exponential backoff on transient failures
- Progress bars for large downloads

## Web

### Bundle Size
- Code splitting via React.lazy for route components
- shadcn/ui tree-shakes unused components
- Vite handles chunk optimization

### Data Fetching
- TanStack Query with staleTime (5 min) prevents refetch storms
- Optimistic updates for mutations
- Background refetch on window focus

### Rendering
- React.memo for expensive list components
- useMemo for computed values
- useCallback for event handlers passed to children

## Infrastructure

- PostgreSQL: tune `shared_buffers`, `work_mem` for workload
- MinIO: use SSD storage for package tarballs
- Caddy: enable gzip compression for API responses
