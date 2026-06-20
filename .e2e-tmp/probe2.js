const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const cmds = [
  'echo "=== sudo test ==="',
  `echo '${PASS}' | sudo -S docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}|{{.Status}}" 2>&1 | grep -v "password" || echo "sudo docker failed"`,
  'echo "=== what is on 8081 ==="',
  `echo '${PASS}' | sudo -S ss -tlnp 2>/dev/null | grep ':8081' || echo none`,
  'echo "=== mysql/redis containers or native? ==="',
  `echo '${PASS}' | sudo -S ss -tlnp 2>/dev/null | grep -E ':3306|:6379' || echo "no mysql/redis port listening"`,
  'echo "=== all docker containers incl stopped ==="',
  `echo '${PASS}' | sudo -S docker ps -a --format "{{.Names}}|{{.Image}}|{{.Status}}" 2>&1 | grep -v password | head -20 || echo none`,
];
conn.on('ready', () => {
  const run = (i) => {
    if (i >= cmds.length) { conn.end(); return; }
    conn.exec(cmds[i], { pty: false }, (err, stream) => {
      if (err) { console.error('err', err.message); run(i + 1); return; }
      let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
      stream.on('close', () => { console.log(out.replace(/\n$/, '')); run(i + 1); });
    });
  };
  run(0);
});
conn.on('error', e => { console.error('[ssh] err:', e.message); process.exit(1); });
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
