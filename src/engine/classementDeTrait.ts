// TABLE DE CLASSEMENT d'un Trait imprimé (#1463) — module PUR, composé par la saisie (`parseStatEntry`,
// `parseTraitInstance`) et par les migrations de `scripts/migrations/` : une seule lecture du texte
// imprimé pour l'éditeur et pour la donnée. Une migration le charge par `node`, qui ne résout pas un
// chemin sans extension : ses imports portent la leur.

import { fr } from '../i18n/messages/fr.ts';
import { norm } from '../lib/normalize.ts';
import { tableTotale } from '../lib/tableTotale.ts';
import { LOCALISATIONS_DE_COUP, type HitLocation } from './localisations.ts';
import type { CharKey } from './types.ts';
import type { FormuleSansTirage } from './ops.ts';
import type { MatiereDArmure } from '../data/schemas/grammaire/valeurs.ts';


/** Fourchette d'Indice imprimée, bornes incluses (`lirePlage`). */
export type Plage = { min: number; max: number };
/** Indice par Localisation : chaque Localisation, son nombre de PA (`lireParLocalisation`). */
export type ParLocalisation = Record<HitLocation, number>;
/** Une pièce d'armure de la table : ses Emplacements, ses PA, la matière de son Groupe. LDB 63 l.41-58 */
export type PieceDArmure = { locs: readonly HitLocation[]; pa?: number; matiere?: MatiereDArmure };
/** La pièce d'armure nommée, ou `undefined` (`emplacementsDesPieces`). */
export type PiecesDArmure = (nom: string) => PieceDArmure | undefined;
/** La Caractéristique qu'abrège un sigle imprimé (« F », « FM »), ou `undefined`. */
export type CaracDuSigle = (sigle: string) => CharKey | undefined;
/** Ce que l'appelant sait d'une parenthèse : l'Indice imprimé hors d'elle, les pièces d'armure du Trait qui
 *  les lit, les sigles des Caractéristiques d'un Indice relatif. */
export type ContexteDeParenthese = { indice?: number; pieces?: PiecesDArmure; caracs?: CaracDuSigle };
/** Indice relatif : le Bonus d'une Caractéristique, plus ou moins un nombre (`lireIndiceRelatif`). */
export type IndiceRelatif = { bonusOf: CharKey } | { sum: [{ bonusOf: CharKey }, number] };

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

/** Pièce nommée hors de la table → la pièce de la table qu'elle désigne. LDB 63 l.55-56 ; MSR 09 l.1504. */
const PIECES_HORS_TABLE: Readonly<Record<string, string>> = { casque: 'heaume' };

/** Localisations d'une zone nommée (« Tête », « Pattes avant »), ou `undefined`. */
export const localisationsDeZone = (mot: string): readonly HitLocation[] | undefined => ZONES.get(norm(mot).replace(/\s+/g, ' '));

/** Localisations que couvre une pièce d'armure du catalogue, lues à son `loc` (« Bras, Corps ») ; vide sans `loc`. */
export const localisationsDeLoc = (loc: string | null | undefined): HitLocation[] => (loc ? loc.split(',').flatMap((zone) => localisationsDeZone(zone) ?? []) : []);

const singulier = (mot: string): string => mot.replace(/s$/, '');

/** Nom de pièce comparable : replié, chaque mot sans sa marque du pluriel, « en » lu « de » (« veste en
 *  cuir », EDOC 11 l.169). */
const nomDePiece = (nom: string): string => norm(nom).split(/\s+/).map((m) => (m === 'en' ? 'de' : singulier(m))).join(' ');

/** Noms des Aspects d'Armure à toutes les Localisations, au singulier, et la matière que chacun nomme.
 *  LDB 63 l.97-103 ; LDB 85 l.39 ; docs/raw/4e/combat.md « Parenthèse de l'Armure dans les profils » ; #1463. */
const ASPECTS_A_TOUTES_LOCALISATIONS: ReadonlyMap<string, MatiereDArmure | undefined> = new Map(([
  ['legere', 'leather'], ['moyenne', 'metal'], ['lourde', 'metal'], ['cuir', 'leather'], ['plate', 'metal'],
  ['peau', 'peau'], ['ecaille', 'peau'], ['fourrure', 'peau'], ['chitine', 'peau'], ['divers', undefined],
] as const).map(([nom, matiere]) => [singulier(nom), matiere]));

/** L'Aspect d'une Armure, sans Indice, vaut-il à toutes les Localisations : chacun de ses
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

/** La pièce d'armure nommée, lue au catalogue des armures (`{ label, loc, pa, subType }`) : le nom de la pièce,
 *  ou son début quand le profil sous-entend la matière (« Calotte et Veste de cuir », EDO 03 l.303). Sa matière
 *  est celle de son Groupe (`subType`), que `matiereDuGroupe` lit à chaque lecture. Un nom que le catalogue ne
 *  nomme pas, ou dont les pièces candidates divergent par leurs Emplacements, rend `undefined`. LDB 63 l.13 ;
 *  LDB 63 l.39-58. */
export function emplacementsDesPieces(
  catalogue: readonly { label: string; loc?: string | null; pa?: number | null; subType?: string | null }[],
  matiereDuGroupe: (groupe: string) => MatiereDArmure | undefined = () => undefined,
): PiecesDArmure {
  const pieces = catalogue.flatMap((p) => (p.loc ? [{ nom: nomDePiece(p.label), locs: localisationsDeLoc(p.loc), pa: p.pa ?? undefined, groupe: p.subType ?? undefined }] : []));
  return (nom) => {
    const cle = PIECES_HORS_TABLE[nomDePiece(nom)] ?? nomDePiece(nom);
    const exactes = pieces.filter((p) => p.nom === cle);
    const candidates = exactes.length ? exactes : pieces.filter((p) => [' de ', " d'", ' d’'].some((lien) => p.nom.startsWith(cle + lien)));
    const [premiere, ...autres] = candidates;
    if (!premiere || autres.some((p) => p.locs.join() !== premiere.locs.join())) return undefined;
    const matiere = premiere.groupe === undefined ? undefined : matiereDuGroupe(premiere.groupe);
    const memes = autres.every((p) => p.pa === premiere.pa && (p.groupe === undefined ? undefined : matiereDuGroupe(p.groupe)) === matiere);
    return { locs: premiere.locs, ...(memes && premiere.pa !== undefined ? { pa: premiere.pa } : {}), ...(memes && matiere ? { matiere } : {}) };
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
    const zone = m && (localisationsDeZone(m[1]) ?? pieces?.(m[1])?.locs);
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

/** Indice relatif imprimé (« BF +4 », Middenheim 04 l.29 ; « BF +3 », VDM 02 l.479) : « B » suivi du sigle
 *  d'une Caractéristique, puis un nombre signé facultatif ; `undefined` sinon. */
export function lireIndiceRelatif(texte: string, caracs: CaracDuSigle): IndiceRelatif | undefined {
  const m = /^B(\S+?)\s*(?:([+\-–−])\s*(\d+))?$/.exec(texte.trim());
  const k = m ? caracs(m[1]) : undefined;
  if (!m || !k) return undefined;
  if (m[3] === undefined) return { bonusOf: k };
  return { sum: [{ bonusOf: k }, (m[2] === '+' ? 1 : -1) * Number(m[3])] };
}

/** Texte d'un Indice relatif (« BF +4 »), relu par `lireIndiceRelatif` ; `undefined` pour une formule d'une
 *  autre forme. `sigle` = le sigle imprimé d'une Caractéristique. */
export function formaterIndiceRelatif(f: FormuleSansTirage, sigle: (k: CharKey) => string): string | undefined {
  if (typeof f !== 'object' || f === null) return undefined;
  if ('bonusOf' in f) return `B${sigle(f.bonusOf)}`;
  if (!('sum' in f) || f.sum.length !== 2) return undefined;
  const [b, n] = f.sum;
  if (typeof b !== 'object' || b === null || !('bonusOf' in b) || typeof n !== 'number') return undefined;
  return `B${sigle(b.bonusOf)} ${n < 0 ? '-' : '+'}${Math.abs(n)}`;
}

/** Matière d'un Aspect d'Armure : celle que nomme le premier mot de chacun de ses groupes (le dernier élément
 *  d'un mot composé, « Demi-plate »), la même pour tous, ou `undefined`. LDB 63 l.97 ; LDB 85 l.39 */
function matiereDeLAspect(aspect: string): MatiereDArmure | undefined {
  const matieres = nomDePiece(aspect).split(/\s*,\s*|\s+et\s+/).map((groupe) => ASPECTS_A_TOUTES_LOCALISATIONS.get(singulier(groupe.split(' ')[0].split('-').pop() ?? '')));
  return matieres.every((m) => m === matieres[0]) ? matieres[0] : undefined;
}

/** Matière d'une parenthèse d'Armure : celle des pièces de la table qu'elle nomme toutes (`pieces`), sinon celle
 *  de son Aspect (« Peau 1 », « Légère », « Cuir »). Des pièces de matières différentes valent `metal` quand, à
 *  chaque Localisation protégée, les PA des pièces de métal atteignent l'Indice imprimé, et `undefined` sinon ;
 *  une zone nommée sans pièce rend `undefined`. docs/raw/4e/combat.md « Parenthèse de l'Armure dans les
 *  profils » ; LDB 63 l.41-58 ; #1463 */
export function lireMatiere(texte: string, contexte: ContexteDeParenthese = {}): MatiereDArmure | undefined {
  const noms = texte.split(/\s*,\s*|\s+et\s+/).map((s) => /^(.*?)(?:\s+\d+)?$/.exec(s.trim())?.[1] ?? '').filter(Boolean);
  const pieces = noms.map((nom) => (localisationsDeZone(nom) ? undefined : contexte.pieces?.(nom)));
  if (!noms.length || !pieces.every((p): p is PieceDArmure => p !== undefined)) return matiereDeLAspect(lireAspectIndice(texte)?.aspect ?? texte);
  if (pieces.every((p) => p.matiere === pieces[0].matiere)) return pieces[0].matiere;
  const indices = lireParLocalisation(texte, contexte);
  const metal = (loc: HitLocation): number => pieces.filter((p) => p.matiere === 'metal' && p.locs.includes(loc)).reduce((n, p) => n + (p.pa ?? 0), 0);
  return indices && LOCALISATIONS_DE_COUP.every((loc) => metal(loc) >= indices[loc]) ? 'metal' : undefined;
}

/** Classement du texte d'une parenthèse d'un Trait à Indice imprimé : fourchette, Indice par
 *  Localisation (quand l'appelant donne les `pieces` d'un Trait qui le lit), Indice relatif (quand il donne
 *  les sigles des Caractéristiques, `caracs`), ou Aspect et Indice ; `undefined` si le texte n'est qu'un
 *  Aspect. Avec un Indice imprimé hors de la parenthèse (`indice`), seul l'Indice par Localisation s'y lit. */
export function classerParenthese(
  texte: string,
  contexte: ContexteDeParenthese = {},
): { plage: Plage } | { parLocalisation: ParLocalisation } | { formule: IndiceRelatif } | { aspect: string; indice: number } | undefined {
  const parLocalisation = contexte.pieces ? lireParLocalisation(texte, contexte) : undefined;
  if (contexte.indice !== undefined) return parLocalisation ? { parLocalisation } : undefined;
  const plage = lirePlage(texte);
  if (plage) return { plage };
  if (parLocalisation) return { parLocalisation };
  const formule = contexte.caracs ? lireIndiceRelatif(texte, contexte.caracs) : undefined;
  if (formule) return { formule };
  return lireAspectIndice(texte);
}
