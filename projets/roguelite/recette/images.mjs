// L'image de chaque écran sur une partie fixe, comparée au pixel (`ecart`) à sa référence, `reference/<écran>.png`, prise
// sur le navigateur épinglé à la vue 1366×768, les polices rejouées de leur archive (`commun.mjs`) et le rejeu du combat
// sur une horloge arrêtée (`Page.clock`) : une image absente, en trop ou qui diffère de plus de `SEUIL` rend 1.
// `--poser` remplace la référence par les images de la passe, et l'archive des polices par celles du réseau.
// Usage : node projets/roguelite/recette/images.mjs <dossier> <partie-fixe.json> [--poser]
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecart } from '../../../scripts/recette/ecart.mjs';
import { CAPTURES, erreurs, lancer, page, surLaPartieFixe } from './commun.mjs';

const REFERENCE = fileURLToPath(new URL('./reference', import.meta.url));
/** L'écart toléré par canal : la composition d'un calque filtré (un portrait hors de combat) varie d'une unité d'une
 *  passe à l'autre sur le même poste, mesuré sur cinq passes à la même tête (#5010). */
const SEUIL = 1;
const IMAGES = join(CAPTURES, 'images');
rmSync(IMAGES, { recursive: true, force: true });
mkdirSync(IMAGES, { recursive: true });
const b = await lancer();
const p = await page(b, [1366, 768], surLaPartieFixe());
await p.waitForTimeout(400);
/** L'image de l'écran, prise quand deux captures de suite sont égales (l'ouverture d'un panneau s'anime) ; un écran
 *  jamais stable est une erreur de la passe. */
const image = async (nom) => {
  await p.mouse.move(0, 0); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  let avant = await p.screenshot({ animations: 'disabled' });
  for (let t = 0; t < 20; t++) {
    await p.waitForTimeout(150);
    const apres = await p.screenshot({ animations: 'disabled' });
    if (apres.equals(avant)) return writeFileSync(join(IMAGES, `${nom}.png`), apres);
    avant = apres;
  }
  erreurs.push(`${nom} : l'écran ne se stabilise pas`);
};
const geste = (a, id) => p.evaluate(([x, i]) => document.querySelector(`button[data-a="${x}"]${i ? `[data-id="${i}"]` : ''}`).click(), [a, id]);
await image('hameau');
for (const id of ['relais', 'temple', 'salle', 'forge', 'cartographe']) { await geste('batiment', id); await image(id); await geste('fermer-panneau'); }
await geste('chronique'); await image('chronique'); await geste('fermer-panneau');
await geste('batiment', 'cartographe'); await p.click('[data-a="preparer"]'); await image('depart');
await geste('fermer-panneau');
const premier = await p.$eval('.socle-compagnie .carte-heros', (e) => e.dataset.id);
await geste('heros', premier);
for (const o of ['talents', 'sorts', 'equipement']) { const t = await p.$(`[data-a="onglet"][data-k="${o}"]`); if (t) { await t.click(); await image(`fiche-${o}`); } }
await geste('fermer-panneau'); await geste('ouvrir-depart'); await p.click('[data-a="preparer"]'); await p.click('[data-a="partir"]'); await image('expedition');
await p.clock.install();
await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
await p.click('[data-a="avancer"]');
if (await p.isVisible('#combat')) {
  await p.clock.runFor(1500); await image('combat');
  if (await p.isVisible('[data-j]')) { await p.click('[data-j]'); await image('combat-journal'); await p.click('[data-j]'); }
  await p.click('[data-v="0"]'); await p.waitForTimeout(600); await image('combat-issue'); await p.click('#combat-fin');
}
if (await p.$('.carton')) { await image('recit'); await p.click('.carton [data-a="fermer"]'); }
await p.click('[data-a="rentrer"]'); await image('retour');
await p.click('.carton [data-a="fermer"]'); await p.click('[data-a="reglages"]'); await image('reglages');
await p.click('.carton [data-a="reset"]'); await image('recommencer');
// toutes les polices de la feuille, que l'archive les porte pour chaque recette du lot
await p.evaluate(() => Promise.all([...document.fonts].map((f) => f.load())));
await p.context().close(); await b.close();
const pngs = (dossier) => readdirSync(dossier).filter((f) => f.endsWith('.png')).sort();
if (process.argv.includes('--poser') && !erreurs.length) {
  rmSync(REFERENCE, { recursive: true, force: true });
  mkdirSync(REFERENCE, { recursive: true });
  for (const f of pngs(IMAGES)) copyFileSync(join(IMAGES, f), join(REFERENCE, f));
}
const references = pngs(REFERENCE);
const ecarts = [...new Set([...pngs(IMAGES), ...references])].flatMap((f) => {
  if (!references.includes(f)) return [`${f} : sans référence`];
  if (!pngs(IMAGES).includes(f)) return [`${f} : référence sans image`];
  const { pixels, boite } = ecart(readFileSync(join(IMAGES, f)), readFileSync(join(REFERENCE, f)), { seuil: SEUIL });
  return pixels ? [`${f} : ${pixels} pixels, ${boite}`] : [];
});
console.log(`${references.length} images · écarts : ${ecarts.length ? `\n  ${ecarts.join('\n  ')}` : 'aucun'} · erreurs de page : ${erreurs.length ? erreurs : 'aucune'}`);
process.exit(ecarts.length || erreurs.length ? 1 : 0);
