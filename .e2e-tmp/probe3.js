const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
// 进 yanhuo-mysql 容器看库；mysql root 密码未知，先看容器 env
const cmds = [
  'echo "=== yanhuo-mysql env (MYSQL_ROOT_PASSWORD etc) ==="',
  `echo '${PASS}' | sudo -S docker inspect yanhuo-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' 2>&1 | grep -i -E "MYSQL|PASS" `,
  'echo "=== databases via container mysql client (try root no pw then common) ==="',
  `echo '${PASS}' | sudo -S docker exec yanhuo-mysql mysql -uroot -e "SHOW DATABASES;" 2>&1 | grep -v password | head -20 || echo "need password"`,
  'echo "=== yanhuo-redis env ==="',
  `echo '${PASS}' | sudo -S docker inspect yanhuo-redis --format '{{range .Config.Env}}{{println .}}{{end}}' 2>&1 | grep -v password | head -5`,
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
