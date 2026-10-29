/**
 * Migration L2 #1548 (commit 4) — la Spécialisation « Guilde » de Signes secrets n'a qu'UN id.
 *
 * `skills.json › signes-secrets.specs[]` portait DEUX entrées pour le MÊME groupe : `guilde`
 * (`LDB 08 l.250` : « Signes secrets (guilde) ») et `guilde-au-choix` (libellé « Guilde (Au choix) »),
 * qui n'est pas une spéc de plus mais la graphie du catalogue — `LDB 09 l.504` : « **Spécialisations :**
 * Ordre Gris, Guildes (au choix), Ruraux, Éclaireurs, Voleurs, Vagabonds ». Le doublon FUSIONNE dans
 * `guilde`, qui reçoit l'emplacement d'origine en `alsoIn` (avec sa citation verbatim), et l'unique
 * référence qui le désignait (`careerLevels.json`) prend l'id survivant.
 *
 * ENTRÉES : `src/data/skills.json` (le catalogue), `src/data/careerLevels.json` (la référence).
 * FORME D'AVANT SEULE : le doublon ne fusionne qu'EXACTEMENT à sa forme d'avant
 * (`MORT_AVANT`), une référence n'est ramenée que tant qu'elle porte `guilde-au-choix` ; une entrée absente,
 * déjà fusionnée ou révisée après la migration, est laissée telle quelle. FAIL-FAST : le doublon à
 * fusionner sans son survivant.
 * IDEMPOTENT : rejouée, elle n'écrit rien. FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié
 * canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as egal } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'src/data');
const MORT = 'guilde-au-choix';
const MORT_AVANT = { id: MORT, label: 'Guilde (Au choix)' };
const VIVANT = 'guilde';
const ALSO_IN = {
  book: 'livre-de-base',
  page: 130,
  note: 'LDB 09 l.504',
  quote: 'Guildes (au choix)',
};

const lire = (f) => {
  const abs = path.join(DATA, f);
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) {
    console.error(`FORME NON CANONIQUE — src/data/${f} ; AUCUNE écriture.`);
    process.exit(1);
  }
  return { abs, brut, doc };
};

const ecrire = ({ abs, brut, doc }, quoi) => {
  const out = serializeDataset(doc);
  if (out === brut) { console.log(`${path.basename(abs)} — INCHANGÉ (no-op byte-identique).`); return; }
  if (out.includes('\r')) { console.error(`${abs} : \\r dans le texte réécrit ; AUCUNE écriture.`); process.exit(1); }
  fs.writeFileSync(abs, out, 'utf8');
  console.log(`${path.basename(abs)} — ${quoi}`);
};

const skills = lire('skills.json');
const specs = skills.doc.find((s) => s.id === 'signes-secrets')?.specs;
const survivant = Array.isArray(specs) ? specs.find((e) => e.id === VIVANT) : undefined;
const iMort = Array.isArray(specs) ? specs.findIndex((e) => egal(e, MORT_AVANT)) : -1;
if (iMort >= 0) {
  if (!survivant) { console.error(`« ${VIVANT} » absent du catalogue de signes-secrets ; AUCUNE écriture.`); process.exit(1); }
  specs.splice(iMort, 1);
  survivant.alsoIn = [...(survivant.alsoIn ?? []).filter((a) => a.note !== ALSO_IN.note), ALSO_IN];
}
ecrire(skills, `doublon « ${MORT} » fusionné dans « ${VIVANT} » (+ alsoIn ${ALSO_IN.note}).`);

const cl = lire('careerLevels.json');
let refs = 0;
const walk = (n) => {
  if (Array.isArray(n)) { n.forEach(walk); return; }
  if (!n || typeof n !== 'object') return;
  if (n.id === 'signes-secrets' && n.spec === MORT) { n.spec = VIVANT; refs++; }
  for (const v of Object.values(n)) walk(v);
};
walk(cl.doc);
ecrire(cl, `${refs} référence(s) « signes-secrets/${MORT} » ramenée(s) à « ${VIVANT} ».`);
