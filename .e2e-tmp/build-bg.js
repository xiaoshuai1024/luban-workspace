const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const REMOTE_DIR = '/home/john/luban-e2e';
// nohup 后台 build，输出到文件，立即返回；后续轮询日志
const cmd = `cd ${REMOTE_DIR}/luban-backend && nohup bash -c "echo '${PASS}' | sudo -S docker build -t luban-java-e2e:local . > ${REMOTE_DIR}/docker-build.log 2>&1; echo DONE >> ${REMOTE_DIR}/docker-build.log" > /dev/null 2>&1 & echo "build started pid=$!"`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err.message); conn.end(); return; }
    let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
    stream.on('close', () => { console.log(out.replace(/\n$/, '')); conn.end(); });
  });
});
conn.on('error', e => { console.error('[ssh] err:', e.message); process.exit(1); });
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
