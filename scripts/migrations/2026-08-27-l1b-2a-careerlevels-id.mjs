/**
 * Migration #1467 L1b V-P1 — `careerLevels.json` : chaque niveau de carrière reçoit son `id`
 * d'ENVELOPPE, composite `<career>-<level>` (ex. `agitateur-1`).
 *
 * MOTIF MESURÉ : les 432 entrées n'ont AUCUNE identité de premier niveau — le couple `career`+`level`
 * la portait, ce que `scripts/gen-registry.mjs` inscrivait au défaut `DEFAUTS_IDS['careerLevels.json']`
 * (« liste d'entités sans identité de premier niveau »). Le seul site du dépôt qui FABRIQUAIT un id de
 * niveau le composait au vol avec un séparateur `:` : l'identité existait donc déjà, non déclarée et non partagée. Elle devient une CLÉ de la donnée.
 *
 * SÉPARATEUR `-` (et non `:`) : graphie des ids du dépôt (slugs `kebab-case`), et `-` est le
 * séparateur admis par le détecteur d'ids du registre. Unicité MESURÉE avant écriture : 432/432
 * composites distincts, 0 collision.
 *
 * PÉRIMÈTRE : le CATALOGUE seul. `Combatant` (`src/engine/types.ts`) garde sa PAIRE `career` +
 * `careerLevel` — cette migration ne touche aucun état de jeu.
 *
 * ENTRÉES : `src/data/careerLevels.json` (la seule donnée lue et écrite).
 *
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : seule une entrée SANS `id` reçoit le sien ; une entrée
 * qui en porte un (forme d'après, ou `career` révisé depuis, #2968 L03) passe sans faute. Rejouée sur
 * l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : sur une entrée sans `id`, `career`/`level` absent ou de mauvais type ; composite en
 * collision avec un `id` présent ou posé → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence), donc
 * la réécriture structurée est byte-exacte hors les clés ajoutées.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/careerLevels.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/careerLevels.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

/** Identité d'un niveau de carrière — SOURCE UNIQUE de la composition (le catalogue la déclare). */
const idDe = (e) => `${e.career}-${e.level}`;

const echecs = [];
const migres = [];
const dejaMigres = [];
const vus = new Map();

for (const [i, e] of data.entries()) if (e?.id !== undefined) vus.set(e.id, i);

const sortie = data.map((e, i) => {
  if (e?.id !== undefined) {
    dejaMigres.push(e.id);
    return e;
  }
  if (typeof e?.career !== 'string' || !e.career) {
    echecs.push(`entrée #${i} : \`career\` absente ou non-chaîne`);
    return e;
  }
  if (typeof e.level !== 'number') {
    echecs.push(`entrée #${i} (${e.career}) : \`level\` absent ou non-numérique`);
    return e;
  }
  const id = idDe(e);
  const premier = vus.get(id);
  if (premier !== undefined) {
    echecs.push(`collision d’id \`${id}\` : entrées #${premier} et #${i}`);
    return e;
  }
  vus.set(id, i);
  migres.push(id);
  // `id` en PREMIÈRE clé — l'identité ouvre l'entrée, comme partout ailleurs dans `src/data`.
  return { id, ...e };
});

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : chaque entrée porte un `id`, et tous sont distincts.
const apres = JSON.parse(out);
const sansId = apres.filter((e) => e.id === undefined);
const distincts = new Set(apres.map((e) => e.id)).size;
if (sansId.length || distincts !== apres.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${sansId.length} sans id, ${distincts}/${apres.length} id(s) distinct(s)`);
  process.exit(1);
}

console.log(`careerLevels.json — \`id\` composite \`<career>-<level>\` posé : ${migres.length}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres.length}`);
console.log(`Entrées : ${apres.length} ; ids distincts : ${distincts}/${apres.length}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/careerLevels.json`);
