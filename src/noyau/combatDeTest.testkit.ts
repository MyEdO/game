/**
 * Le duel de test des flux de combat (#2779, #2817) : un héros à fiche réelle (`createHero`) face au
 * premier ennemi de `enc-mutants`, au contact ((10,10)-(11,10)), les autres ennemis hors de combat, le
 * tour au héros. Le propriétaire de l'état (le store, `state/combatDeTest.testkit.ts` ; un banc ; une partie) lance
 * la scène et le combat, puis écrit le patch que rend `auContact`.
 */
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import type { EtatDeJeu, Jeu } from './etat';
import type { Scene } from './monde/scene';

/** Le héros du duel. */
export function heroDuDuel(): Combatant {
  return createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
}

/** Met le héros et le premier ennemi au contact dans le combat ouvert de `etat` (combattants mutés en place,
 *  comme le moteur), et rend le patch qui donne le tour au héros. */
export function auContact(etat: EtatDeJeu): { H: Combatant; E: Combatant; patch: Pick<EtatDeJeu, 'battle' | 'pendingFrenzy'> } {
  const b = etat.battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
  H.pos = { x: 10, y: 10 }; E.pos = { x: 11, y: 10 };
  H.engagedWith = []; E.engagedWith = [];
  return { H, E, patch: { battle: { ...b, turn: b.order.indexOf(H.id), acted: false, movementUsed: 0 }, pendingFrenzy: null } };
}

/** Le propriétaire qui ouvre le duel (le store, un banc) : son état, son écriture, et l'abandon des suites programmées. */
export interface ProprietaireDuDuel {
  getState: () => Jeu;
  setState: (patch: Partial<Jeu>) => void;
  abandonner: () => void;
}

/** Ouvre le duel chez `p`, dans `scene` (la scène de fixture, que le noyau n'importe pas) : la scène, le combat, la
 *  manche confirmée, les suites programmées abandonnées, puis le patch d'`auContact` écrit. */
export function heroFaceAUnEnnemi(p: ProprietaireDuDuel, scene: Scene): { H: Combatant; E: Combatant } {
  p.setState({ party: [heroDuDuel()] });
  p.getState().startScene(scene);
  p.getState().startCombat('enc-mutants');
  p.getState().confirmRoundStart();
  p.abandonner();
  const { H, E, patch } = auContact(p.getState());
  p.setState(patch);
  return { H, E };
}
