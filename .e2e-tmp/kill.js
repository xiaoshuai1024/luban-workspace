const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const cmd = `echo '${PASS}' | sudo -S kill -9 849556 849554 849552 2>/dev/null; echo done`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err.message); conn.end(); return; }
    let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
    stream.on('close', () => { console.log(out.replace(/\n$/,'')); conn.end(); });
  });
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
