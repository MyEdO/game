// La recette de l'interface : le jeu construit (`node projets/roguelite/construire.mjs`), servi par un serveur statique sur
// `projets/roguelite/dist` (par défaut http://localhost:8765). Chaque script reçoit en argument le dossier des captures.
// Usage : node projets/roguelite/recette/<script>.mjs <dossier-des-captures> [url-de-base]
import { createRequire } from 'node:module';

// Playwright est installé hors du dépôt : on le charge par la résolution de Node, comme l'environnement le documente.
const charger = createRequire(import.meta.url);
const { chromium, devices } = charger('playwright');

const BASE = process.argv[3] ?? 'http://localhost:8765';
const CAPTURES = process.argv[2] ?? '.';

/** Une page neuve à la taille `[largeur, hauteur]` (ou un appareil nommé), sur une partie neuve que `regler` ajuste
 *  avant le rechargement (or, bâtiments, PX…), avec `argument`. Les erreurs de page s'accumulent dans `erreurs`. */
async function ouvrir(navigateur, taille, regler, erreurs, argument) {
  const contexte = typeof taille === 'string' ? await navigateur.newContext({ ...devices[taille] }) : await navigateur.newContext({ viewport: { width: taille[0], height: taille[1] } });
  const p = await contexte.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.goto(`${BASE}/recette.html`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('.enseigne');
  if (regler) {
    await p.evaluate(regler, argument);
    await p.reload();
    await p.waitForSelector('.enseigne');
  }
  return p;
}

/** Clique un bouton par son geste (`data-a`) et son id, sans viser une enseigne du panorama ni un groupe SVG. */
const geste = (p, a, id) => p.evaluate(([x, i]) => document.querySelector(`button[data-a="${x}"]${i ? `[data-id="${i}"]` : ''}`).click(), [a, id]);

export { chromium, BASE, CAPTURES, ouvrir, geste };
