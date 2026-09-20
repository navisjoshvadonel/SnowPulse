# Bolt Performance Journal

## 2025-02-23 - Offloading Synchronous DB Query in Trigger Insights Endpoint

### What
Offloaded synchronous database query in `async def trigger_insights_generation` endpoint to a background threadpool using `starlette.concurrency.run_in_threadpool`.

### Why
When FastAPI endpoints declared with `async def` execute synchronous blocking I/O calls (such as SQLAlchemy database queries via `db.query(...)`), they run directly on the main asyncio event loop thread, blocking all other incoming HTTP requests and async tasks. By offloading the blocking DB query to `run_in_threadpool`, the query executes in Starlette's threadpool executor without blocking the event loop. Keeping the endpoint `async def` allows async coroutines like `await JobManager.submit_job(...)` to execute natively on the main event loop without event loop recreation overhead or context mismatch issues.

### Impact
- Eliminates event-loop blocking during database queries on the `/api/insights/trigger/{dataset_id}` endpoint.
- Preserves native async execution for job submission and maintains shared connection pool state.
- Ensures high request throughput and low latency under concurrent load.
