// Simulates the next-pwa standalone server (node start.js) that V8-FATALs.
// We use process.abort() to produce the same exit shape as a V8 FATAL:
//   exit code = null, signal = 'SIGABRT'
console.log('[child] pid=' + process.pid + ' up, will abort in 1s');
setTimeout(() => {
  console.log('[child] calling process.abort() — simulating V8 FATAL');
  process.abort();
}, 1000);
