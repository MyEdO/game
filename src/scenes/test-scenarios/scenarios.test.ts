import { describe, it, expect, assert } from 'vitest';
import { testScenarios } from './index';
import { validateScene } from '../../state/validateScene';
import { ficheDEntite } from '../../state/sceneNpc';
import { enemyRigProfile } from '../../gameIso/rig/enemyProfile';
import { refs } from '../../data/schemas/grammaire/ref';

describe('Batterie de scénarios de test', () => {
  it('couvre au moins 6 scénarios', () => {
    expect(testScenarios.length).toBeGreaterThanOrEqual(6);
  });
  // Invariants GÉNÉRIQUES sur tout le set (s'adapte à la refonte sans liste d'ids à maintenir).
  it.each(testScenarios.map((s) => [s.id, s] as const))(
    'le scénario %s a un groupe de héros non vide et une scène cohérente',
    (_id, s) => {
      const party = s.makeParty();
      expect(party.length).toBeGreaterThanOrEqual(1);
      expect(party.every((h) => h.kind === 'hero')).toBe(true);
      if (s.autoCombat) expect(s.scene.encounters.find((e) => e.id === s.autoCombat)).toBeTruthy();
    },
  );
  /**
   * Sorts des HÉROS posés EN CODE (`makeParty`) : aucun document ne les porte, donc aucun schéma de
   * scène ne les voit — la porte est celle de la grammaire (`refs('spell')`). DÉRIVÉE.
   */
  it.each(testScenarios.map((s) => [s.id, s] as const))('les sorts des héros du scénario %s existent dans `spells.json`', (_id, s) => {
    const verdict = refs('spell').safeParse(s.makeParty().flatMap((h) => h.spells ?? []));
    expect(verdict.success ? [] : verdict.error.issues.map((i) => i.message)).toEqual([]);
  });

  it('contient les piliers Embuscade et Magie', () => {
    expect(testScenarios.find((s) => s.id === 'embuscade')).toBeTruthy();
    expect(testScenarios.find((s) => s.id === 'magie')).toBeTruthy();
  });
  it('résout une espèce de rig pour les cinq mutants de l’Embuscade', () => {
    const embuscade = testScenarios.find((s) => s.id === 'embuscade')!;
    const encounter = embuscade.scene.encounters.find((e) => e.id === 'enc-mutants')!;
    const entities = new Map(embuscade.scene.entities.map((e) => [e.id, e]));
    assert(encounter.members?.length, 'enc-mutants doit contenir ses cinq membres');
    const species = encounter.members.map((member) => {
      const entity = entities.get(member.entityId)!;
      const combatant = ficheDEntite(entity);
      return [combatant.label, combatant.species, enemyRigProfile(combatant)?.appearance.species];
    });

    expect(species).toEqual([
      ['Knud Cratinx', 'humains-reiklander', 'humains-reiklander'],
      ['Mikael', 'humains-reiklander', 'humains-reiklander'],
      ['Erik', 'humains-reiklander', 'humains-reiklander'],
      ['Johann', 'humains-reiklander', 'humains-reiklander'],
      ['Terenz', 'humains-reiklander', 'humains-reiklander'],
    ]);
  });
  // Chaque scénario doit rester une scène VALIDE (réfs, transitions, dialogues, ids) contre le
  // moteur courant — pas seulement « non vide ».
  it.each(testScenarios.map((s) => [s.id, s] as const))(
    'le scénario %s passe validateScene sans erreur',
    (id, s) => {
      const project = [s.scene, ...(s.extraScenes ?? [])];
      const errors = validateScene(project, s.worldMap).filter((w) => w.level === 'error');
      expect(errors, `scénario « ${id} » : ${errors.map((e) => `[${e.scope}${e.refId ? `:${e.refId}` : ''}] ${e.message}`).join(' | ')}`).toEqual([]);
    },
  );
});
