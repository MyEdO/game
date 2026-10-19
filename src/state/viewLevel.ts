/**
 * Niveau (étage z) AFFICHÉ — l'étage de la zone ACTIVE, celui que le picking résout et que la vue du
 * dessus isole. En iso, l'écran rend la scène ENTIÈRE et n'en retire que ce qui coiffe le groupe
 * (`gameIso/stage/MondeDeCampagne.tsx:loiDeDégagement`) ; l'ISOLEMENT d'un seul étage est le régime du
 * plan (`politique.etageIsole`) et de l'override ci-dessous. Ce module porte les deux faces de cette
 * vérité :
 *  - l'override DEBUG (devtool `__wfrp.viewLevel(z)`) : `null` = automatique. Store externe minimal
 *    (hors store Zustand : isolé, zéro couplage) ; le devtool le PILOTE, le rendu le LIT ;
 *  - `etageActif` : la RÈGLE qui en déduit l'étage montré. UNE définition, trois lecteurs — le rendu
 *    (`gameIso/stage/MondeDeCampagne.tsx`), le picking (`gameIso/stage/pickResolve.ts`) et la recette
 *    (`state/devtools.ts:__wfrp.levels`). Tenue en triple, elle divergeait : la copie du devtool
 *    ignorait le combattant qui joue et annonçait l'étage du groupe pendant un tour d'ennemi posté un
 *    étage plus haut.
 * Vit dans `state` (#161) : `src/gameIso` en dépend, jamais l'inverse.
 */
import { inBattleId } from '../noyau/monde/combatants';
import type { GameState } from './store';

let _viewZ: number | null = null;
const subs = new Set<() => void>();

export const getViewZ = (): number | null => _viewZ;
export function setViewZ(z: number | null): void {
  _viewZ = z;
  subs.forEach((f) => f());
}
export function subscribeViewZ(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

/** Ce que la règle de l'étage affiché lit de l'état — la tranche EXACTE, jamais le store entier. */
export interface EtatEtage {
  mode: GameState['mode'];
  battle: GameState['battle'];
  partyPos: GameState['partyPos'];
}

/** ÉTAGE ACTIF — celui que le rendu montre et sur lequel le picking résout : l'override DEBUG d'abord,
 *  sinon l'étage du combattant qui JOUE, sinon celui du groupe. `viewZ` est PASSÉ et non relu ici : le
 *  rendu s'y abonne (`subscribeViewZ`) pour se redessiner, et doit résoudre sur la valeur qu'il a
 *  commise — la relire ferait diverger l'image et le clic pendant le battement. */
export function etageActif(st: EtatEtage, viewZ: number | null): number {
  if (viewZ !== null) return viewZ;
  const actif = st.mode === 'battle' && st.battle ? inBattleId(st.battle, st.battle.order[st.battle.turn]) : undefined;
  return actif?.pos?.z ?? st.partyPos?.z ?? 0;
}
