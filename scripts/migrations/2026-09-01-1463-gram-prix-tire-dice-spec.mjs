/**
 * Migration #1463 L-gram-3 (vague `grammaire`) — le PRIX TIRÉ AU DÉ prend la forme unique du dé.
 *
 *   `price: { dice: "3d10" }` → `price: { dice: { n: 3, sides: 10 } }`
 *
 * Le tableau des prix de base maritime imprime « 3d10 » aux quatre saisons pour le Vin
 * (`Source/WH - V4 - La Mer de Griffe/15 - Longs voyages.md` l.429 : « | Vin | 3d10 | 3d10 | 3d10 |
 * 3d10 | », l.436 : « Notez le prix du Vin quand il est acheté. »). La donnée le portait en CHAÎNE, lue
 * par `rollExpr` — le dé du projet est le `DiceSpec` de `src/engine/dice.ts` (`prixTireSchema`,
 * `src/data/schemas/grammaire/valeurs.ts`), jamais une expression.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : tout prix tiré au dé du document final est un site nommé, à son dé
 * nommé (`{n:3, sides:10}` pour le Vin) ; tout écart est un ARRÊT (exit 1). L’absence du
 * catalogue est tolérée (doctrine #3080).
 *
 * ENTRÉES : `src/data/sea-cargo.json` (seul document lu et écrit) — `src/data/land-cargo.json` ne
 * porte AUCUN prix à dés (son Vin passe par la table de qualité secrète, MSRC 13 l.93-104).
 * IDEMPOTENT : rejouée, elle ne voit plus aucune chaîne et n'écrit rien.
 * FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = path.join(ROOT, 'src/data/sea-cargo.json');

/** Le seul site attendu : `<id de cargaison>` → dé imprimé au tableau des prix (MDG 15 l.429). */
const ATTENDU = { vin: { n: 3, sides: 10 } };

const brut = fs.readFileSync(FICHIER, 'utf8');
const doc = JSON.parse(brut);
if (brut !== JSON.stringify(doc, null, 2)) {
  console.error('FORME NON CANONIQUE — src/data/sea-cargo.json ; AUCUNE écriture.');
  process.exit(1);
}

const arrets = [];
const migres = [];

for (const cargo of doc.cargoes ?? []) {
  const prix = cargo.price;
  if (!prix || typeof prix !== 'object' || !('dice' in prix)) continue;
  if (typeof prix.dice !== 'string') continue;
  const m = /^(\d+)d(\d+)$/.exec(prix.dice.trim());
  if (!m) {
    arrets.push(`${cargo.id} : expression de dé « ${prix.dice} » hors du patron \`NdM\` — la conversion serait une invention`);
    continue;
  }
  cargo.price = { dice: { n: Number(m[1]), sides: Number(m[2]) } };
  migres.push(cargo.id);
}

/** Constat sur le RÉSULTAT : les prix tirés au dé du document final, à leur forme d'arrivée. */
const constat = {};
for (const cargo of doc.cargoes ?? []) {
  const prix = cargo.price;
  if (!prix || typeof prix !== 'object' || !('dice' in prix)) continue;
  const de = prix.dice;
  if (!de || typeof de !== 'object' || typeof de.n !== 'number' || typeof de.sides !== 'number') {
    arrets.push(`${cargo.id} : prix à dé de forme ${JSON.stringify(de)} — attendu \`{n, sides}\``);
    continue;
  }
  constat[cargo.id] = { n: de.n, sides: de.sides };
}

for (const [id, de] of Object.entries(constat)) {
  const attendu = ATTENDU[id];
  if (!attendu) arrets.push(`${id} : prix tiré au dé hors des sites nommés (${Object.keys(ATTENDU).join(', ')})`);
  else if (de.n !== attendu.n || de.sides !== attendu.sides) arrets.push(`${id} : dé ${de.n}d${de.sides}, attendu ${attendu.n}d${attendu.sides}`);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}

const out = JSON.stringify(doc, null, 2);
if (out === brut) {
  console.log('src/data/sea-cargo.json — INCHANGÉ (no-op byte-identique).');
  process.exit(0);
}
if (out.includes('\r')) {
  console.error(`${FICHIER} : \\r dans le texte réécrit ; AUCUNE écriture.`);
  process.exit(1);
}
fs.writeFileSync(FICHIER, out, 'utf8');
console.log(`src/data/sea-cargo.json — réécrit (${migres.length} prix tiré(s) au dé : ${migres.join(', ')}).`);
