/**
 * LE MANIFESTE D'UN ÉLÉMENT (#2972, schéma 3) : la pièce sémantique qu'un GLB dessine, et sa validation contre le
 * manifeste de la base pour laquelle il se construit (`manifesteDeBase.ts`). La catégorie fixe, par discriminant, la forme
 * de `cle` et de `liaison`, la présence de `couche`, `couvre`, `chaines`, `emplacements`, `silhouettes` et `postes`, et si
 * l'élément a une base (`REGLES_DES_CATEGORIES`) : sans base (décor, véhicule, Amélioration, #2987), il ne nomme aucune base et ses
 * meshes restent à la racine de sa scène ou sous ses propres nœuds ; une clé bien formée se résout contre la donnée
 * du jeu (`ecartsDeCleDElement`, surface du noyau). Ses surfaces (`surfaces.ts`) admettent le blason.
 * Un vêtement, une armure ou un accessoire offre des `emplacements`, ids de la garde-robe (`estEmplacement`, #3116), ou
 * `<emplacement>#<rang>`, la case du rang-ième objet rangé à cet emplacement (`rangDeCase`, #3844) ; un accessoire
 * dont l'emplacement n'est offert ni par sa base ni par une pièce de cette base est rapporté, ni refusé ni servi
 * (`emplacementsNonOfferts`, `indexerModeles`). Un véhicule offre des `postes` : par bord (`FIRE_ARCS`), les positions de
 * sa scène où se montent les pièces des postes de ce bord ; et des `ancrages` : par Amélioration navale, les positions où
 * se monte sa pièce. Une pièce d'Amélioration (`amelioration`) dit son `montage` : à ses ancrages, ou à chaque poste que
 * son Amélioration offre, où elle montre son nœud `ouvert` si une pièce y est montée, `ferme` sinon (#2987). Un véhicule
 * ou une pièce d'Amélioration dit, `selon` une Amélioration montée, ce qui change : ses nœuds `avec-<amelioration>`
 * (`noeudSelon`), montrés seulement quand elle est montée, `sans-<amelioration>` seulement quand elle ne l'est pas, et,
 * pour un véhicule, les postes qu'elle offre, qui remplacent ceux de chaque bord qu'elle nomme (MDG 12 l.362, Sabord). Un
 * véhicule s'anime de ses `clips` : par rôle d'animation, le clip du GLB qu'il joue, comme une base ; il dit l'emprise
 * libre des `cases` de ses ponts que son modèle rogne (`EmprisesDesCases`, #3767).
 */
import { estObjet } from '../../../src/lib/objet.mjs';
import {
  ecartsDeCleDElement,
  emplacementDePiece,
  estEmplacement,
  FIRE_ARCS,
  matieresDeDecor,
  type CodeDEcartDeCle,
  type EmprisesDesCases,
  type FireArc,
} from '../../../src/noyau/index.ts';
import { ecartsAuGlb, ecartsAuxMatieres, lireSurfaces, type CodeDEcartDeSurface, type Surface } from './surfaces.ts';
import { estListeDeChaines, estRepere, estTriplet, rangDeCase, TOLERANCE_DES_POIDS, type EmplacementOffert, type Repere } from './attache.ts';
import { EMPREINTE, sha256 } from './empreinte.ts';
import type { ContenuGlb } from './glb.ts';
import type { ManifesteDeBase } from './manifesteDeBase.ts';
import type { TableDeClips } from './clips.ts';

const VERSION_DU_SCHEMA_D_ELEMENT = 3;

/** Les couches, de la plus intérieure à la plus extérieure. */
export const COUCHES = ['peau', 'dessous', 'tenue', 'armure', 'manteau'] as const;
export type Couche = (typeof COUCHES)[number];
/** Le rang du corps, sous la couche la plus intérieure de `COUCHES`. */
export const RANG_DU_CORPS = -1;

export const LIAISONS = ['squelette', 'surface', 'rigide'] as const;
export type ModeDeLiaison = (typeof LIAISONS)[number];

type Presence = 'requis' | 'optionnel' | 'interdit';

interface RegleDeCategorie {
  /** Les champs de `cle`, tous des ids. */
  readonly cle: readonly string[];
  readonly liaisons: readonly ModeDeLiaison[];
  /** Les couches admises ; `null` : l'élément n'a pas de couche. */
  readonly couches: readonly Couche[] | null;
  readonly couvre: Presence;
  readonly chaines: boolean;
  readonly emplacements: boolean;
  readonly silhouettes: boolean;
  /** L'élément offre des postes : par bord, les positions de sa scène, en mètres, où se montent les pièces des postes de ce
   *  bord, chacune tournée vers lui. */
  readonly postes: boolean;
  /** L'élément offre des ancrages : par Amélioration navale, les positions de sa scène, en mètres, où se monte sa pièce. */
  readonly ancrages: boolean;
  /** L'élément dit où il se monte sur un véhicule (`MONTAGES`). */
  readonly montage: boolean;
  /** L'élément dit ce qui change selon une Amélioration navale montée (`selon`) : les nœuds qu'elle montre ou cache, et, s'il
   *  offre des postes, ceux qu'elle offre. */
  readonly selon: boolean;
  /** L'élément se construit pour une base : son manifeste la nomme, il se valide contre elle et ses meshes rigides pendent
   *  à ses os. Sans base (décor, véhicule, #2987), ses meshes restent à la racine de sa scène ou sous ses propres nœuds. */
  readonly base: boolean;
  /** L'élément tenu peut déclarer, dans le repère de sa prise, celle de la main libre (`liaison.secondePrise`, #3319). */
  readonly secondePrise: boolean;
  /** L'élément s'anime : par rôle d'animation, le nom de son clip dans le GLB (`TableDeClips`, jugée par `ecartsDeClips`
   *  dans le graphe de l'hôte). */
  readonly clips: boolean;
  /** L'élément dit l'emprise libre des cases des ponts que son modèle rogne (`EmprisesDesCases`). */
  readonly cases: boolean;
}

const SKINNE = { liaisons: ['squelette'], couches: COUCHES, couvre: 'requis', chaines: true, emplacements: false, silhouettes: true, postes: false, ancrages: false, montage: false, selon: false, base: true, secondePrise: false, clips: false, cases: false } as const;
const RIGIDE = { liaisons: ['rigide'], couches: null, couvre: 'interdit', chaines: false, emplacements: false, silhouettes: false, postes: false, ancrages: false, montage: false, selon: false, base: true, secondePrise: false, clips: false, cases: false } as const;

/** Les règles de chaque catégorie, seule source du type `ManifesteDElement` et de `validerElement`. */
export const REGLES_DES_CATEGORIES = {
  corps: { ...SKINNE, cle: ['partie', 'forme'] },
  tete: { ...SKINNE, cle: ['tete'] },
  pilosite: { ...SKINNE, cle: ['coiffure'] },
  vetement: { ...SKINNE, cle: ['piece'], emplacements: true },
  armure: { ...SKINNE, cle: ['piece'], couches: ['armure'], emplacements: true },
  accessoire: { ...SKINNE, cle: ['piece'], liaisons: ['rigide', 'surface'], couvre: 'optionnel', emplacements: true },
  rigide: { ...RIGIDE, cle: ['apparence'], secondePrise: true },
  trait: { ...SKINNE, cle: ['trait'] },
  decor: { ...RIGIDE, cle: ['prop'], base: false },
  vehicule: { ...RIGIDE, cle: ['definition'], postes: true, ancrages: true, selon: true, base: false, clips: true, cases: true },
  amelioration: { ...RIGIDE, cle: ['amelioration'], montage: true, selon: true, base: false },
} as const satisfies Record<string, RegleDeCategorie>;

type Regles = typeof REGLES_DES_CATEGORIES;
export type CategorieDElement = keyof Regles;
export const CATEGORIES_D_ELEMENT = Object.keys(REGLES_DES_CATEGORIES) as readonly CategorieDElement[];

/** Où se monte une pièce d'Amélioration : aux `ancrages` de son Amélioration, ou à chaque `postes` du véhicule. */
export const MONTAGES = ['ancrages', 'postes'] as const;
export type Montage = (typeof MONTAGES)[number];

/** Les nœuds à mesh d'une pièce montée aux postes : celui qu'elle montre devant une pièce montée, et sans. */
export const ETATS_AU_POSTE = { arme: 'ouvert', vide: 'ferme' } as const;

/** Les nœuds d'un élément qui changent selon une Amélioration : montrés seulement `avec` elle montée, ou `sans`. */
const GENRES_SELON = ['avec', 'sans'] as const;
type GenreSelon = (typeof GENRES_SELON)[number];
/** Le nom du nœud de genre `genre` selon l'Amélioration `amelioration`. */
export const noeudSelon = (genre: GenreSelon, amelioration: string): string => `${genre}-${amelioration}`;
const NOEUD_SELON = new RegExp(`^(${GENRES_SELON.join('|')})-(.+)$`);

type Rien = Record<never, never>;
type Liste = readonly string[];
type Triplet = readonly [number, number, number];
type Postes = Readonly<Partial<Record<FireArc, readonly Triplet[]>>>;

type Selon<P, Requis, Optionnel> = P extends 'requis' ? Requis : P extends 'optionnel' ? Optionnel : Rien;

type ChampsDe<C extends CategorieDElement> = (Regles[C]['base'] extends true ? { readonly base: string } : Rien)
  & (Regles[C]['couches'] extends readonly Couche[] ? { readonly couche: Regles[C]['couches'][number] } : Rien)
  & Selon<Regles[C]['couvre'], { readonly couvre: Liste }, { readonly couvre?: Liste }>
  & (Regles[C]['chaines'] extends true ? { readonly chaines?: Liste } : Rien)
  & (Regles[C]['emplacements'] extends true ? { readonly emplacements?: Readonly<Record<string, EmplacementOffert>> } : Rien)
  & (Regles[C]['silhouettes'] extends true ? { readonly silhouettes?: Liste } : Rien)
  & (Regles[C]['postes'] extends true ? { readonly postes?: Postes } : Rien)
  & (Regles[C]['ancrages'] extends true ? { readonly ancrages?: Readonly<Record<string, readonly Triplet[]>> } : Rien)
  & (Regles[C]['montage'] extends true ? { readonly montage: Montage } : Rien)
  & (Regles[C]['clips'] extends true ? { readonly clips?: TableDeClips } : Rien)
  & (Regles[C]['cases'] extends true ? { readonly cases?: EmprisesDesCases } : Rien)
  & (Regles[C]['selon'] extends true ? { readonly selon?: Readonly<Record<string, Regles[C]['postes'] extends true ? { readonly postes?: Postes } : Rien>> } : Rien);

export type ManifesteDElement = {
  [C in CategorieDElement]: {
    readonly schema: typeof VERSION_DU_SCHEMA_D_ELEMENT;
    readonly categorie: C;
    readonly cle: { readonly [K in Regles[C]['cle'][number]]: string };
    readonly liaison: { readonly mode: Regles[C]['liaisons'][number] } & (Regles[C]['secondePrise'] extends true ? { readonly secondePrise?: Repere } : Rien);
    readonly surfaces: readonly Surface[];
    readonly glb: { readonly sha256: string; readonly octets: number };
  } & ChampsDe<C>;
}[CategorieDElement];

/** La surface de base lue par la validation d'un élément. */
export type BaseDUnElement = Pick<ManifesteDeBase, 'base' | 'os' | 'chaines' | 'zones' | 'silhouettes' | 'prises'>;

export type CodeDEcartDElement =
  | 'forme'
  | 'version-inconnue'
  | 'categorie-inconnue'
  | 'champ-hors-categorie'
  | 'cle-mal-formee'
  | CodeDEcartDeCle
  | 'base-differente'
  | 'liaison-hors-categorie'
  | 'couche-hors-categorie'
  | 'zone-inconnue'
  | 'chaine-absente'
  | 'emplacement-sur-os-absent'
  | 'emplacement-inconnu'
  | 'silhouette-absente'
  | 'bord-inconnu'
  | 'etat-absent'
  | 'selon-absent'
  | CodeDEcartDeSurface
  | 'glb-different'
  | 'rigide-sans-mesh'
  | 'rigide-sur-os-absent'
  | 'rigide-a-la-racine'
  | 'rigide-skinne'
  | 'seconde-prise-sans-prise';

export interface EcartDElement {
  readonly code: CodeDEcartDElement;
  readonly ou: string;
  readonly detail: string;
}

export type VerdictDElement = { readonly ok: true; readonly manifeste: ManifesteDElement } | { readonly ok: false; readonly ecarts: readonly EcartDElement[] };

const CHAMPS_COMMUNS = ['schema', 'categorie', 'cle', 'liaison', 'surfaces', 'glb'] as const;
const estCategorie = (v: unknown): v is CategorieDElement => typeof v === 'string' && Object.prototype.hasOwnProperty.call(REGLES_DES_CATEGORIES, v);
/** Le manifeste `brut` est d'une catégorie qui ne se construit pour aucune base (`RegleDeCategorie.base`). */
export const estSansBase = (brut: unknown): boolean => estObjet(brut) && estCategorie(brut.categorie) && !REGLES_DES_CATEGORIES[brut.categorie].base;
const liste = (l: readonly string[]) => l.map((e) => `\`${e}\``).join(', ');

/** Le manifeste `brut` réduit au schéma 3 et validé contre la base qu'il nomme, `null` pour une catégorie sans base, et le
 *  GLB `octets`, lu en `glb` (`lireGlb`). */
export function validerElement(brut: unknown, base: BaseDUnElement | null, octets: Uint8Array, glb: ContenuGlb): VerdictDElement {
  const ecarts: EcartDElement[] = [];
  const refus = (code: CodeDEcartDElement, ou: string, detail: string) => ecarts.push({ code, ou, detail });
  if (!estObjet(brut)) return { ok: false, ecarts: [{ code: 'forme', ou: '', detail: 'le manifeste n’est pas un objet' }] };
  if (brut.schema !== VERSION_DU_SCHEMA_D_ELEMENT) refus('version-inconnue', 'schema', `${String(brut.schema)}, ${VERSION_DU_SCHEMA_D_ELEMENT} attendue`);
  if (!estCategorie(brut.categorie)) {
    refus('categorie-inconnue', 'categorie', `${String(brut.categorie)} : ${liste(CATEGORIES_D_ELEMENT)} attendue`);
    return { ok: false, ecarts };
  }
  const categorie = brut.categorie;
  const regle: RegleDeCategorie = REGLES_DES_CATEGORIES[categorie];
  const optionnels = [
    ...(regle.base ? ['base'] : []), ...(regle.couches ? ['couche'] : []), ...(regle.couvre === 'interdit' ? [] : ['couvre']),
    ...(regle.chaines ? ['chaines'] : []), ...(regle.emplacements ? ['emplacements'] : []), ...(regle.silhouettes ? ['silhouettes'] : []),
    ...(regle.postes ? ['postes'] : []), ...(regle.ancrages ? ['ancrages'] : []), ...(regle.montage ? ['montage'] : []),
    ...(regle.selon ? ['selon'] : []), ...(regle.clips ? ['clips'] : []), ...(regle.cases ? ['cases'] : []),
  ];
  const admis = new Set<string>([...CHAMPS_COMMUNS, ...optionnels]);
  for (const champ of Object.keys(brut)) if (!admis.has(champ)) refus('champ-hors-categorie', champ, `un élément \`${categorie}\` ne porte pas \`${champ}\``);
  const requis = [...CHAMPS_COMMUNS, ...(regle.base ? ['base'] : []), ...(regle.couches ? ['couche'] : []), ...(regle.couvre === 'requis' ? ['couvre'] : []), ...(regle.montage ? ['montage'] : [])];
  for (const champ of requis) if (brut[champ] === undefined) refus('forme', champ, `champ requis pour un élément \`${categorie}\``);

  const nomDeBase = base?.base ?? 'aucune';
  const osDeBase = base?.os ?? [];
  if (regle.base && brut.base !== undefined) {
    if (typeof brut.base !== 'string') refus('forme', 'base', 'chaîne attendue');
    else if (brut.base !== base?.base) refus('base-differente', 'base', `${brut.base}, construit pour une autre base que \`${nomDeBase}\``);
  }

  const cle = brut.cle;
  if (cle !== undefined) {
    const bienFormee = estObjet(cle) && Object.keys(cle).length === regle.cle.length && regle.cle.every((c) => typeof cle[c] === 'string' && cle[c] !== '');
    if (!bienFormee) refus('cle-mal-formee', 'cle', `${JSON.stringify(cle)} : ${liste(regle.cle)}, ids non vides et seuls, attendus pour un élément \`${categorie}\``);
    else for (const e of ecartsDeCleDElement(categorie, cle as Record<string, string>)) refus(e.code, `cle.${e.champ}`, e.detail);
  }

  if (brut.liaison !== undefined) {
    const champs = regle.secondePrise ? ['mode', 'secondePrise'] : ['mode'];
    const mode = estObjet(brut.liaison) && Object.keys(brut.liaison).every((c) => champs.includes(c)) ? brut.liaison.mode : undefined;
    if (typeof mode !== 'string') refus('forme', 'liaison', regle.secondePrise ? '`{ mode, secondePrise? }` attendu' : '`{ mode }` seul attendu');
    else if (!regle.liaisons.includes(mode as ModeDeLiaison)) refus('liaison-hors-categorie', 'liaison.mode', `${mode} : ${liste(regle.liaisons)} attendue pour un élément \`${categorie}\``);
    else if (mode === 'rigide') {
      if (glb.meshes.every((m) => m.skinne)) refus('rigide-sans-mesh', 'liaison.mode', 'le GLB ne porte aucun mesh rigide');
      for (const { nom: mesh, skinne, articulation, os } of glb.meshes) {
        if (skinne) refus('rigide-skinne', 'liaison.mode', `${mesh} porte un skin : un élément en liaison \`rigide\` ne monte que des meshes sans skin`);
        else if (articulation === null) { if (regle.base) refus('rigide-a-la-racine', 'liaison.mode', `${mesh} ne pend directement à aucune articulation d’un skin : un élément \`${categorie}\` ne reste pas à la racine de la scène`); }
        else if (!regle.base) refus('rigide-sur-os-absent', 'liaison.mode', `${mesh} pend à ${os ?? `l’articulation sans nom noeud ${articulation}`}, mais un élément \`${categorie}\` n’a pas de base dont il serait un os`);
        else if (os === null || !osDeBase.includes(os)) refus('rigide-sur-os-absent', 'liaison.mode', `${mesh} pend à ${os ?? `l’articulation sans nom noeud ${articulation}`}, qui n’est pas un os de la base \`${nomDeBase}\``);
      }
      const seconde = (brut.liaison as Record<string, unknown>).secondePrise;
      const osDesPrises = base?.prises ? [base.prises.main.os, base.prises.secondaire.os] : [];
      if (seconde !== undefined && !estRepere(seconde)) refus('forme', 'liaison.secondePrise', '`position` et `rotation` triplets de nombres, seuls, attendus');
      else if (seconde !== undefined && !glb.meshes.some((m) => m.os !== null && osDesPrises.includes(m.os))) refus('seconde-prise-sans-prise', 'liaison.secondePrise', `aucun mesh ne pend à l’os d’une prise de la base \`${nomDeBase}\` (${liste(osDesPrises)}) : la seconde prise n’a pas de première`);
    }
  }

  if (regle.couches && brut.couche !== undefined) {
    if (!regle.couches.includes(brut.couche as Couche)) refus('couche-hors-categorie', 'couche', `${String(brut.couche)} : ${liste(regle.couches)} attendue pour un élément \`${categorie}\``);
  }

  const sousEnsemble = (champ: string, connus: readonly string[], code: CodeDEcartDElement, quoi: string) => {
    const v = brut[champ];
    if (v === undefined || !admis.has(champ)) return;
    if (!estListeDeChaines(v) || new Set(v).size !== v.length) return refus('forme', champ, 'liste de chaînes sans doublon attendue');
    v.forEach((e, i) => { if (!connus.includes(e)) refus(code, `${champ}.${i}`, `${e} n’est pas ${quoi} de la base \`${nomDeBase}\``); });
  };
  sousEnsemble('couvre', base?.zones ?? [], 'zone-inconnue', 'une zone');
  sousEnsemble('chaines', Object.keys(base?.chaines ?? {}), 'chaine-absente', 'une chaîne');
  sousEnsemble('silhouettes', base?.silhouettes ?? [], 'silhouette-absente', 'une shape key');

  if (regle.emplacements && brut.emplacements !== undefined) {
    if (!estObjet(brut.emplacements)) refus('forme', 'emplacements', 'objet attendu');
    else for (const [id, e] of Object.entries(brut.emplacements)) {
      if (!(estObjet(e) && typeof e.os === 'string' && estRepere({ position: e.position, rotation: e.rotation }) && Object.keys(e).length === (e.poids === undefined ? 3 : 4))) refus('forme', `emplacements.${id}`, '`os` chaîne, `position` et `rotation` triplets de nombres, `poids` facultatif, attendus');
      else if (!osDeBase.includes(e.os)) refus('emplacement-sur-os-absent', `emplacements.${id}.os`, `${e.os} n’est pas un os de la base \`${nomDeBase}\``);
      else if (e.poids !== undefined) {
        const poids = estObjet(e.poids) ? Object.entries(e.poids) : [];
        const absent = poids.find(([os]) => !osDeBase.includes(os));
        if (absent) refus('emplacement-sur-os-absent', `emplacements.${id}.poids.${absent[0]}`, `${absent[0]} n’est pas un os de la base \`${nomDeBase}\``);
        else if (!(poids.length > 0 && poids.every(([, w]) => typeof w === 'number' && w > 0)
          && Math.abs(poids.reduce((somme, [, w]) => somme + (w as number), 0) - 1) <= TOLERANCE_DES_POIDS && poids.some(([os]) => os === e.os)))
          refus('forme', `emplacements.${id}.poids`, `par os de la base, un poids positif, de somme 1, dont \`${e.os}\`, attendu`);
      }
      const [emplacement, rang] = id.split('#');
      if (!estEmplacement(emplacement)) refus('emplacement-inconnu', `emplacements.${id}`, `${emplacement} n’est aucun emplacement de \`garde-robe.json\``);
      else if (rang !== undefined && rangDeCase(id) === undefined) refus('forme', `emplacements.${id}`, `\`${emplacement}#<rang>\`, rang entier d’au moins 2, attendu`);
    }
  }

  const validerPostes = (ou: string, postes: unknown) => {
    if (!estObjet(postes)) return refus('forme', ou, 'objet attendu');
    for (const [bord, positions] of Object.entries(postes)) {
      if (!(FIRE_ARCS as readonly string[]).includes(bord)) refus('bord-inconnu', `${ou}.${bord}`, `${bord} : ${liste(FIRE_ARCS)} attendu`);
      else if (!(Array.isArray(positions) && positions.every(estTriplet))) refus('forme', `${ou}.${bord}`, 'liste de triplets de nombres attendue');
    }
  };
  if (regle.postes && brut.postes !== undefined) validerPostes('postes', brut.postes);

  if (regle.selon) {
    const selon = brut.selon ?? {};
    if (!estObjet(selon)) refus('forme', 'selon', 'objet attendu');
    else for (const [amelioration, effets] of Object.entries(selon)) {
      for (const e of ecartsDeCleDElement('amelioration', { amelioration })) refus(e.code, `selon.${amelioration}`, e.detail);
      if (!estObjet(effets) || Object.keys(effets).some((champ) => !(regle.postes && champ === 'postes'))) refus('forme', `selon.${amelioration}`, regle.postes ? '`{ postes? }` attendu' : '`{}` attendu');
      else if (effets.postes !== undefined) validerPostes(`selon.${amelioration}.postes`, effets.postes);
    }
    for (const { nom } of glb.meshes) {
      const amelioration = NOEUD_SELON.exec(nom)?.[2];
      if (amelioration !== undefined && !(estObjet(selon) && Object.prototype.hasOwnProperty.call(selon, amelioration))) refus('selon-absent', 'selon', `${nom} change selon \`${amelioration}\`, que \`selon\` ne nomme pas`);
    }
  }

  if (regle.ancrages && brut.ancrages !== undefined) {
    if (!estObjet(brut.ancrages)) refus('forme', 'ancrages', 'objet attendu');
    else for (const [amelioration, positions] of Object.entries(brut.ancrages)) {
      for (const e of ecartsDeCleDElement('amelioration', { amelioration })) refus(e.code, `ancrages.${amelioration}`, e.detail);
      if (!(Array.isArray(positions) && positions.every(estTriplet))) refus('forme', `ancrages.${amelioration}`, 'liste de triplets de nombres attendue');
    }
  }

  if (regle.cases && brut.cases !== undefined) {
    if (!estObjet(brut.cases)) refus('forme', 'cases', 'objet attendu');
    else for (const [cle, emprise] of Object.entries(brut.cases)) {
      const [x, y] = cle.split(',').map(Number);
      const bornee = /^\d+,\d+,\d+$/.test(cle) && Array.isArray(emprise) && emprise.length === 4 && emprise.every((v) => typeof v === 'number' && Number.isFinite(v))
        && x <= emprise[0] && emprise[0] <= emprise[2] && emprise[2] <= x + 1 && y <= emprise[1] && emprise[1] <= emprise[3] && emprise[3] <= y + 1;
      if (!bornee) refus('forme', `cases.${cle}`, 'clé `x,y,z` et emprise [x0, y0, x1, y1] dans sa case attendues');
    }
  }

  if (regle.clips && brut.clips !== undefined) {
    if (!estObjet(brut.clips) || !Object.values(brut.clips).every((nom) => typeof nom === 'string' && nom !== '')) refus('forme', 'clips', 'objet rôle → nom de clip non vide attendu');
  }

  if (regle.montage && brut.montage !== undefined) {
    if (!(MONTAGES as readonly unknown[]).includes(brut.montage)) refus('forme', 'montage', `${String(brut.montage)} : ${liste(MONTAGES)} attendu`);
    else if (brut.montage === 'postes') {
      const absents = Object.values(ETATS_AU_POSTE).filter((etat) => !glb.meshes.some((m) => m.nom === etat));
      if (absents.length) refus('etat-absent', 'montage', `une pièce montée aux postes porte un nœud à mesh par état, ${liste(Object.values(ETATS_AU_POSTE))} : ${liste(absents)} absent du GLB`);
    }
  }

  if (brut.surfaces !== undefined) {
    const { surfaces, ecarts: deForme } = lireSurfaces(brut.surfaces, 'element');
    for (const e of [...deForme, ...ecartsAuxMatieres(surfaces, matieresDeDecor()), ...ecartsAuGlb(surfaces, glb)]) refus(e.code, e.ou, e.detail);
  }

  if (brut.glb !== undefined) {
    const g = brut.glb;
    if (!(estObjet(g) && typeof g.sha256 === 'string' && EMPREINTE.test(g.sha256) && Number.isInteger(g.octets) && (g.octets as number) > 0 && Object.keys(g).length === 2)) {
      refus('forme', 'glb', '`sha256` hexadécimal de 64 caractères et `octets` entier positif attendus');
    } else {
      const somme = sha256(octets);
      if (g.sha256 !== somme || g.octets !== octets.byteLength) refus('glb-different', 'glb', `GLB de ${octets.byteLength} octets, SHA-256 ${somme} ; déclaré ${g.octets} octets, ${g.sha256}`);
    }
  }

  return ecarts.length ? { ok: false, ecarts } : { ok: true, manifeste: brut as unknown as ManifesteDElement };
}

/** Par id, la ligne de rapport `[emplacement-non-offert]` des éléments `accessoire` de `elements` dont l'emplacement (celui de leur pièce,
 *  `emplacementDePiece`) n'est offert ni par les `emplacements` de leur base dans `bases` ni par ceux d'un élément de
 *  la même base dont la catégorie offre des emplacements. */
export function emplacementsNonOfferts(bases: ReadonlyMap<string, unknown>, elements: readonly { readonly id: string; readonly brut: unknown }[]): { readonly id: string; readonly ligne: string }[] {
  const offerts = new Map<string, Set<string>>();
  const offrir = (base: unknown, emplacements: unknown) => {
    if (typeof base !== 'string' || !estObjet(emplacements)) return;
    offerts.set(base, new Set([...(offerts.get(base) ?? []), ...Object.keys(emplacements)]));
  };
  for (const [base, brut] of bases) if (estObjet(brut)) offrir(base, brut.emplacements);
  for (const { brut } of elements) if (estObjet(brut) && estCategorie(brut.categorie) && REGLES_DES_CATEGORIES[brut.categorie].emplacements) offrir(brut.base, brut.emplacements);
  return elements.flatMap(({ id, brut }) => {
    if (!estObjet(brut) || brut.categorie !== 'accessoire' || !estObjet(brut.cle) || typeof brut.cle.piece !== 'string') return [];
    const emplacement = emplacementDePiece(brut.cle.piece);
    if (emplacement === undefined || offerts.get(String(brut.base))?.has(emplacement)) return [];
    return [{ id, ligne: `[emplacement-non-offert] ${id} : ${brut.cle.piece} se pose sur ${emplacement}, que ni la base \`${String(brut.base)}\` ni aucune de ses pièces n’offre` }];
  });
}
