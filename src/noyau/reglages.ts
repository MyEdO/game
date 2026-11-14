/**
 * LES RÉGLAGES QU'UNE FENÊTRE NOMME (#2928) : un choix ou une bascule d'un lecteur de fenêtre (`fenetreDAttaque`,
 * `fenetreDeDefense`), ou l'argument de l'étape de cascade courante (`VERBES_D_INTERACTION`), nomme le geste qui le
 * règle (`GesteDuJeu` : `jetRegler` et son flux et son réglage pour un jet) ; ce module les relève, chacun avec la
 * valeur courante de son argument et, pour un choix, les valeurs que l'état ouvre, chacune avec son libellé. Un hôte
 * rend l'argument d'un geste d'après son réglage, sinon d'après sa forme ; il ne devine jamais le geste d'un choix.
 * Module feuille : la cascade (`combatAuto.ts`) y prend ses réglages d'étape sans rien importer d'autre.
 */
import type { CascadeStep } from './pendings';
import type { GesteDuJeu } from './modalArbiter';
import { VERBE_DE_REGLAGE, declarationDuReglageNomme, type EffetDuChoix, type FluxRegle, type ReglageDuJet } from './reglagesDuJet';
import { declarationDuChoixNomme } from './choixDesFenetres';

/** Une valeur qu'un argument prend : celle que le verbe reçoit, son libellé, et la raison qui la ferme (`null` :
 *  ouverte). */
export interface ValeurDuReglage { valeur: string | number | boolean | null; libelle: string; refus: string | null }

/** Un choix d'une fenêtre : le geste qui le règle (`GesteDuJeu`), le paramètre qu'il règle (absent : le premier argument
 *  libre du verbe), son libellé, la valeur retenue et les valeurs offertes, chacune avec la raison qui la ferme
 *  (absente ou `null` : ouverte). */
export interface ChoixNomme<V extends string | number | boolean = string> {
  geste: GesteDuJeu;
  parametre?: string;
  libelle: string;
  choisie: V | null;
  options: { valeur: V | null; libelle: string; refus?: string | null }[];
}

/** Une bascule d'une fenêtre : le geste qui la règle, son libellé, son état, et la note qui en dit l'effet (`null` :
 *  aucune). */
export interface BasculeNommee { geste: GesteDuJeu; libelle: string; active: boolean; note: string | null }

/** Le réglage d'un argument d'un geste : le paramètre qu'il règle (absent : le premier argument libre du verbe), son
 *  libellé, la valeur courante de l'argument, ses valeurs (`null` : la forme de l'argument les dit), ses bornes
 *  (`null` : aucune), la note qui en dit l'effet. */
export interface Reglage {
  geste: GesteDuJeu;
  parametre?: string;
  libelle: string | null;
  courant: string | number | boolean | null;
  valeurs: ValeurDuReglage[] | null;
  bornes: { min: number; max: number; pas: number | null } | null;
  note: string | null;
}

/** L'effet du geste `g` qui choisit, réglage de jet (`jetRegler`) ou choix de fenêtre (`fenetreChoisir`), tel que sa
 *  déclaration le dit (`REGLAGES_DU_JET`, `CHOIX_DES_FENETRES`) ; `null` : le geste ne choisit pas. */
export const effetDuGeste = (g: GesteDuJeu): EffetDuChoix | null =>
  (g.axe ? g.fenetre && declarationDuChoixNomme(g.fenetre, g.axe) : g.flux && g.reglage ? declarationDuReglageNomme(g.flux, g.reglage) : null)?.effet ?? null;

/** Le geste qui règle le réglage `reglage` du jet du flux `flux` (`jetRegler`). */
export const gesteDuReglage = (flux: FluxRegle, reglage: ReglageDuJet): GesteDuJeu => ({ verbe: VERBE_DE_REGLAGE, flux, reglage });

const estNomme = (e: unknown): e is ChoixNomme<string | number | boolean> | BasculeNommee => typeof e === 'object' && e !== null && 'geste' in e;

/** Les réglages des éléments nommés d'une fenêtre lue (`fenetreDAttaque`, `fenetreDeDefense`) : chaque champ qui
 *  nomme son geste, ou chaque élément nommé d'un champ qui en liste (`FenetreDIncantation.crans`). */
export function reglagesDesElements(fenetre: object | null): Reglage[] {
  return Object.values(fenetre ?? {}).flatMap((v: unknown) => (Array.isArray(v) ? v : [v])).filter(estNomme).map((e) => ('options' in e
    ? { geste: e.geste, ...(e.parametre ? { parametre: e.parametre } : {}), libelle: e.libelle, courant: e.choisie, valeurs: e.options.map((o) => ({ valeur: o.valeur, libelle: o.libelle, refus: o.refus ?? null })), bornes: null, note: null }
    : { geste: e.geste, libelle: e.libelle, courant: e.active, valeurs: null, bornes: null, note: e.note }));
}

/** Le réglage d'un choix d'étape de cascade (`options`, `chosen`) par le geste `geste`. */
export const reglageDuChoix = (geste: GesteDuJeu) => (e: CascadeStep): Reglage => ({
  geste,
  libelle: e.label ?? null,
  courant: e.chosen ?? null,
  valeurs: (e.options ?? []).map((o) => ({ valeur: o.key, libelle: o.label, refus: o.refus ?? null })),
  bornes: null,
  note: null,
});

/** Le réglage d'une quantité d'étape de cascade (`quantity`, `amount`) par le geste `geste`. */
export const reglageDeLaQuantite = (geste: GesteDuJeu) => (e: CascadeStep): Reglage => ({
  geste,
  libelle: e.label ?? null,
  courant: e.amount ?? null,
  valeurs: null,
  bornes: e.quantity ? { min: e.quantity.min, max: e.quantity.max, pas: e.quantity.step ?? null } : null,
  note: e.quantity?.unit ?? null,
});
