/**
 * Scénario « Poursuite terrestre » (#95) : parse + l'Effet `startPursuit` est posé au trigger d'entrée
 * + ses réfs (compétence, créature du secours) résolvent contre les VRAIS enregistrements.
 */
import { describe, it, expect } from 'vitest';
import { flowEffects } from '../../state/flow';
import { byId, findCreatureById } from '../../data';
import { scenario } from './95-poursuite-terrestre';
const scenarioConstruit = scenario.construire();

describe('Scénario 95 — Poursuite terrestre', () => {
  it('un groupe fixe (pré-tirés) part de la scène', () => {
    expect(scenario.construire().party.length).toBeGreaterThan(0);
    expect(scenarioConstruit.scene.entities.find((e) => e.kind === 'heroStart')).toBeTruthy();
  });

  it('le trigger d’entrée pose l’Effet startPursuit (fuite, 3 brigands, secours au rattrapage)', () => {
    const trigger = scenarioConstruit.scene.triggers.find((t) => t.id === 'depart-poursuite');
    expect(trigger).toBeTruthy();
    const effects = flowEffects(trigger!.flow);
    const startPursuit = effects.find((e) => e.type === 'startPursuit');
    expect(startPursuit).toBeTruthy();
    if (startPursuit?.type !== 'startPursuit') throw new Error('type narrowing');
    expect(startPursuit.partyRole).toBe('fleeing');
    expect(startPursuit.foes.length).toBe(3);
    expect(startPursuit.encounter).toBe('enc-rattrapage');
  });

  it('la compétence de Mouvement testée et le bestiaire du secours résolvent (données réelles)', () => {
    const trigger = scenarioConstruit.scene.triggers.find((t) => t.id === 'depart-poursuite')!;
    const startPursuit = flowEffects(trigger.flow).find((e) => e.type === 'startPursuit');
    if (startPursuit?.type !== 'startPursuit') throw new Error('type narrowing');
    expect(byId('skill', startPursuit.skill.id)).toBeTruthy();
    expect(findCreatureById('brigand')).toBeTruthy();
  });

  it('la rencontre de secours au rattrapage porte 3 brigands cachés jusqu’au combat', () => {
    const enc = scenarioConstruit.scene.encounters.find((e) => e.id === 'enc-rattrapage')!;
    expect(enc).toBeTruthy();
    const members = enc.members ?? [];
    expect(members.length).toBe(3);
    const refs = members.map((m) => scenarioConstruit.scene.entities.find((e) => e.id === m.entityId)?.ref);
    expect(refs.every((r) => r === 'brigand')).toBe(true);
  });
});
