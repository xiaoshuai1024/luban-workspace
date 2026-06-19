const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
// 测试能否拉 maven 镜像（1ms 加速）
const cmd = "echo '" + PASS + "' | sudo -S docker pull maven:3.9-eclipse-temurin-17-alpine 2>&1 | tail -8";
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err.message); conn.end(); return; }
    let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
    stream.on('close', () => { console.log(out.replace(/\n$/,'')); conn.end(); });
  });
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
