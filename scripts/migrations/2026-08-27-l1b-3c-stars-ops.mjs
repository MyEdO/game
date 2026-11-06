/**
 * Migration #1467 L1b V-P2 — `stars.json` : le champ `effect` devient `ops`.
 *
 * MOTIF MESURÉ : la valeur portée par ce champ est un `GameOp[]` (`z.array(gameOpSchema)`,
 * `src/data/schemas/defs/stars.ts`) — `charMod` et `grantTalent`, lus par `applyStarOps`
 * (`src/engine/creation.ts`) et rendus par `GameOpEditor`. Le nom `effect` le faisait classer en
 * PROSE par le détecteur de structures (rôle `prose`, cible `desc`) ; il porte désormais le nom du
 * CONCEPT qu'il contient, la même graphie `ops` que `drunkenness`/`traumas`/les Critiques.
 *
 * ENTRÉES : `src/data/stars.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `ops` (et plus d'`effect`) est
 * reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0. Une entrée sans
 * ni l'un ni l'autre est LÉGITIME (le champ est optionnel) et n'est pas comptée.
 * FAIL-FAST : entrée portant `effect` ET `ops`, ou `effect` qui n'est pas un tableau → rien n'est
 * écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estMonoTable, lignesDe } from './lib/monoTable.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/stars.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/stars.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
let migres = 0;
let dejaMigres = 0;
let sansEffet = 0;

const lignes = lignesDe(data);
const sortie = lignes.map((e, i) => {
  const aEffect = e?.effect !== undefined;
  const aOps = e?.ops !== undefined;
  if (aEffect && aOps) {
    echecs.push(`entrée #${i} (${e.id}) : porte À LA FOIS \`effect\` et \`ops\` — arbitrage requis`);
    return e;
  }
  if (aOps) { dejaMigres++; return e; }
  if (!aEffect) { sansEffet++; return e; }
  if (!Array.isArray(e.effect)) {
    echecs.push(`entrée #${i} (${e.id}) : \`effect\` de forme inattendue ${JSON.stringify(e.effect)} (tableau de GameOp attendu)`);
    return e;
  }
  migres++;
  // Renommage EN PLACE : `ops` occupe la position exacte d'`effect`, la valeur est inchangée.
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [k === 'effect' ? 'ops' : k, v]));
});

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(estMonoTable(data) ? { ...data, entries: sortie } : sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucun `effect`, et la charge utile op par op est CONSERVÉE.
const apres = lignesDe(JSON.parse(out));
const residus = apres.filter((e) => e.effect !== undefined).length;
const avantOps = JSON.stringify(lignes.map((e) => e.effect ?? e.ops ?? null));
const apresOps = JSON.stringify(apres.map((e) => e.ops ?? null));
if (residus || avantOps !== apresOps) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`effect\` résiduel(s) ; charge utile ${avantOps === apresOps ? 'conservée' : 'ALTÉRÉE'}`);
  process.exit(1);
}

console.log(`stars.json — \`effect\` → \`ops\` : ${migres}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres} ; sans champ (légitime) : ${sansEffet} ; entrées : ${apres.length}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/stars.json`);
