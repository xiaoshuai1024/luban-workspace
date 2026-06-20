const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const cmds = [
  `echo "=== full build log (last 30) ===" && tail -30 /home/john/luban-e2e/docker-build.log 2>/dev/null`,
  `echo "=== maven/java child procs ===" && (echo '${PASS}' | sudo -S ps aux 2>/dev/null | grep -iE "mvn|java|maven|com.google" | grep -v grep | head -8 || echo "no mvn/java running")`,
  `echo "=== docker build cache/containers ===" && (echo '${PASS}' | sudo -S docker ps -a 2>/dev/null | grep -iE "build|maven|luban" | head -5 || echo none)`,
  `echo "=== log file size ===" && ls -la /home/john/luban-e2e/docker-build.log 2>/dev/null`,
];
conn.on('ready', () => {
  const run = (i) => {
    if (i >= cmds.length) { conn.end(); return; }
    conn.exec(cmds[i], (err, stream) => {
      if (err) { run(i+1); return; }
      let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
      stream.on('close', () => { console.log(out.replace(/\n$/,'')); run(i+1); });
    });
  };
  run(0);
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
