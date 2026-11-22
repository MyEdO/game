// Le HTML de chaque écran sur une partie fixe (graine 42), écrit dans un fichier : deux instantanés, avant et après
// une refonte, doivent être identiques. La partie se fabrique par `partie-fixe.ts` (même code que le jeu).
// Usage : npx tsx roguelite/recette/partie-fixe.ts > fixe.json ; node roguelite/recette/instantanes.mjs <captures> <url> fixe.json sortie.json
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, BASE } from './commun.mjs';

const [, , , , fixe, sortie] = process.argv;
const sauvegarde = readFileSync(fixe, 'utf8');

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(e.message));
await p.goto(`${BASE}/recette.html`);
await p.evaluate((s) => localStorage.setItem('grisefosse-v1', s), sauvegarde);
await p.reload();
await p.waitForSelector('.enseigne');
const html = () => p.$eval('#jeu', (e) => e.innerHTML.replace(/style="[^"]*"/g, ''));
const geste = (a, id) => p.evaluate(([x, i]) => document.querySelector(`button[data-a="${x}"]${i ? `[data-id="${i}"]` : ''}`).click(), [a, id]);
const ecrans = { hameau: await html() };
for (const id of ['relais', 'temple', 'salle', 'forge', 'cartographe', 'peage', 'memorial']) { await geste('batiment', id); ecrans[id] = await html(); }
await geste('chronique'); ecrans.chronique = await html();
await geste('fermer-panneau');
const premier = await p.$eval('.socle-compagnie .carte-heros', (e) => e.dataset.id);
await geste('heros', premier); ecrans.fiche = await html();
for (const o of ['talents', 'sorts', 'equipement']) { const t = await p.$(`[data-a="onglet"][data-k="${o}"]`); if (t) { await t.click(); ecrans[`fiche-${o}`] = await html(); } }
writeFileSync(sortie, JSON.stringify(ecrans, null, 1));
console.log(`${Object.keys(ecrans).length} écrans écrits · erreurs de page :`, erreurs.length ? erreurs : 'aucune');
await b.close();
