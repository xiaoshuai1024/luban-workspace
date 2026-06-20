const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const REMOTE_DIR = '/home/john/luban-e2e';
// kill 旧 build，清缓存后用 buildkit 带日志后台重启
const cmds = [
  `echo "=== kill old build ===" && echo '${PASS}' | sudo -S kill -9 849556 849554 849552 2>/dev/null; echo '${PASS}' | sudo -S pkill -9 -f "docker build" 2>/dev/null; echo "killed"`,
  `echo "=== start fresh build with log ===" && cd ${REMOTE_DIR}/luban-backend && nohup bash -c "echo '${PASS}' | sudo -S DOCKER_BUILDKIT=0 docker build --network=host -t luban-java-e2e:local . > ${REMOTE_DIR}/docker-build.log 2>&1" </dev/null >/dev/null 2>&1 & echo "started pid=$!"`,
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
