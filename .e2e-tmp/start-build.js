const { Client } = require('ssh2');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const REMOTE_DIR = '/home/john/luban-e2e';
// nohup 后台 build，日志写文件，立即返回
const cmd = `cd ${REMOTE_DIR}/luban-backend && rm -f ${REMOTE_DIR}/docker-build.log && nohup bash -c "echo '${PASS}' | sudo -S DOCKER_BUILDKIT=0 docker build --network=host -t luban-java-e2e:local . 2>&1" > ${REMOTE_DIR}/docker-build.log 2>&1 </dev/null & echo "BUILD_PID=$!"`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err.message); conn.end(); return; }
    let out = ''; stream.on('data', d => out += d).on('stderr', d => out += d);
    stream.on('close', () => { console.log(out.replace(/\n$/,'')); conn.end(); });
  });
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
