import { describe, it, expect } from 'vitest';
import { pickActiveModalKey as pick } from './ActiveModal';
import type { GameState } from '../state/store';
import { cascadeDeTest } from '../state/cascadeTestKit';
import type { Weapon } from '../engine/types';

/**
 * Arbitre de modales (R2, désormais REGISTRE state/modalArbiter) : une seule modale de combat à
 * la fois, par priorité explicite (ordre du registre). La file est implicite — une modale moins
 * prioritaire dont le `pending` est posé n'apparaît qu'une fois les plus prioritaires fermées.
 * Les tests passent des pendings MINCES (la forme suffit à l'arbitre), sauf l'étape-jet élue : son
 * corps (slot + acteurs présents au combat, `stateFields.sansCorps`) est celui que le jeu pose.
 */
// CLÉS contraintes à `keyof GameState` (un pending typo'd ou SUPPRIMÉ → erreur tsc), VALEURS libres
// (`unknown`) pour garder les pendings MINCES. L'ancien `s: object` + cast masquait toute faute de clé.
const pickActiveModalKey = (s: Partial<Record<keyof GameState, unknown>>) => pick(s as Parameters<typeof pick>[0]);
/** Le combat où vivent les acteurs des étapes-jets ci-dessous. */
const battle = { combatants: [{ id: 'h1' }, { id: 'e1' }] };
const defense = { attackerId: 'e1', defenderId: 'h1' };
const attaque = { attackerId: 'h1', targetId: 'e1' };
describe('pickActiveModalKey — priorité des modales de combat', () => {
  it('aucun pending → null', () => {
    expect(pickActiveModalKey({})).toBeNull();
  });

  it('un seul pending → sa modale', () => {
    expect(pickActiveModalKey({ pendingRenounce: {} })).toBe('renounce');
  });

  it('la défense n’est PLUS une modale propre : étape `jet:\'defense\'` de la cascade `combat` (wrapper-fold)', () => {
    // pendingDefense SEUL (sans cascade) → aucune entrée 'defense' → null. La SITUATION est portée
    // par la cascade-hôte ouverte par maybeOpenDefense (CascadeModal → useDefenseJetProps).
    expect(pickActiveModalKey({ pendingDefense: {} })).toBeNull();
    const defCascade = cascadeDeTest([{ id: 'd', kind: 'defenseJet', jet: 'defense', actorId: 'h1' }]);
    expect(pickActiveModalKey({ battle, pendingDefense: defense, pendingCascade: defCascade })).toBe('cascade');
    // Défense réactive (cascade) l'emporte sur le jet d'attaque du joueur : `cascade` avant `attack` au registre.
    expect(pickActiveModalKey({ battle, pendingDefense: defense, pendingCascade: defCascade, pendingAttack: attaque })).toBe('cascade');
  });

  it('la révélation n’est PLUS une modale propre : c’est une ÉTAPE d’AFFICHAGE de la cascade', () => {
    // Elle ne PRÉEMPTE plus rien par l’ordre du registre (#942 L8) : servie à son rang dans la
    // séquence, la clé rendue reste 'cascade' — même quand un pendingDefense coexiste.
    const revCascade = cascadeDeTest([{ id: 'r', kind: 'critical', reveal: { kind: 'critical', title: 'x', lines: [] }, actorId: 'h1' }]);
    expect(pickActiveModalKey({ pendingCascade: revCascade })).toBe('cascade');
    expect(pickActiveModalKey({ pendingDefense: {}, pendingCascade: revCascade })).toBe('cascade');
  });

  it('le sauvetage par Destin domine tout', () => {
    expect(
      pickActiveModalKey({ pendingFateSave: {}, pendingDefense: {}, pendingCascade: cascadeDeTest([{ id: 'r', kind: 'round', reveal: { kind: 'round', title: 'x', lines: [] } }]), pendingAttack: {} }),
    ).toBe('fateSave');
  });

  it('la Maladresse n’est PLUS une modale propre : étape `jet:\'fumble\'` de la cascade (passe avant la Corruption)', () => {
    // Sans cascade fumble → la Corruption l'emporte (la Maladresse n'existe QUE comme étape de cascade).
    expect(pickActiveModalKey({ pendingCorruption: {} })).toBe('corruption');
    // Cascade portant une étape `jet:'fumble'` (donnée SUR l'étape `step.fumble`) → 'cascade' (avant 'corruption').
    const fumbleCascade = cascadeDeTest([{ id: 'f', kind: 'fumbleJet', jet: 'fumble', actorId: 'h1', fumble: { weapon: {} as Weapon, result: null } }]);
    expect(pickActiveModalKey({ battle, pendingCascade: fumbleCascade, pendingCorruption: {} })).toBe('cascade');
  });

  it('Frappe Mortelle / 2ᵉ frappe (Deux armes) ne sont PLUS des modales (ciblage carte, TargetPrompt)', () => {
    expect(pickActiveModalKey({ pendingCleave: {} })).toBeNull();
    expect(pickActiveModalKey({ pendingDualStrike: {} })).toBeNull();
  });

  it('l’attaque n’est PLUS une modale propre : étape `jet:\'attack\'` de la cascade `combat` (charge/normale/gratuite + cleave/dual)', () => {
    // pendingAttack SEUL (sans cascade) → aucune entrée 'attack' → null. TOUS les chemins d'attaque
    // ouvrent une cascade (Charge incluse) ; cleave/dual réutilisent celle déjà ouverte.
    expect(pickActiveModalKey({ pendingAttack: {} })).toBeNull();
    const atkCascade = cascadeDeTest([{ id: 'a', kind: 'attackJet', jet: 'attack', actorId: 'h1' }]);
    expect(pickActiveModalKey({ battle, pendingAttack: attaque, pendingCascade: atkCascade })).toBe('cascade');
    // Acteurs absents du combat : l'étape n'a aucun corps à rendre, l'arbitre ne l'élit pas (`sansCorps`).
    expect(pickActiveModalKey({ pendingAttack: attaque, pendingCascade: atkCascade })).toBeNull();
    // Frappe Mortelle : la 2ᵉ frappe (pendingAttack) RÉUTILISE la cascade d'enchaînement → 'cascade'.
    expect(pickActiveModalKey({ battle, pendingCleave: {}, pendingAttack: attaque, pendingCascade: atkCascade })).toBe('cascade');
  });

  it('l’incantation n’est PLUS une modale propre : c’est une étape `jet:\'cast\'` de la cascade (wrapper-fold)', () => {
    // Un pendingCast SEUL (sans cascade) → l'arbitre ne renvoie plus 'cast' (entrée retirée).
    // La SITUATION est désormais portée par la cascade-hôte ouverte à l'incantation (CascadeModal → CastModal).
    expect(pickActiveModalKey({ pendingCast: {} })).toBeNull();
    // pendingCast + cascade `jet:'cast'` → l'arbitre renvoie 'cascade' (qui rend CastModal via le host).
    const castCascade = cascadeDeTest([{ id: 'c', kind: 'castJet', jet: 'cast', actorId: 'h1' }]);
    expect(pickActiveModalKey({ pendingCast: {}, pendingCascade: castCascade })).toBe('cascade');
    // Ciblage CARTE (Surincantation / pose de zone) : la carte prend la main, la fenêtre s'efface —
    // et c'est l'ARBITRE qui ne l'élit pas (#1852). Il n'élit JAMAIS une modale au corps vide : le
    // `null` rendu par le host sous une fenêtre déjà élue était un état mort (fiche mémoire
    // `game-modal-arbiter-dead-state`). La cascade, elle, reste OUVERTE : la fenêtre revient à la pose.
    expect(pickActiveModalKey({ pendingCast: { pickingTargets: true }, pendingCascade: castCascade })).toBeNull();
    expect(pickActiveModalKey({ pendingCast: { zone: { placing: true } }, pendingCascade: castCascade })).toBeNull();
  });

  it('le Contre-sort n’est PLUS une modale propre : la réaction est rendue DANS la cascade `cast` (Sort ennemi figé)', () => {
    // pendingCounterspell coexiste avec le pendingCast (+ cascade) du Sort ennemi → c'est la modale
    // `cascade` (→ CastModal) qui s'affiche (elle héberge les rangées de contre-lanceurs) : aucune entrée `counterspell`.
    const enemyCast = cascadeDeTest([{ id: 'c', kind: 'castJet', jet: 'cast', groupOwner: true }]);
    expect(pickActiveModalKey({ pendingCast: {}, pendingCascade: enemyCast, pendingCounterspell: { participants: [] } })).toBe('cascade');
    // Un pendingCounterspell SANS pendingCast/cascade (impossible en pratique) ne déclenche aucune modale.
    expect(pickActiveModalKey({ pendingCounterspell: { participants: [] } })).toBeNull();
  });
});
