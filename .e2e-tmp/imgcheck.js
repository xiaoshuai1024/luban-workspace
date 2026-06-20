const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
conn.on('ready', () => {
  conn.exec("echo '" + PASS + "' | sudo -S docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' 2>/dev/null | grep -v 'password for john'", (err, stream) => {
    if (err) { console.error(err.message); conn.end(); return; }
    let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
    stream.on('close', () => { console.log(out || '(empty)'); conn.end(); });
  });
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
