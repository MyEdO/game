import { describe, it, expect } from 'vitest';
import { castingValue } from './magic';
import { effectiveSkillCharKey, testValue } from './skills';
import type { Combatant, CharKey } from './types';

/** Combatant minimal : Int 30 ≠ E 40 → la valeur de Test révèle quelle Caractéristique a servi. */
function mk(opts: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', label: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: { intelligence: 30, endurance: 40, sociabilite: 20, 'force-mentale': 25 } as never,
    psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never,
    skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 }, ...opts,
  } as Combatant;
}

const langue = (characteristic: CharKey) => ({ id: 'langue', spec: 'magick', characteristic, advances: 0 });

describe('caractéristique d’incantation — DATA-DRIVEN (point unique, zéro valeur en dur)', () => {
  it('défaut : Langue (Magick) sur la carac de la compétence (Intelligence)', () => {
    expect(castingValue(mk({ skills: [langue('intelligence')] }), 'langue', 'magick')).toBe(30);
  });

  it('carac alternative PORTÉE PAR LA DONNÉE : l’instance sur Endurance → Endurance (ex. lanceur ogre, ADE II 2 l.728)', () => {
    // Aucun sniff d'espèce, aucune règle en dur : le moteur lit SkillInstance.characteristic.
    expect(castingValue(mk({ skills: [langue('endurance')] }), 'langue', 'magick')).toBe(40);
  });

  it('sans instance possédée : repli sur la carac de la compétence (défaut LDB)', () => {
    expect(effectiveSkillCharKey(mk(), 'langue', { spec: 'magick', fallback: 'intelligence' })).toBe('intelligence');
  });

  it('testValue et castingValue partagent LE MÊME point (carac d’instance respectée des deux côtés)', () => {
    const c = mk({ skills: [langue('endurance')] });
    expect(testValue(c, 'langue', undefined, 'magick')).toBe(castingValue(c, 'langue', 'magick'));
    expect(testValue(c, 'langue', undefined, 'magick')).toBe(40);
  });

  it('Domaine « Gueule » (Magie Ogre, ADE II 2 l.728) : Langue (Magick) sur Endurance — attribut DATA du domaine', () => {
    // Lanceur du Domaine Gueule (talent arcane spec = id « gueule ») → castingChar 'endurance' lu dans domains.json.
    const gueuleCaster = mk({ skills: [langue('intelligence')], talents: [{ talentId: 'magie-des-arcanes', spec: 'gueule', times: 1 }] });
    expect(castingValue(gueuleCaster, 'langue', 'magick')).toBe(40);
  });
});
