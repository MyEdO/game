import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { subirDesAttaques } from './combatFlow';
import { bestDefenseMode } from './combatManeuvers';
import { imposerLesD100 } from './battleRng.testkit';
import { weaponFromTrait } from '../engine/creatureEquip';
import { blesseDeTest, combattantDeTest, type SurchargeDeCombattant } from '../engine/combattantDeTest.testkit';
import { hasCondition } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import type { TraitInstance } from '../engine/statEntry';

/**
 * UNE SÉRIE D'ATTAQUES SUBIE HORS BATAILLE (`subirDesAttaques`, #1652 lot 12a) — MDG 15 l.161, l.176 : « il subit
 * 1d10 attaques avec CC 35 et le Trait Arme +5 ». Banc du noyau sans bataille (`battle: null`) ; chaque touche suit
 * LDB 13 (double → Critique), LDB 18 l.17 (dépassement), LDB 17 l.29 (Destin), LDB 16 l.113 (cible sans défense).
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => { vi.restoreAllMocks(); });

const ARME: TraitInstance = { id: 'arme', value: 5 };
const MALADIE: TraitInstance = { id: 'maladie', arg: 'fievre-du-rongeur' };

const rats = (traits: TraitInstance[] = [ARME]): Combatant => combattantDeTest({
  id: 'rats', label: 'Rats géants', kind: 'enemy', characteristics: { 'capacite-de-combat': 35 },
  traits, weapons: [weaponFromTrait(ARME)!],
});

/** Le héros `over`, seul du groupe, hors bataille ; `aiControlled` : aucun siège ne tient sa défense ; `restantes` :
 *  ses Points de Blessure, au maximum par défaut. */
function poser(over: SurchargeDeCombattant = {}, restantes?: number): Combatant {
  const o: SurchargeDeCombattant = { id: 'h', label: 'Héros', kind: 'hero', fate: 0, ...over };
  const h = restantes == null ? combattantDeTest(o) : blesseDeTest(restantes, o);
  banc.setState({ party: [h], battle: null, pendingDefense: null, pendingCascade: null, pendingFateSave: null });
  return h;
}
const heros = (): Combatant => banc.getState().party.find((c) => c.id === 'h')!;

describe('Attaques subies hors bataille — la touche (MDG 15 l.161)', () => {
  it('(a) une touche sur un double donne une Blessure critique (LDB 13)', () => {
    poser({ aiControlled: true });
    imposerLesD100(11, 99, 50, 10); // attaque 11 (double réussi), défense 99, Localisation relancée, sévérité
    subirDesAttaques(banc.getState, banc.setState, 'h', rats(), 1);
    expect(heros().criticalWounds).toBe(1);
  });

  it('(b) le dépassement donne une Blessure critique (LDB 18 l.17)', () => {
    poser({ aiControlled: true }, 1);
    imposerLesD100(21, 99, 10); // attaque 21 (réussie, pas un double), défense 99, sévérité
    subirDesAttaques(banc.getState, banc.setState, 'h', rats(), 1);
    expect(heros().wounds.current).toBe(0);
    expect(heros().criticalWounds).toBe(1);
  });

  for (const fate of [1, 0]) {
    it(`(c) Critique mortel : ${fate ? 'le Destin se suspend (`pendingFateSave`)' : 'sans Destin, la mort (`dead`)'} (LDB 17 l.29)`, () => {
      poser({ aiControlled: true, fate });
      imposerLesD100(11, 99, 1, 100); // double réussi, défense ratée, Tête, sévérité 100
      subirDesAttaques(banc.getState, banc.setState, 'h', rats(), 1);
      expect(banc.getState().pendingFateSave?.heroId ?? null).toBe(fate ? 'h' : null);
      expect(!!heros().dead).toBe(!fate);
    });
  }

  it('(d) une victime tombée Inconsciente en cours de série subit la suite sans défense (LDB 16 l.113)', () => {
    poser({ aiControlled: true, conditions: [{ id: 'hemorragique', value: 1 }] }, 1);
    // 1re : attaque 21, défense 99, sévérité 10 ; 2e (victime Inconsciente) : attaque sans jet de défense, Critique.
    imposerLesD100(21, 99, 10, 90, 10, 10);
    subirDesAttaques(banc.getState, banc.setState, 'h', rats(), 2);
    expect(hasCondition(heros(), 'inconscient')).toBe(true);
    expect(heros().criticalWounds, 'la 2e attaque, sans défense, porte ses Blessures critiques (`compteDuCoup`)').toBeGreaterThanOrEqual(2);
  });

  for (const [traits, expose] of [[[ARME, MALADIE], true], [[ARME], false]] as const) {
    it(`(e) assaillant ${expose ? 'porteur' : 'sans'} du Trait Maladie : la victime blessée ${expose ? 'est' : "n'est pas"} exposée`, () => {
      poser();
      imposerLesD100(21, 99); // attaque réussie, défense ratée : la touche blesse
      subirDesAttaques(banc.getState, banc.setState, 'h', rats([...traits]), 1);
      banc.getState().jetLancer('defense');
      banc.getState().jetValider('defense');
      expect(heros().wounds.current).toBeLessThan(heros().wounds.max);
      const bande = banc.getState().pendingCascade?.participants.some((p) => p.id.startsWith('infection-h-') && p.id.endsWith('fievre-du-rongeur'));
      expect(!!bande).toBe(expose);
    });
  }
});

describe('Attaques subies hors bataille — la défense est une étape de la porte', () => {
  it('(f) défenseur surfacé : une fenêtre par attaque, mode choisissable, `bestDefenseMode` par défaut', () => {
    const h = poser();
    subirDesAttaques(banc.getState, banc.setState, 'h', rats(), 2);
    const pd = banc.getState().pendingDefense!;
    expect(pd.mode).toBe(bestDefenseMode(h));
    expect(pd.suite).toMatchObject({ mode: 'subie', restantes: 1 });
    const casc = banc.getState().pendingCascade!;
    expect(casc.participants[casc.cursor].jet).toBe('defense');
    banc.getState().jetRegler('defense', 'reaction', 'esquive');
    expect(banc.getState().pendingDefense!.mode).toBe('esquive');
    banc.getState().jetLancer('defense');
    banc.getState().jetValider('defense');
    expect(banc.getState().pendingDefense!.suite).toMatchObject({ mode: 'subie', restantes: 0 });
    banc.getState().jetLancer('defense');
    banc.getState().jetValider('defense');
    expect(banc.getState().pendingDefense).toBeNull();
  });

  it('(f) défenseur non surfacé (`jetSurfaced` faux) : aucune fenêtre, sa défense `bestDefenseMode` se joue et pare', () => {
    poser({ aiControlled: true, characteristics: { 'capacite-de-combat': 95 }, weapons: [weaponFromTrait({ id: 'arme', value: 3 })!] });
    imposerLesD100(30, 5); // attaque 30 (DR 0), parade 05 (DR 9) : la défense l'emporte
    subirDesAttaques(banc.getState, banc.setState, 'h', rats(), 1);
    expect(banc.getState().pendingDefense).toBeNull();
    expect(heros().wounds.current).toBe(heros().wounds.max);
  });
});
