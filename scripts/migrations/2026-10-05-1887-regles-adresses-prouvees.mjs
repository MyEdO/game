/**
 * Migration #1887 lot 6a-2c — les `regles` que `2026-09-28-1887-regles-desc-vers-descref.mjs` laisse
 * inline ADRESSENT leur prose : chacune adresse la plus petite unité adressable du livre qui CONTIENT
 * sa prose.
 *  - (A) ligne ou case de table → le tableau ENTIER, légende comprise (`adresseDe`) : fiche
 *    `user-doctrine-regle-ligne-de-tableau-adresse-le-tableau-entier`, utilisateur, 2026-09-28 :
 *    « Le tableau entier (Recommandé) ».
 *  - (B) partie stricte d'un bloc de prose ou de liste → le BLOC entier : extension d'ingénierie,
 *    révisable, par analogie à la même fiche — elle ne couvre que les lignes de table.
 *
 * ENTRÉES :
 *   - `src/data/regles.json`  (le SEUL document écrit)
 *   - `Source/**`             (les chapitres du livre cité, lus par `scripts/source/lecteur-fs.mjs`)
 *   - `src/data/books.json`   (id de livre → dossier d'extraction, via `sigleDe`)
 *
 * TABLE FIGÉE (`ADRESSES`, mesurée le 2026-10-05) : `id → { ch, sec, secOcc, b0, b1 }`. Elle ne consomme
 * pas `judge` : un changement de son verdict ne fait pas rejouer la migration autrement. Chaque adresse
 * est PROUVÉE avant d'être écrite (`prouver`) :
 *   - RÉSOLUTION : `resoudreAdresse` réussit ; `sum` est l'empreinte du rendu (`fragmentBlocs`) ;
 *   - CONTENANCE : `aligner` aligne la desc entière sur le rendu de l'adresse ; son `ajoute` est
 *     rendu en preuve de perte ;
 *   - UNICITÉ : exactement UN bloc du livre entier contient la desc (`lieuxDe`), et l'adresse est la
 *     plus petite unité qui le contient : le bloc, ou sa table entière (`adresseDe`).
 * Une preuve qui échoue : RIEN n'est écrit, sortie 1 nominative.
 *
 * HORS TABLE : `navigation-progression` (MDG 13). Sa desc couvre deux blocs (l.66, et la table l.68-75) :
 * aucun bloc ne la contient (`lieuxDe`), et le rendu des deux blocs non plus — la bannière `PROGRESSION`
 * de la table et sa séparatrice s'y interposent (mesure du 2026-10-05).
 *
 * Une entrée inline hors table est NOMMÉE au bilan, jamais touchée. IDEMPOTENT : une entrée adressée
 * n'a plus de `desc`, elle est sautée.
 *
 * FORMATAGE PRÉSERVÉ : réécriture TEXTUELLE ancrée sur le couple `"desc": <chaîne JSON>` exact de
 * l'entrée (`remplacerAncre`) ; le compte TEXTUEL est confronté au compte STRUCTUREL.
 *
 * `migrer(brut)` ne lit que le Source sur le disque : `src/data/regles-migration-fidelite.test.ts`
 * la rejoue sur la pré-image, `src/data/regles-adresses-prouvees.test.ts` prouve la table.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sigleDe } from '../raw/_lib.mjs';
import { chapitresDe, lireChapitre } from '../source/lecteur-fs.mjs';
import { jsonIndente, remplacerAncre } from '../source/reecriture-ancree.mjs';
import {
  adresseDe, aligner, estErreur, fragmentBlocs, parseTable, resoudreAdresse, tablesOf, unitesDeLAdresse,
  unitesDuBloc, unitesDuTexte,
} from '../../src/data/source/decoupe.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FICHIER = 'src/data/regles.json';

/** Date de la mesure de la table. */
export const DATE_DE_LA_TABLE = '2026-10-05';

/** Table FIGÉE : l'adresse (chapitre, section, bornes) de chaque entrée, mesurée à `DATE_DE_LA_TABLE`. */
export const ADRESSES = Object.freeze({
  'main-secondaire': { ch: '14', sec: 'combat-sup-a-sup-deux-armes', secOcc: 1, b0: 1, b1: 1 },
  'viser-une-localisation': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  viser: { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'tir-en-mouvement': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'ragot-au-marche': { ch: '59', sec: 'interpreter-les-seances-d-achats', secOcc: 1, b0: 1, b1: 1 },
  'surincantation-des-sorts-d-augure': { ch: '03', sec: 'table-de-surincantation-des-sorts-d-augure', secOcc: 1, b0: 0, b1: 0 },
  'maladresse-tableau-des-oups': { ch: '14', sec: 'maladresses', secOcc: 1, b0: 1, b1: 1 },
  'attaque-de-flanc-ou-de-dos': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'cible-en-contrebas': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'cible-dissimulee': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'navigation-derive': { ch: '07', sec: 'notes', secOcc: 1, b0: 0, b1: 0 },
  'navigation-louvoyage': { ch: '07', sec: 'notes', secOcc: 1, b0: 0, b1: 0 },
  'navigation-chavirage': { ch: '07', sec: 'notes', secOcc: 1, b0: 0, b1: 0 },
  'navigation-greement': { ch: '07', sec: 'notes', secOcc: 1, b0: 0, b1: 0 },
});

/** Mémo par livre : chaque bloc de chaque chapitre, avec ses unités. */
const _blocsDuLivre = new Map();

/** Les blocs d'un livre entier, dans l'ordre des chapitres. */
function blocsDuLivre(livre) {
  if (!_blocsDuLivre.has(livre)) {
    const blocs = [];
    for (const ch of chapitresDe(livre)) {
      const chapitre = lireChapitre(livre, ch);
      if (!chapitre) continue;
      for (const section of chapitre.sections) {
        section.blocks.forEach((_, rang) => blocs.push({ ch, chapitre, section, rang, unites: unitesDuBloc(section, rang) }));
      }
    }
    _blocsDuLivre.set(livre, blocs);
  }
  return _blocsDuLivre.get(livre);
}

/**
 * Les LIEUX d'une desc dans son livre : les blocs, PRIS UN À UN, dont le rendu la contient (`aligner`).
 * Une suite de blocs n'est pas mesurée.
 * @param {string} livre @param {string} desc
 * @returns {{ ch: string, sec: string, secOcc: number, rang: number }[]}
 */
export function lieuxDe(livre, desc) {
  const texte = unitesDuTexte(desc);
  return blocsDuLivre(livre)
    .filter((b) => aligner(texte, b.unites) !== null)
    .map(({ ch, section, rang }) => ({ ch, sec: section.slug, secOcc: section.occ, rang }));
}

/** Désignation d'une adresse de la table. */
const ouDeLaCible = ({ ch, sec, secOcc, b0, b1 }) => `ch.${ch} §${sec}#${secOcc} blocs ${b0}-${b1}`;

/**
 * PROUVE l'adresse figée d'une entrée inline : `{ ref, preuve }`, ou `{ erreur }` nominative.
 * @param {{ id: string, desc: string, source: { book: string } }} entree
 * @param {{ ch: string, sec: string, secOcc: number, b0: number, b1: number }} cible
 */
export function prouver(entree, cible) {
  const livre = entree.source.book;
  const ou = `${entree.id} → ${livre} ${ouDeLaCible(cible)}`;
  const chapitre = lireChapitre(livre, cible.ch);
  if (!chapitre) return { erreur: `${ou} : chapitre introuvable` };
  const ref = { book: livre, ch: cible.ch, parts: [fragmentBlocs(chapitre, cible)] };
  const resolu = resoudreAdresse(chapitre, ref);
  if (estErreur(resolu)) return { erreur: `${ou} : ne résout pas — ${resolu.error} : ${resolu.detail}` };

  const unites = unitesDeLAdresse(chapitre, ref);
  const texte = unitesDuTexte(entree.desc);
  const alignement = estErreur(unites) ? null : aligner(texte, unites.unites);
  if (!alignement) return { erreur: `${ou} : la desc n'est pas contenue dans le rendu de l'adresse` };

  const lieux = lieuxDe(livre, entree.desc);
  if (lieux.length !== 1) {
    return { erreur: `${ou} : ${lieux.length} lieux du livre contiennent la desc (${lieux.map((l) => `${l.ch}:${l.sec}#${l.secOcc}:${l.rang}`).join(', ') || 'aucun'})` };
  }
  const [lieu] = lieux;
  const section = chapitre.sections.find((s) => s.slug === lieu.sec && s.occ === lieu.secOcc);
  const table = lieu.ch === cible.ch && section && parseTable(section.blocks[lieu.rang].md)
    ? tablesOf(section).find((t) => t.block === section.blocks[lieu.rang])
    : undefined;
  const attendue = lieu.ch !== cible.ch || !section
    ? null
    : table
      ? adresseDe({ book: livre, ch: cible.ch }, chapitre, { section, table })
      : { book: livre, ch: cible.ch, parts: [fragmentBlocs(chapitre, { sec: lieu.sec, secOcc: lieu.secOcc, b0: lieu.rang, b1: lieu.rang })] };
  if (!attendue || estErreur(attendue) || JSON.stringify(attendue) !== JSON.stringify(ref)) {
    return { erreur: `${ou} : la plus petite unité qui contient la desc est ${lieu.ch}:${lieu.sec}#${lieu.secOcc}:${lieu.rang}${table ? ' (sa table entière)' : ''}, pas l'adresse figée` };
  }
  return {
    ref,
    preuve: {
      unites: texte.length,
      ajoute: alignement.ajoute,
      ecartDeLongueurNormalisee: unites.unites.reduce((n, u) => n + u.norm.length, 0) - texte.reduce((n, u) => n + u.norm.length, 0),
      lieux: lieux.length,
    },
  };
}

/**
 * Migre le TEXTE d'un `regles.json` ; sur panne, le texte rendu est l'entrée intacte.
 * @param {string} brut
 * @param {Readonly<Record<string, { ch: string, sec: string, secOcc: number, b0: number, b1: number }>>} [adresses]
 * @returns {{ texte: string, gestes: { id: string, adresse: string }[], restantes: string[], echecs: string[] }}
 */
export function migrer(brut, adresses = ADRESSES) {
  /** @type {string[]} */
  const echecs = [];
  /** @type {string[]} */
  const restantes = [];
  /** @type {{ id: string, desc: string, ref: object }[]} */
  const gestes = [];

  const data = JSON.parse(brut);
  if (!Array.isArray(data)) return { texte: brut, gestes: [], restantes, echecs: [`${FICHIER} n'est pas un tableau d'entrées`] };

  for (const [i, entree] of data.entries()) {
    const id = typeof entree?.id === 'string' ? entree.id : `[${i}]`;
    const ou = `${FICHIER} ${id}`;
    const aDesc = typeof entree?.desc === 'string' && entree.desc.length > 0;
    if (!aDesc) continue;
    if (entree?.descRef !== undefined) {
      echecs.push(`${ou} : \`desc\` ET \`descRef\` — un texte, un porteur`);
      continue;
    }
    const cible = Object.hasOwn(adresses, id) ? adresses[id] : undefined;
    if (!cible) {
      restantes.push(`${ou} : hors table`);
      continue;
    }
    const livre = entree?.source?.book;
    if (typeof livre !== 'string' || !sigleDe(livre)) {
      echecs.push(`${ou} : ${livre ? `livre sans extraction FR (${livre})` : 'sans `source.book`'}`);
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
      const pose = remplacerAncre(texte, `"desc": ${JSON.stringify(geste.desc)}`, ({ indentation }) => `"descRef": ${jsonIndente(geste.ref, indentation)}`);
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
    gestes: gestes.map(({ id, ref }) => ({ id, adresse: `${ref.book} ${ouDeLaCible({ ch: ref.ch, ...ref.parts[0] })}` })),
    restantes,
    echecs,
  };
}

if (import.meta.main) {
  const cible = path.join(ROOT, FICHIER);
  const brut = readFileSync(cible, 'utf8');
  const { texte, gestes, restantes, echecs } = migrer(brut);
  console.log(`${FICHIER} — ${gestes.length} adressée(s), ${restantes.length} hors table`);
  for (const g of gestes) console.log(`  ${g.id.padEnd(40)} ${g.adresse}`);
  for (const r of restantes) console.log(`  · ${r}`);
  if (echecs.length) {
    console.error(`\nPANNE — ${echecs.length} adresse(s) refusée(s), RIEN n'a été écrit :`);
    for (const e of echecs) console.error(`  ${e}`);
    process.exit(1);
  }
  if (texte !== brut) writeFileSync(cible, texte, 'utf8');
  console.log(`\nRemplacements écrits : ${gestes.length}`);
}
