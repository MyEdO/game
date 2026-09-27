/**
 * Appendice DORSAL (ailes, queue, cape, aura…) — codifie UNE FOIS les règles de
 * vue/profondeur apprises à la dure, pour ne plus les redécouvrir à chaque nouvel art :
 *
 *  - de FACE, l'appendice passe DERRIÈRE TOUT le corps (plan 'fond') : un simple calque
 *    d'os est trahi par le z inégal des bras (G=4 derrière, D=8 devant) ;
 *  - de DOS, il passe DEVANT tout (plan 'avant') : on regarde le dos où il s'attache ;
 *  - de PROFIL, le dos du personnage est à −x (il regarde +x) : l'art `profile` DOIT
 *    s'ancrer au bord arrière (x négatif) et se déployer vers −x — et il se peint
 *    PAR-DESSUS le bord du dos (calque d'os normal) : relégué au fond, sa racine serait
 *    occultée par la silhouette et l'appendice « flotterait » derrière le héros.
 *
 * Le miroir (regarder à gauche) est géré au niveau du pion : tout le svg est retourné,
 * l'appendice suit. Les trois arts sont donc dessinés pour un personnage regardant +x.
 */
import type { BoneId, RigOverlay } from '../bones';
import { VIEWS, type View } from '../facing';
import type { ViewSet } from './types';

/** Plan de chaque vue d'un appendice dorsal (règles ci-dessus). */
const PLAN_DORSAL = {
  front: { plane: 'fond' },
  profile: {}, // calque d'os : la racine se pose SUR le dos
  back: { plane: 'avant' },
} as const satisfies Record<View, Pick<RigOverlay, 'plane'>>;

/** Les vues d'un appendice dorsal → calques prêts (plan/vue/ancrage corrects). */
export function dorsalOverlays(bone: BoneId, art: ViewSet): RigOverlay[] {
  return VIEWS.map((view): RigOverlay => ({ bone, svg: art[view], view, ...PLAN_DORSAL[view] }));
}
