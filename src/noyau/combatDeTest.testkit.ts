/**
 * Le duel de test des flux de combat (#2779, #2817) : un héros à fiche réelle (`createHero`) face au
 * premier ennemi de `enc-mutants`, au contact ((10,10)-(11,10)), les autres ennemis hors de combat, le
 * tour au héros. Le propriétaire de l'état (le store, un banc, une partie) lance
 * la scène et le combat, puis écrit le patch que rend `auContact`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { createHero } from '../engine/character';
import type { Combatant, Weapon } from '../engine/types';
import type { EtatDeJeu } from './etat';
import type { JeuDuNoyau } from './machinerieDuNoyau';
import type { Scene } from './monde/scene';
import type { Pt } from './monde/path';
import { actorIn } from './monde/combatants';
import { footprintN } from './monde/footprint';
import { placeCombatant } from './monde/spawn';

/** L'acteur `c` relu par son id dans l'état de `getState` : une écriture copie le combattant dont le maximum
 *  des Blessures bouge (`transitionDuJeu.ts`), une référence prise avant elle désigne l'ancien objet. */
export function reluDans(getState: () => JeuDuNoyau, c: Combatant): Combatant {
  return actorIn(getState(), c.id)!;
}

/** Le héros du duel. */
export function heroDuDuel(): Combatant {
  return createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
}

/** Met le héros et le premier ennemi au contact dans le combat ouvert de `etat` (combattants mutés en place,
 *  comme le moteur), et rend le patch qui donne le tour au héros. */
export function auContact(etat: EtatDeJeu): { H: Combatant; E: Combatant; patch: Pick<EtatDeJeu, 'battle' | 'pendingFrenzy'> } {
  const b = etat.battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const E = b.combatants.find((c) => c.kind === 'ennemi')!;
  b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id).forEach((e) => (e.dead = true));
  H.pos = { x: 10, y: 10 }; E.pos = { x: 11, y: 10 };
  H.engagedWith = []; E.engagedWith = [];
  return { H, E, patch: { battle: { ...b, turn: b.order.indexOf(H.id), acted: false, movementUsed: 0 }, pendingFrenzy: null } };
}

/** Le propriétaire qui ouvre le duel (le store, un banc) : son état, son écriture, et l'abandon des suites programmées. */
export interface ProprietaireDuDuel {
  getState: () => JeuDuNoyau;
  setState: (patch: Partial<JeuDuNoyau>) => void;
  abandonner: () => void;
}

/** Ouvre chez `p` le combat `encId` de `scene` avec le groupe `party` : la scène, le combat, la manche confirmée, les
 *  suites programmées abandonnées. */
function ouvrirLeCombat(p: ProprietaireDuDuel, scene: Scene, party: JeuDuNoyau['party'], encId: string): void {
  p.setState({ screen: 'campaign', party });
  p.getState().lancerLaScene(scene);
  p.getState().lancerLeCombat(encId);
  p.getState().fenetreValider('debutDuRound');
  p.abandonner();
}

/** Ouvre le duel chez `p`, dans `scene` (la scène de fixture, que le noyau n'importe pas), puis écrit le patch
 *  d'`auContact`. */
export function heroFaceAUnEnnemi(p: ProprietaireDuDuel, scene: Scene): { H: Combatant; E: Combatant } {
  ouvrirLeCombat(p, scene, [heroDuDuel()], 'enc-mutants');
  const { H, E, patch } = auContact(p.getState());
  p.setState(patch);
  return { H, E };
}

export const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

/** Le combat `encId` du scénario `contenu` (sa scène et son groupe, que le test construit : le noyau n'importe pas les
 *  scénarios) ouvert chez `p`, réduit à un héros H, un ennemi E et, sur demande, un second héros ou un second ennemi T,
 *  armés de mêlée ; H joue le tour. `poser` place un combattant par `placeCombatant` et rend le tour à H. */
export function ouvrirLeDuel(
  p: ProprietaireDuDuel, contenu: { scene: Scene; party: JeuDuNoyau['party'] }, encId: string, tiers?: 'heros' | 'ennemi',
): { H: Combatant; E: Combatant; T: Combatant | undefined; poser: (c: Combatant, pos: Pt) => void } {
  ouvrirLeCombat(p, contenu.scene, contenu.party, encId);
  const b = p.getState().battle!;
  const unPion = (c: Combatant) => !c.inert && c.bodyShape !== 'vehicule' && footprintN(c) === 1;
  const H = b.combatants.find((c) => c.kind === 'heros' && !c.aiControlled && unPion(c))!;
  const E = b.combatants.find((c) => c.kind === 'ennemi' && unPion(c))!;
  const T = tiers && b.combatants.find((c) => c.kind === tiers && c.id !== H.id && c.id !== E.id && unPion(c));
  for (const c of b.combatants) if (c !== H && c !== E && c !== T) c.dead = true;
  for (const c of [H, E, T]) if (c) c.weapons = [MELEE];
  const poser = (c: Combatant, pos: Pt) => {
    placeCombatant(c, p.getState().scene, pos);
    p.setState({ battle: { ...p.getState().battle!, acted: false, movementUsed: 0, turn: 0, order: [H.id, ...b.order.filter((id) => id !== H.id)] } });
  };
  return { H, E, T, poser };
}
