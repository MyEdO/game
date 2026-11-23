// L'image de chaque écran sur une partie fixe, écrite dans un dossier : deux séries, avant et après une refonte du
// style, doivent être identiques au pixel près (`cmp` des fichiers).
// Usage : node roguelite/recette/images.mjs <dossier> <url> <partie-fixe.json> [largeur×hauteur, 1366×768 par défaut]
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, BASE, CAPTURES } from './commun.mjs';

const sauvegarde = readFileSync(process.argv[4], 'utf8');
mkdirSync(CAPTURES, { recursive: true });
const [largeur, hauteur] = (process.argv[5] ?? '1366×768').split('×').map(Number);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: largeur, height: hauteur } })).newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(e.message));
await p.goto(`${BASE}/recette.html`);
await p.evaluate((s) => localStorage.setItem('grisefosse-v1', s), sauvegarde);
await p.reload();
await p.waitForSelector('.enseigne');
await p.waitForTimeout(400);
const image = async (nom) => { await p.mouse.move(0, 0); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300); await p.screenshot({ path: `${CAPTURES}/${nom}.png`, animations: 'disabled' }); };
const geste = (a, id) => p.evaluate(([x, i]) => document.querySelector(`button[data-a="${x}"]${i ? `[data-id="${i}"]` : ''}`).click(), [a, id]);
await image('hameau');
for (const id of ['relais', 'temple', 'salle', 'forge', 'cartographe', 'peage', 'memorial']) { await geste('batiment', id); await image(id); }
await geste('chronique'); await image('chronique');
await geste('batiment', 'cartographe'); await p.click('[data-a="preparer"]'); await image('depart');
await geste('fermer-panneau');
const premier = await p.$eval('.socle-compagnie .carte-heros', (e) => e.dataset.id);
await geste('heros', premier);
for (const o of ['talents', 'sorts', 'equipement']) { const t = await p.$(`[data-a="onglet"][data-k="${o}"]`); if (t) await t.click(); await image(`fiche-${o}`); }
await geste('fermer-panneau'); await geste('ouvrir-depart'); await p.click('[data-a="preparer"]'); await p.click('[data-a="partir"]'); await image('expedition');
await p.click('[data-a="avancer"]');
if (await p.isVisible('#combat')) { await p.waitForTimeout(500); await p.click('[data-v="0"]'); await p.waitForTimeout(300); await image('combat'); await p.click('#combat-fin'); }
await image('recit');
await p.click('.carton [data-a="fermer"]'); await p.click('[data-a="rentrer"]'); await image('retour');
await p.click('.carton [data-a="fermer"]'); await p.click('[data-a="reset"]'); await image('recommencer');
console.log('images écrites · erreurs de page :', erreurs.length ? erreurs : 'aucune');
await b.close();
