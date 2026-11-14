import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { unarmedWeapon } from '../engine/items';
import type { Combatant, SkillInstance, Weapon } from '../engine/types';
import { bilanDuRound, degatsDEnfoncement } from './enfoncerUnePorte';
import { dureeDeChanson } from './shipCrew';
import { ligneDAttaquantDeManoeuvre, ligneDeCorpsACorpsBrut, ligneDeDistraire, ligneDuCalmeDistrait, distraireAttackValue } from './combatManeuvers';
import { ligneDEsquiveDeDesengagement } from './combat/desengagement';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const cc = (spec: string, advances: number) => ({ id: 'corps-a-corps', spec, characteristic: 'capacite-de-combat', advances } as SkillInstance);
const heros = (over: Partial<Combatant> = {}): Combatant => combattantDeTest({
  id: 'h', label: 'Gerhardt', kind: 'heros', wounds: blessuresDeBase(12), fortune: 0, resilience: 0,
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40 } as Combatant['characteristics'],
  weapons: [unarmedWeapon()], ...over,
});

describe('Enfoncer une porte (EDO 11 l.89-95)', () => {
  it('le Test roulé est Corps à corps (Bagarre) : Escrime +20, Bagarre +0 → cible 40 (EDO 11 l.93)', () => {
    const h = heros({ skills: [cc('escrime', 20), cc('bagarre', 0)] });
    banc.setState({ battle: null, party: [h], pendingForceDoor: null, pendingCascade: null, suspendedCascades: [], flags: {} } as never);
    banc.getState().enfoncerLaPorte({ label: 'Porte de la cave', doorBE: 4, doorB: 10, heroIds: [h.id] });
    banc.getState().jetLancer('enfoncerLaPorte', h.id);
    expect(banc.getState().pendingForceDoor!.participants[0].result!.target).toBe(40);
  });

  const hache = (): Weapon => ({ ...unarmedWeapon(), unarmed: undefined, builtinId: undefined, qualities: [], uid: 'hache', label: 'Hache', subType: 'base', damage: { plusBF: true, flat: 4 } } as Weapon);

  it('avec une arme choisie, le Test suit sa Spécialisation : Base +10, Escrime +20 → cible 50 (EDO 11 l.93)', () => {
    const h = heros({ skills: [cc('base', 10), cc('escrime', 20)], weapons: [hache(), unarmedWeapon()] });
    banc.setState({ battle: null, party: [h], pendingForceDoor: null, pendingCascade: null, suspendedCascades: [], flags: {} } as never);
    banc.getState().enfoncerLaPorte({ label: 'Porte', doorBE: 0, doorB: 10, heroIds: [h.id] });
    banc.getState().jetRegler('enfoncerLaPorte', 'arme', 'hache', h.id);
    banc.getState().jetLancer('enfoncerLaPorte', h.id);
    expect(banc.getState().pendingForceDoor!.participants[0].result!.target).toBe(50);
  });

  it('dégâts : hache +BF+4, BF 4, DR 2 → 2 + ⌊8/2⌋ = 6 ; mains nues, DR 2, BF 4 → 6 ; BE retranché', () => {
    const h = heros({ characteristics: { force: 40 } as Combatant['characteristics'] });
    expect(degatsDEnfoncement(h, hache(), 2, 0)).toBe(6);
    expect(degatsDEnfoncement(h, undefined, 2, 0)).toBe(6);
    expect(degatsDEnfoncement(h, { ...hache(), damage: { plusBF: true, flat: 5 } } as Weapon, 2, 4)).toBe(2);
  });

  it('la porte cède quand la somme du Round atteint ses Blessures restantes, et tient sinon', () => {
    const coups = (...d: number[]) => ({ label: 'P', doorBE: 4, doorB: 5, doorBmax: 5,
      participants: d.map((damage, i) => ({ id: `h${i}`, interactive: true, result: { roll: 10, target: 40, sl: 3, damage } })) });
    expect(bilanDuRound(coups(3, 2))).toEqual({ degats: 5, reste: 0, cede: true, complet: true });
    expect(bilanDuRound(coups(3, 1))).toEqual({ degats: 4, reste: 1, cede: false, complet: true });
  });
});

describe('Chanson de marin (MDG 09 l.38)', () => {
  it('trois minutes plus le DR', () => {
    expect(dureeDeChanson(0)).toBe(3);
    expect(dureeDeChanson(4)).toBe(7);
  });
});

describe('Lignes des jets de manœuvre', () => {
  it('Vomissement : Facile (+40) — CT 40 → cible 80 (LDB 85 l.445)', () => {
    const l = ligneDAttaquantDeManoeuvre(heros(), 'capacite-de-tir', 'facile');
    expect([l.difficulty, l.target]).toEqual(['facile', 80]);
  });

  it('Corps à corps brut : la valeur suit l’arme en main — hallebarde sans Armes d’hast, Base +10 → cible 40', () => {
    const hallebarde = { ...unarmedWeapon(), unarmed: undefined, builtinId: undefined, qualities: [], uid: 'hal', label: 'Hallebarde', subType: 'armes-d-hast' } as Weapon;
    const h = heros({ skills: [cc('base', 10)], weapons: [hallebarde, unarmedWeapon()] });
    expect(ligneDeCorpsACorpsBrut(h).target).toBe(40);
  });
});

describe('Distraire (LDB 10 l.364) et Esquive du désengagement', () => {
  it('Test opposé ordinaire : Athlétisme Agilité 40 +10, Sonné 1 → cible 40 ; Calme FM 30 +5 → 35', () => {
    const h = heros({ characteristics: { agilite: 40, 'force-mentale': 30 } as Combatant['characteristics'],
      skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 10 } as SkillInstance, { id: 'calme', characteristic: 'force-mentale', advances: 5 } as SkillInstance],
      conditions: [{ id: 'sonne', value: 1 }] });
    expect(ligneDeDistraire(h).target).toBe(40);
    expect(distraireAttackValue(h)).toBe(40);
    expect(ligneDuCalmeDistrait({ ...h, conditions: [] }).target).toBe(35);
  });

  it('l’Esquive du désengagement porte les lignes d’Esquive du contexte : monté → −20 (LDB 14 l.184)', () => {
    const h = heros({ characteristics: { agilite: 40 } as Combatant['characteristics'], mountId: 'cheval' });
    expect(ligneDEsquiveDeDesengagement({ scene: null, gameTime: 0 } as never, h).target).toBe(20);
  });
});
