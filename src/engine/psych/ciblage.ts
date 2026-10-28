/**
 * La Cible d'un Trait psychologique (LDB 21 l.17-19) : SEUL module qui la fabrique, la lit, la compare et
 * l'affiche dans le moteur. Hors de lui, `cibleInconnue` (`psychology.ts`) juge la Cible d'un porteur
 * PERSISTÉ avant toute lecture et élague toute chaîne hors `groups.json`, donc aussi toute Cible d'individu
 * (`@id`) de β1. #1463 #3045
 */
import { findPsychologyById, groupLabel } from '../../data';
import type { PlayerText } from '../../i18n/playerText';
import { groupesDe, type PorteurDeGroupes } from '../groups';

/** La Cible d'un Trait psy : un Groupe de `groups.json`, par son id. */
export type CiblePsy = string;

/** Motif d'un id de Groupe, imposé au schéma de `groups.json` (`defs/groups.ts`). */
export const MOTIF_D_ID_DE_GROUPE = /^[a-z0-9-]+$/;

/** SEULE fabrique d'une Cible. `groupe` lève sur un id hors du motif des Groupes : erreur de programmation. */
export const ciblePsy = {
  groupe(id: string): CiblePsy {
    if (!MOTIF_D_ID_DE_GROUPE.test(id)) {
      throw new Error(`ciblePsy.groupe : « ${id} » n'est pas un id de Groupe (motif ${MOTIF_D_ID_DE_GROUPE.source}).`);
    }
    return id;
  },
};

/** SEUL lecteur de la forme d'une Cible : rend ce que dit le lecteur de sa variante. */
export function selonCible<R>(cible: CiblePsy, lecteurs: { groupe: (id: string) => R }): R {
  return lecteurs.groupe(cible);
}

/** La Cible que désigne un porteur : son 1er Groupe (`groupesDe`), `undefined` s'il n'en porte aucun. */
export function cibleDuPorteur(p: PorteurDeGroupes): CiblePsy | undefined {
  const [groupe] = groupesDe(p);
  return groupe === undefined ? undefined : ciblePsy.groupe(groupe);
}

/** Référence de DONNÉE d'une Cible : le `{ id }` d'un Groupe (`ref('groupe')` des ops psy, #1468). */
export interface RefDeCible {
  readonly id: string;
}

/** SEULE couture donnée → moteur : la Cible d'une référence de donnée. */
export function ciblePsyLue(ref: RefDeCible): CiblePsy {
  return ciblePsy.groupe(ref.id);
}

/** Réciproque de `ciblePsyLue` : la référence de donnée d'une Cible. */
export function refDeCible(cible: CiblePsy): RefDeCible {
  return selonCible(cible, { groupe: (id) => ({ id }) });
}

/** Identité d'un Trait psy ou d'une affliction : son type, et sa Cible s'il en porte une. Deux entrées de même
 *  identité sont la même entrée. */
export function identiteDeCiblage(type: string, cible?: CiblePsy): string {
  return cible === undefined ? type : `${type}|${cible}`;
}

/** Le libellé joueur d'une Cible. */
export function libelleDeCible(cible: CiblePsy): PlayerText {
  return selonCible(cible, { groupe: groupLabel });
}

/** Le type de psychologie vise-t-il une Cible (`psychology.json`, `targeted`) ? */
export function estCibleType(type: string): boolean {
  return !!findPsychologyById(type)?.targeted;
}
