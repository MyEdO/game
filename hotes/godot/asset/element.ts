/**
 * LE MANIFESTE D'UN ÉLÉMENT (#2972, schéma 3) : la pièce sémantique qu'un GLB dessine pour une base, et sa validation
 * contre le manifeste de cette base (`manifesteDeBase.ts`). La catégorie fixe, par discriminant, la forme de
 * `cle` et de `liaison`, la présence de `couche`, `couvre`, `chaines`, `emplacements` et `silhouettes`, et le choix
 * palette ou teinte des surfaces (`REGLES_DES_CATEGORIES`).
 */
import { estObjet } from '../../../src/hote/formes';
import { SLOTS } from '../../../src/noyau/index.ts';
import { estListeDeChaines, estTriplet, type Attache } from './attache.ts';
import { sha256 } from './empreinte.ts';
import type { ManifesteDeBase } from './manifesteDeBase.ts';

export const VERSION_DU_SCHEMA_D_ELEMENT = 3;

/** Les couches, de la plus intérieure à la plus extérieure. */
export const COUCHES = ['peau', 'dessous', 'tenue', 'armure', 'manteau'] as const;
export type Couche = (typeof COUCHES)[number];

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
  readonly couleur: 'palette' | 'teinte';
}

const SKINNE = { liaisons: ['squelette'], couches: COUCHES, couvre: 'requis', chaines: true, emplacements: false, silhouettes: true } as const;
const RIGIDE = { liaisons: ['rigide'], couches: null, couvre: 'interdit', chaines: false, emplacements: false, silhouettes: false, couleur: 'teinte' } as const;

/** Les règles de chaque catégorie, seule source du type `ManifesteDElement` et de `validerElement`. */
export const REGLES_DES_CATEGORIES = {
  corps: { ...SKINNE, cle: ['partie', 'forme'], couleur: 'palette' },
  tete: { ...SKINNE, cle: ['tete'], couleur: 'palette' },
  pilosite: { ...SKINNE, cle: ['coiffure'], couleur: 'palette' },
  vetement: { ...SKINNE, cle: ['piece'], emplacements: true, couleur: 'palette' },
  armure: { ...SKINNE, cle: ['piece'], couches: ['armure'], couleur: 'teinte' },
  accessoire: { ...SKINNE, cle: ['piece'], liaisons: ['rigide', 'surface'], couvre: 'optionnel', couleur: 'teinte' },
  rigide: { ...RIGIDE, cle: ['apparence'] },
  trait: { ...SKINNE, cle: ['trait'], couleur: 'palette' },
  decor: { ...RIGIDE, cle: ['prop'] },
  vehicule: { ...RIGIDE, cle: ['definition'] },
} as const satisfies Record<string, RegleDeCategorie>;

type Regles = typeof REGLES_DES_CATEGORIES;
export type CategorieDElement = keyof Regles;
export const CATEGORIES_D_ELEMENT = Object.keys(REGLES_DES_CATEGORIES) as readonly CategorieDElement[];

type Slot = (typeof SLOTS)[number];
type Rien = Record<never, never>;
type Liste = readonly string[];

type Selon<P, Requis, Optionnel> = P extends 'requis' ? Requis : P extends 'optionnel' ? Optionnel : Rien;
type SurfaceDe<C extends CategorieDElement> = Regles[C]['couleur'] extends 'palette'
  ? { readonly nom: string; readonly palette: Slot }
  : { readonly nom: string; readonly teinte: true };

type ChampsDe<C extends CategorieDElement> = (Regles[C]['couches'] extends readonly Couche[] ? { readonly couche: Regles[C]['couches'][number] } : Rien)
  & Selon<Regles[C]['couvre'], { readonly couvre: Liste }, { readonly couvre?: Liste }>
  & (Regles[C]['chaines'] extends true ? { readonly chaines?: Liste } : Rien)
  & (Regles[C]['emplacements'] extends true ? { readonly emplacements?: Readonly<Record<string, Attache>> } : Rien)
  & (Regles[C]['silhouettes'] extends true ? { readonly silhouettes?: Liste } : Rien);

export type ManifesteDElement = {
  [C in CategorieDElement]: {
    readonly schema: typeof VERSION_DU_SCHEMA_D_ELEMENT;
    readonly base: string;
    readonly categorie: C;
    readonly cle: { readonly [K in Regles[C]['cle'][number]]: string };
    readonly liaison: { readonly mode: Regles[C]['liaisons'][number] };
    readonly surfaces: readonly SurfaceDe<C>[];
    readonly glb: { readonly sha256: string; readonly octets: number };
  } & ChampsDe<C>;
}[CategorieDElement];

/** La surface de base lue par la validation d'un élément. */
export type BaseDUnElement = Pick<ManifesteDeBase, 'base' | 'os' | 'chaines' | 'zones' | 'silhouettes'>;

export type CodeDEcartDElement =
  | 'forme'
  | 'version-inconnue'
  | 'categorie-inconnue'
  | 'champ-hors-categorie'
  | 'cle-mal-formee'
  | 'base-differente'
  | 'liaison-hors-categorie'
  | 'couche-hors-categorie'
  | 'zone-inconnue'
  | 'chaine-absente'
  | 'emplacement-sur-os-absent'
  | 'silhouette-absente'
  | 'surface-hors-categorie'
  | 'palette-inconnue'
  | 'glb-different';

export interface EcartDElement {
  readonly code: CodeDEcartDElement;
  readonly ou: string;
  readonly detail: string;
}

export type VerdictDElement = { readonly ok: true; readonly manifeste: ManifesteDElement } | { readonly ok: false; readonly ecarts: readonly EcartDElement[] };

const CHAMPS_COMMUNS = ['schema', 'base', 'categorie', 'cle', 'liaison', 'surfaces', 'glb'] as const;
const estCategorie = (v: unknown): v is CategorieDElement => typeof v === 'string' && Object.prototype.hasOwnProperty.call(REGLES_DES_CATEGORIES, v);
const estSlot = (v: unknown): v is Slot => (SLOTS as readonly unknown[]).includes(v);
const liste = (l: readonly string[]) => l.map((e) => `\`${e}\``).join(', ');

/** Le manifeste `brut` réduit au schéma 3 et validé contre la base qu'il nomme. */
export function validerElement(brut: unknown, base: BaseDUnElement, octets: Uint8Array): VerdictDElement {
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
    ...(regle.couches ? ['couche'] : []), ...(regle.couvre === 'interdit' ? [] : ['couvre']),
    ...(regle.chaines ? ['chaines'] : []), ...(regle.emplacements ? ['emplacements'] : []), ...(regle.silhouettes ? ['silhouettes'] : []),
  ];
  const admis = new Set<string>([...CHAMPS_COMMUNS, ...optionnels]);
  for (const champ of Object.keys(brut)) if (!admis.has(champ)) refus('champ-hors-categorie', champ, `un élément \`${categorie}\` ne porte pas \`${champ}\``);
  const requis = [...CHAMPS_COMMUNS, ...(regle.couches ? ['couche'] : []), ...(regle.couvre === 'requis' ? ['couvre'] : [])];
  for (const champ of requis) if (brut[champ] === undefined) refus('forme', champ, `champ requis pour un élément \`${categorie}\``);

  if (brut.base !== undefined) {
    if (typeof brut.base !== 'string') refus('forme', 'base', 'chaîne attendue');
    else if (brut.base !== base.base) refus('base-differente', 'base', `${brut.base}, construit pour une autre base que \`${base.base}\``);
  }

  const cle = brut.cle;
  if (cle !== undefined) {
    const bienFormee = estObjet(cle) && Object.keys(cle).length === regle.cle.length && regle.cle.every((c) => typeof cle[c] === 'string' && cle[c] !== '');
    if (!bienFormee) refus('cle-mal-formee', 'cle', `${JSON.stringify(cle)} : ${liste(regle.cle)}, ids non vides et seuls, attendus pour un élément \`${categorie}\``);
  }

  if (brut.liaison !== undefined) {
    const mode = estObjet(brut.liaison) && Object.keys(brut.liaison).length === 1 ? brut.liaison.mode : undefined;
    if (typeof mode !== 'string') refus('forme', 'liaison', '`{ mode }` seul attendu');
    else if (!regle.liaisons.includes(mode as ModeDeLiaison)) refus('liaison-hors-categorie', 'liaison.mode', `${mode} : ${liste(regle.liaisons)} attendue pour un élément \`${categorie}\``);
  }

  if (regle.couches && brut.couche !== undefined) {
    if (!regle.couches.includes(brut.couche as Couche)) refus('couche-hors-categorie', 'couche', `${String(brut.couche)} : ${liste(regle.couches)} attendue pour un élément \`${categorie}\``);
  }

  const sousEnsemble = (champ: string, connus: readonly string[], code: CodeDEcartDElement, quoi: string) => {
    const v = brut[champ];
    if (v === undefined || !admis.has(champ)) return;
    if (!estListeDeChaines(v) || new Set(v).size !== v.length) return refus('forme', champ, 'liste de chaînes sans doublon attendue');
    v.forEach((e, i) => { if (!connus.includes(e)) refus(code, `${champ}.${i}`, `${e} n’est pas ${quoi} de la base \`${base.base}\``); });
  };
  sousEnsemble('couvre', base.zones, 'zone-inconnue', 'une zone');
  sousEnsemble('chaines', Object.keys(base.chaines), 'chaine-absente', 'une chaîne');
  sousEnsemble('silhouettes', base.silhouettes, 'silhouette-absente', 'une shape key');

  if (regle.emplacements && brut.emplacements !== undefined) {
    if (!estObjet(brut.emplacements)) refus('forme', 'emplacements', 'objet attendu');
    else for (const [id, e] of Object.entries(brut.emplacements)) {
      if (!(estObjet(e) && typeof e.os === 'string' && estTriplet(e.position) && estTriplet(e.rotation) && Object.keys(e).length === 3)) refus('forme', `emplacements.${id}`, '`os` chaîne, `position` et `rotation` triplets de nombres attendus');
      else if (!base.os.includes(e.os)) refus('emplacement-sur-os-absent', `emplacements.${id}.os`, `${e.os} n’est pas un os de la base \`${base.base}\``);
    }
  }

  if (brut.surfaces !== undefined) {
    if (!Array.isArray(brut.surfaces)) refus('forme', 'surfaces', 'liste attendue');
    else {
      const noms = new Set<string>();
      brut.surfaces.forEach((s: unknown, i) => {
        const ou = `surfaces.${i}`;
        if (!estObjet(s) || typeof s.nom !== 'string' || s.nom === '' || Object.keys(s).length !== 2) return refus('forme', ou, '`{ nom, palette }` ou `{ nom, teinte: true }` attendu');
        if (noms.has(s.nom)) refus('forme', `${ou}.nom`, `${s.nom} nommée deux fois`);
        noms.add(s.nom);
        if (regle.couleur === 'teinte') {
          if (s.teinte !== true) refus('surface-hors-categorie', ou, `un élément \`${categorie}\` prend la teinte de l’objet : \`teinte: true\` attendu`);
        } else if (s.palette === undefined) refus('surface-hors-categorie', ou, `un élément \`${categorie}\` prend la palette du combattant : \`palette\` attendue`);
        else if (!estSlot(s.palette)) refus('palette-inconnue', `${ou}.palette`, `${String(s.palette)} : ${liste(SLOTS)} attendue`);
      });
    }
  }

  if (brut.glb !== undefined) {
    const g = brut.glb;
    if (!(estObjet(g) && typeof g.sha256 === 'string' && /^[0-9a-f]{64}$/.test(g.sha256) && Number.isInteger(g.octets) && (g.octets as number) > 0 && Object.keys(g).length === 2)) {
      refus('forme', 'glb', '`sha256` hexadécimal de 64 caractères et `octets` entier positif attendus');
    } else {
      const somme = sha256(octets);
      if (g.sha256 !== somme || g.octets !== octets.byteLength) refus('glb-different', 'glb', `GLB de ${octets.byteLength} octets, SHA-256 ${somme} ; déclaré ${g.octets} octets, ${g.sha256}`);
    }
  }

  return ecarts.length ? { ok: false, ecarts } : { ok: true, manifeste: brut as unknown as ManifesteDElement };
}
