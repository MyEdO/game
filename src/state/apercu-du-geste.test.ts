/**
 * APERÇU DU GESTE (#1411 P2-D) — le survol dit ce que le clic commettra, y compris la Difficulté.
 *
 * Un geste combiné (Charge, rejoindre-puis-attaquer) s'aperçoit depuis sa case d'ARRIVÉE : l'appelant
 * passe un attaquant `{ ...actif, pos: destination }`. L'environnement du Test, lui, se lit sur
 * `battle.combatants` — Surnombre (`LDB 14 l.110`) en tête. Ces deux vues doivent être LA MÊME
 * (`withAttackerAt`), sans quoi l'aperçu annonce un palier que le jet contredit.
 */
import { describe, it, expect } from 'vitest';
import { previewAttack, withAttackerAt, difficultyOf } from '../noyau/combatFlow';
import { difficultyShownText } from '../noyau/difficultyText';
import { apercuDuGeste, previewDifficultyOf } from '../noyau/targetingModes';
import { hoverTargeting } from '../noyau/targeting';
import { selectedAttackOption } from '../noyau/combatManeuvers';
import { Scene } from '../noyau/monde/scene';
import { Combatant } from '../engine/types';
import type { GameState } from './store';
import { initialNet } from '../noyau/etat';
import { ligneDe } from '../engine/modLine.testkit';
import { refDeRegle } from '../engine/reglesChiffrees';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/** Ce que l'affichage dira de cette Difficulté (`noyau/difficultyText`, celle de la modale). */
const dit = (p: Parameters<typeof difficultyOf>[0]): string | null => difficultyShownText(difficultyOf(p));

const guerrier = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'A',
    label: 'Guerrier',
    kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12),
    advantage: 0,
    conditions: [],
    weapons: [{ label: 'Épée', name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [],
    skills: [],
    talents: [],
    traits: [],
    movement: 4,
    size: 'moyenne',
    pos: { x: 0, y: 0 },
    ...over,
  })) as unknown as Combatant;

function scene(w = 8, h = 8): Scene {
  return {
    id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour',
    layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }],
    entities: [], dialogues: [], triggers: [], encounters: [],
  } as unknown as Scene;
}

const mkGet = (combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: scene(), battle: { combatants, movementUsed: 0, order: ['A'], turn: 0, log: [] }, facing: {}, gameTime: 0, net: initialNet(), log: () => {} })) as unknown as () => GameState;

describe('G1 — la Difficulté aperçue d’un geste COMBINÉ compte l’attaquant à sa case d’ARRIVÉE', () => {
  //  allié en (5,0) et cible en (6,0) : l'attaquant qui arrive en (7,0) est le 2ᵉ au contact
  //  → Surnombre 2 c.1 = +20 (`LDB 14 l.110`), donc « Accessible (+20) ».
  const dest = { x: 7, y: 0 };
  const setup = () => {
    const a = guerrier({ id: 'A', pos: { x: 0, y: 0 } });
    const allie = guerrier({ id: 'ALLIE', label: 'Allié', pos: { x: 5, y: 0 } });
    const cible = guerrier({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 6, y: 0 } });
    return { a, allie, cible };
  };

  it('l’aperçu depuis la case d’arrivée dit CE QUE LE JET DIRA une fois le geste commis', () => {
    const { a, allie, cible } = setup();
    const arrive = { ...a, pos: dest };
    // Ce que l'appelant fait (attaquant usurpé, combat aux positions RÉELLES)…
    const apercu = previewAttack(mkGet([a, allie, cible]), arrive, cible);
    // …et ce que le combat dira une fois le déplacement commis (attaquant RÉELLEMENT arrivé).
    const commis = previewAttack(mkGet([arrive, allie, cible]), arrive, cible);
    expect(dit(apercu)).toBe(dit(commis));
    expect(dit(commis), 'Surnombre 2 c.1 = +20 → Accessible').toBe('Accessible (+20)');
  });

  it('le Surnombre est NOMMÉ dans la composition de l’aperçu', () => {
    const { a, allie, cible } = setup();
    const apercu = previewAttack(mkGet([a, allie, cible]), { ...a, pos: dest }, cible);
    expect(ligneDe(apercu.difficultyParts, refDeRegle('superiorite-numerique'))).toBeDefined();
  });

  it('`withAttackerAt` rend le MÊME combat quand l’attaquant est déjà l’objet du combat', () => {
    const { a, allie, cible } = setup();
    const battle = mkGet([a, allie, cible])().battle!;
    expect(withAttackerAt(battle, a)).toBe(battle);
    expect(withAttackerAt(battle, { ...a, pos: dest }).combatants[0].pos).toEqual(dest);
  });
});

describe('G2 — l’aperçu du geste tire la Difficulté de l’arme ÉPINGLÉE par l’option armée', () => {
  const dague = { label: 'Dague', name: 'Dague', type: 'melee', damage: { plusBF: true, flat: 2 }, hand: 'off', qualities: [], uid: 'D1' };
  const epee = { label: 'Épée', name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, hand: 'main', qualities: [], uid: 'E1' };

  it('l’arme de main SECONDAIRE porte sa pénalité (LDB 14 l.181) — l’arme principale non', () => {
    const a = guerrier({ weapons: [epee, dague] as unknown as Combatant['weapons'], pos: { x: 5, y: 0 } });
    const cible = guerrier({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 6, y: 0 } });
    const get = mkGet([a, cible]);
    const avecEpee = dit(apercuDuGeste(get, a, cible, { id: 'arme', label: 'Épée', weaponUid: 'E1', cost: { action: 1 } } as never));
    const avecDague = dit(apercuDuGeste(get, a, cible, { id: 'arme', label: 'Dague', weaponUid: 'D1', cost: { action: 1 } } as never));
    expect(avecEpee, 'rien ne pèse sur la frappe à l’arme principale').toBe('Intermédiaire (+0)');
    expect(avecDague, 'Main secondaire −10 → Complexe').not.toBe(avecEpee);
  });
});

describe('G3 — hors cran de l’échelle, l’aperçu dit le modificateur RÉEL, comme la modale', () => {
  it('une combinaison de −15 se nomme « Combinée (−15) », jamais le cran voisin', () => {
    const a = guerrier({ pos: { x: 5, y: 0 } });
    const cible = guerrier({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 6, y: 0 } });
    const p = previewAttack(mkGet([a, cible]), a, cible);
    // On compose la même ligne que le socle, avec une circonstance hors cran.
    expect(dit({ ...p, difficulty: 'intermediaire', difficultyCombined: -15 })).toBe('Combinée (−15)');
    expect(dit({ ...p, difficulty: 'difficile', difficultyCombined: undefined })).toBe('Difficile (−20)');
  });

  it('un aperçu sans cible atteignable (hors portée / LdV coupée) ne dit AUCUNE Difficulté', () => {
    const a = guerrier({ pos: { x: 0, y: 0 } });
    const loin = guerrier({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 7, y: 7 } });
    expect(dit(previewAttack(mkGet([a, loin]), a, loin))).toBeNull();
  });
});

describe('G-A — le badge tap-1 ne nomme une Difficulté QUE pour un Test d’arme', () => {
  /** Empoignade EN COURS (`LDB 14 l.161`) : l'option armée se résout par un Test opposé de FORCE ; il
   *  n'y a aucune Difficulté d'arme à composer, et le réticule n'en annonce aucune. Le badge de
   *  l'aperçu tap-1 doit se taire pour la MÊME raison, par le MÊME prédicat. */
  const empoignade = () => {
    const a = guerrier({ id: 'A', pos: { x: 5, y: 0 }, grapplingWith: ['B'] } as never);
    const b = guerrier({ id: 'B', label: 'B', kind: 'enemy', pos: { x: 6, y: 0 }, grapplingWith: ['A'] } as never);
    const battle = { combatants: [a, b], order: ['A'], turn: 0, movementUsed: 0, acted: false, action: null, selectedAttack: 'grapple', preview: { kind: 'attack', targetId: 'B' }, log: [], reachable: new Map() };
    const get = (() => ({ scene: scene(), battle, facing: {}, gameTime: 0, net: initialNet(), log: () => {} })) as unknown as () => GameState;
    return { a, b, battle, get };
  };

  it('l’option ARMÉE est bien l’Empoignade, et le réticule n’annonce aucune Difficulté', () => {
    const { a, b, battle, get } = empoignade();
    expect(selectedAttackOption(a, battle as never)?.targeting).toBe('grapple');
    const ht = hoverTargeting(get, a, b);
    expect(ht.kind).toBe('ok');
    expect(ht.kind === 'ok' && ht.difficulty, 'un Test opposé de Force n’a pas de Difficulté d’arme').toBeUndefined();
  });

  it('le badge de l’aperçu se tait EXACTEMENT comme le réticule', () => {
    const { get } = empoignade();
    expect(previewDifficultyOf(get), 'sinon le badge annonce « Intermédiaire (+0) » sur un Test de Force').toBeUndefined();
  });

  it('la frappe d’ARME, elle, en nomme une — le prédicat ne bâillonne pas tout', () => {
    const a = guerrier({ id: 'A', pos: { x: 5, y: 0 } });
    const b = guerrier({ id: 'B', label: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    const battle = { combatants: [a, b], order: ['A'], turn: 0, movementUsed: 0, acted: false, action: null, preview: { kind: 'attack', targetId: 'B' }, log: [], reachable: new Map() };
    const get = (() => ({ scene: scene(), battle, facing: {}, gameTime: 0, net: initialNet(), log: () => {} })) as unknown as () => GameState;
    expect(dit(apercuDuGeste(get, a, b, { id: 'arme', label: 'Épée', cost: { action: 1 } } as never))).toBe('Intermédiaire (+0)');
    expect(previewDifficultyOf(get)).toEqual({ difficulty: 'intermediaire' });
  });
});
