import { describe, it, expect } from 'vitest';
import {
  traitCharMods, traitMovementMod, traitBonusWoundsBE, wardSaves,
  traitAuras,
  immunityTypes, isUnstable,
  bellicosePsychImmune, isMindless, isBestial, isColdBlooded, isStupid, hasRage,
  isTerritorial, flyMeters, runMultiplier, traitSeesInDark, mutationsAtSpawn,
} from './dispatch';
import { canCounterOnDefenseWin } from '../combatFeatures/dispatch';
import { traitSpellDRMod } from '../magic';
import { coldBloodedAdjust, isPsychImmune } from '../psychology';
import { attackModifiers } from '../combat';
import { traumaCharPenalties } from '../trauma';
import { effectiveChar } from '../characteristics';
import { effectiveMovement } from '../encumbrance';
import type { Combatant } from '../../engine/types';
import { statblockToCombatant, creatureToCombatant } from '../../state/spawn';
import { findCreatureById } from '../../data';

/** Lot C — Traits de créature (LDB 85). Tests PURS des helpers + dérivation de profil au spawn. */

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', label: 'C', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  } as Combatant;
}

describe('dispatch — parsing et prédicats (LDB 85)', () => {
  it('modificateurs de profil : Élite, Coriace, Brutal, Rapide, Rusé', () => {
    expect(traitCharMods([{ id: 'elite' }])).toEqual({ 'capacite-de-combat': 20, 'capacite-de-tir': 20, 'force-mentale': 20 });
    expect(traitCharMods([{ id: 'coriace' }, { id: 'brutal' }])).toEqual({ endurance: 20, 'force-mentale': 10, agilite: -10, force: 10 });
    expect(traitMovementMod([{ id: 'brutal' }])).toBe(-1);
    expect(traitMovementMod([{ id: 'rapide' }])).toBe(1);
    expect(traitCharMods([{ id: 'ruse' }])).toEqual({ sociabilite: 10, intelligence: 10, initiative: 10 });
    expect(traitBonusWoundsBE([{ id: 'endurant' }])).toBe(true);
  });
  it('sauvegardes : Démoniaque 8+, Protection 9', () => {
    expect(wardSaves([{ id: 'demoniaque', value: 8 }])).toEqual([8]);
    expect(wardSaves([{ id: 'protection', value: 9 }])).toEqual([9]);
    expect(wardSaves([{ id: 'arme', value: 8 }])).toEqual([]);
  });
  it('divers combat : Champion, Parasité, Perturbant, Instable', () => {
    expect(canCounterOnDefenseWin({ traits: [{ id: 'champion' }] } as never, undefined)).toBe(true); // Champion : sans condition d'arme
    // Perturbant : l'aura (−20 à BE m) vit en DONNÉE (`TraitData.aura`), projetée par le hook générique.
    const emitted = traitAuras([{ id: 'perturbant' }])[0];
    expect(emitted?.traitId).toBe('perturbant'); // le trait ÉMETTEUR voyage avec l'aura (il NOMME la pénalité chez la cible)
    expect(emitted?.aura.rangeChar).toBe('endurance');
    expect(emitted?.aura.passive).toEqual([{ op: 'testMod', amount: -20 }]);
    expect(isUnstable([{ id: 'instable' }])).toBe(true);
  });
  it('magie : Résistance à la Magie, Immunité (Poison)', () => {
    // Résistance à la Magie : op passive `incomingSpellDRMod` × Indice (le DR, plus les Blessures).
    expect(traitSpellDRMod(mk({ traits: [{ id: 'resistance-a-la-magie', value: 2 }] }))).toBe(-2);
    expect(traitSpellDRMod(mk({ traits: [{ id: 'resistance-a-la-magie' }] }))).toBe(-1); // Indice absent → 1 (donnée naine)
    expect(immunityTypes([{ id: 'immunite', arg: 'Poison' }])).toEqual(['poison']);
  });
  it('psy/IA : Bestial, À sang-froid, Stupide, Rage, Territorial, Fabriqué', () => {
    expect(isBestial([{ id: 'bestial' }])).toBe(true);
    expect(isColdBlooded([{ id: 'a-sang-froid' }])).toBe(true); // casse de la donnée
    expect(isStupid([{ id: 'stupide' }])).toBe(true);
    expect(hasRage([{ id: 'rage' }])).toBe(true);
    expect(isTerritorial([{ id: 'territorial' }])).toBe(true);
    expect(isMindless([{ id: 'fabrique' }])).toBe(true);
  });
  it('mouvement & vision : Vol, Bond/Foulée, Vision nocturne/Infravision, Furtif', () => {
    expect(flyMeters([{ id: 'vol', value: 100 }])).toBe(100);
    expect(flyMeters([{ id: 'foulee' }])).toBeNull();
    expect(runMultiplier([{ id: 'bond' }])).toBe(2);
    expect(runMultiplier([{ id: 'foulee' }])).toBe(1.5);
    expect(runMultiplier([{ id: 'bond' }, { id: 'foulee' }])).toBe(2); // Bond prime
    expect(runMultiplier([{ id: 'rampant' }])).toBe(0); // Rampant (MSRC) : aucune Action de Course
    expect(traitSeesInDark([{ id: 'vision-nocturne' }])).toBe(true);
    expect(traitSeesInDark([{ id: 'infravision' }])).toBe(true);
    expect(mutationsAtSpawn([{ id: 'mutation' }, { id: 'corruption-mentale' }])).toEqual([{ kind: 'physique', mutationId: undefined }, { kind: 'mentale', mutationId: undefined }]);
    // Mutation EXPLICITE (tell figé en donnée) : l'argument d'auteur est résolu en id stable (slugId).
    expect(mutationsAtSpawn([{ id: 'mutation', arg: 'Cornes asymétriques' }])).toEqual([{ kind: 'physique', mutationId: 'cornes-asymetriques' }]);
  });
});

describe('spawn — profil dérivé des statblocks d’éditeur (LDB 77 « ajoutez les Traits »)', () => {
  it('Élite +20 CC/CT/FM, Brutal −1 M — appliqués en DIRECT (characteristics = base, effectiveChar = final)', () => {
    const c = statblockToCombatant({ name: 'Vétéran', char: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, 'force-mentale': 30, M: 4 }, traits: [{ id: 'elite' }, { id: 'brutal' }] } as any, 'e1', { x: 0, y: 0 });
    expect(c.characteristics['capacite-de-combat']).toBe(30); // BASE (les traits ne sont plus cuits dans characteristics)
    expect(c.liveTraits).toEqual([{ id: 'elite' }, { id: 'brutal' }]);
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(50); // 30 + Élite 20 (en direct via le collecteur passif)
    expect(effectiveChar(c, 'force-mentale')).toBe(50);
    expect(effectiveChar(c, 'force')).toBe(40); // Brutal +10 F
    expect(effectiveMovement(c)).toBe(3); // Brutal −1 M
  });
  it('Endurant : +BE Blessures (formule)', () => {
    const sans = statblockToCombatant({ name: 'A', char: { endurance: 30 }, traits: [] } as any, 'e2', { x: 0, y: 0 });
    const avec = statblockToCombatant({ name: 'B', char: { endurance: 30 }, traits: [{ id: 'endurant' }] } as any, 'e3', { x: 0, y: 0 });
    expect(avec.wounds.max - sans.wounds.max).toBe(3);
  });
  it('bestiaire : trait de profil INHÉRENT non ré-appliqué (profil imprimé FINAL → zéro double-compte)', () => {
    // Le bonus de profil d'un trait INHÉRENT (Bella la Noire : Brutal +10 F) est déjà cuit dans creatures.json ;
    // un spawn normal ne met PAS les traits inhérents dans `liveTraits` → le collecteur ne les ré-applique pas.
    const def = findCreatureById('bella-la-noire')!;
    const c = creatureToCombatant(def, 'b', { x: 0, y: 0 });
    expect(c.liveTraits).toBeUndefined(); // traits inhérents PAS « en direct »
    expect(effectiveChar(c, 'force')).toBe(def.char.force as number); // 41 = imprimé ; Brutal +10 NON re-compté (sinon 51)
  });
  it('Fabriqué → immunité psychologique ; Mutation → mutation tirée (graine stable)', () => {
    const c = statblockToCombatant({ name: 'Golem', char: {}, traits: [{ id: 'fabrique' }, { id: 'mutation' }] } as any, 'e4', { x: 0, y: 0 });
    expect(c.psychImmune).toBe(true);
    expect(c.mutations?.length).toBe(1);
    expect(c.mutations![0].kind).toBe('physique');
    // Déterminisme : même id → même mutation.
    const c2 = statblockToCombatant({ name: 'Golem', char: {}, traits: [{ id: 'fabrique' }, { id: 'mutation' }] } as any, 'e4', { x: 0, y: 0 });
    expect(c2.mutations![0].label).toBe(c.mutations![0].label);
  });
});

describe('câblages moteur', () => {
  it('Parasité : −10 pour toucher en mêlée (attackModifiers)', () => {
    const atk = mk({ id: 'a' });
    const tgt = mk({ id: 't', traits: [{ id: 'parasite' }] });
    const mods = attackModifiers(atk, tgt, { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }, { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Parasité')?.value).toBe(-10);
  });
  it('À sang-froid : un Test de FM raté est inversé s’il devient réussi', () => {
    expect(coldBloodedAdjust({ roll: 91, target: 40, success: false, sl: -5 }, true).success).toBe(true); // 91 → 19
    expect(coldBloodedAdjust({ roll: 99, target: 40, success: false, sl: -5 }, true).success).toBe(false); // 99 → 99
    expect(coldBloodedAdjust({ roll: 91, target: 40, success: false, sl: -5 }, false).success).toBe(false);
  });
  it('Belliqueux : immunité psy si plus d’Avantages que l’adversaire', () => {
    const c = mk({ traits: [{ id: 'belliqueux' }], advantage: 2 });
    expect(bellicosePsychImmune(c, 1)).toBe(true);
    expect(bellicosePsychImmune(c, 2)).toBe(false);
    expect(isPsychImmune(c, 1)).toBe(true);
    expect(isPsychImmune(c)).toBe(false); // sans contexte d'adversaire, le trait est inerte
  });
  it('Insensible à la douleur : pénalités de Critique ignorées (hors amputations)', () => {
    const t = { label: 'Déchirure musculaire (Majeure)', location: 'jambeG', ops: [{ op: 'charMod', char: 'agilite', mod: -10 }] } as any;
    const douillet = mk({ traumas: [t] });
    const stoique = mk({ traumas: [t], traits: [{ id: 'insensible-a-la-douleur' }] });
    expect(traumaCharPenalties(douillet, 'agilite')).toEqual([-10]);
    expect(traumaCharPenalties(stoique, 'agilite')).toEqual([]);
    // … mais une AMPUTATION reste pénalisante (LDB 85 l.195) — keyée par `traumaId` (`doigt-ampute`
    // porte `amputation: true` dans `traumas.json`), jamais par le `label`.
    const ampute = mk({ traumas: [{ label: 'Doigts amputés', traumaId: 'doigt-ampute', location: 'brasD', ops: [{ op: 'charMod', char: 'capacite-de-combat', mod: -5 }] } as any], traits: [{ id: 'insensible-a-la-douleur' }] });
    expect(traumaCharPenalties(ampute, 'capacite-de-combat')).toEqual([-5]);
  });
});
