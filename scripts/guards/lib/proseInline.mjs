// MESURE de la PROSE INLINE recopiée d'un livre EXTRAIT — le dénominateur du chantier #1390.
// Consommée par `src/data/prose-inline-contrat.test.ts` (contrat bidirectionnel contre le stock
// `PROSE_INLINE_TOLEREE` de `src/data/schemas/grammaire/prose-inline.ts`) et par le CLI
// `scripts/source/mesurer-prose-inline.mjs` (table type/compte, avec laquelle le stock se peuple).
// Patron mesure-en-lib du dépôt (`structures-scan.mts`, `folioIntegrity.mjs`).
//
// MASQUE, mot à mot : « nœud portant un `desc` chaîne non vide dont la source EFFECTIVE — son
// `source.book` propre, sinon le `source.book` de l'ancêtre le plus proche qui en porte un —
// désigne un livre à `dir` dans `books.json`, `maison` ou pas, à toute profondeur ». Un nœud qui porte
// `adapteDe` (`champAdapteDe`, `src/data/schemas/grammaire/prose.ts`) COUPE l'héritage, pour lui et ce
// qu'il contient (#2001).
//
// PÉRIMÈTRE — des racines de documents DONNÉES EN DESCRIPTEURS. Défaut de la mesure, le commun
// (`RACINES_DU_COMMUN`) : `src/data/*.json` (non récursif, le motif de `RACINE_DES_DONNEES`,
// `scripts/docs/lib/structures-scan.mts`) et son contenu (`CORPUS_DU_COMMUN`). Le greffon de prose transforme
// aussi les projets livrés (`RACINES_PROSE`, `PROJETS_LIVRES`).
//
// CLÉ — le `type` du DOCUMENT racine du fichier (`type` de la racine objet, ou de son premier
// élément quand la racine est une liste), à défaut le nom de base du fichier. C'est la clé que le
// refine V3 de `grammaire/prose.ts` consulte (`ctx.type in PROSE_INLINE_TOLEREE`) : mesurer autre
// chose que le `type` rendrait le stock et le verrou aveugles l'un à l'autre.
import fs from 'node:fs';
import path from 'node:path';
import { listerArbre } from './lister.mjs';
import { PROJETS_LIVRES } from './projetsLivres.mjs';
import { porteDeTousLesProjets } from './porteDesProjets.mjs';
import { CORPUS_DU_COMMUN } from './paquetsDuCommun.mjs';
import { REGISTRE_LIVRES, estLivreExtrait } from '../../raw/_lib.mjs';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt, déduite de l'emplacement de ce module (`scripts/guards/lib`). */
export const RACINE_DEPOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));

/** Les données du commun, en DESCRIPTEUR ENTIER (dossier + motif de fichier + récursivité). Une racine se donne
 *  entière à `mesurerProseInline`, jamais par une CLÉ à résoudre : un identifiant de racine à résoudre serait un
 *  branchement par identité dans du code générique (#842, `src/registry-id-branch-guard.test.ts`). */
const DONNEES = Object.freeze({ dossier: 'src/data', suffixe: '.json', recursif: false });

/** Les racines du COMMUN : ses données et son contenu, défaut de `mesurerProseInline`. */
const RACINES_DU_COMMUN = Object.freeze([DONNEES, CORPUS_DU_COMMUN]);

/** Les documents que le greffon de prose transforme (`estDocumentDeProse`) : les données et les projets livrés. */
export const RACINES_PROSE = Object.freeze([DONNEES, PROJETS_LIVRES]);

/**
 * Le fichier `chemin` est-il un DOCUMENT de l'une des `RACINES_PROSE` ? Jugé sur le chemin à partir du
 * DOSSIER de la racine, où que soit le dépôt (Vite rend des ids absolus, les tests des racines de
 * fixture) : sous `<dossier>/`, au bon suffixe, et à plat quand la racine n'est pas récursive.
 * @param {string} chemin @param {readonly { dossier: string, suffixe: string, recursif: boolean }[]} [racines]
 * @returns {boolean}
 */
export function estDocumentDeProse(chemin, racines = RACINES_PROSE) {
  const posix = `/${String(chemin).split('\\').join('/').replace(/^\/+/, '')}`;
  return racines.some((r) => {
    const marque = `/${r.dossier}/`;
    const i = posix.lastIndexOf(marque);
    if (i === -1) return false;
    const reste = posix.slice(i + marque.length);
    return reste.endsWith(r.suffixe) && (r.recursif || !reste.includes('/'));
  });
}

/** Ids des livres EXTRAITS (`estLivreExtrait`) du registre (`REGISTRE_LIVRES`) — les seuls adressables. */
export function livresExtraits() {
  return new Set(REGISTRE_LIVRES.filter(estLivreExtrait).map((b) => b.id));
}

function fichiersDe(dir, suffixe, recursif) {
  return listerArbre(dir, {
    absent: 'vide',
    descendre: () => recursif,
    filtre: (rel) => rel.endsWith(suffixe),
    porte: porteDeTousLesProjets,
  }).map((rel) => path.join(dir, rel));
}

/** `type` du DOCUMENT que porte ce fichier — sa déclaration, jamais son nom de fichier quand elle existe. */
export function typeDuDocument(doc, chemin) {
  const racine = Array.isArray(doc) ? doc[0] : doc;
  const t = racine && typeof racine === 'object' ? racine.type : undefined;
  if (typeof t === 'string' && t.length > 0) return t;
  return path.basename(chemin).replace(/\.json$/, '');
}

/**
 * Mesure la prose inline d'un livre extrait sur les racines DONNÉES (des descripteurs entiers, cf.
 * `RACINES_DU_COMMUN`, jamais des identifiants à résoudre) ; un projet passe les siennes.
 * Rend `{ [type]: { entrees, noeuds } }` — `noeuds` étant les chemins `fichier › chemin.dans.le.json`,
 * triés, pour que la garde nomme ce qui dérive au lieu d'imprimer un delta nu.
 */
export function mesurerProseInline(racines = RACINES_DU_COMMUN, root = RACINE_DEPOT) {
  const extraits = livresExtraits();
  const parType = new Map();
  for (const racine of racines) {
    for (const fichier of fichiersDe(path.join(root, racine.dossier), racine.suffixe, racine.recursif)) {
      const relatif = path.relative(root, fichier).split(path.sep).join('/');
      const doc = JSON.parse(fs.readFileSync(fichier, 'utf8'));
      const type = typeDuDocument(doc, fichier);
      const trouves = [];
      const visite = (v, chemin, heritee) => {
        if (Array.isArray(v)) {
          v.forEach((x, i) => visite(x, `${chemin}[${i}]`, heritee));
          return;
        }
        if (!v || typeof v !== 'object') return;
        const propre =
          v.source && typeof v.source === 'object' && typeof v.source.book === 'string' ? v.source.book : null;
        const effective = v.adapteDe !== undefined ? null : (propre ?? heritee);
        if (typeof v.desc === 'string' && v.desc.length > 0 && effective && extraits.has(effective)) {
          trouves.push(`${relatif} › ${chemin || '(racine)'}`);
        }
        for (const [k, x] of Object.entries(v)) {
          if (k !== 'source' && x && typeof x === 'object') visite(x, chemin ? `${chemin}.${k}` : k, effective);
        }
      };
      visite(doc, '', null);
      if (trouves.length) {
        const acc = parType.get(type) ?? { entrees: 0, noeuds: [] };
        acc.entrees += trouves.length;
        acc.noeuds.push(...trouves);
        parType.set(type, acc);
      }
    }
  }
  const out = {};
  for (const type of [...parType.keys()].sort()) {
    const { entrees, noeuds } = parType.get(type);
    out[type] = { entrees, noeuds: noeuds.sort() };
  }
  return out;
}
