// La recette de l'interface : le jeu construit (`npm run roguelite:construire`, sous `SORTIE`), servi à chaque contexte
// du navigateur par l'interception de ses requêtes (`BrowserContext.route`), sans serveur ni port. Le stockage de la
// page se pose et se lit par l'état du contexte (`newContext({ storageState })`, `storageState()`) : un contexte neuf
// est un stockage vide. Chaque script reçoit en premier argument le dossier des captures, en second le fichier de la
// partie fixe (`partie-fixe.json`, que `lot.mjs` pose sous `dist/roguelite-recette/`).
// Usage : npm run roguelite:recette, ou node projets/roguelite/recette/<script>.mjs <dossier-des-captures> <partie-fixe.json> [...]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerLeNavigateurEpingle } from '../../../scripts/recette/navigateur.mjs';
import { SORTIE } from '../construire.mjs';

/** L'origine sous laquelle la page se charge, servie par `route`. */
const BASE = 'http://roguelite.recette';
const CAPTURES = process.argv[2] ?? '.';
/** Les polices de la page (Google Fonts), prises du réseau à la pose de la référence d'images (`images.mjs --poser`),
 *  rejouées de cette archive à toute autre passe : une police hors de l'archive est une erreur de la page. */
const POLICES = fileURLToPath(new URL('./polices.har.zip', import.meta.url));
const POLICE = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
/** La clé de la sauvegarde de la partie (`src/jeu/sauvegarde.ts`). */
const SAUVEGARDE = 'grisefosse-v1';
/** Les erreurs de page de toutes les pages du script. */
const erreurs = [];

/** Le navigateur de la recette : le build épinglé (`lancerLeNavigateurEpingle`), celui de sa référence d'images. */
const lancer = () => lancerLeNavigateurEpingle();

/** Le stockage local de la page `p`, entrée par entrée (`{ clé: valeur }`). */
async function stockage(p) {
  const { origins } = await p.context().storageState();
  return Object.fromEntries((origins.find((o) => o.origin === BASE)?.localStorage ?? []).map(({ name, value }) => [name, value]));
}

/** La sauvegarde de la partie de la page `p`, lue. */
const sauvegarde = async (p) => JSON.parse((await stockage(p))[SAUVEGARDE]);

/** Le stockage d'une page sur la partie fixe (`partie-fixe.ts`, fichier du second argument), que `regler` modifie en
 *  place ou remplace. */
function surLaPartieFixe(regler = () => {}) {
  const e = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  return { [SAUVEGARDE]: JSON.stringify(regler(e) ?? e) };
}

/** Une page de la recette dans un contexte neuf, à la vue `[largeur, hauteur]`, sur le stockage `entrees`
 *  (`{ clé: valeur }`, vide par défaut : une partie neuve), prête quand `attendre` paraît. */
async function page(navigateur, [width, height], entrees = {}, attendre = '.enseigne') {
  const contexte = await navigateur.newContext({
    viewport: { width, height },
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: Object.entries(entrees).map(([name, value]) => ({ name, value })) }] },
  });
  await contexte.routeFromHAR(POLICES, { url: POLICE, notFound: 'abort', update: process.argv.includes('--poser') });
  await contexte.route(`${BASE}/**`, (r) => {
    const fichier = join(SORTIE, new URL(r.request().url()).pathname);
    return existsSync(fichier) ? r.fulfill({ path: fichier }) : r.fulfill({ status: 404 });
  });
  const p = await contexte.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('requestfailed', (r) => { if (POLICE.test(r.url())) erreurs.push(`police hors de l'archive : ${r.url()}`); });
  await p.goto(`${BASE}/recette.html`);
  await p.waitForSelector(attendre);
  return p;
}

/** La page `p` rechargée dans un contexte neuf sur son stockage, sa sauvegarde passée par `regler(e, argument)`, qui la
 *  modifie en place ou en rend une autre ; l'ancien contexte est fermé. */
async function recharger(p, regler, attendre = '.enseigne', argument) {
  const entrees = await stockage(p);
  const e = JSON.parse(entrees[SAUVEGARDE]);
  const regle = regler(e, argument) ?? e;
  const navigateur = p.context().browser();
  const { width, height } = p.viewportSize();
  await p.context().close();
  return page(navigateur, [width, height], { ...entrees, [SAUVEGARDE]: JSON.stringify(regle) }, attendre);
}

/** Clique un bouton par son geste (`data-a`) et son id, sans viser une enseigne du panorama ni un groupe SVG. */
const geste = (p, a, id) => p.evaluate(([x, i]) => document.querySelector(`button[data-a="${x}"]${i ? `[data-id="${i}"]` : ''}`).click(), [a, id]);

export { CAPTURES, erreurs, geste, lancer, page, recharger, sauvegarde, surLaPartieFixe };
