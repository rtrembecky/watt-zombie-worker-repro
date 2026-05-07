const { Worker } = require('node:worker_threads');
const path = require('node:path');

console.log('[parent-fixed] starting worker thread (with fix)');

const worker = new Worker(path.join(__dirname, 'worker-fixed.js'));

worker.once('exit', (code) => {
  console.log(
    '\n[parent-fixed] >>> worker.exit FIRED with code=' +
      code +
      '. Watt would restart NOW (within ~1s of the crash). <<<'
  );
  process.exit(0);
});

setTimeout(() => {
  console.log('[parent-fixed] >>> 8s elapsed, fix did not work <<<');
  process.exit(1);
}, 8000);
