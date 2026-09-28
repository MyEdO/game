/**
 * Table des CLÉS DE PALETTE du rig (#1903) — le vocabulaire des jetons `@clé`, source unique : toute
 * base qu'une palette déclare ou qu'un art peint est une ligne. Trois parties : les clés RECOLORIABLES
 * (une ligne par élément de `SLOTS`, défaut + libellé d'éditeur), les clés COMMUNES (non
 * recoloriables, à défaut de couche défaut ou à clé suivie) et le VOCABULAIRE (sans défaut : ce que la
 * clé peint ; elle n'est résolue que si une couche la déclare). La sorte d'une clé se déduit de son
 * appartenance à `PORTEUR`, à `SLOTS` ou à aucun. Une ligne commune peut porter l'ombre et la lumière
 * de sa gamme dans la couche défaut, et la clé qu'elle SUIT (`suit`, voir `propagerSuiveuses`).
 * Module FEUILLE : aucun import du rig.
 */
import { SLOTS, PORTEUR, ROLES_DE_GAMME, gammeDe, type RoleDeGamme, type Slot } from '../../data/palette.types';

/** Champs de rôle d'une ligne : un champ par `RoleDeGamme`, de valeur `V`. */
type RolesDeLigne<V> = { readonly [R in RoleDeGamme]?: V };
/** Valeur d'une clé dans la couche défaut ; un champ de rôle = la clé `gammeDe(<clé>, rôle)` de cette
 *  couche ; `suit` = la clé de la table dont elle prend la gamme quand une couche ne la donne pas. Sans
 *  `defaut`, la couche défaut la donne par sa clé suivie. */
type LigneDeCle<K extends string> =
  | ({ readonly defaut: string; readonly suit?: K } & RolesDeLigne<string>)
  | ({ readonly suit: K; readonly defaut?: undefined } & RolesDeLigne<undefined>);
type LigneRecoloriable = { readonly defaut: string; readonly libelle: string };
/** Ligne de vocabulaire : ce que la clé peint (nom court) ; aucune valeur dans la couche défaut. */
type LigneDeVocabulaire = { readonly peint: string; readonly defaut?: never; readonly suit?: never } & RolesDeLigne<never>;

/** Lignes communes : refuse, au type, une clé qui serait un `Slot` et un `suit` hors de la table. */
export function communes<const T extends Record<string, LigneDeCle<string>>>(
  t: T & { [K in keyof T]: K extends Slot ? never : LigneDeCle<Slot | Extract<keyof T, string>> },
): T {
  return t;
}

const RECOLORIABLES = {
  peau: { defaut: '#e2b48c', libelle: 'Peau' },
  cheveux: { defaut: '#5a4427', libelle: 'Cheveux' },
  yeux: { defaut: '#5a3e28', libelle: 'Yeux' },
  vet1: { defaut: '#8a7048', libelle: 'Vêtement 1' },
  vet2: { defaut: '#4c3a26', libelle: 'Vêtement 2' },
  cuir: { defaut: '#5a3f24', libelle: 'Cuir' },
  metal: { defaut: '#8b94a6', libelle: 'Métal' },
  corps: { defaut: '#6b4a2e', libelle: 'Corps (pelage)' },
  accent: { defaut: '#c8923a', libelle: 'Accent' },
} as const satisfies Record<Slot, LigneRecoloriable>;

const COMMUNES = communes({
  or: { defaut: '#c9a23c', ombre: '#8a6a1e' },
  acier: { defaut: '#9aa6b8', ombre: '#5a6376', lumiere: '#e8edf5' },
  botte: { defaut: '#3a2614', ombre: '#1f1408' },
  semelle: { defaut: '#241608', suit: 'botte' },
  botteDos: { defaut: '#2e1f10', ombre: '#1a1208', suit: 'botte' },
  griffe: { defaut: '#241a12' },
  aile: { suit: 'corps' },
  voilure: { suit: 'cheveux' },
  membrane: { suit: 'corps' },
});

/** Lignes de vocabulaire : refuse, au type, une clé déjà recoloriable ou commune. */
export function vocabulaire<const T extends Record<string, LigneDeVocabulaire>>(
  t: T & { [K in keyof T]: K extends Slot | keyof typeof COMMUNES ? never : LigneDeVocabulaire },
): T {
  return t;
}

const VOCABULAIRE = vocabulaire({
  aigle: { peint: 'aigle brodé du tabard' },
  aura: { peint: 'aura translucide' },
  bache: { peint: 'bâche de chariot' },
  bas: { peint: 'bas de chausses' },
  bois: { peint: 'bois de charpente et de hampe' },
  bonnet: { peint: 'bonnet' },
  braie: { peint: 'braies' },
  broderie: { peint: 'tabard brodé de filigranes' },
  cape: { peint: 'cape' },
  chapeau: { peint: 'bord de chapeau' },
  chapelet: { peint: 'grains de chapelet' },
  coque: { peint: 'bois de carène' },
  corail: { peint: 'coraux et coquillages' },
  corde: { peint: 'cordages' },
  corne: { peint: 'cornes' },
  creve: { peint: "crevés d'étoffe" },
  crin: { peint: 'crinière de cimier' },
  cuirAv: { peint: 'tarses et serres écailleux' },
  cuivre: { peint: 'rosace de cuivre' },
  drap: { peint: 'caparaçon' },
  echarpe: { peint: 'écharpe' },
  empennage: { peint: 'empennage de projectile' },
  etincelle: { peint: 'étincelle de mèche' },
  fer: { peint: 'ferrures' },
  feuillage: { peint: 'feuillage profond : sous-tunique et creux du feuillage' },
  feuille: { peint: 'feuilles' },
  feutre: { peint: 'chapeau de feutre' },
  fonte: { peint: 'fûts de fonte' },
  fourreau: { peint: 'fourreau' },
  fourrure: { peint: 'fourrures et pelisses' },
  gemme: { peint: 'gemme' },
  harnaisCuir: { peint: 'cuirs du harnachement : caparaçon, collier, sangles, brides, étrivières' },
  jambiere: { peint: 'jambière de plates' },
  lacet: { peint: 'lacets' },
  laurier: { peint: 'couronne de laurier' },
  liane: { peint: 'lianes' },
  lin: { peint: 'linge de lin : chemise, col' },
  lueur: { peint: 'lueur de malepierre ou de sort' },
  maille: { peint: 'mailles' },
  manche: { peint: 'manche' },
  manchette: { peint: 'manchettes' },
  mat: { peint: 'espars et rames' },
  orbite: { peint: 'orbites de la dépouille' },
  os: { peint: 'os et crânes' },
  paille: { peint: 'paille tressée' },
  panache: { peint: 'panache de plumes' },
  parchemin: { peint: 'parchemins et rouleaux' },
  parement: { peint: 'parements' },
  pavillon: { peint: 'flammes et pavillons' },
  perle: { peint: 'collier de perles' },
  plume: { peint: 'plumes' },
  poignee: { peint: 'poignée de fourreau' },
  poil: { peint: 'poil de la dépouille' },
  rayure: { peint: 'rayure du tabard' },
  robe: { peint: 'robe de laine' },
  sangle: { peint: 'selle matelassée et panneaux de croupière' },
  sceau: { peint: 'sceaux et cachets' },
  tablier: { peint: 'tablier' },
  toile: { peint: 'vêtement de toile' },
  toileDeVoile: { peint: 'voiles de navire et un pavois sur deux' },
  tunique: { peint: 'tunique' },
  uniforme: { peint: 'uniforme' },
  venin: { peint: 'venin' },
  voile: { peint: 'guimpe et voile' },
});

type Communes = typeof COMMUNES;
/** Base de la table : recoloriable, commune ou de vocabulaire. */
export type BaseDeTable = Slot | keyof Communes | keyof typeof VOCABULAIRE;
type Suivie<K> = K extends keyof Communes ? (Communes[K] extends { readonly suit: infer S } ? S : never) : never;
type DeSortePorteur<K> = K extends (typeof PORTEUR)[number] ? true : [Suivie<K>] extends [never] ? false : DeSortePorteur<Suivie<K>>;
/** Base de sorte PORTEUR : une clé de `PORTEUR`, ou une suiveuse (clôture des `suit`) d'une clé porteur. */
export type BasePorteur = { [K in BaseDeTable]: DeSortePorteur<K> extends true ? K : never }[BaseDeTable];

const LIGNES: readonly (readonly [string, LigneDeCle<string> | LigneDeVocabulaire])[] = [
  ...SLOTS.map((k) => [k, RECOLORIABLES[k]] as const),
  ...Object.entries(COMMUNES),
  ...Object.entries(VOCABULAIRE),
];

/** Toutes les clés de la table (bases de gamme) : recoloriables dans l'ordre de `SLOTS`, communes,
 *  vocabulaire. */
export const CLES: readonly string[] = LIGNES.map(([k]) => k);

/** Paires [suiveuse, suivie] de la table. */
export const SUIVEUSES: readonly (readonly [string, string])[] = LIGNES.flatMap(([k, l]) => (l.suit ? [[k, l.suit] as const] : []));

/**
 * Clé SUIVEUSE, dans UNE couche : une couche qui donne la clé suivie mais pas la suiveuse lui donne la
 * gamme DÉCLARÉE de la suivie (base, plus ombre et lumière si cette couche les déclare).
 */
export function propagerSuiveuses(couche: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = { ...couche };
  for (const [f, s] of SUIVEUSES) {
    if (couche[s] == null || couche[f] != null) continue;
    out[f] = couche[s];
    for (const role of ROLES_DE_GAMME) {
      const valeur = couche[gammeDe(s, role)];
      if (valeur != null) out[gammeDe(f, role)] = valeur;
    }
  }
  return out;
}

/** La couche DÉFAUT DÉCLARÉE (la base et chacun de ses rôles, `gammeDe`), avant propagation des suiveuses. */
export const COUCHE_DEFAUT: Readonly<Record<string, string>> = Object.fromEntries(LIGNES.flatMap(([k, l]) => [
  ...(l.defaut ? [[k, l.defaut]] : []),
  ...ROLES_DE_GAMME.flatMap((role) => {
    const valeur = l[role];
    return valeur ? [[gammeDe(k, role), valeur]] : [];
  }),
]));

/** Défaut d'une clé recoloriable. */
export const defautDe = (slot: Slot): string => RECOLORIABLES[slot].defaut;

/** Projection d'éditeur : les clés retenues, avec le libellé de la table sauf libellé contextuel. */
export function projectionEditeur(cles: readonly Slot[], libelles: Partial<Record<Slot, string>> = {}): [label: string, slot: Slot][] {
  return cles.map((k) => [libelles[k] ?? RECOLORIABLES[k].libelle, k]);
}
