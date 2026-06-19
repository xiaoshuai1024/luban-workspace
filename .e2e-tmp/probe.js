const { Client } = require('ssh2');
const conn = new Client();

const HOST = process.env.SSH_HOST || '192.168.100.248';
const USER = process.env.SSH_USER || 'john';
const PASS = process.env.SSH_PASS || 'xiaoshuai12@#';

const cmds = [
  'echo "=== docker ps ==="',
  'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null || echo "docker not accessible or none"',
  'echo "=== docker compose projects ==="',
  'docker compose ls 2>/dev/null || echo "no compose ls"',
  'echo "=== listening ports (mysql/redis/backends) ==="',
  "sudo -n ss -tlnp 2>/dev/null | grep -E ':3306|:6379|:8080|:8081|:3100|:4200|:3000' || ss -tln 2>/dev/null | grep -E ':3306|:6379|:8080|:8081|:3100|:4200|:3000' || echo 'cannot read ports'",
  'echo "=== docker networks ==="',
  'docker network ls 2>/dev/null || echo none',
];

conn.on('ready', () => {
  console.log('[ssh] connected to', HOST);
  const run = (i) => {
    if (i >= cmds.length) { conn.end(); return; }
    conn.exec(cmds[i], (err, stream) => {
      if (err) { console.error('exec err', err); run(i + 1); return; }
      let out = '';
      stream.on('data', (d) => (out += d)).on('stderr', (d) => (out += d));
      stream.on('close', () => { console.log(out.replace(/\n$/, '')); run(i + 1); });
    });
  };
  run(0);
});
conn.on('error', (e) => { console.error('[ssh] error:', e.message); process.exit(1); });
conn.on('banner', (b) => process.stderr.write('[banner] ' + b));
conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
  // 某些服务器要求 keyboard-interactive
  finish([PASS]);
});
conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 15000 });
