const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const cmds = [
  "echo '=== daemon.json ===' && cat /etc/docker/daemon.json 2>/dev/null || echo 'no daemon.json'",
  "echo '=== registry-mirrors ===' && echo '" + PASS + "' | sudo -S cat /etc/docker/daemon.json 2>/dev/null | grep -A5 -i mirror || echo 'none'",
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
