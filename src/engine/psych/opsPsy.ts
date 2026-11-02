/**
 * Fabriques des ops psychologiques de `GameOp` (`beginPsych`, `endPsych`, `grantPsychTrait`,
 * `removePsychTrait`) : SEULE graphie de leurs références emboîtées (`{ id }`), la Cible passant par
 * `refDeCible`. #1468 #1463 #3045
 */
import type { GameOp } from '../ops';
import type { PsychTrait, PsychType } from '../psychology';
import { psychologyLabel } from '../../data';
import { t } from '../../i18n';
import type { PlayerText } from '../../i18n/playerText';
import { cibleDeRef, libelleDePsy, refDeCible, type CiblePsy } from './ciblage';

type OpDe<K extends GameOp['op']> = Extract<GameOp, { op: K }>;

/** Les champs d'une pose autres que son type et sa Cible. */
export type ChampsDePose = Omit<OpDe<'beginPsych'>, 'op' | 'type' | 'cible'> & { readonly cible?: CiblePsy };

export const opPsy = {
  /** Pose (ou met à jour) l'état psychologique `type`. */
  pose(type: string, champs: ChampsDePose = {}): OpDe<'beginPsych'> {
    const { cible, ...reste } = champs;
    return { op: 'beginPsych', type: { id: type }, ...(cible !== undefined ? { cible: refDeCible(cible) } : {}), ...reste };
  },
  /** Retire l'état psychologique `type`. */
  fin(type: string): OpDe<'endPsych'> {
    return { op: 'endPsych', type: { id: type } };
  },
  /** Accorde le Trait psychologique `type`, visant `cible` s'il est ciblé. */
  octroi(type: string, cible?: CiblePsy): OpDe<'grantPsychTrait'> {
    return { op: 'grantPsychTrait', psychType: { id: type }, ...(cible !== undefined ? { cible: refDeCible(cible) } : {}) };
  },
  /** Retire le Trait psychologique `type` (l'instance visant `cible` si elle est donnée), ou un Trait au choix
   *  sans `type`. */
  retrait(type?: string, cible?: CiblePsy): OpDe<'removePsychTrait'> {
    if (type === undefined) return { op: 'removePsychTrait' };
    return { op: 'removePsychTrait', psychType: { id: type }, ...(cible !== undefined ? { cible: refDeCible(cible) } : {}) };
  },
};

/** Le Trait psychologique qu'accorde un `grantPsychTrait` : SEUL lecteur de ses références. */
export function traitOctroye(op: OpDe<'grantPsychTrait'>): Pick<PsychTrait, 'type' | 'cible'> {
  return { type: op.psychType.id as PsychType, ...(op.cible !== undefined ? { cible: cibleDeRef(op.cible) } : {}) };
}

/** Le libellé joueur du Trait qu'accorde un `grantPsychTrait` : « Préjugé (Nains) », ou « Préjugé (une personne
 *  choisie) » pour un Trait `envers` (VDM 10 l.327). */
export function libelleDuTraitOctroye(op: OpDe<'grantPsychTrait'>): PlayerText {
  const { type, cible } = traitOctroye(op);
  return op.envers ? t('step.sujetPrecision', { sujet: psychologyLabel(type), precision: t('cible.personneChoisie') }) : libelleDePsy(type, cible);
}
