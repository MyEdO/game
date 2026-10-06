/**
 * Migration #1389 (épique #1388) — PILOTE de l'adressage de la prose : les entrées de
 * `src/data/psychology.json` cessent de DUPLIQUER le texte du livre, elles l'ADRESSENT (`descRef`).
 *
 * MOTIF MESURÉ : `node scripts/source/derive-decoupes.mjs psychology` rendait, sur l'arbre de départ,
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
 * TABLE FIGÉE (`ADRESSES`) : les décisions de cette migration, relevées dans l'arbre le 2026-10-05 —
 * `id → { ch, parts }`, les fragments sans empreinte (`fragmentBlocs` la pose). Elle ne consomme pas
 * le verdict vivant : un changement de `judge` ne fait pas rejouer la migration autrement. Chaque
 * adresse est PROUVÉE avant d'être écrite (`prouver`) : elle RÉSOUT (`unitesDeLAdresse`), et son rendu
 * ÉGALE la desc (`aligner`, `ajoute` vide). V2b (`schemas/grammaire/prose.ts`) : l'adresse cite le
 * livre de la `source`.
 *
 * FAIL-FAST : une entrée inline hors table, ou une preuve qui échoue, est consignée, RIEN n'est écrit,
 * sortie 1 nominative.
 * IDEMPOTENT : une entrée déjà adressée n'a plus de `desc` — elle est sautée, second passage
 * byte-identique (aucune écriture).
 *
 * FORMATAGE PRÉSERVÉ : la réécriture est TEXTUELLE et ancrée sur le couple `"desc": <chaîne JSON>`
 * exact de l'entrée, remplacé PAR SA PLACE par `"descRef": <objet>` à l'indentation du fichier ; le
 * document n'est jamais re-sérialisé (`remplacerAncre`, `scripts/source/reecriture-ancree.mjs`). Le
 * compte TEXTUEL (remplacements) est confronté au compte STRUCTUREL (entrées prouvées) — divergence =
 * sortie 1.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sigleDe } from '../raw/_lib.mjs';
import { lireChapitre } from '../source/lecteur-fs.mjs';
import { jsonIndente, remplacerAncre } from '../source/reecriture-ancree.mjs';
import { aligner, estErreur, fragmentBlocs, ouDeLAdresse, unitesDeLAdresse, unitesDuTexte } from '../../src/data/source/decoupe.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FICHIER = 'src/data/psychology.json';

/** Table FIGÉE : l'adresse (chapitre, fragments sans empreinte) de chaque entrée que cette migration adresse. */
export const ADRESSES = Object.freeze({
  frenesie: { ch: '21', parts: [{ sec: 'frenesie', secOcc: 1, b0: 0, b1: 2 }] },
  peur: { ch: '21', parts: [{ sec: 'peur-indice', secOcc: 1, b0: 0, b1: 1 }] },
  terreur: { ch: '21', parts: [{ sec: 'terreur-indice', secOcc: 1, b0: 0, b1: 1 }] },
  animosite: { ch: '21', parts: [{ sec: 'animosite-cible', secOcc: 1, b0: 0, b1: 1 }] },
  haine: { ch: '21', parts: [{ sec: 'haine-cible', secOcc: 1, b0: 0, b1: 1 }] },
  prejuge: { ch: '21', parts: [{ sec: 'prejuge-cible', secOcc: 1, b0: 0, b1: 1 }] },
  amour: { ch: '21', parts: [{ sec: 'amour', secOcc: 1, b0: 0, b1: 0 }] },
  camaraderie: { ch: '21', parts: [{ sec: 'camaraderie', secOcc: 1, b0: 0, b1: 0 }] },
  phobie: { ch: '21', parts: [{ sec: 'phobie', secOcc: 1, b0: 0, b1: 0 }] },
});

/**
 * PROUVE l'adresse figée d'une entrée inline : `{ ref }`, ou `{ erreur }` nominative.
 * @param {{ id: string, desc: string, source: { book: string } }} entree
 * @param {{ ch: string, parts: object[] }} cible
 */
export function prouver(entree, cible) {
  const livre = entree.source.book;
  const chapitre = lireChapitre(livre, cible.ch);
  if (!chapitre) return { erreur: `${entree.id} → ${livre} ch.${cible.ch} : chapitre introuvable` };
  const ref = { book: livre, ch: cible.ch, parts: cible.parts.map((choix) => fragmentBlocs(chapitre, choix)) };
  const ou = `${entree.id} → ${ouDeLAdresse(ref)}`;
  const unites = unitesDeLAdresse(chapitre, ref);
  if (estErreur(unites)) return { erreur: `${ou} : ne résout pas — ${unites.error} : ${unites.detail}` };
  const alignement = aligner(unitesDuTexte(entree.desc), unites.unites);
  if (!alignement || alignement.ajoute.length) return { erreur: `${ou} : le rendu de l'adresse n'égale pas la desc` };
  return { ref };
}

/**
 * Migre le TEXTE d'un `psychology.json` ; sur panne, le texte rendu est l'entrée intacte.
 * @param {string} brut
 * @returns {{ texte: string, gestes: { id: string, adresse: string }[], echecs: string[] }}
 */
export function migrer(brut) {
  /** @type {string[]} */
  const echecs = [];
  /** @type {{ id: string, desc: string, ref: object }[]} */
  const gestes = [];

  const data = JSON.parse(brut);
  if (!Array.isArray(data)) return { texte: brut, gestes: [], echecs: [`${FICHIER} n'est pas un tableau d'entrées`] };

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
    if (typeof livre !== 'string' || !sigleDe(livre)) continue;
    const cible = Object.hasOwn(ADRESSES, id) ? ADRESSES[id] : undefined;
    if (!cible) {
      echecs.push(`${ou} : prose inline d'un livre extrait, hors table`);
      continue;
    }
    const preuve = prouver(entree, cible);
    if (preuve.erreur) {
      echecs.push(`${FICHIER} ${preuve.erreur}`);
      continue;
    }
    gestes.push({ id, desc: entree.desc, ref: preuve.ref });
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
    gestes: gestes.map(({ id, ref }) => ({ id, adresse: ouDeLAdresse(ref) })),
    echecs,
  };
}

if (import.meta.main) {
  const cible = path.join(ROOT, FICHIER);
  const brut = readFileSync(cible, 'utf8');
  const { texte, gestes, echecs } = migrer(brut);
  console.log(`${FICHIER} — ${gestes.length} adressée(s)`);
  for (const g of gestes) console.log(`  ${g.id.padEnd(16)} ${g.adresse}`);
  if (echecs.length) {
    console.error(`\nARBITRAGE REQUIS — ${echecs.length} entrée(s) non adressée(s), RIEN n'a été écrit :`);
    for (const e of echecs) console.error(`  ${e}`);
    process.exit(1);
  }
  if (texte !== brut) writeFileSync(cible, texte, 'utf8');
  console.log(`\nRemplacements écrits : ${gestes.length}`);
}
