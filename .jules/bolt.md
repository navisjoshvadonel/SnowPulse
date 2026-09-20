# Bolt Performance Journal

## 2026-09-20 - Unblock Event Loop in Async Endpoint with run_in_threadpool

### What
Offloaded synchronous SQLAlchemy database lookup `_get_dataset_for_user(db, dataset_id, current_user)` in `/api/forecast/train/{dataset_id}` endpoint to FastAPI's `run_in_threadpool`.

### Why
When a route handler in FastAPI is declared with `async def`, FastAPI executes it directly on the asyncio event loop thread. Calling synchronous blocking I/O functions (such as synchronous SQLAlchemy database queries) directly inside an `async def` function blocks the single-threaded asyncio event loop for all concurrent requests during the database operation.

### Impact
By wrapping `_get_dataset_for_user` with `run_in_threadpool`, the synchronous database lookup runs in an external worker thread pool, preventing event loop starvation and allowing concurrent incoming asynchronous requests to be processed without head-of-line blocking delays.
