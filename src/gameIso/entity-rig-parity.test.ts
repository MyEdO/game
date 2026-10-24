import { describe, it, expect } from 'vitest';
import { entityRigProfileFor } from './rig/enemyProfile';
import type { SceneEntity } from '../noyau/monde/scene';
import { spawnEnemy } from '../noyau/monde/spawn';
import { equipementDessine } from '../noyau/equipementDessine';

/** Profil d'entité partagé par ISO et POV : enrôlement et apparence d'auteur traversent la même projection. */
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

  it('transmet les apparences d’objets de la scène au canal weapon', () => {
    const prof = entityRigProfileFor(ent({ weapon: 'arme-simple', appearance: { apparencesObjets: { 'arme-simple': 'hache_naine' } } }), false);
    expect(prof?.equip.weapons[0].candidats).toEqual(['hache_naine', 'hache']);
  });

  it('conserve les candidats d’un statbloc entre exploration et combat', () => {
    const e = ent({
      ref: undefined,
      appearance: { species: 'humains-reiklander', apparencesObjets: { 'arme-simple': 'hache_naine' } },
      statblock: { type: 'statblock', label: 'PNJ', char: { B: 10 }, traits: [{ id: 'arme', arg: 'arme-simple', value: 7 }] },
    });
    const prof = entityRigProfileFor(e, true);
    const c = spawnEnemy({ statblock: e.statblock! }, e.id, e.pos, { appearance: e.appearance });
    expect(prof?.equip.weapons[0].candidats).toEqual(['hache_naine', 'hache']);
    expect(equipementDessine(c).weapons.map(w => w.candidats)).toEqual(prof?.equip.weapons.map(w => w.candidats));
    expect(c.weapons[0]).not.toHaveProperty('apparence');
  });
});
