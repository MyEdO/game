/**
 * Table des CLÉS DE PALETTE du rig (#1903) — le vocabulaire des jetons `@clé`, source unique.
 * Deux parties : les clés RECOLORIABLES (une ligne par élément de `SLOTS`, défaut + libellé
 * d'éditeur) et les clés COMMUNES (non recoloriables, défaut commun à tous les defs). La sorte d'une
 * clé se déduit de son appartenance à `PORTEUR`, à `SLOTS` ou à aucun. Une ligne peut porter
 * l'ombre et la lumière de sa gamme dans la couche défaut, et la clé qu'elle SUIT (`suit`, voir
 * `propagerSuiveuses`). Module FEUILLE : aucun import du rig.
 */
import { SLOTS, type Slot } from '../../data/palette.types';

/** Valeur d'une clé dans la couche défaut ; `ombre`/`lumiere` = `<clé>O`/`<clé>H` de cette couche ;
 *  `suit` = la clé de la table dont elle prend la gamme quand une couche ne la donne pas. Sans
 *  `defaut`, la couche défaut la donne par sa clé suivie. */
type LigneDeCle<K extends string> =
  | { readonly defaut: string; readonly ombre?: string; readonly lumiere?: string; readonly suit?: K }
  | { readonly suit: K; readonly defaut?: undefined; readonly ombre?: undefined; readonly lumiere?: undefined };
type LigneRecoloriable = { readonly defaut: string; readonly libelle: string };

/** Lignes communes : refuse, au type, une clé qui serait un `Slot` et un `suit` hors de la table. */
export function communes<const T extends Record<string, LigneDeCle<string>>>(
  t: T & { [K in keyof T]: K extends Slot ? never : LigneDeCle<Slot | Extract<keyof T, string>> },
): T {
  return t;
}

const CLES_DE_PALETTE = {
  recoloriables: {
    peau: { defaut: '#e2b48c', libelle: 'Peau' },
    cheveux: { defaut: '#5a4427', libelle: 'Cheveux' },
    yeux: { defaut: '#5a3e28', libelle: 'Yeux' },
    vet1: { defaut: '#8a7048', libelle: 'Vêtement 1' },
    vet2: { defaut: '#4c3a26', libelle: 'Vêtement 2' },
    cuir: { defaut: '#5a3f24', libelle: 'Cuir' },
    metal: { defaut: '#8b94a6', libelle: 'Métal' },
    corps: { defaut: '#6b4a2e', libelle: 'Corps (pelage)' },
    accent: { defaut: '#c8923a', libelle: 'Accent' },
  } satisfies Record<Slot, LigneRecoloriable>,
  communes: communes({
    or: { defaut: '#c9a23c' },
    acier: { defaut: '#9aa6b8', ombre: '#5a6376', lumiere: '#e8edf5' },
    botte: { defaut: '#3a2614', ombre: '#1f1408' },
    semelle: { defaut: '#241608', suit: 'botte' },
    botteDos: { defaut: '#2e1f10', ombre: '#1a1208', suit: 'botte' },
    griffe: { defaut: '#241a12' },
    aile: { suit: 'corps' },
    voilure: { suit: 'cheveux' },
    membrane: { suit: 'corps' },
  }),
} as const;

const LIGNES: readonly (readonly [string, LigneDeCle<string>])[] = [
  ...SLOTS.map((k) => [k, CLES_DE_PALETTE.recoloriables[k]] as const),
  ...Object.entries(CLES_DE_PALETTE.communes),
];

/** Toutes les clés de la table (bases de gamme), recoloriables d'abord, dans l'ordre de `SLOTS`. */
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
    for (const suf of ['O', 'H']) if (couche[s + suf] != null) out[f + suf] = couche[s + suf];
  }
  return out;
}

/** La couche DÉFAUT DÉCLARÉE (`<clé>`, `<clé>O`, `<clé>H`), avant propagation des suiveuses. */
export const COUCHE_DEFAUT: Readonly<Record<string, string>> = Object.fromEntries(LIGNES.flatMap(([k, l]) => [
  ...(l.defaut ? [[k, l.defaut]] : []),
  ...(l.ombre ? [[`${k}O`, l.ombre]] : []),
  ...(l.lumiere ? [[`${k}H`, l.lumiere]] : []),
]));

/** Défaut d'une clé recoloriable. */
export const defautDe = (slot: Slot): string => CLES_DE_PALETTE.recoloriables[slot].defaut;

/** Projection d'éditeur : les clés retenues, avec le libellé de la table sauf libellé contextuel. */
export function projectionEditeur(cles: readonly Slot[], libelles: Partial<Record<Slot, string>> = {}): [label: string, slot: Slot][] {
  return cles.map((k) => [libelles[k] ?? CLES_DE_PALETTE.recoloriables[k].libelle, k]);
}
