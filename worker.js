// Simulates @platformatic/basic capability.js: a Worker thread that spawns
// the application as a child process via `commands.production`.
//
// Configurable via env so we can drive both crash modes through the SAME
// (buggy) exit handler:
//   CHILD_SCRIPT=child-abort.js       (default — synthetic, deterministic)
//   CHILD_SCRIPT=child-v8-fatal.js NODE_FLAGS="--max-old-space-size=50"
const { spawn } = require('node:child_process');
const path = require('node:path');

const childScript = process.env.CHILD_SCRIPT || 'child-abort.js';
const nodeFlags = process.env.NODE_FLAGS ? process.env.NODE_FLAGS.split(' ') : [];

console.log('[worker] tid up, spawning ' + childScript + ' ' + nodeFlags.join(' '));

const child = spawn(
  process.execPath,
  [...nodeFlags, path.join(__dirname, childScript)],
  { stdio: 'inherit' }
);

let started = true;

// ---- VERBATIM from @platformatic/basic capability.js:547-553 ----
// > // If the process exits prematurely, terminate the thread with the same code
// > this.subprocess.on('exit', code => {
// >   if (this.#subprocessStarted && typeof code === 'number' && code !== 0) {
// >     this.childManager.close()
// >     process.exit(code)
// >   }
// > })
child.on('exit', (code) => {
  console.log(
    '[worker] child exited — code=' + code + ' (typeof ' + typeof code + ')'
  );
  if (started && typeof code === 'number' && code !== 0) {
    console.log('[worker] propagating: process.exit(' + code + ')');
    process.exit(code);
  }
  console.log(
    '[worker] no propagation — thread stays alive while child is dead (ZOMBIE)'
  );
});

setInterval(() => {
  console.log('[worker] still alive at ' + new Date().toISOString());
}, 2000);
