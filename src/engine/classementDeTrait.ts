// TABLE DE CLASSEMENT d'un Trait imprimé (#1463) — module PUR, composé par la saisie (`parseStatEntry`,
// `parseTraitInstance`) et par les migrations de `scripts/migrations/` : une seule lecture du texte
// imprimé pour l'éditeur et pour la donnée. Une migration le charge par `node`, qui ne résout pas un
// chemin sans extension : ses imports portent la leur.

import { fr } from '../i18n/messages/fr.ts';
import { norm } from '../lib/normalize.ts';
import { tableTotale } from '../lib/tableTotale.ts';
import { LOCALISATIONS_DE_COUP, type HitLocation } from './localisations.ts';


/** Fourchette d'Indice imprimée, bornes incluses (`lirePlage`). */
export type Plage = { min: number; max: number };
/** Indice par Localisation : chaque Localisation, son nombre de PA (`lireParLocalisation`). */
export type ParLocalisation = Record<HitLocation, number>;
/** Emplacements d'une pièce d'armure nommée, ou `undefined` (`emplacementsDesPieces`). */
export type PiecesDArmure = (nom: string) => readonly HitLocation[] | undefined;
/** Ce que l'appelant sait d'une parenthèse : l'Indice imprimé hors d'elle, les pièces d'armure du Trait qui les lit. */
export type ContexteDeParenthese = { indice?: number; pieces?: PiecesDArmure };

const libelle = (loc: HitLocation): string => fr[`hitloc.${loc}`];

/** Les Emplacements d'armure. LDB 63 l.13 ; LDB 63 l.39-58. */
export const ZONES_D_ARMURE: readonly { label: string; locs: readonly HitLocation[] }[] = [
  { label: libelle('tete'), locs: ['tete'] },
  { label: 'Bras', locs: ['brasG', 'brasD'] },
  { label: libelle('corps'), locs: ['corps'] },
  { label: 'Jambes', locs: ['jambeG', 'jambeD'] },
];

/** Zones nommées par un profil hors de la table d'impact et des Emplacements. */
const AUTRES_ZONES: Readonly<Record<string, readonly HitLocation[]>> = {
  // LDB 76 l.17
  'pattes avant': ['brasG', 'brasD'],
  'membres anterieurs': ['brasG', 'brasD'],
  ailes: ['brasG', 'brasD'],
  'pattes arrieres': ['jambeG', 'jambeD'],
  'membres posterieurs': ['jambeG', 'jambeD'],
  // ACE 05 l.2043
  poitrine: ['corps'],
};

/** Zone nommée, repliée (`norm`) → Localisations : Emplacements, Localisations de la table, autres zones. */
const ZONES = new Map<string, readonly HitLocation[]>([
  ...ZONES_D_ARMURE.map((z): [string, readonly HitLocation[]] => [norm(z.label), z.locs]),
  ...LOCALISATIONS_DE_COUP.map((loc): [string, readonly HitLocation[]] => [norm(libelle(loc)), [loc]]),
  ...Object.entries(AUTRES_ZONES),
]);

/** LDB 63 l.55-56 ; MSR 09 l.1504. */
const PIECES_HORS_TABLE: Readonly<Record<string, readonly HitLocation[]>> = { casque: ['tete'] };

/** Localisations d'une zone nommée (« Tête », « Pattes avant »), ou `undefined`. */
export const localisationsDeZone = (mot: string): readonly HitLocation[] | undefined => ZONES.get(norm(mot).replace(/\s+/g, ' '));

const singulier = (mot: string): string => mot.replace(/s$/, '');

/** Nom de pièce comparable : replié, chaque mot sans sa marque du pluriel, « en » lu « de » (« veste en
 *  cuir », EDOC 11 l.169). */
const nomDePiece = (nom: string): string => norm(nom).split(/\s+/).map((m) => (m === 'en' ? 'de' : singulier(m))).join(' ');

/** Noms des Aspects des types 4, 6 et 8 de la raison `maison` de l'Armure (`traits.json`), au singulier.
 *  LDB 63 l.97-103 ; LDB 85 l.39. */
const ASPECTS_A_TOUTES_LOCALISATIONS = new Set(['legere', 'moyenne', 'peau', 'ecaille', 'fourrure', 'chitine', 'cuir', 'plate', 'divers'].map(singulier));

/** L'Aspect d'une Armure, sans Indice, est-il d'un des types 4, 6 ou 8 de sa raison `maison` : chacun de ses
 *  groupes (séparés par « , » ou « et ») a, avant son premier complément (« de », « d'un »), traits d'union
 *  compris, un de leurs noms (« Fourrures », « Peau de chitine », « Demi- plate », « Fausse Plate », « Cuirs
 *  et Plates »), sans nommer de zone ni de lieu (« sur ») ? */
export function aspectAToutesLocalisations(aspect: string): boolean {
  if (/\d/.test(aspect)) return false;
  const mots = norm(aspect).split(/[\s,]+/);
  if (mots.some((m, i) => m === 'sur' || localisationsDeZone(m) || localisationsDeZone(`${m} ${mots[i + 1] ?? ''}`))) return false;
  return nomDePiece(aspect).split(/\s*,\s*|\s+et\s+/).every((groupe) => {
    const mots = groupe.split(' ');
    const fin = mots.findIndex((m) => m === 'de' || /^d['’]/.test(m));
    return mots.slice(0, fin < 0 ? undefined : fin).flatMap((m) => m.split('-')).some((m) => ASPECTS_A_TOUTES_LOCALISATIONS.has(singulier(m)));
  });
}

/** Emplacements d'une pièce d'armure nommée, lus au catalogue des armures (`{ label, loc }`) : le nom de
 *  la pièce, ou son début quand le profil sous-entend la matière (« Calotte et Veste de cuir », EDO 03
 *  l.303). Un nom que le catalogue ne nomme pas, ou dont les pièces candidates divergent, rend
 *  `undefined`. LDB 63 l.13 ; LDB 63 l.39-58. */
export function emplacementsDesPieces(catalogue: readonly { label: string; loc?: string | null }[]): PiecesDArmure {
  const pieces = catalogue.flatMap((p) => (p.loc ? [{ nom: nomDePiece(p.label), locs: p.loc.split(',').flatMap((z) => localisationsDeZone(z) ?? []) }] : []));
  return (nom) => {
    const cle = nomDePiece(nom);
    if (cle in PIECES_HORS_TABLE) return PIECES_HORS_TABLE[cle];
    const exactes = pieces.filter((p) => p.nom === cle);
    const candidates = exactes.length ? exactes : pieces.filter((p) => [' de ', " d'", ' d’'].some((lien) => p.nom.startsWith(cle + lien)));
    const [premiere, ...autres] = candidates;
    if (!premiere || autres.some((p) => p.locs.join() !== premiere.locs.join())) return undefined;
    return premiere.locs;
  };
}

/** Texte d'un Indice par Localisation (« Tête 2, Bras 3, Corps 3, Jambes 3 »), sans les Localisations
 *  sans PA, relu par `lireParLocalisation`. */
export function formaterParLocalisation(p: ParLocalisation): string {
  const tout = LOCALISATIONS_DE_COUP.every((loc) => p[loc] === 0);
  return ZONES_D_ARMURE.flatMap(({ label, locs }): [string, number][] =>
    locs.every((loc) => p[loc] === p[locs[0]]) ? [[label, p[locs[0]]]] : locs.map((loc): [string, number] => [libelle(loc), p[loc]]),
  ).filter(([, n]) => tout || n !== 0).map(([nom, n]) => `${nom} ${n}`).join(', ');
}

/** Fourchette imprimée « N-M » (bornes incluses, « 1- 3 » compris), ou `undefined`. */
export function lirePlage(texte: string): Plage | undefined {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(texte.trim());
  if (!m) return undefined;
  const min = Number(m[1]);
  const max = Number(m[2]);
  return min < max ? { min, max } : undefined;
}

/** Indice par Localisation d'une parenthèse qui nomme des zones ou des pièces d'armure : chaque groupe
 *  prend l'Indice qui le suit (AA 09 l.184 ; MCLB 02 l.698), le dernier groupe sans Indice prend
 *  l'Indice imprimé hors de la parenthèse (PDT 09 l.536), et une Localisation que la parenthèse ne nomme
 *  pas n'a aucun PA. Un nom ni zone ni pièce, une Localisation qui reçoit deux Indices différents ou un
 *  groupe sans Indice rendent `undefined`. */
export function lireParLocalisation(texte: string, { indice, pieces }: ContexteDeParenthese = {}): ParLocalisation | undefined {
  const segments = texte.split(/\s*,\s*|\s+et\s+/).map((s) => s.trim()).filter(Boolean);
  if (!segments.length) return undefined;
  const out: Partial<ParLocalisation> = {};
  let enAttente: HitLocation[] = [];
  const poser = (n: number): boolean => {
    for (const loc of enAttente) {
      if (out[loc] !== undefined && out[loc] !== n) return false;
      out[loc] = n;
    }
    enAttente = [];
    return true;
  };
  for (const segment of segments) {
    const m = /^(.*?)(?:\s+(\d+))?$/.exec(segment);
    const zone = m && (localisationsDeZone(m[1]) ?? pieces?.(m[1]));
    if (!m || !zone) return undefined;
    enAttente.push(...zone);
    if (m[2] !== undefined && !poser(Number(m[2]))) return undefined;
  }
  if (enAttente.length && (indice === undefined || !poser(indice))) return undefined;
  return tableTotale(LOCALISATIONS_DE_COUP, (loc) => out[loc] ?? 0);
}

/** Aspect suivi de son Indice dans la même parenthèse (« Peau 1 », LDB 78 l.58), ou `undefined`. */
export function lireAspectIndice(texte: string): { aspect: string; indice: number } | undefined {
  const m = /^([^,\d]*[^,\d\s])\s+(\d+)$/.exec(texte.trim());
  return m ? { aspect: m[1], indice: Number(m[2]) } : undefined;
}

/** Classement du texte d'une parenthèse d'un Trait à Indice imprimé : fourchette, Indice par
 *  Localisation (quand l'appelant donne les `pieces` d'un Trait qui le lit), ou Aspect et Indice ;
 *  `undefined` si le texte n'est qu'un Aspect. Avec un Indice imprimé hors de la parenthèse (`indice`),
 *  seul l'Indice par Localisation s'y lit. */
export function classerParenthese(
  texte: string,
  contexte: ContexteDeParenthese = {},
): { plage: Plage } | { parLocalisation: ParLocalisation } | { aspect: string; indice: number } | undefined {
  const parLocalisation = contexte.pieces ? lireParLocalisation(texte, contexte) : undefined;
  if (contexte.indice !== undefined) return parLocalisation ? { parLocalisation } : undefined;
  const plage = lirePlage(texte);
  if (plage) return { plage };
  if (parLocalisation) return { parLocalisation };
  return lireAspectIndice(texte);
}
