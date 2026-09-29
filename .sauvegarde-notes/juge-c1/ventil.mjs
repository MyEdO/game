const S = process.argv[2];
const a = await import(S + '/stock-head.mjs'), b = await import(S + '/stock-index.mjs');
for (const k of Object.keys(a)) if (Array.isArray(a[k])) {
  const key = (e) => `${e.fichier}|${e.ref}|${e.occurrence}`;
  const A = new Set(a[k].map(key)), B = new Set(b[k].map(key));
  const app = [...B].filter((x) => !A.has(x)), dis = [...A].filter((x) => !B.has(x));
  console.log(k, A.size, '->', B.size, 'APPARU', app.length, 'DISPARU', dis.length, app.slice(0, 5));
}
