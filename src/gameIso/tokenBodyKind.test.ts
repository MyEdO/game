import { describe, it, expect, vi } from 'vitest';
import { tokenBodyKind } from './tokenBodyKind';
import type { SceneEntity } from '../state/scene';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';

const ent = (over: Partial<SceneEntity>): SceneEntity => ({ id: 'x', kind: 'prop', pos: { x: 0, y: 0 }, ...over });

describe('tokenBodyKind — classifieur de backend (rig / plan / sprite)', () => {
  it('entité prop sans ref → sprite', () => {
    const r = tokenBodyKind({ kind: 'sceneEntity', ent: ent({ id: 'a', kind: 'prop' }) });
    expect(r.bodyKind).toBe('sprite');
  });

  it('personnage humanoïde (villageois) → rig', () => {
    const r = tokenBodyKind({ kind: 'sceneEntity', ent: ent({ id: 'b', kind: 'personnage', ref: 'villageois' }) });
    expect(r.bodyKind).toBe('rig');
  });

  it('personnage créature non-bipède (id rat-geant → espèce du record) → plan (fin de l’asymétrie sprite figé)', () => {
    const r = tokenBodyKind({ kind: 'sceneEntity', ent: ent({ id: 'c', kind: 'personnage', ref: 'rat-geant' }) });
    expect(r.bodyKind).toBe('plan');
  });
});

describe('tokenBodyKind — coque de véhicule en COMBAT (#224 : routage par creatureId, pas par name)', () => {
  for (const id of ['cogue', 'loup-imperial']) {
    it(`combattant « ${id} » route vers le gabarit navire (jamais bipède)`, () => {
      const v = findVehicleById(id)!;
      expect(v?.hull).toBeTruthy();
      const c = vehicleCombatant(v, `g-${id}`)!;
      const r = tokenBodyKind({ kind: 'combatant', combatant: c });
      expect(r.bodyKind).toBe('plan');
    });

    it(`combattant « ${id} » renommé (label ≠ id) route toujours par creatureId, pas par name`, () => {
      const v = findVehicleById(id)!;
      const c = vehicleCombatant(v, `g-${id}-renamed`)!;
      c.label = 'Un Ennemi Sans Nom De Créature Valide';
      expect(c.creatureId).toBe(id);
      const r = tokenBodyKind({ kind: 'combatant', combatant: c });
      expect(r.bodyKind).toBe('plan');
    });

    it(`#230 — coque au NOM D'INSTANCE de campagne (« Le Cormoran ») route toujours par creatureId`, () => {
      const c = vehicleCombatant(findVehicleById(id)!, `g-${id}-cormoran`)!;
      c.label = 'Le Cormoran'; // nom d'instance authoré : AFFICHAGE pur, jamais une clé de rendu
      expect(tokenBodyKind({ kind: 'combatant', combatant: c }).bodyKind).toBe('plan');
    });
  }

  it('la garde DEV ne hurle pas pour une sceneEntity dont la ref est une coque de véhicule valide', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    tokenBodyKind({ kind: 'sceneEntity', ent: ent({ id: 'd', kind: 'personnage', ref: 'cogue' }) });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  for (const id of ['cogue', 'loup-imperial']) {
    it(`sceneEntity « ${id} » (figurant d'EXPLORATION/ÉDITEUR : même classifieur que les combattants)
        route vers le gabarit navire, jamais bipède`, () => {
      const r = tokenBodyKind({ kind: 'sceneEntity', ent: ent({ id: `fig-${id}`, kind: 'personnage', ref: id }) });
      expect(r.bodyKind).toBe('plan');
    });

    it(`sceneEntity « ${id} » renommée (label ≠ id/label catalogue) route toujours par la ref, pas par le label`, () => {
      const r = tokenBodyKind({ kind: 'sceneEntity', ent: ent({ id: `fig-${id}-renamed`, kind: 'personnage', ref: id, label: 'Un Nom De Fiction Sans Rapport' }) });
      expect(r.bodyKind).toBe('plan');
    });
  }

  it('la garde DEV HURLE pour une sceneEntity dont la ref ne résout ni créature ni véhicule ni engin (#223)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = tokenBodyKind({ kind: 'sceneEntity', ent: ent({ id: 'e', kind: 'personnage', ref: 'ref-totalement-inconnue' }) });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(r.bodyKind).toBe('rig'); // repli bipède Humain, mais SIGNALÉ — plus jamais silencieux
    warn.mockRestore();
  });
});
