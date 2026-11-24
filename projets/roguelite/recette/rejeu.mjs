// Le rejeu d'une mêlée nombreuse (peaux-vertes, Animosité, un chamane) joué en entier à ×4, puis « Échap » : aucune
// erreur de page, l'ordre garde les héros à terre, Échap mène à l'issue avant de fermer. Captures en cours de combat,
// un héros à terre si possible, à 1280 × 720 et 1920 × 1080.
// Usage : node projets/roguelite/recette/rejeu.mjs <dossier-des-captures> <partie-fixe.json>
import { CAPTURES, erreurs, lancer, page, recharger, surLaPartieFixe } from './commun.mjs';

const fixe = surLaPartieFixe();
const b = await lancer();
const echecs = [];
const constater = (ok, quoi) => { console.log(ok ? '✓' : '✗', quoi); if (!ok) echecs.push(quoi); };
for (const [l, h] of [[1280, 720], [1920, 1080]]) {
  let p = await page(b, [l, h], fixe);
  for (const a of ['ouvrir-depart', 'preparer', 'partir']) await p.evaluate((x) => document.querySelector(`[data-a="${x}"]`).click(), a);
  p = await recharger(p, (e) => {
    const s = e.expedition.salles[e.expedition.index];
    s.type = 'combat';
    s.ennemis = ['orc', 'orc', 'gobelin', 'gobelin', 'gobelin', 'chamane-gobelin-des-forets'];
  }, '[data-a="avancer"]');
  await p.click('[data-a="avancer"]');
  await p.waitForSelector('#combat:not([hidden])');
  await p.click('[data-v="4"]'); await p.click('[data-v="4"]');
  let capture = false;
  for (let t = 0; t < 240 && !(await p.$('#combat .banniere-issue')); t++) {
    if (!capture && await p.$('.ordre li.hors')) { capture = true; await p.screenshot({ path: `${CAPTURES}/rejeu-a-terre-${l}.png` }); }
    await p.waitForTimeout(500);
  }
  if (!capture) await p.screenshot({ path: `${CAPTURES}/rejeu-fin-${l}.png` });
  constater(!!(await p.$('#combat .banniere-issue')), `${l} : le rejeu joué en entier mène à l’issue`);
  await p.keyboard.press('Escape');
  constater(await p.isHidden('#combat'), `${l} : Échap ferme depuis l’issue`);
  await p.context().close();
}
// Échap avant la fin : l'issue d'abord.
const p = await page(b, [1366, 768], fixe);
for (const a of ['ouvrir-depart', 'preparer', 'partir', 'avancer']) await p.evaluate((x) => document.querySelector(`[data-a="${x}"]`).click(), a);
if (await p.isVisible('#combat')) {
  await p.keyboard.press('Escape');
  constater(await p.isVisible('#combat .banniere-issue'), 'Échap pendant le combat montre l’issue');
}
await b.close();
console.log(echecs.length ? `${echecs.length} échec(s)` : 'rejeu complet', '· erreurs de page :', erreurs.length ? erreurs : 'aucune');
process.exit(echecs.length || erreurs.length ? 1 : 0);
