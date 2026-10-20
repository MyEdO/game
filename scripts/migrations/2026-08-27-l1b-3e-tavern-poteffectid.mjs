/**
 * Migration #1467 L1b V-P2 — `tavernGames.json` : `pot.rows[].effect` devient `potEffectId`.
 *
 * MOTIF MESURÉ : la valeur n'est ni de la prose ni l'issue du tour — c'est une CLÉ DE REGISTRE. Le
 * JSDoc du def le disait déjà avant ce lot (`src/data/schemas/defs/tavernGames.ts` : « le nom d'un
 * effet de pot ENREGISTRÉ (`registerSequencePotEffect`), jamais un id de jeu ») : la valeur est
 * l'index de `sequencePotEffects` (`src/noyau/sequenceCore.ts:145`), lu par
 * `resolveSequencePotTurn`. La clé porte désormais ce qu'elle contient — suffixe `Id` du dépôt pour
 * une clé de registre. Sous le nom `effect`, le détecteur de structures la classait en PROSE.
 *
 * ENTRÉES : `src/data/tavernGames.json` (chemin `[].pot.rows[]`).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une rangée portant déjà `potEffectId` (et plus d'`effect`)
 * est reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0. Un jeu sans
 * bloc `pot` est LÉGITIME (le bloc est optionnel) et n'est pas compté.
 * FAIL-FAST : rangée portant les DEUX clés, rangée sans ni l'une ni l'autre, `effect` non-chaîne →
 * rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/tavernGames.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/tavernGames.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
let migres = 0;
let deja = 0;
let sansPot = 0;

const sortie = data.map((jeu) => {
  if (!jeu?.pot || !Array.isArray(jeu.pot.rows)) { sansPot++; return jeu; }
  const rows = jeu.pot.rows.map((r, i) => {
    const aEffect = r?.effect !== undefined;
    const aId = r?.potEffectId !== undefined;
    if (aEffect && aId) { echecs.push(`${jeu.id} › pot.rows[${i}] : porte À LA FOIS \`effect\` et \`potEffectId\``); return r; }
    if (aId) { deja++; return r; }
    if (!aEffect) { echecs.push(`${jeu.id} › pot.rows[${i}] : ni \`effect\` ni \`potEffectId\` — clé de registre PERDUE`); return r; }
    if (typeof r.effect !== 'string' || !r.effect) { echecs.push(`${jeu.id} › pot.rows[${i}] : \`effect\` de forme inattendue ${JSON.stringify(r.effect)}`); return r; }
    migres++;
    // Renommage EN PLACE : `potEffectId` occupe la position exacte d'`effect`, la valeur est inchangée.
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k === 'effect' ? 'potEffectId' : k, v]));
  });
  return { ...jeu, pot: { ...jeu.pot, rows } };
});

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucun `effect` sous `pot.rows`, clés de registre CONSERVÉES dans l'ordre.
const apres = JSON.parse(out);
const lignes = (d) => d.flatMap((j) => (Array.isArray(j?.pot?.rows) ? j.pot.rows : []));
const residus = lignes(apres).filter((r) => r.effect !== undefined).length;
const avantVals = lignes(data).map((r) => r.effect ?? r.potEffectId).join(',');
const apresVals = lignes(apres).map((r) => r.potEffectId).join(',');
if (residus || avantVals !== apresVals) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`effect\` résiduel(s) ; clés ${avantVals === apresVals ? 'conservées' : `ALTÉRÉES (${avantVals} → ${apresVals})`}`);
  process.exit(1);
}

console.log(`tavernGames.json — \`pot.rows[].effect\` → \`potEffectId\` : ${migres}`);
console.log(`Déjà migrées (no-op) : ${deja} ; jeux sans bloc \`pot\` (légitime) : ${sansPot} ; jeux : ${apres.length}`);
console.log(`Clés de registre : ${apresVals}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/tavernGames.json`);
