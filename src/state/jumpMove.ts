import { Scene, Effect, heightAt, surfaceDAtterrissage } from '../noyau/monde/scene';
import { type Flow, EMPTY_FLOW, flowFromEffects, testFlow } from '../noyau/monde/flow';
import type { Pt } from '../noyau/monde/path';
import { jumpNeedsTest } from '../engine/movement';
import { combatStakeRef } from '../data';
import { chebyshev } from '../engine/grid';
import { testDeRegle } from '../engine/reglesChiffrees';

export type JumpPlan =
  | { kind: 'free' }
  | { kind: 'test'; flow: Flow }
  | { kind: 'none'; raison: 'aucune-surface' }; // un échec tomberait sur rien (`surfaceDAtterrissage`)

/**
 * Traduit un pas de SAUT (`takeoff`→`landing`, en cases cardinales) en plan jouable, SANS flux dédié :
 *  - dans la portée libre (Saut LDB 15 l.76) → franchissement d'office (`free`) ;
 *  - au-delà → l'Effet `test` existant (Test de la fiche `saut`) dont l'ÉCHEC déclenche `fall` sur
 *    la surface d'atterrissage du gouffre (`surfaceDAtterrissage`) ; sans surface → refus `aucune-surface`.
 * `runUpCases` = élan en ligne droite avant décollage : ≥ ceil(M/2) cases ⇒ Test `avec-elan` de la fiche
 * `saut`, sinon `sans-elan` (LDB 15 l.76).
 */
export function planJump(scene: Scene, takeoff: Pt, landing: Pt, movement: number, runUpCases: number): JumpPlan {
  const dist = chebyshev(landing, takeoff);
  if (!jumpNeedsTest(movement, dist)) return { kind: 'free' };
  const dx = Math.sign(landing.x - takeoff.x), dy = Math.sign(landing.y - takeoff.y);
  const gap = { x: takeoff.x + dx, y: takeoff.y + dy }; // 1re case du gouffre franchi
  const hDepart = heightAt(scene, takeoff.x, takeoff.y, takeoff.z ?? 0);
  const sol = surfaceDAtterrissage(scene, gap.x, gap.y, hDepart);
  if (sol.kind === 'aucune-surface') return { kind: 'none', raison: 'aucune-surface' };
  // Chute = hauteur métrique entre la surface de décollage et celle d'atterrissage (LDB 15 l.80).
  const metres = Math.max(0, hDepart - sol.hauteur);
  const test = testDeRegle('saut', runUpCases >= Math.ceil(movement / 2) ? 'avec-elan' : 'sans-elan');
  const fall: Effect = { type: 'fall', target: 'party', metres, to: sol.to };
  // La réussite ne fait rien (on a déjà franchi, optimiste) ; l'échec déclenche `fall` dans le gouffre.
  const stake = combatStakeRef('jumpTest', { values: { metres } });
  return { kind: 'test', flow: testFlow({ ...test, stake }, EMPTY_FLOW, flowFromEffects([fall])) };
}
