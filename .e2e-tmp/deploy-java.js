// 通过 sftp 上传 java backend 包到远端，并在远端 docker build+run
const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
const PASS = 'xiaoshuai12@#';
const REMOTE_DIR = '/home/john/luban-e2e';

const steps = [
  // 解包（包已由 sftp 上传）
  `cd ${REMOTE_DIR} && tar -xzf luban-backend.tar.gz && ls luban-backend/Dockerfile && echo "unpack ok"`,
  // docker build（需 sudo，密码用 stdin）
  `cd ${REMOTE_DIR}/luban-backend && echo '${PASS}' | sudo -S docker build -t luban-java-e2e:local . 2>&1 | tail -20`,
];

conn.on('ready', () => {
  console.log('[ssh] connected, mkdir first...');
  conn.exec(`mkdir -p ${REMOTE_DIR}`, (e, stream) => {
    if (e) { console.error('mkdir err', e); conn.end(); return; }
    let o = ''; stream.on('data', d => o += d).on('stderr', d => o += d);
    stream.on('close', () => {
      console.log('[ssh] dir ready, uploading tarball via sftp...');
      conn.sftp((err, sftp) => {
        if (err) { console.error('sftp err', err); conn.end(); return; }
        const localPath = 'D:/codes/luban-workspace/packages/backend/luban-backend.tar.gz';
        const remotePath = `${REMOTE_DIR}/luban-backend.tar.gz`;
        const rs = sftp.createWriteStream(remotePath);
        rs.on('error', e2 => { console.error('write err', e2.message); conn.end(); });
        rs.on('close', () => {
          console.log('[sftp] upload done');
          // run steps
          const run = (i) => {
            if (i >= steps.length) { conn.end(); return; }
            conn.exec(steps[i], (e3, stream2) => {
              if (e3) { console.error('exec', e3.message); run(i+1); return; }
              let out = ''; stream2.on('data', d => out += d).on('stderr', d => out += d);
              stream2.on('close', () => { console.log(out.replace(/\n$/, '')); run(i+1); });
            });
          };
          run(0);
        });
        fs.createReadStream(localPath).pipe(rs);
      });
    });
  });
});
conn.on('error', e => { console.error('[ssh] err:', e.message); process.exit(1); });
conn.connect({ host: '192.168.100.248', port: 22, username: 'john', password: PASS, readyTimeout: 15000 });
