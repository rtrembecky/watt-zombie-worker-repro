// Triggers a real V8 FATAL via heap exhaustion. Spawned with
// --max-old-space-size=50 so it crashes within ~1 second.
console.log('[child-v8-fatal] pid=' + process.pid + ' up, exhausting heap');
const arrays = [];
setTimeout(function leak() {
  while (true) arrays.push(new Array(1e6).fill(0));
}, 100);
