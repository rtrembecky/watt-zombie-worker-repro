// Same as worker.js but with the proposed FIX: also propagate signal-based
// child deaths (SIGABRT, SIGKILL, etc.).
const { spawn } = require('node:child_process');
const path = require('node:path');

const childScript = process.env.CHILD_SCRIPT || 'child-abort.js';
const nodeFlags = process.env.NODE_FLAGS ? process.env.NODE_FLAGS.split(' ') : [];

console.log('[worker-fixed] tid up, spawning ' + childScript);

const child = spawn(
  process.execPath,
  [...nodeFlags, path.join(__dirname, childScript)],
  { stdio: 'inherit' }
);

let started = true;

// FIXED handler: take both args, exit on signal too.
child.on('exit', (code, signal) => {
  console.log(
    '[worker-fixed] child exited — code=' + code + ' signal=' + signal
  );
  if (started) {
    if (typeof code === 'number' && code !== 0) {
      console.log('[worker-fixed] propagating exit code ' + code);
      process.exit(code);
    } else if (signal) {
      // V8 FATAL → SIGABRT lands here. Map to non-zero exit so the runtime
      // sees "unexpectedly exited" and restarts the worker immediately.
      console.log('[worker-fixed] propagating signal ' + signal + ' as exit 1');
      process.exit(1);
    }
  }
});

setInterval(() => {}, 2000);
