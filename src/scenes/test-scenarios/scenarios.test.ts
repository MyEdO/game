import { describe, it, expect, assert } from 'vitest';
import { testScenarios } from './index';
import { validateScene } from '../../state/validateScene';
import { ficheDEntite } from '../../state/sceneNpc';
import { enemyRigProfile } from '../../gameIso/rig/enemyProfile';
import { terrainEntree } from '../../state/terrain';

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
      expect(s.scene.layers[0].tiles.length).toBe(s.scene.dimensions.w * s.scene.dimensions.h);
      if (s.autoCombat) expect(s.scene.encounters.find((e) => e.id === s.autoCombat)).toBeTruthy();
    },
  );
  /**
   * FILET des scènes TS (#1690). Le schéma refuse AU PARSE une tuile qui nomme un sol absent de
   * `terrains.json` (`layerSchema.tiles: idDe('terrain')`), mais les scénarios de test sont
   * construits EN CODE et ne passent par aucun parse : sans cette garde, un id de sol mort y peindrait
   * le repli d'alarme sans que rien ne le dise. DÉRIVÉE — aucune liste d'ids récitée.
   */
  it('tout id de TERRAIN posé par une scène TS existe dans `terrains.json`', () => {
    const morts: string[] = [];
    for (const s of testScenarios)
      for (const l of s.scene.layers)
        for (const t of new Set(l.tiles))
          if (!terrainEntree(t)) morts.push(`${s.id} z=${l.z} : « ${t} »`);
    expect([...new Set(morts)], `sol(s) absent(s) du dataset : ${morts.join(' | ')}`).toEqual([]);
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
