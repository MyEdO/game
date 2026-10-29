/**
 * Migration #1797 — le « minimum de 1 Round » vit dans la FORMULE de l'entrée, jamais au moteur.
 *
 * La durée du Choc au bras était résolue nue (`1d10 − (Bonus d'Endurance)`, qui vaut ≤ 0 dès BE ≥ 10)
 * et le plancher était posé par le SITE D'APPEL de `durationFromOp` (`src/engine/ops.ts`) : le moteur
 * portait une clause qui appartient à DEUX entrées de table. La borne basse est désormais un terme de
 * la grammaire `Formula` (`{minimum, of}`) : la clause est LUE là où le livre l'écrit.
 *
 * MOTIF AU SOURCE — la prose des deux entrées, mot pour mot :
 *  - `Source/WH - V4 - Aux Armes/07 - MISES A JOUR DE L'ETAT HEMORRAGIQUE.md` l.113 (« Choc au bras »,
 *    `aa-bras-11`) : « Vous lâchez ce que vous teniez dans cette main et cette dernière devient
 *    inutilisable pour 1d10 – (Bonus d'Endurance) Rounds (minimum de 1). » ;
 *  - `Source/Warhammer v4 - Livre de base version corrigee/18 - Traumatisme.md` l.88 (« Choc violent au
 *    bras », `choc-violent-au-bras`) : « Vous lâchez ce que vous teniez en main, et cette dernière
 *    devient inutilisable pour 1d10 - (Bonus d'Endurance) Rounds (minimum de 1). »
 *
 * ENTRÉE : `src/data/criticals.json`, aux SEULES entrées nommées ci-dessous, sur leur op
 * `maxWeaponHands` : 2 durées.
 * FORME D'AVANT SEULE : une durée ne se borne qu'EXACTEMENT à sa forme d'avant
 * (`1d10 + (Bonus d'Endurance) × -1`) ; une entrée ou une op absentes, bornées ou révisées depuis,
 * sont laissées telles quelles.
 * IDEMPOTENT : rejouée sur l'état final, les deux durées sont déjà bornées et elle sort 0 sans écrire.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF, newline final constaté), vérifié
 * AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { porteLaTranche } from './lib/formeDAvant.mjs';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/criticals.json';

/** Entrées PORTEUSES de la clause — LISTE CLOSE (les deux tables Bras du corpus). */
const PORTEUSES = ['choc-violent-au-bras', 'aa-bras-11'];
/** Durée attendue AVANT migration : « 1d10 – (Bonus d'Endurance) ». */
const DUREE_ATTENDUE = { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] };
/** Borne basse d'arrivée : « (minimum de 1) ». */
const MINIMUM = 1;

const abs = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(abs, 'utf8');
const data = JSON.parse(brut);
const suffixe = brut.endsWith('\n') ? '\n' : '';
if (serializeDataset(data) + suffixe !== brut) {
  console.error(`FORME NON CANONIQUE — ${FICHIER} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error(`FORME INATTENDUE — ${FICHIER} n'est pas une liste de tables ; AUCUNE écriture.`);
  process.exit(1);
}

/** L'entrée `id`, où qu'elle vive dans les tables du fichier. */
const entree = (doc, id) => doc.flatMap((table) => table.entries ?? []).find((e) => e && e.id === id);

const sites = PORTEUSES.flatMap((id) =>
  (entree(data, id)?.ops ?? [])
    .filter((o) => porteLaTranche(o, { op: 'maxWeaponHands', durationRounds: DUREE_ATTENDUE }))
    .map((op) => ({ id, op })),
);

if (sites.length === 0) {
  console.log(`RIEN À FAIRE — aucune durée « Choc au bras » à sa forme d'avant.`);
  process.exit(0);
}

for (const { op } of sites) op.durationRounds = { minimum: MINIMUM, of: op.durationRounds };

fs.writeFileSync(abs, serializeDataset(data) + suffixe);
console.log(`${sites.length} durée(s) « Choc au bras » bornées à « minimum de ${MINIMUM} » (AA 07 l.113, LDB 18 l.88) :`);
for (const s of sites) console.log(`  ${s.id}.maxWeaponHands`);
