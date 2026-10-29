/**
 * Migration #1457 (B2) — les 9 spécs de `savoir-vivre` portées par des créatures des livres
 * OFFICIELS (Middenheim 6, Mer des Griffes 2, Zoo Impérial 1) rejoignent le catalogue par leur ID.
 *
 * Deux gestes, chacun adossé à la ligne « **Talents :** » du statbloc lue au `Source/` FR :
 *  - `ENTREES_NEUVES` : le groupe social est IMPRIMÉ et ABSENT du catalogue → entrée
 *    `talents.json › savoir-vivre.specs[]` `{id,label,source,pool:false}` (`page` = folio IMPRIMÉ qui
 *    gouverne la ligne du STATBLOC, `note` = citation à la ligne, confrontées par
 *    `folio-line-align.test.ts`). `pool: false` : leur seul consommateur est un statbloc, aucune
 *    ligne joueur ne les demande et LDB 10 l.1071 ne les énumère pas (#1342 L3 ; `LDB 09 l.40`).
 *  - `SOURCES_MANQUANTES` : le groupe est DÉJÀ au catalogue mais NU (aucune `source`) alors que
 *    LDB 10 l.1071 ne l'énumère pas — il reçoit la citation de la PREMIÈRE ligne JOUEUR qui le
 *    demande (une ligne « **Talents :** » de niveau de carrière), folio = ancre `data-folio` qui
 *    gouverne cette ligne. Aucun `pool: false` ici : une ligne joueur le demande, le pool doit le
 *    proposer (`LDB 09 l.40`).
 *  - `ARBITRAGES` : le groupe est DÉJÀ au catalogue sous une autre GRAPHIE — le porteur prend l'id
 *    (doctrine des ids : le `label` est de l'affichage). Chaque ligne porte, en commentaire, les
 *    DEUX impressions qui prouvent la synonymie ; créer une 2ᵉ entrée poserait un doublon de concept.
 *
 * ENTRÉES : `src/data/talents.json` (catalogue de `savoir-vivre`, écrit) et `src/data/creatures.json`
 * (les 9 porteurs, écrit). Marche des `talents[]` : `scripts/data/lib/skillSpecWalk.mjs`
 * (`walkSkillRefs`), la MÊME que la garde `src/data/refs-migrated.test.ts`.
 *
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : un porteur n'est remappé que tant qu'il porte la spéc
 * IMPRIMÉE ; une entrée de `ENTREES_NEUVES` n'entre que pour un porteur à remapper ; une source n'est posée
 * que sur l'entrée EXACTEMENT `{ id, label }`. Un porteur ou une entrée absents, déjà migrés ou révisés après
 * la migration, sont laissés tels quels.
 * IDEMPOTENT : rejouée, elle n'écrit rien.
 * FAIL-FAST : arrêt en 1, pour un porteur à remapper, si sa cible manque au catalogue ou si l'entrée neuve
 * qu'il appelle y entre en collision — l'arbre n'est écrit qu'après mesure.
 * FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as egal } from 'node:util';
import { walkSkillRefs } from '../data/lib/skillSpecWalk.mjs';
import { porteLaTranche } from './lib/formeDAvant.mjs';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'src/data');
const TALENT = 'savoir-vivre';

/** Groupes sociaux imprimés que le catalogue ne porte pas encore. */
const ENTREES_NEUVES = [
  // MDG 16 l.360 (statbloc Jaego Roth, folio 151) : « Savoirvivre (Marins, Nobles, Pirates) ».
  // Distinct d'`equipage` : le MÊME livre imprime « Savoir-vivre (Équipage) » (MDG 09 l.95/171/578,
  // MDG 14 l.349) et « Marins » à la même ligne que « Nobles » et « Pirates ».
  { id: 'marins', label: 'Marins', source: { book: 'mer-des-griffes', page: 151, note: 'MDG 16 l.360' }, pool: false },
  { id: 'pirates', label: 'Pirates', source: { book: 'mer-des-griffes', page: 151, note: 'MDG 16 l.360' }, pool: false },
  // ZI 04 l.44 (statbloc de « L'abominable » Halagrundsor, folio 35) : « Savoir-vivre (Nains) ».
  { id: 'nains', label: 'Nains', source: { book: 'zoo-imperial', page: 35, note: 'ZI 04 l.44' }, pool: false },
];

/** Entrées déjà au catalogue mais SANS attestation — `attendu` = le libellé du catalogue, re-mesuré. */
const SOURCES_MANQUANTES = [
  // LDB 08 l.1295 (Prêtre Guerrier, niveau « Novice – Bronze 2 », folio 73) :
  // « **Talents :** Béni (au choix), Lire/Écrire, Obstiné, Savoir-vivre (Fidèles) ».
  { id: 'fideles', attendu: 'Fidèles', source: { book: 'livre-de-base', page: 73, note: 'LDB 08 l.1295' } },
  // MDG 09 l.95 (Artilleur de navire, niveau « Artilleur de navire – Argent 3 », folio 64) :
  // « **Talents :** Artilleur, Savoir-vivre (Équipage), Tireur de ».
  { id: 'equipage', attendu: 'Équipage', source: { book: 'mer-des-griffes', page: 64, note: 'MDG 09 l.95' } },
];

/**
 * Porteurs dont la spéc imprimée EST une entrée du catalogue sous une autre graphie. `imprime` =
 * verbatim du statbloc, `vers` = id existant, `cite` = les impressions qui portent la décision.
 */
const ARBITRAGES = [
  // MCLB 02 l.2406 (folio 106) : « Savoirvivre (Serviteur, Guilde, Noble) ».
  // « Serviteur » ⇄ `serviteurs` : le MÊME livre imprime « Savoir-vivre (Serviteurs) » (MCLB 02
  // l.1828) et LDB 10 l.1071 énumère « … Serviteurs et Soldats ».
  { creature: 'andrea-bruhn', imprime: 'Serviteur', vers: 'serviteurs', cite: 'MCLB 02 l.2406 ⇄ MCLB 02 l.1828' },
  // « Guilde » ⇄ `guildes` : le MÊME livre imprime « Savoir-vivre (Guildes) » (MCLB 09 l.144).
  { creature: 'andrea-bruhn', imprime: 'Guilde', vers: 'guildes', cite: 'MCLB 02 l.2406 ⇄ MCLB 09 l.144' },
  // « Noble » ⇄ `nobles` : MDG 16 l.360 imprime « Nobles », LDB 10 l.1071 aussi.
  { creature: 'andrea-bruhn', imprime: 'Noble', vers: 'nobles', cite: 'MCLB 02 l.2406 ⇄ MDG 16 l.360' },
  // MCLB 02 l.696 (folio 52) : « Savoir-vivre (Noble), Savoir-vivre (Soldat) ».
  { creature: 'moritz-valgeir', imprime: 'Noble', vers: 'nobles', cite: 'MCLB 02 l.696 ⇄ MDG 16 l.360' },
  // « Soldat » ⇄ `soldats` : LDB 10 l.1071 « … Serviteurs et Soldats ».
  { creature: 'moritz-valgeir', imprime: 'Soldat', vers: 'soldats', cite: 'MCLB 02 l.696 ⇄ LDB 10 l.1071' },
  // MCLB 02 l.1308 (folio 72) : « Savoir-vivre (Guilde) ».
  { creature: 'stefan-hochen', imprime: 'Guilde', vers: 'guildes', cite: 'MCLB 02 l.1308 ⇄ MCLB 09 l.144' },
  // MDG 16 l.360 (folio 151) et ZI 04 l.44 (folio 35) : les entrées créées ci-dessus.
  { creature: 'jaego-roth', imprime: 'Marins', vers: 'marins', cite: 'MDG 16 l.360' },
  { creature: 'jaego-roth', imprime: 'Pirates', vers: 'pirates', cite: 'MDG 16 l.360' },
  { creature: 'l-abominable-halagrundsor', imprime: 'Nains', vers: 'nains', cite: 'ZI 04 l.44' },
];

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

// -- Porteurs encore à leur spéc imprimée ------------------------------------------------------
const talents = lire('talents.json');
const creatures = lire('creatures.json');
const parId = new Map(creatures.doc.map((c) => [c.id, c]));
/** Les nœuds `savoir-vivre` du porteur de `a` encore EXACTEMENT à la spéc imprimée. */
const noeudsImprimes = (a) => {
  const noeuds = [];
  const c = parId.get(a.creature);
  if (c) walkSkillRefs(c, (node) => { if (porteLaTranche(node, { id: TALENT, spec: a.imprime })) noeuds.push(node); }, 'talents');
  return noeuds;
};
const aRemapper = ARBITRAGES.map((a) => ({ ...a, noeuds: noeudsImprimes(a) })).filter((a) => a.noeuds.length);

// -- Catalogue ---------------------------------------------------------------------------------
const specs = talents.doc.find((t) => t.id === TALENT)?.specs;
let ajoutees = 0;
for (const e of ENTREES_NEUVES) {
  if (!Array.isArray(specs) || !aRemapper.some((a) => a.vers === e.id)) continue;
  const deja = specs.find((s) => s.id === e.id);
  if (!deja) { specs.push(e); ajoutees++; continue; }
  if (deja.label !== e.label) {
    console.error(`COLLISION d'id ${TALENT}/${e.id} : catalogue « ${deja.label} » vs ajout « ${e.label} » ; AUCUNE écriture.`);
    process.exit(1);
  }
}

let sourcees = 0;
for (const s of SOURCES_MANQUANTES) {
  const e = Array.isArray(specs) ? specs.find((x) => egal(x, { id: s.id, label: s.attendu })) : undefined;
  if (!e) continue;
  e.source = s.source;
  sourcees++;
}

// -- Porteurs ----------------------------------------------------------------------------------
let remappees = 0;
for (const a of aRemapper) {
  if (!Array.isArray(specs) || !specs.some((s) => s.id === a.vers)) {
    console.error(`CIBLE ABSENTE — ${TALENT}/${a.vers} (${a.creature}, « ${a.imprime} ») ; AUCUNE écriture.`);
    process.exit(1);
  }
  for (const node of a.noeuds) node.spec = a.vers;
  remappees += a.noeuds.length;
  console.log(`  creatures/${a.creature} : ${TALENT} « ${a.imprime} » → ${a.vers}  [${a.cite}]`);
}

// Écriture APRÈS la mesure complète des deux documents : un arrêt fail-fast laisse l'arbre intact.
ecrire(talents, `${ajoutees} entrée(s) ajoutée(s) au catalogue de ${TALENT}, ${sourcees} attestée(s).`);
ecrire(creatures, `${remappees} spéc(s) de ${TALENT} ramenée(s) à leur id.`);
console.log(`Catalogue : +${ajoutees} · porteurs remappés : ${remappees} / ${ARBITRAGES.length} arbitrage(s)`);
