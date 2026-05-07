# `@platformatic/basic` zombie-worker on SIGABRT-class child deaths

When a child process spawned via `commands.production` dies from a signal (e.g. SIGABRT from a V8 FATAL, OOM-killer SIGKILL, or native segfault), the Worker thread that hosts the capability stays alive indefinitely. The runtime parent never receives the `worker.exit` event, and the unhealthy worker is only replaced after `maxUnhealthyChecks * interval` of ELU/heap monitoring (default ~2.5 min in our deployment).

**Affected:** `@platformatic/basic@3.52.4` (latest at time of report). Verified on Node 22.22.2.

## The bug

[`packages/basic/lib/capability.js:547-553`](https://github.com/platformatic/platformatic/blob/main/packages/basic/lib/capability.js#L547-L553):

```js
// If the process exits prematurely, terminate the thread with the same code
this.subprocess.on('exit', code => {
  if (this.#subprocessStarted && typeof code === 'number' && code !== 0) {
    this.childManager.close()
    process.exit(code)
  }
})
```

The handler is registered with one parameter and gates on `typeof code === 'number'`. Per [Node's `child_process` `exit` event docs](https://nodejs.org/api/child_process.html#event-exit):

> If the process exited, `code` is the final exit code of the process, otherwise `null`. If the process terminated due to receipt of a signal, `signal` is the string name of the signal, otherwise `null`.

So for **any** signal-based child death:
- `code === null` → the filter is false
- `signal === 'SIGABRT' | 'SIGKILL' | 'SIGSEGV' | …` → ignored, never read
- `process.exit()` is never called → the Worker thread becomes a zombie

## Reproduction

No dependencies — pure stdlib Node.

```sh
git clone <this repo> && cd watt-zombie-worker-repro
node verify-equivalence.js   # 1. proves abort() and V8 FATAL produce the same exit tuple
node parent.js               # 2. demonstrates the bug (8s zombie window, parent never sees worker.exit)
node parent-fixed.js         # 3. demonstrates the proposed fix (worker.exit fires within ~1s)
```

### 1. `process.abort()` ≡ V8 FATAL (at the `child.on('exit')` layer)

```
process.abort()   exit event → { code: null, signal: 'SIGABRT' }
V8 FATAL (OOM)    exit event → { code: null, signal: 'SIGABRT' }
Identical (code, signal): YES
Filter `typeof code === "number" && code !== 0` evaluates to: false / false
```

We use `process.abort()` for the bug repro because it's deterministic and dependency-free; the equivalence script confirms a real V8 FATAL hits the same code path. Both terminate via libc `abort(3)` — V8's `FATAL` macro calls `v8::base::OS::Abort()` which calls libc `abort` ([v8/src/base/platform/platform-posix.cc](https://github.com/v8/v8/blob/main/src/base/platform/platform-posix.cc), search `OS::Abort`).

### 2. Bug reproduced (excerpt)

```
[worker] tid up, spawning child-abort.js
[child] pid=90346 up, will abort in 1s
[child] calling process.abort()
[worker] child exited — code=null (typeof object)
[worker] no propagation — thread stays alive while child is dead (ZOMBIE)
[worker] still alive at 2026-05-07T14:44:19.168Z
[worker] still alive at 2026-05-07T14:44:21.169Z
[worker] still alive at 2026-05-07T14:44:23.170Z
[parent] >>> 8s elapsed and worker.exit NEVER fired. Bug reproduced. <<<
```

The same harness with `CHILD_SCRIPT=child-v8-fatal.js NODE_FLAGS="--max-old-space-size=50"` produces an identical zombie window from a real V8 FATAL.

### 3. Fix verified

```
[worker-fixed] child exited — code=null signal=SIGABRT
[worker-fixed] propagating signal SIGABRT as exit 1
[parent-fixed] >>> worker.exit FIRED with code=1. Watt would restart NOW (within ~1s of the crash). <<<
```

## Proposed fix

```diff
  // If the process exits prematurely, terminate the thread with the same code
- this.subprocess.on('exit', code => {
+ this.subprocess.on('exit', (code, signal) => {
    if (this.#subprocessStarted && typeof code === 'number' && code !== 0) {
      this.childManager.close()
      process.exit(code)
+   } else if (this.#subprocessStarted && signal) {
+     this.childManager.close()
+     process.exit(1)
    }
  })
```

This collapses the unhealthy-detection window from `maxUnhealthyChecks * interval` (minutes) to ~1 second for any signal-based death, which is what the surrounding comment ("terminate the thread with the same code") already promises.

## Impact

In our deployment (`wattpm` + `@platformatic/next`, 4 workers/pod, default health config — `maxELU=0.98`, `maxUnhealthyChecks=5`, `interval=30000`), V8 FATAL (`Allocation failed - JavaScript heap out of memory`) child deaths produce a 2–3 minute service-degradation window per crash, during which the affected worker accepts no traffic but is not yet replaced. With multiple crashes per pod per day across the fleet, this is the single largest contributor to our worker-unavailability minutes.

## Files

| File | Purpose |
|------|---------|
| `child-abort.js` | Calls `process.abort()` after 1s — deterministic SIGABRT |
| `child-v8-fatal.js` | Triggers a real V8 FATAL via heap exhaustion |
| `worker.js` | Worker thread w/ **verbatim** buggy handler from `capability.js:547-553` |
| `worker-fixed.js` | Same with the proposed patch |
| `parent.js` / `parent-fixed.js` | `runtime.js` analog — watches `worker.exit` |
| `verify-equivalence.js` | Empirically proves `abort()` ≡ V8 FATAL at the exit-event layer |
