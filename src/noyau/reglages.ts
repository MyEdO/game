/**
 * LES RÉGLAGES QU'UNE FENÊTRE NOMME (#2928) : un choix ou une bascule d'un lecteur de fenêtre (`fenetreDAttaque`,
 * `fenetreDeDefense`), ou l'argument de l'étape de cascade courante (`VERBES_D_INTERACTION`), nomme le verbe qui le
 * règle ; ce module les relève, chacun avec la valeur courante de son argument et, pour un choix, les valeurs que
 * l'état ouvre, chacune avec son libellé. Un hôte rend l'argument d'un verbe d'après son réglage, sinon d'après sa
 * forme ; il ne devine jamais le verbe d'un choix. Module feuille : la cascade (`combatAuto.ts`) y prend ses réglages
 * d'étape sans rien importer d'autre.
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { CascadeStep } from './pendings';

/** Une valeur qu'un argument prend : celle que le verbe reçoit, son libellé, et la raison qui la ferme (`null` :
 *  ouverte). */
export interface ValeurDuReglage { valeur: string | number | boolean | null; libelle: string; refus: string | null }

/** Un choix d'une fenêtre : le verbe qui le règle, le paramètre qu'il règle (absent : le premier argument libre du
 *  verbe), son libellé, la valeur retenue et les valeurs offertes, chacune avec la raison qui la ferme (absente ou
 *  `null` : ouverte). */
export interface ChoixNomme<V extends string | number | boolean = string> {
  verbe: keyof ActionsDuNoyau;
  parametre?: string;
  libelle: string;
  choisie: V | null;
  options: { valeur: V | null; libelle: string; refus?: string | null }[];
}

/** Une bascule d'une fenêtre : le verbe qui la règle, son libellé, son état, et la note qui en dit l'effet (`null` :
 *  aucune). */
export interface BasculeNommee { verbe: keyof ActionsDuNoyau; libelle: string; active: boolean; note: string | null }

/** Le réglage d'un argument d'un verbe : le paramètre qu'il règle (absent : le premier argument libre du verbe), son
 *  libellé, la valeur courante de l'argument, ses valeurs (`null` : la forme de l'argument les dit), ses bornes
 *  (`null` : aucune), la note qui en dit l'effet. */
export interface Reglage {
  verbe: string;
  parametre?: string;
  libelle: string | null;
  courant: string | number | boolean | null;
  valeurs: ValeurDuReglage[] | null;
  bornes: { min: number; max: number; pas: number | null } | null;
  note: string | null;
}

/** Les verbes que la fenêtre d'attaque règle (`fenetreDAttaque`, `FENETRE_DU_JET.attack`) : chacun nommé par l'élément
 *  qui le règle quand l'attaque l'ouvre, fermé sinon (`hote/gestes.ts`). */
export const REGLAGES_DE_L_ATTAQUE = [
  'attackSetLocation', 'attackSetWeapon', 'attackSetDualMode', 'attackSetWithhold', 'attackSetHarpoonRopeCut', 'attackSetGrapple',
  'attackSetCritLocation',
] as const satisfies readonly (keyof ActionsDuNoyau)[];

/** Les verbes que la fenêtre de la Défense règle (`fenetreDeDefense`, `FENETRE_DU_JET.defense`), comme ceux de l'attaque. */
export const REGLAGES_DE_LA_DEFENSE = ['defenseSetMode', 'defenseSetParryWeapon', 'defenseSetShieldReaction', 'defenseSetRiposte'] as const satisfies readonly (keyof ActionsDuNoyau)[];

const estNomme = (e: unknown): e is ChoixNomme<string | number | boolean> | BasculeNommee => typeof e === 'object' && e !== null && 'verbe' in e;

/** Les réglages des éléments nommés d'une fenêtre lue (`fenetreDAttaque`, `fenetreDeDefense`) : chaque champ qui
 *  nomme son verbe. */
export function reglagesDesElements(fenetre: object | null): Reglage[] {
  return Object.values(fenetre ?? {}).filter(estNomme).map((e) => ('options' in e
    ? { verbe: e.verbe, ...(e.parametre ? { parametre: e.parametre } : {}), libelle: e.libelle, courant: e.choisie, valeurs: e.options.map((o) => ({ valeur: o.valeur, libelle: o.libelle, refus: o.refus ?? null })), bornes: null, note: null }
    : { verbe: e.verbe, libelle: e.libelle, courant: e.active, valeurs: null, bornes: null, note: e.note }));
}

/** Le réglage d'un choix d'étape de cascade (`options`, `chosen`) par le verbe `verbe`. */
export const reglageDuChoix = (verbe: keyof ActionsDuNoyau) => (e: CascadeStep): Reglage => ({
  verbe,
  libelle: e.label ?? null,
  courant: e.chosen ?? null,
  valeurs: (e.options ?? []).map((o) => ({ valeur: o.key, libelle: o.label, refus: o.refus ?? null })),
  bornes: null,
  note: null,
});

/** Le réglage d'une quantité d'étape de cascade (`quantity`, `amount`) par le verbe `verbe`. */
export const reglageDeLaQuantite = (verbe: keyof ActionsDuNoyau) => (e: CascadeStep): Reglage => ({
  verbe,
  libelle: e.label ?? null,
  courant: e.amount ?? null,
  valeurs: null,
  bornes: e.quantity ? { min: e.quantity.min, max: e.quantity.max, pas: e.quantity.step ?? null } : null,
  note: e.quantity?.unit ?? null,
});
