import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { traumaDodgePenalty, cannotWieldTwoHanded, amputationCombatPenalty } from '../engine/trauma';
import type { Combatant, ItemInstance } from '../engine/types';
import { objetDeTest } from '../engine/objetDeTest.testkit';
import { type SurchargeDObjet } from '../engine/objetDeTest.testkit';

const legSequela = { label: 'Membre inférieur amputé (jambeD)', location: 'jambeD' as const, ops: [{ op: 'moveScale' as const, num: 1, den: 2 }, { op: 'skillMod' as const, skill: { id: 'esquive' }, mod: -20 }], prosthesis: [{ trappingId: 'fausse-jambe', cancels: 'movement' as const }] };
const fausseJambe = (over: SurchargeDObjet = {}): ItemInstance => objetDeTest({ uid: 'fj', trappingId: 'fausse-jambe', kind: 'misc', subType: 'Prothèses', qualities: [], enc: 2, equipped: true, ...over });

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', label: 'Manchot', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    traumas: [legSequela], items: [fausseJambe()], ...p,
  } as Combatant);

describe('trainProsthesis — rachat PX en 2 paliers de la Fausse jambe (LDB 73 l.23)', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration' }); });

  it('100 PX (1er palier, Mouvement) : marque prosthesisMoveTrained, l’Esquive reste pénalisée', () => {
    const h = hero({ id: 'a', xp: 300 });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(200); // 300 − 100
    const it = p.items!.find((i) => i.uid === 'fj')!;
    expect(it.prosthesisMoveTrained).toBe(true);
    expect(it.prosthesisTrained).toBeFalsy();
    expect(traumaDodgePenalty(p)).toBe(-20); // Esquive toujours pénalisée : palier Esquive non franchi
  });

  it('200 PX (2e palier, Esquive) : une fois le Mouvement déjà entraîné, rétablit AUSSI l’Esquive', () => {
    const h = hero({ id: 'a', xp: 250, items: [fausseJambe({ prosthesisMoveTrained: true })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(50); // 250 − 200
    expect(p.items!.find((i) => i.uid === 'fj')!.prosthesisTrained).toBe(true);
    expect(traumaDodgePenalty(p)).toBe(0);
  });

  it('achats séquentiels : deux appels (100 PX puis 200 PX) mènent au plein entraînement', () => {
    const h = hero({ id: 'a', xp: 300 });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj'); // 1er palier : 100 PX
    useGame.getState().trainProsthesis('a', 'fj'); // 2e palier : 200 PX
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(0); // 300 − 100 − 200
    const it = p.items!.find((i) => i.uid === 'fj')!;
    expect(it.prosthesisMoveTrained).toBe(true);
    expect(it.prosthesisTrained).toBe(true);
    expect(traumaDodgePenalty(p)).toBe(0);
  });

  it('PX insuffisants pour le 1er palier (100 PX) : aucun changement', () => {
    const h = hero({ id: 'a', xp: 50 });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(50);
    expect(p.items!.find((i) => i.uid === 'fj')!.prosthesisMoveTrained).toBeFalsy();
  });

  it('PX insuffisants pour le 2e palier (200 PX) une fois le Mouvement acquis : aucun changement', () => {
    const h = hero({ id: 'a', xp: 150, items: [fausseJambe({ prosthesisMoveTrained: true })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(150);
    expect(p.items!.find((i) => i.uid === 'fj')!.prosthesisTrained).toBeFalsy();
  });

  it('déjà pleinement entraînée (200 PX) : nouvel appel ne fait rien', () => {
    const h = hero({ id: 'a', xp: 300, items: [fausseJambe({ prosthesisMoveTrained: true, prosthesisTrained: true })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    expect(useGame.getState().party[0].xp).toBe(300);
  });

  it('prothèse non portée : refus', () => {
    const h = hero({ id: 'a', xp: 300, items: [fausseJambe({ equipped: false })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    expect(useGame.getState().party[0].xp).toBe(300); // inchangé
  });

  /** Crochet — rachat GRADUÉ, LDB 73 l.19 verbatim : « vous pouvez racheter la pénalité de -20 à tous les
   *  Tests impliquant deux mains pour 100 PX pour chaque tranche de 5, soustraite de la pénalité, retirant
   *  la pénalité entière pour 400 PX ». 4 paliers DÉCLARÉS (`TrappingData.prosthesisTraining`). */
  it('Crochet : chaque tranche de 100 PX rachète 5 points de la pénalité de main perdue', () => {
    const crochet: ItemInstance = objetDeTest({ uid: 'cr', trappingId: 'crochet', kind: 'misc', subType: 'Prothèses', qualities: [], enc: 1, equipped: true });
    const main = { label: 'Main', traumaId: 'main-bras-ampute', location: 'brasD' as const, ops: [{ op: 'maxWeaponHands' as const, hands: 1 }] };
    const arme = { label: 'Épée', hands: 1, hand: 'main' } as never;
    const h = hero({ id: 'a', xp: 500, traumas: [main], items: [crochet] });
    useGame.setState({ party: [h] });
    expect(amputationCombatPenalty(useGame.getState().party[0], arme)).toBe(-20); // avant tout rachat
    useGame.getState().trainProsthesis('a', 'cr'); // 1re tranche : 100 PX
    expect(useGame.getState().party[0].xp).toBe(400);
    expect(amputationCombatPenalty(useGame.getState().party[0], arme)).toBe(-15);
    useGame.getState().trainProsthesis('a', 'cr'); // 2e tranche
    expect(amputationCombatPenalty(useGame.getState().party[0], arme)).toBe(-10);
  });

  it('Crochet : les 4 tranches (400 PX) retirent la pénalité ENTIÈRE et rétablissent les armes à deux mains', () => {
    const crochet: ItemInstance = objetDeTest({ uid: 'cr', trappingId: 'crochet', kind: 'misc', subType: 'Prothèses', qualities: [], enc: 1, equipped: true });
    const arme = { label: 'Épée', hands: 1, hand: 'main' } as never;
    const h = hero({ id: 'a', xp: 500, traumas: [{ label: 'Main', traumaId: 'main-bras-ampute', location: 'brasD', ops: [{ op: 'maxWeaponHands' as const, hands: 1 }] }], items: [crochet] });
    useGame.setState({ party: [h] });
    expect(cannotWieldTwoHanded(useGame.getState().party[0])).toBe(true); // avant : pas d'arme à 2 mains
    for (let i = 0; i < 4; i++) useGame.getState().trainProsthesis('a', 'cr');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(100); // 500 − 4×100
    expect(amputationCombatPenalty(p, arme)).toBe(0); // pénalité entière rachetée
    expect(cannotWieldTwoHanded(p)).toBe(false); // crochet maîtrisé → 2 mains de nouveau possibles
    useGame.getState().trainProsthesis('a', 'cr'); // plus aucun palier : rien ne se passe
    expect(useGame.getState().party[0].xp).toBe(100);
  });
});
