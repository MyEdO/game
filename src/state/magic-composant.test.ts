/**
 * Composants d'incantation (LDB 46 l.107-113, règle optionnelle `magic-composant`) :
 *  - l.111 : « toute Incantation Imparfaite Majeure devient Mineure, et aucune Incantation
 *    Imparfaite Mineure n'a d'effet » ; le composant est « consumé ou détruit […], même si aucune
 *    Incantation Imparfaite n'a été obtenue » ;
 *  - l.113 : composants = Sorts d'Arcane et de Domaine, coût NI pistoles d'argent, par Sort.
 *
 * On pilote directement `applyMiscast` (gate de dégradation, façon miscast.test.ts) ET la
 * consommation au point d'incantation via `useSpellComponent`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { avanceEtapeCascade } from './cascadeTestKit';
import { applyMiscast, useSpellComponent } from './combatFlow';
import { setRule, resetRule } from '../engine/policy';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { creatureToCombatant } from './spawn';
import { findCreatureById } from '../data';

const SPELL = 'mur-de-feu'; // un id de Sort de Domaine réel (Feu) — couvert par un composant

function mageInBattle() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  return b.combatants.find((c) => c.kind === 'hero')!;
}

describe('Composants d’incantation (LDB 46 l.107-113)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
    useGame.getState().seedRng(2);
  });
  afterEach(() => {
    resetRule('magic-composant');
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('règle ON : un composant DÉGRADE une Imparfaite Majeure en Mineure (le contrecoup est joué une Mineure)', () => {
    setRule('magic-composant', true);
    const hero = mageInBattle();
    hero.componentSpells = [SPELL];
    useGame.setState({ pendingCascade: null });
    // useSpellComponent consomme le composant et signale la dégradation (componentDowngrade=true).
    const lines: string[] = [];
    const used = useSpellComponent(hero, SPELL, lines);
    expect(used).toBe(true);
    expect(hero.componentSpells).toEqual([]); // consommé
    const out = applyMiscast(useGame.getState, useGame.setState, hero, 'majeure', { componentDowngrade: used });
    expect(out.some((l) => /Majeure → Mineure/.test(l))).toBe(true);
    // L'Imparfaite jouée est une Mineure : sa table est l'étape ouverte, sa révélation vient après le dé.
    expect(useGame.getState().pendingCascade!.participants[0].table!.tableId).toBe('miscast-mineure');
    avanceEtapeCascade(useGame.getState);
    const step = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'miscast');
    expect(step?.label).toBe('Imparfaite');
  });

  it('règle ON : un composant ANNULE une Imparfaite Mineure (aucun effet, aucune table)', () => {
    setRule('magic-composant', true);
    const hero = mageInBattle();
    hero.componentSpells = [SPELL];
    useGame.setState({ pendingCascade: null });
    const lines: string[] = [];
    const used = useSpellComponent(hero, SPELL, lines);
    const out = applyMiscast(useGame.getState, useGame.setState, hero, 'mineure', { componentDowngrade: used });
    expect(out.some((l) => /aucun effet/.test(l))).toBe(true);
    expect(useGame.getState().pendingCascade).toBeNull(); // aucune Imparfaite ouverte
    expect(hero.componentSpells).toEqual([]); // consommé quand même
  });

  it('composant consumé même sans Imparfaite (RAW « même si aucune Imparfaite n’a été obtenue »)', () => {
    setRule('magic-composant', true);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    hero.componentSpells = [SPELL];
    const lines: string[] = [];
    const used = useSpellComponent(hero, SPELL, lines);
    expect(used).toBe(true);
    expect(hero.componentSpells).toEqual([]); // consommé à l'incantation, hors de tout contrecoup
    expect(lines.some((l) => /consumé/.test(l))).toBe(true);
  });

  it('règle OFF : aucune dégradation, le composant n’est pas touché (Imparfaite pleine)', () => {
    resetRule('magic-composant'); // défaut = off
    const hero = mageInBattle();
    hero.componentSpells = [SPELL];
    useGame.setState({ pendingCascade: null });
    const lines: string[] = [];
    const used = useSpellComponent(hero, SPELL, lines);
    expect(used).toBe(false); // règle off → pas de consommation
    expect(hero.componentSpells).toEqual([SPELL]); // intact
    const out = applyMiscast(useGame.getState, useGame.setState, hero, 'majeure', { componentDowngrade: used });
    expect(out.some((l) => /Majeure → Mineure/.test(l))).toBe(false); // pas de dégradation
    // Une Imparfaite Majeure PLEINE est ouverte : c'est la table Majeure que l'étape déclare.
    expect(useGame.getState().pendingCascade!.participants[0].table!.tableId).toBe('miscast-majeure');
    avanceEtapeCascade(useGame.getState);
    const step = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'miscast');
    expect(step?.label).toBe('Imparfaite');
  });

  it('règle ON mais PAS de composant pour ce sort : aucune dégradation', () => {
    setRule('magic-composant', true);
    const hero = mageInBattle();
    hero.componentSpells = ['un-autre-sort']; // composant pour un AUTRE sort
    useGame.setState({ pendingCascade: null });
    const lines: string[] = [];
    const used = useSpellComponent(hero, SPELL, lines);
    expect(used).toBe(false);
    expect(hero.componentSpells).toEqual(['un-autre-sort']); // intact (pas le bon sort)
    const out = applyMiscast(useGame.getState, useGame.setState, hero, 'mineure', { componentDowngrade: used });
    expect(out.some((l) => /aucun effet/.test(l))).toBe(false);
  });

  it('un ENNEMI GÉNÉRIQUE (sans `followsCharacterRules`) n’a jamais de composant', () => {
    setRule('magic-composant', true);
    mageInBattle();
    const enemy = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy')!;
    // #152 : la rencontre `enc-mutants` spawne le Mutant du bestiaire, désormais flagué
    // `followsCharacterRules` (PNJ humain) — ce cas isole le défaut « créature générique ».
    delete enemy.followsCharacterRules;
    enemy.componentSpells = [SPELL];
    const used = useSpellComponent(enemy, SPELL, []);
    expect(used).toBe(false);
    expect(enemy.componentSpells).toEqual([SPELL]); // intact
  });

  // #143 : le vrai prédicat RAW est « suit les règles de Personnage » (LDB 46 l.107-111), pas `kind === 'hero'`
  // — un ennemi MODÉLISÉ comme personnage (PNJ humain hostile, `followsCharacterRules`) achète/consume un
  // composant comme un héros ; une créature générique (le test ci-dessus) n'en a jamais.
  it('un ENNEMI PERSONNAGE (`followsCharacterRules`) consume un composant comme un héros', () => {
    setRule('magic-composant', true);
    mageInBattle();
    const enemy = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy')!;
    enemy.followsCharacterRules = true;
    enemy.componentSpells = [SPELL];
    const lines: string[] = [];
    const used = useSpellComponent(enemy, SPELL, lines);
    expect(used).toBe(true);
    expect(enemy.componentSpells).toEqual([]); // consommé
    expect(lines.some((l) => /consumé/.test(l))).toBe(true);
  });

  // #152 (suite #143) : le flag doit aussi profiter aux ennemis spawnés depuis le BESTIAIRE
  // (creatureToCombatant, réf de scène), pas seulement aux statblocs d'éditeur.
  it('#152 : un ennemi du BESTIAIRE flagué (CreatureData.followsCharacterRules, Cultiste) consume un composant', () => {
    setRule('magic-composant', true);
    const npc = creatureToCombatant(findCreatureById('cultiste')!, 'e1', { x: 0, y: 0 });
    npc.componentSpells = [SPELL];
    const lines: string[] = [];
    const used = useSpellComponent(npc, SPELL, lines);
    expect(used).toBe(true);
    expect(npc.componentSpells).toEqual([]); // consommé
  });

  it('#152 : une créature GÉNÉRIQUE du bestiaire (Orc, non flaguée) n’a jamais de composant', () => {
    setRule('magic-composant', true);
    const npc = creatureToCombatant(findCreatureById('orc')!, 'e1', { x: 0, y: 0 });
    npc.componentSpells = [SPELL];
    const used = useSpellComponent(npc, SPELL, []);
    expect(used).toBe(false);
    expect(npc.componentSpells).toEqual([SPELL]); // intact
  });

  it('la Colère des dieux n’est jamais dégradée (composants = Sorts, pas Prières — l.113)', () => {
    setRule('magic-composant', true);
    const hero = mageInBattle();
    const out = applyMiscast(useGame.getState, useGame.setState, hero, 'colere', { componentDowngrade: true });
    expect(out.some((l) => /Majeure → Mineure|aucun effet/.test(l))).toBe(false);
  });
});
