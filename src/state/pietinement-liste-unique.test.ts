/**
 * Le Piétinement est UNE manœuvre (`maneuvers.json` `pietinement`), ouverte par l'écart de Taille à tout
 * combattant, porteur du trait Taille ou non, héros compris ; une seule liste de gratuites
 * (`attaquesNaturelles`) alimente la barre d'attaques, la porte d'action et la file de l'IA.
 * LDB 85 l.387 ; LDB 85 l.344 ; LDB 85 l.350-351 ; LDB 85 l.314 — #1765.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { aiCreatureFreeAttacks } from '../noyau/combatFlow';
import { availableAttacks } from '../noyau/combatManeuvers';
import { ACTION_GATES } from '../noyau/actionRegistry';
import { createHero } from '../engine/character';
import { findManeuverById } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';
import type { TraitList } from '../engine/statEntry';

const g = () => useGame.getState();
const PIETINEMENT = findManeuverById('pietinement')!;

/** Héros au contact d'un ennemi ; le tour est donné à `tourDe`. */
function engage(tourDe: 'heros' | 'creature', o: { tailleE: SizeCategory; tailleH: SizeCategory; traitsE?: TraitList; traitsH?: TraitList; movementUsed?: number; advantageE?: number }): { H: Combatant; E: Combatant } {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  g().seedRng(2);
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies[0];
  H.pos = { x: 10, y: 10 }; E.pos = { x: 11, y: 10 };
  E.size = o.tailleE; E.traits = o.traitsE ?? [];
  H.size = o.tailleH; H.traits = o.traitsH ?? [];
  E.characteristics['capacite-de-combat'] = 85; E.advantage = o.advantageE ?? 6;
  H.advantage = 6;
  H.wounds = { current: 200, max: 200, base: 200 } as never;
  H.conditions = [{ id: 'surpris', value: 1 }] as never;
  const porteur = tourDe === 'heros' ? H : E;
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(porteur.id), action: null, movementUsed: o.movementUsed ?? 0, acted: false } });
  return { H, E };
}

const optionDe = (c: Combatant) => availableAttacks(c, g().battle!).find((o) => o.id === PIETINEMENT.id);
const porteOuverte = (c: Combatant) => ACTION_GATES['pietinement-gratuit']({ active: c, battle: g().battle! }).ok;

/** L'IA de `E` joue ses gratuites ; rend le nombre de Piétinements déclarés, les Blessures infligées et le
 *  solde d'Avantage de `E` (payé moins gagné). */
function fileIA(H: Combatant, E: Combatant): { compteur: number; blessures: number; avantagePaye: number } {
  const avant = H.wounds.current;
  const avantageAvant = E.advantage;
  aiCreatureFreeAttacks(g, useGame.setState, E);
  return { compteur: E.freeAttacksThisTurn?.pietinement ?? 0, blessures: avant - H.wounds.current, avantagePaye: avantageAvant - E.advantage };
}

describe('Piétinement : une manœuvre, une liste de gratuites', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingAttack: null, pendingDefense: null, pendingCascade: null });
  });

  it('porteur de Taille plus grand : UN Piétinement par tour, les Blessures d’UN coup', () => {
    const sansTrait = engage('creature', { tailleE: 'enorme', tailleH: 'moyenne' });
    const temoin = fileIA(sansTrait.H, sansTrait.E);
    const { H, E } = engage('creature', { tailleE: 'enorme', tailleH: 'moyenne', traitsE: [{ id: 'taille', arg: 'Énorme' }] });
    const porteur = fileIA(H, E);
    expect(porteur.compteur, 'un seul Piétinement déclaré').toBe(1);
    expect(temoin.blessures, 'précondition : le coup témoin porte').toBeGreaterThan(0);
    expect(porteur.blessures, 'les Blessures d’un coup, comme sans le trait').toBe(temoin.blessures);
    expect(porteur.avantagePaye, 'le solde d’Avantage d’un coup, comme sans le trait').toBe(temoin.avantagePaye);
  });

  it.each([
    { cas: 'face à plus grand', tailleE: 'moyenne', tailleH: 'grande' },
    { cas: 'face à même Taille', tailleE: 'moyenne', tailleH: 'moyenne' },
  ] as const)('porteur de Taille $cas : ni option, ni porte, ni Piétinement de l’IA', ({ tailleE, tailleH }) => {
    const { H, E } = engage('creature', { tailleE, tailleH, traitsE: [{ id: 'taille', arg: 'Moyenne' }] });
    expect(optionDe(E), 'aucune option').toBeUndefined();
    expect(porteOuverte(E), 'porte fermée').toBe(false);
    expect(fileIA(H, E).compteur).toBe(0);
  });

  it('créature plus grande SANS trait : l’option existe, au coût de la manœuvre', () => {
    const { E } = engage('creature', { tailleE: 'enorme', tailleH: 'moyenne' });
    expect(optionDe(E)?.cost.advantage).toBe(PIETINEMENT.advantageCost);
    expect(porteOuverte(E)).toBe(true);
  });

  it('héros Grand face à plus petit : l’option existe, au coût de la manœuvre, nommée par elle', () => {
    const { H } = engage('heros', { tailleE: 'moyenne', tailleH: 'grande' });
    const option = optionDe(H);
    expect(option?.cost.advantage).toBe(PIETINEMENT.advantageCost);
    expect(option?.label).toBe(PIETINEMENT.label);
    expect(porteOuverte(H)).toBe(true);
  });

  it('Se cabrer, Mouvement inutilisé : le Piétinement coûte l’Action de Mouvement', () => {
    const { H } = engage('heros', { tailleE: 'moyenne', tailleH: 'grande', traitsH: [{ id: 'se-cabrer' }] });
    expect(optionDe(H)?.cost).toEqual({ action: false, advantage: 0, movement: true });
  });

  it('Se cabrer, file de l’IA : Mouvement entier payé en Mouvement, Mouvement entamé payé 1 Avantage', () => {
    const entier = engage('creature', { tailleE: 'grande', tailleH: 'moyenne', traitsE: [{ id: 'se-cabrer' }], advantageE: 0 });
    expect(optionDe(entier.E)?.cost).toEqual({ action: false, advantage: 0, movement: true });
    const parMouvement = fileIA(entier.H, entier.E);
    expect(parMouvement.compteur).toBe(1);
    expect(g().battle!.movementUsed, 'le Mouvement est consommé').toBeGreaterThan(0);

    const entame = engage('creature', { tailleE: 'grande', tailleH: 'moyenne', traitsE: [{ id: 'se-cabrer' }], advantageE: 3, movementUsed: 4 });
    expect(optionDe(entame.E)?.cost).toEqual({ action: false, advantage: 1 });
    const parAvantage = fileIA(entame.H, entame.E);
    expect(parAvantage.compteur).toBe(1);
    expect(parAvantage.avantagePaye - parMouvement.avantagePaye, 'la voie ordinaire paie 1 Avantage de plus').toBe(1);
  });

  it('Se cabrer face à même Taille : ni option, ni Piétinement de l’IA', () => {
    const { H, E } = engage('creature', { tailleE: 'moyenne', tailleH: 'moyenne', traitsE: [{ id: 'se-cabrer' }] });
    expect(optionDe(E)).toBeUndefined();
    expect(fileIA(H, E).compteur).toBe(0);
  });
});
