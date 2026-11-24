// Le socle de la compagnie est au même rectangle sur le hameau, un service, la fiche et l'expédition ; avec sept
// héros, chacun reste atteignable (le socle défile en largeur).
import { chromium, CAPTURES, ouvrir, geste } from './commun.mjs';

(async () => {
  const b = await chromium.launch();
  const erreurs = [];
  const p = await ouvrir(b, [1366, 768], () => {
    const e = JSON.parse(localStorage.getItem('grisefosse-v1'));
    e.or = 900;
    for (let n = e.roster.length; n < 7; n++) e.roster.push({ ...JSON.parse(JSON.stringify(e.roster[0])), c: { ...JSON.parse(JSON.stringify(e.roster[0].c)), id: `${e.roster[0].c.id}-copie-${n}`, label: `Copie ${n}` } });
    localStorage.setItem('grisefosse-v1', JSON.stringify(e));
  }, erreurs);
  const rect = () => p.$eval('.socle-compagnie', (e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); });
  const rects = { hameau: await rect() };
  await geste(p, 'batiment', 'forge'); rects.forge = await rect();
  const cartes = await p.$$eval('.socle-compagnie .carte-heros', (c) => c.length);
  const defile = await p.$eval('.socle-compagnie .rang-heros', (e) => e.scrollWidth > e.clientWidth && getComputedStyle(e).overflowX !== 'hidden');
  await geste(p, 'fermer-panneau'); await p.click('.socle-compagnie .carte-heros'); rects.fiche = await rect();
  await p.click('.croix-ecran'); await geste(p, 'ouvrir-depart'); await p.click('[data-a="preparer"]'); await p.click('[data-a="partir"]'); rects.expedition = await rect();
  await p.screenshot({ path: `${CAPTURES}/socle-expedition.png` });
  const memes = new Set(Object.values(rects)).size === 1;
  console.log('rectangles du socle :', JSON.stringify(rects), memes ? '· identiques' : '· DIFFÉRENTS');
  console.log(`sept héros : ${cartes} cartes, défilement en largeur ${defile ? 'oui' : 'NON'}`);
  console.log('erreurs de page :', erreurs.length ? erreurs : 'aucune');
  await b.close();
  process.exit(memes && cartes === 7 && defile && !erreurs.length ? 0 : 1);
})();
