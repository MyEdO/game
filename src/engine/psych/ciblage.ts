/**
 * La Cible d'un Trait psychologique (LDB 21 l.17-19, l.75 ; EDOC 11 l.648) : SEUL module qui la fabrique,
 * la lit, la compare et l'affiche dans le moteur. Deux variantes : un Groupe de `groups.json` (id nu), ou un
 * individu, un combattant par son `Combatant.id` (`@id`). Le préfixe ne se lit qu'ici. #1463 #3045
 */
import { dataLabel, findGroupById, findPsychologyById, findTraitById, groupLabel, psychologyLabel } from '../../data';
import type { VarianteDeCible } from '../../data/schemas/grammaire/valeurs';
import { t } from '../../i18n';
import type { NonAffichable, PlayerText } from '../../i18n/playerText';
import { groupesDe, type PorteurDeGroupes } from '../groups';

declare const CIBLE_PSY: unique symbol;

/** La Cible d'un Trait psy, sortie de `ciblePsy` : un Groupe par son id, ou un individu par son id. */
export type CiblePsy = string & NonAffichable & { readonly [CIBLE_PSY]: true };

const marquer = (id: string): CiblePsy =>
  // eslint-disable-next-line murs/marques -- #3045 : l'unique cast de ce module — forger la marque EST le corps de métier de la fabrique `ciblePsy`.
  id as CiblePsy;

/** Motif d'un id de Groupe, imposé au schéma de `groups.json` (`defs/groups.ts`). */
export const MOTIF_D_ID_DE_GROUPE = /^[a-z0-9-]+$/;

/** Préfixe d'une Cible d'individu, disjoint du motif des ids de Groupe. */
const PREFIXE_D_INDIVIDU = '@';

/** La forme d'une Cible écrite : sa variante et l'id qu'elle porte. */
function formeDe(ecrite: string): { variante: VarianteDeCible; id: string } {
  return ecrite.startsWith(PREFIXE_D_INDIVIDU)
    ? { variante: 'individu', id: ecrite.slice(PREFIXE_D_INDIVIDU.length) }
    : { variante: 'groupe', id: ecrite };
}

/** `id` peut-il être l'id d'un individu (non vide, sans le préfixe d'individu) ? */
function estIdDIndividu(id: string): boolean {
  return id !== '' && !id.startsWith(PREFIXE_D_INDIVIDU);
}

/** SEULE fabrique d'une Cible. Lève sur un id qui ne peut pas être celui de sa variante : erreur de programmation. */
export const ciblePsy = {
  groupe(id: string): CiblePsy {
    if (!MOTIF_D_ID_DE_GROUPE.test(id)) {
      throw new Error(`ciblePsy.groupe : « ${id} » n'est pas un id de Groupe (motif ${MOTIF_D_ID_DE_GROUPE.source}).`);
    }
    return marquer(id);
  },
  individu(id: string): CiblePsy {
    if (!estIdDIndividu(id)) {
      throw new Error(`ciblePsy.individu : « ${id} » n'est pas un id de combattant.`);
    }
    return marquer(`${PREFIXE_D_INDIVIDU}${id}`);
  },
};

/** SEUL lecteur de la forme d'une Cible : rend ce que dit le lecteur de sa variante. */
export function selonCible<R>(cible: CiblePsy, lecteurs: { groupe: (id: string) => R; individu: (id: string) => R }): R {
  const { variante, id } = formeDe(cible);
  return lecteurs[variante](id);
}

/** La Cible que désigne un porteur : son 1er Groupe (`groupesDe`), `undefined` s'il n'en porte aucun. */
export function cibleDuPorteur(p: PorteurDeGroupes): CiblePsy | undefined {
  const [groupe] = groupesDe(p);
  return groupe === undefined ? undefined : ciblePsy.groupe(groupe);
}

/** La Cible qu'écrit une chaîne de donnée (`arg` d'un Trait, spécialisation, Cible persistée) : `@id` donne
 *  l'individu, un id de Groupe connu de `groups.json` le Groupe ; sinon aucune. */
export function ciblePsyLue(ecrite: string): CiblePsy | undefined {
  const { variante, id } = formeDe(ecrite);
  if (variante === 'individu') return estIdDIndividu(id) ? ciblePsy.individu(id) : undefined;
  return findGroupById(id) ? ciblePsy.groupe(id) : undefined;
}

/** SEUL décodage de l'`arg` d'un Trait posé en Cible : celle qu'il écrit (`ciblePsyLue`) quand le Trait `traitId`
 *  tire son argument des Cibles psy (`specsSource: ciblesPsy`), sinon aucune. */
export function cibleDeLArg(traitId: string, arg: string): CiblePsy | undefined {
  return findTraitById(traitId)?.specsSource === 'ciblesPsy' ? ciblePsyLue(arg.trim()) : undefined;
}

/** L'id de l'individu que vise une Cible, `undefined` pour un Groupe. */
export function individuDe(cible: CiblePsy): string | undefined {
  return selonCible<string | undefined>(cible, { groupe: () => undefined, individu: (id) => id });
}

/** Les ids d'individu qu'une valeur de DONNÉE nomme en Cible psy, à toute profondeur : l'`arg` d'un Trait posé
 *  (`cibleDeLArg`). #3045 */
export function individusNommes(valeur: unknown, out: string[] = []): string[] {
  if (Array.isArray(valeur)) {
    for (const v of valeur) individusNommes(v, out);
    return out;
  }
  if (valeur === null || typeof valeur !== 'object') return out;
  const o = valeur as Record<string, unknown>;
  const deLArg = typeof o.id === 'string' && typeof o.arg === 'string' ? cibleDeLArg(o.id, o.arg) : undefined;
  const individu = deLArg && individuDe(deLArg);
  if (individu !== undefined) out.push(individu);
  for (const v of Object.values(o)) individusNommes(v, out);
  return out;
}

/** Référence d'une Cible dans une op psy (#1468) : `{ id }` d'un Groupe, seule forme de la donnée
 *  (`ref('groupe')`), ou `{ personnage }`, l'individu d'une op que pose le moteur (`psychBranchOps`). #3045 */
export type RefDeCible = { readonly id: string } | { readonly personnage: string };

/** SEULE couture référence d'op → moteur : la Cible d'une référence. */
export function cibleDeRef(ref: RefDeCible): CiblePsy {
  return 'personnage' in ref ? ciblePsy.individu(ref.personnage) : ciblePsy.groupe(ref.id);
}

/** Réciproque de `cibleDeRef` : la référence d'op d'une Cible. */
export function refDeCible(cible: CiblePsy): RefDeCible {
  return selonCible<RefDeCible>(cible, { groupe: (id) => ({ id }), individu: (personnage) => ({ personnage }) });
}

/** La variante d'une Cible. */
export function varianteDe(cible: CiblePsy): VarianteDeCible {
  return selonCible<VarianteDeCible>(cible, { groupe: () => 'groupe', individu: () => 'individu' });
}

/** Le type de psychologie `type` admet-il la `variante` (`psychology.json`, `cibles`) ? */
export function varianteAdmise(type: string, variante: VarianteDeCible): boolean {
  return !!findPsychologyById(type)?.cibles?.includes(variante);
}

/** Identité d'un Trait psy ou d'une affliction : son type, et sa Cible s'il en porte une. Deux entrées de même
 *  identité sont la même entrée. */
export function identiteDeCiblage(type: string, cible?: CiblePsy): string {
  return cible === undefined ? type : `${type}|${cible}`;
}

/** Le nom d'un individu par son id, fourni par l'appelant (`nomDIndividu`, `noyau/monde/sceneNpc.ts`). */
export type NomDIndividu = (id: string) => string | undefined;

/** Le libellé joueur d'une Cible : le libellé du Groupe, ou le nom de l'individu, à défaut « une personne de
 *  la scène ». */
export function libelleDeCible(cible: CiblePsy, nomDIndividu?: NomDIndividu): PlayerText {
  return selonCible(cible, {
    groupe: groupLabel,
    individu: (id) => {
      const nom = nomDIndividu?.(id);
      return nom ? dataLabel(nom) : t('cible.personneDeLaScene');
    },
  });
}

/** Le libellé joueur d'une psychologie et de sa Cible, « Haine (Nains) » ; le type seul sans Cible. */
export function libelleDePsy(type: string, cible?: CiblePsy, nomDIndividu?: NomDIndividu): PlayerText {
  const psy = psychologyLabel(type);
  return cible === undefined ? psy : t('step.sujetPrecision', { sujet: psy, precision: libelleDeCible(cible, nomDIndividu) });
}

/** Le type de psychologie vise-t-il une Cible (`psychology.json`, `cibles`) ? */
export function estCibleType(type: string): boolean {
  return findPsychologyById(type)?.cibles !== undefined;
}
