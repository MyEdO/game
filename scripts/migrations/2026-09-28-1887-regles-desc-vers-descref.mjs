/**
 * Migration #1887 (campagne #1390, épique #1388) — la famille `regles` passe à l'ADRESSE : les entrées
 * de `src/data/regles.json` cessent de DUPLIQUER le texte du livre, elles l'ADRESSENT (`descRef`).
 * Patron : le pilote `2026-09-05-1389-psychology-desc-vers-descref.mjs`.
 *
 * ENTRÉES :
 *   - `src/data/regles.json`  (le SEUL document écrit)
 *   - `Source/**`             (les chapitres du livre cité, lus par `scripts/source/lecteur-fs.mjs`)
 *   - `src/data/books.json`   (id de livre → dossier d'extraction, via `sigleDe`)
 *
 * RÉSOLUTION : par le `Source/` LUI-MÊME — `judge` (`scripts/source/derive-decoupes.mjs`), SEULE
 * définition du verdict d'adressabilité du dépôt, qui RE-RÉSOUT l'adresse qu'il émet et rend l'écart
 * en `verification` : la migration consomme ce verdict, elle ne refait aucune comparaison. Écart au
 * pilote : une famille de règles cite des passages à cheval sur plusieurs sections ; les verdicts
 * `EXACT-MULTI-SECTIONS` et `MONTAGE` sont donc ADOPTABLES. V2b (`schemas/grammaire/prose.ts`) :
 * l'adresse et la `source` citent le MÊME livre.
 *
 * NON ADOPTABLE : ECHEC, CELLULE-AMBIGUE, et CELLULE — une règle qui n'est qu'une ligne d'une table
 * adresse le tableau entier (utilisateur, 2026-09-28 : « Le tableau entier »), geste du lot 6a-2 de
 * #1887. L'entrée garde sa `desc`, NOMMÉE au bilan. Un verdict adoptable dont la `verification`
 * signale un écart est une panne de la chaîne : RIEN n'est écrit, sortie 1 nominative.
 * IDEMPOTENT : une entrée adressée n'a plus de `desc` — elle est sautée, second passage sans écriture.
 *
 * FORMATAGE PRÉSERVÉ : réécriture TEXTUELLE ancrée sur le couple `"desc": <chaîne JSON>` exact de
 * l'entrée (`remplacerAncre`, `scripts/source/reecriture-ancree.mjs`) ; le compte TEXTUEL est
 * confronté au compte STRUCTUREL — divergence = sortie 1.
 *
 * `migrer(brut)` ne lit que le Source sur le disque : `src/data/regles-migration-fidelite.test.ts`
 * la rejoue sur la pré-image.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sigleDe } from '../raw/_lib.mjs';
import { judge } from '../source/derive-decoupes.mjs';
import { jsonIndente, remplacerAncre } from '../source/reecriture-ancree.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FICHIER = 'src/data/regles.json';

/** Verdicts de `judge` qui rendent une adresse ADOPTABLE. */
const VERDICTS_ADOPTABLES = new Set(['EXACT', 'EXACT-MULTI-SECTIONS', 'MONTAGE']);

/**
 * Migre le TEXTE d'un `regles.json` ; sur panne, le texte rendu est l'entrée intacte.
 * @param {string} brut
 * @returns {{ texte: string, gestes: { id: string, verdict: string }[], restantes: string[], echecs: string[] }}
 */
export function migrer(brut) {
  /** @type {string[]} */
  const echecs = [];
  /** @type {string[]} */
  const restantes = [];
  /** @type {{ id: string, verdict: string, desc: string, ref: object }[]} */
  const gestes = [];

  const data = JSON.parse(brut);
  if (!Array.isArray(data)) return { texte: brut, gestes, restantes, echecs: [`${FICHIER} n'est pas un tableau d'entrées`] };

  for (const [i, entree] of data.entries()) {
    const id = typeof entree?.id === 'string' ? entree.id : `[${i}]`;
    const ou = `${FICHIER} ${id}`;
    const aDesc = typeof entree?.desc === 'string' && entree.desc.length > 0;
    if (aDesc && entree?.descRef !== undefined) {
      echecs.push(`${ou} : \`desc\` ET \`descRef\` — un texte, un porteur`);
      continue;
    }
    if (!aDesc) continue;
    const livre = entree?.source?.book;
    if (typeof livre !== 'string' || !sigleDe(livre)) {
      restantes.push(`${ou} : ${livre ? `livre sans extraction FR (${livre})` : 'sans `source.book`'}`);
      continue;
    }

    const verdict = judge(entree);
    if (!VERDICTS_ADOPTABLES.has(verdict.verdict)) {
      restantes.push(`${ou} : ${verdict.verdict}${verdict.reason ? ` — ${verdict.reason}` : ''}`);
      continue;
    }
    if (verdict.verification) {
      echecs.push(`${ou} : ${verdict.verification}`);
      continue;
    }
    if (verdict.ref.book !== livre) {
      echecs.push(`${ou} : la prose vit dans « ${verdict.ref.book} », la source cite « ${livre} »`);
      continue;
    }
    gestes.push({ id, verdict: verdict.verdict, desc: entree.desc, ref: verdict.ref });
  }

  let texte = brut;
  let remplacements = 0;
  if (echecs.length === 0) {
    for (const geste of gestes) {
      const ancre = `"desc": ${JSON.stringify(geste.desc)}`;
      const pose = remplacerAncre(texte, ancre, ({ indentation }) => `"descRef": ${jsonIndente(geste.ref, indentation)}`);
      if (pose.erreur) {
        echecs.push(`${FICHIER} ${geste.id} : ${pose.erreur}`);
        continue;
      }
      texte = pose.texte;
      remplacements += 1;
    }
  }
  if (echecs.length === 0 && remplacements !== gestes.length) {
    echecs.push(`compte TEXTUEL (${remplacements}) ≠ compte STRUCTUREL (${gestes.length})`);
  }
  return {
    texte: echecs.length === 0 ? texte : brut,
    gestes: gestes.map(({ id, verdict }) => ({ id, verdict })),
    restantes,
    echecs,
  };
}

if (import.meta.main) {
  const cible = path.join(ROOT, FICHIER);
  const brut = readFileSync(cible, 'utf8');
  const { texte, gestes, restantes, echecs } = migrer(brut);
  console.log(`${FICHIER} — ${gestes.length} adressée(s), ${restantes.length} non adoptable(s)`);
  for (const g of gestes) console.log(`  ${g.id.padEnd(40)} ${g.verdict}`);
  for (const r of restantes) console.log(`  · ${r}`);
  if (echecs.length) {
    console.error(`\nPANNE — ${echecs.length} adresse(s) refusée(s), RIEN n'a été écrit :`);
    for (const e of echecs) console.error(`  ${e}`);
    process.exit(1);
  }
  if (texte !== brut) writeFileSync(cible, texte, 'utf8');
  console.log(`\nRemplacements écrits : ${gestes.length}`);
}
