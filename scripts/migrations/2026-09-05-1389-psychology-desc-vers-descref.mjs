/**
 * Migration #1389 (épique #1388) — PILOTE de l'adressage de la prose : les entrées de
 * `src/data/psychology.json` cessent de DUPLIQUER le texte du livre, elles l'ADRESSENT (`descRef`).
 *
 * MOTIF MESURÉ : `node scripts/source/derive-decoupes.mjs psychology` rend, sur l'arbre de départ,
 * `total=9 EXACT=9 … verifications KO=0` — les 9 `desc` sont retrouvées telles quelles dans le
 * chapitre du livre qu'elles CITENT, chacune comme une suite contiguë de blocs d'une section. La
 * copie n'apporte donc rien que l'adresse n'apporte : elle ajoute une seconde vérité qui dérive
 * (règle stricte 5 du CLAUDE.md — le texte affiché doit se recoller au `Source/`).
 *
 * ENTRÉES :
 *   - `src/data/psychology.json`  (le SEUL document écrit — périmètre du pilote)
 *   - `Source/**`                 (les chapitres du livre cité, lus par `scripts/source/lecteur-fs.mjs`)
 *   - `src/data/books.json`       (id de livre → dossier d'extraction, via `sigleDe`)
 *
 * RÉSOLUTION : par le `Source/` LUI-MÊME, jamais par une table figée ici — `judge`
 * (`scripts/source/derive-decoupes.mjs`), SEULE définition du verdict d'adressabilité du dépôt, qui
 * compose le parseur pur `src/data/source/decoupe.ts`. Une entrée n'est migrée que sur le verdict
 * `EXACT` / `EXACT-MULTI-SECTIONS`, et seulement après que l'adresse, RE-RÉSOLUE par la porte
 * FAIL-CLOSED `resoudreProse` (`scripts/source/resoudre.mjs` — « le résolveur des gardes et des
 * migrations » : chapitre lu, empreintes `sum` vérifiées, fragments joints), rend un texte identique
 * À L'OCTET à la `desc` qui part. Aucun second chemin de résolution ici : ce que la migration éprouve
 * est exactement ce que le plugin exécute au build.
 * V2b (`schemas/grammaire/prose.ts`) : l'adresse et la `source` doivent citer le MÊME livre.
 *
 * FAIL-FAST : toute autre issue (MONTAGE, CELLULE, ECHEC, ambiguïté d'ancre, re-résolution
 * divergente) est consignée, RIEN n'est écrit, sortie 1 nominative.
 * IDEMPOTENT : une entrée déjà adressée n'a plus de `desc` — elle est sautée, second passage
 * byte-identique (aucune écriture).
 *
 * FORMATAGE PRÉSERVÉ : la réécriture est TEXTUELLE et ancrée sur le couple `"desc": <chaîne JSON>`
 * exact de l'entrée, remplacé PAR SA PLACE par `"descRef": <objet>` à l'indentation du fichier ; le
 * document n'est jamais re-sérialisé. Le geste vient de la primitive PARTAGÉE `remplacerAncre`
 * (`scripts/source/reecriture-ancree.mjs`), que l'outil de réparation d'adresse consomme aussi. Le
 * compte TEXTUEL (remplacements) est confronté au compte STRUCTUREL (entrées jugées) — divergence =
 * sortie 1.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sigleDe } from '../raw/_lib.mjs';
import { resoudreProse } from '../source/resoudre.mjs';
import { judge } from '../source/derive-decoupes.mjs';
import { jsonIndente, remplacerAncre } from '../source/reecriture-ancree.mjs';
import { ouDeLAdresse } from '../../src/data/source/decoupe.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/psychology.json';
const CIBLE = path.join(ROOT, FICHIER);

/** Verdicts de `judge` qui rendent une adresse ADOPTABLE : un run contigu, sans montage. */
const VERDICTS_ADOPTABLES = new Set(['EXACT', 'EXACT-MULTI-SECTIONS']);

/** @type {string[]} */
const echecs = [];
/** @type {{ id: string, verdict: string, adresse: string, sums: string[], desc: string, ref: object }[]} */
const gestes = [];
/** @type {string[]} */
const sautees = [];

const brut = readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);
if (!Array.isArray(data)) {
  console.error(`${FICHIER} n'est pas un tableau d'entrées`);
  process.exit(1);
}

for (const [i, entree] of data.entries()) {
  const id = typeof entree?.id === 'string' ? entree.id : `[${i}]`;
  const ou = `${FICHIER} ${id}`;
  const aDesc = typeof entree?.desc === 'string' && entree.desc.length > 0;
  const adressee = entree?.descRef !== undefined;

  if (aDesc && adressee) {
    echecs.push(`${ou} : \`desc\` ET \`descRef\` — un texte, un porteur`);
    continue;
  }
  if (!aDesc) {
    sautees.push(`${ou} : ${adressee ? 'déjà adressée' : 'aucune prose inline'}`);
    continue;
  }
  const livre = entree?.source?.book;
  if (typeof livre !== 'string' || !sigleDe(livre)) {
    sautees.push(`${ou} : ${livre ? `livre sans extraction FR (${livre})` : 'sans `source.book`'}`);
    continue;
  }

  const verdict = judge(entree);
  if (!VERDICTS_ADOPTABLES.has(verdict.verdict)) {
    echecs.push(`${ou} : verdict ${verdict.verdict}${verdict.reason ? ` — ${verdict.reason}` : ''}`);
    continue;
  }
  if (verdict.verification) {
    echecs.push(`${ou} : ${verdict.verification}`);
    continue;
  }
  const ref = verdict.ref;
  if (ref.book !== livre) {
    echecs.push(`${ou} : la prose vit dans « ${ref.book} », la source cite « ${livre} » — arbitrage (\`alsoIn\`), pas une adresse`);
    continue;
  }
  const fragmentSansEmpreinte = ref.parts.findIndex((p) => typeof p.sum !== 'string' || p.sum.length !== 16);
  if (fragmentSansEmpreinte >= 0) {
    echecs.push(`${ou} : fragment ${fragmentSansEmpreinte + 1} sans empreinte \`sum\``);
    continue;
  }

  // La porte FAIL-CLOSED, jamais une recomposition locale : elle LÈVE sur une adresse morte, une
  // empreinte divergente ou un chapitre absent — l'échec est nominatif, jamais un texte approchant.
  let resolu;
  try {
    resolu = resoudreProse({ descRef: ref });
  } catch (e) {
    echecs.push(`${ou} : re-résolution refusée — ${e instanceof Error ? e.message : String(e)}`);
    continue;
  }
  if (resolu.md !== entree.desc) {
    const n = Math.min(resolu.md.length, entree.desc.length);
    let k = 0;
    while (k < n && resolu.md[k] === entree.desc[k]) k += 1;
    echecs.push(
      `${ou} : texte re-résolu ≠ desc À L'OCTET — divergence au caractère ${k} ` +
        `(desc ${entree.desc.length} car., résolu ${resolu.md.length} car.) : ` +
        `desc « …${entree.desc.slice(Math.max(0, k - 30), k + 30)} » vs résolu « …${resolu.md.slice(Math.max(0, k - 30), k + 30)} »`,
    );
    continue;
  }

  gestes.push({ id, verdict: verdict.verdict, adresse: ouDeLAdresse(ref), sums: ref.parts.map((p) => p.sum), desc: entree.desc, ref });
}

// ── Réécriture TEXTUELLE ancrée, compte textuel confronté au compte structurel ───────────────────
let out = brut;
let remplacements = 0;
if (echecs.length === 0) {
  for (const geste of gestes) {
    const ancre = `"desc": ${JSON.stringify(geste.desc)}`;
    const pose = remplacerAncre(out, ancre, ({ indentation }) => `"descRef": ${jsonIndente(geste.ref, indentation)}`);
    if (pose.erreur) {
      echecs.push(`${FICHIER} ${geste.id} : ${pose.erreur}`);
      continue;
    }
    out = pose.texte;
    remplacements += 1;
  }
}

if (echecs.length === 0 && remplacements !== gestes.length) {
  echecs.push(`compte TEXTUEL (${remplacements} remplacement(s)) ≠ compte STRUCTUREL (${gestes.length} entrée(s) jugée(s))`);
}
if (echecs.length === 0 && remplacements > 0) {
  writeFileSync(CIBLE, out, 'utf8');
}

// ── Bilan ────────────────────────────────────────────────────────────────────────────────────────
console.log(`${FICHIER} — ${data.length} entrée(s), ${gestes.length} adressée(s), ${sautees.length} sautée(s)`);
if (gestes.length) {
  console.log('\n  id                verdict  adresse                                                sum');
  for (const g of gestes) {
    console.log(`  ${g.id.padEnd(16)}  ${g.verdict.padEnd(7)}  ${g.adresse.padEnd(52)}  ${g.sums.join(' + ')}`);
  }
}
for (const s of sautees) console.log(`  · ${s}`);
console.log(`\nRemplacements écrits : ${remplacements}${remplacements ? ` (${FICHIER})` : ''}`);

if (echecs.length) {
  console.error(`\nARBITRAGE REQUIS — ${echecs.length} entrée(s) non adressée(s), RIEN n'a été écrit :`);
  for (const e of echecs) console.error(`  ${e}`);
  process.exit(1);
}
