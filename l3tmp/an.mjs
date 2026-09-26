import { readFileSync } from 'node:fs';
const txt = readFileSync('l3tmp/sweep.json', 'utf8');
const rows = JSON.parse(txt.slice(txt.indexOf('[')));
console.log('lignes avec levée d\'écran :', rows.length, '/ 31*37 =', 31 * 37);
const pure = rows.filter((r) => r.zones === 0 && r.over === 0 && r.rl === 0);
console.log('dont PURE occlusion écran (aucun abri de base) :', pure.length);
const abri = rows.filter((r) => r.zones > 0 || r.over > 0 || r.rl > 0);
console.log('dont abrité (zones/overhead/roomless) :', abri.length);
const grille = [];
for (let y = 1; y < 38; y++) {
  let l = String(y).padStart(2) + ' ';
  for (let x = 1; x < 32; x++) {
    const r = rows.find((r) => r.x === x && r.y === y);
    if (!r) l += '.';
    else if (r.zones > 0 || r.over > 0 || r.rl > 0) l += 'A'; // abrité
    else l += String(Math.min(9, r.aj.length)); // levée PURE d'écran, nb de masses
  }
  grille.push(l);
}
console.log('   ' + Array.from({ length: 31 }, (_, i) => String((i + 1) % 10)).join(''));
console.log(grille.join('\n'));
const dedans = [];
for (let y = 1; y < 38; y++) for (let x = 1; x < 32; x++) {
  const r = rows.find((r) => r.x === x && r.y === y);
  if (r && (r.zones > 0 || r.over > 0 || r.rl > 0)) dedans.push(`${x},${y}(z${r.zones}/o${r.over}/r${r.rl})`);
}
console.log('ABRITÉS :', dedans.slice(0, 60).join(' '));
