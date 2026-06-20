const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const cmd = "echo '" + PASS + "' | sudo -S pkill -9 -f 'docker build' 2>/dev/null; echo '---maven image---'; echo '" + PASS + "' | sudo -S docker images 2>/dev/null | grep -v 'password for john' | grep -iE 'maven|REPOSITORY' | head -5; echo '---all imgs---'; echo '" + PASS + "' | sudo -S docker images 2>/dev/null | grep -v 'password for john' | grep -v '\\[sudo\\]' | head -8; echo done";
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err.message); conn.end(); return; }
    let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
    stream.on('close', () => { console.log(out.replace(/\n$/,'')); conn.end(); });
  });
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
