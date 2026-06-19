const services = [
  ['java(8080)', 'http://localhost:8080/backend/auth/me'],
  ['bff(3100)', 'http://localhost:3100/api/sites'],
  ['engine(4200)', 'http://localhost:4200/'],
  ['website(3000)', 'http://localhost:3000/'],
];
(async () => {
  for (const [name, url] of services) {
    try {
      const r = await fetch(url);
      console.log(`${name} -> ${r.status}`);
    } catch (e) {
      console.log(`${name} -> DOWN (${e.message})`);
    }
  }
})();
