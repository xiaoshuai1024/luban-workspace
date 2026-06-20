const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const REMOTE_DIR = '/home/john/luban-e2e';
const cmds = [
  `echo "=== build log tail (if exists) ===" && (tail -5 ${REMOTE_DIR}/docker-build.log 2>/dev/null || echo "no log yet")`,
  `echo "=== docker build processes ===" && (ps aux | grep -E "docker build|mvn" | grep -v grep || echo "no build running")`,
  `echo "=== image exists? ===" && (echo '${PASS}' | sudo -S docker images luban-java-e2e 2>&1 | grep -v "password for john" | grep -v "\\[sudo\\]")`,
];
conn.on('ready', () => {
  const run = (i) => {
    if (i >= cmds.length) { conn.end(); return; }
    conn.exec(cmds[i], (err, stream) => {
      if (err) { run(i+1); return; }
      let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
      stream.on('close', () => { console.log(out.replace(/\n$/, '')); run(i+1); });
    });
  };
  run(0);
});
conn.on('error', e => { console.error('[ssh] err:', e.message); process.exit(1); });
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
