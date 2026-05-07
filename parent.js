// Simulates @platformatic/runtime: parent that watches Worker threads
// and would restart them on exit (runtime.js:1879).
const { Worker } = require('node:worker_threads');
const path = require('node:path');

console.log('[parent] pid=' + process.pid + ' starting worker thread');

const worker = new Worker(path.join(__dirname, 'worker.js'));

// runtime.js:1879 — what Watt does to detect a dead worker:
worker.once('exit', (code) => {
  console.log(
    '\n[parent] >>> worker exited with code=' +
      code +
      '. Watt would now restart it. <<<\n'
  );
  process.exit(0);
});

// Stop the demo after 8s if the parent never gets the 'exit' event.
setTimeout(() => {
  console.log(
    '\n[parent] >>> 8s elapsed and worker.exit NEVER fired. Bug reproduced. <<<'
  );
  console.log(
    '[parent] In prod this is the 2.5-min window before "is unhealthy. Replacing" fires.'
  );
  process.exit(1);
}, 8000);
