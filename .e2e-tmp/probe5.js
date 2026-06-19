const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const cmds = [
  'echo "=== java? ===" && (java -version 2>&1 | head -1 || echo "no java")',
  'echo "=== maven? ===" && (mvn -v 2>&1 | head -1 || echo "no maven")',
  'echo "=== go? ===" && (go version 2>&1 | head -1 || echo "no go")',
  'echo "=== node/pnpm? ===" && (node -v 2>&1; pnpm -v 2>&1 || echo "no pnpm")',
  'echo "=== git? ===" && (git --version 2>&1 || echo "no git")',
  'echo "=== home disk space ===" && df -h /home 2>&1 | tail -2',
  'echo "=== home dir contents ===" && ls -la ~ 2>&1 | head -15',
  'echo "=== existing luban dirs? ===" && (ls -d ~/*/luban* 2>/dev/null || echo none)',
  'echo "=== docker run permission test ===" && (echo y | echo \'x\' | sudo -S docker run --rm hello-world 2>&1 | head -3 || echo "cannot docker run")',
];
conn.on('ready', () => {
  const run = (i) => {
    if (i >= cmds.length) { conn.end(); return; }
    conn.exec(cmds[i], (err, stream) => {
      if (err) { run(i + 1); return; }
      let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
      stream.on('close', () => { console.log(out.replace(/\n$/, '')); run(i + 1); });
    });
  };
  run(0);
});
conn.on('error', e => { console.error('[ssh] err:', e.message); process.exit(1); });
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
