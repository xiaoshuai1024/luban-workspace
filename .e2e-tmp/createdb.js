const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const cmds = [
  `echo '${PASS}' | sudo -S docker exec yanhuo-mysql mysql -uroot -pyanhuo123 -e "CREATE DATABASE IF NOT EXISTS luban DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | grep -v "\\[sudo\\]" | grep -v "password for john"`,
  'echo "=== verify luban db ==="',
  `echo '${PASS}' | sudo -S docker exec yanhuo-mysql mysql -uroot -pyanhuo123 -e "SHOW DATABASES LIKE 'luban';" 2>&1 | grep -v "\\[sudo\\]" | grep -v "password for john"`,
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
