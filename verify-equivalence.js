// Empirical proof that process.abort() and a real V8 FATAL produce a
// byte-identical (code, signal) tuple in Node's child_process 'exit' event —
// which is the only data the buggy capability.js handler reads.
const { spawn } = require('node:child_process');
const path = require('node:path');

function run(script, nodeArgs = []) {
  return new Promise((resolve) => {
    const c = spawn(
      process.execPath,
      [...nodeArgs, path.join(__dirname, script)],
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    c.on('exit', (code, signal) => resolve({ code, signal }));
  });
}

(async () => {
  const a = await run('child-abort.js');
  const b = await run('child-v8-fatal.js', ['--max-old-space-size=50']);

  console.log('process.abort()   exit event →', a);
  console.log('V8 FATAL (OOM)    exit event →', b);
  console.log(
    '\nIdentical (code, signal):',
    a.code === b.code && a.signal === b.signal ? 'YES' : 'NO'
  );
  console.log(
    'Filter `typeof code === "number" && code !== 0` evaluates to:',
    typeof a.code === 'number' && a.code !== 0,
    '/',
    typeof b.code === 'number' && b.code !== 0
  );
})();
