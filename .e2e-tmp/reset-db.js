const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
// drop 重建 luban 库，让 Java flyway 干净建表
const cmd = "echo '" + PASS + "' | sudo -S docker exec yanhuo-mysql mysql -uroot -pyanhuo123 -e \"DROP DATABASE IF EXISTS luban; CREATE DATABASE luban DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; SHOW DATABASES LIKE 'luban';\" 2>&1 | grep -v 'password for john' | grep -v '\\[sudo\\]'";
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err.message); conn.end(); return; }
    let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
    stream.on('close', () => { console.log(out.replace(/\n$/,'')); conn.end(); });
  });
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
