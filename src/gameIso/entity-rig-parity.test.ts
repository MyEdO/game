import { describe, it, expect } from 'vitest';
import { entityRigProfileFor } from './rig/enemyProfile';
import type { SceneEntity } from '../noyau/monde/scene';

/** `entityRigProfileFor` = dérivation UNIQUE de l'apparence/équipement d'une entité de scène, partagée
 *  par le rendu ISO (`tokenBodyKind`) ET POV (`buildPovBillboards`). Avant, l'objet d'options était recopié
 *  aux deux sites et POV oubliait `enrolled` → un membre de rencontre portait son arme en iso mais pas en
 *  POV. Ce test verrouille la sémantique `enrolled` (la seule qui divergeait). */
describe('entityRigProfileFor — équipement d’une entité de scène (parité iso↔POV)', () => {
  const ent = (over: Partial<SceneEntity> = {}): SceneEntity =>
    ({ kind: 'personnage', id: 'g1', label: 'Garde', pos: { x: 0, y: 0 }, ref: 'nain', ...over }) as SceneEntity;

  it('entité ENRÔLÉE (membre de rencontre) → armée, parité avec le spawn de combat', () => {
    const prof = entityRigProfileFor(ent(), true);
    expect(prof?.equip.weapons.length ?? 0).toBeGreaterThan(0);
  });

  it('entité d’AMBIANCE (non enrôlée) → mains libres (ne dégaine pas pour décorer la scène)', () => {
    const prof = entityRigProfileFor(ent(), false);
    expect(prof?.equip.weapons.length ?? 0).toBe(0);
  });
});
