/**
 * Ciblage homogène — Ligne de Vue des SORTS (LDB 46 l.121 : « sauf indication contraire, vous
 * devez toujours être capable de voir – par exemple, avoir en Ligne de vue – votre cible ») :
 *  • castSpell refuse AVANT la modale (pas de pendingCast) — Projectile comme buff sur allié ;
 *  • ZdE : LdV vers la case CENTRE de la zone (clic-case) ;
 *  • Surincantation : candidats filtrés par LdV quand `sight` est fourni ;
 *  • castOutOfSightTargetIds : grisage hors-LdV du mode incantation ;
 *  • ciblesHorsDeVue : le grisage que lit le survol, tir ou sort selon le mode armé.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { castSpell, overcastTargetCandidates, castOutOfSightTargetIds } from './combatFlow';
import { ciblesHorsDeVue } from './targetingModes';
import { herosDeScenario, tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { spawnEnemy } from './monde/spawn';
import { findSpellById } from '../data';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function wiz() {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  w.spells = ['explosion', 'carreau', ...(w.spells ?? [])];
  return w;
}

/** Arène 20×8, MUR vertical en x=10 percé d'une brèche en y=0 (la ligne y=0 reste dégagée). */
function wallScene() {
  const w = 20, h = 8;
  const tiles: string[] = new Array(w * h).fill('herbe');
  for (let y = 1; y < h; y++) tiles[y * w + 10] = 'mur';
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
}

/** Lanceuse en (2,0) ; e-vu en (16,0) — brèche — ; e-cache en (16,4) — derrière le mur. */
function setup() {
  const w = wiz();
  w.pos = { x: 2, y: 0 };
  w.characteristics['force-mentale'] = 40; // Carreau (FM mètres) → 20 cases : tout le plateau est À PORTÉE
  const seen = spawnEnemy({ ref: 'humain' }, 'e-vu', { x: 16, y: 0 });
  const hidden = spawnEnemy({ ref: 'humain' }, 'e-cache', { x: 16, y: 4 });
  const battle = {
    combatants: [w, seen, hidden], order: [w.id, 'e-vu', 'e-cache'], baseOrder: [w.id, 'e-vu', 'e-cache'],
    turn: 0, round: 1, action: 'incantation', selectedSpellId: 'carreau', reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  banc.setState({ battle, scene: wallScene(), party: [] });
  return { w, seen, hidden };
}

beforeEach(() => {
  banc.getState().ensemencerLeTirage(23);
});

describe('castSpell — Ligne de Vue (LDB 46 l.121)', () => {
  it('cible derrière un mur → refus dans le FEED de combat (pas le journal), pas de modale', () => {
    const { w, hidden } = setup();
    castSpell(banc.getState, banc.setState, w, hidden, 'carreau');
    expect(banc.getState().pendingCast).toBeNull();
    // EN COMBAT, le refus est VISIBLE dans le feed (battle.log) — pas dans le journal d'exploration
    // invisible pendant le combat (B4 : un refus muet passe pour un bug).
    expect(banc.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/pas de ligne de vue/i);
    expect(banc.getState().journal.join('\n')).not.toMatch(/pas de ligne de vue/i);
  });

  it('ligne dégagée (brèche) → la modale s’ouvre', () => {
    const { w, seen } = setup();
    castSpell(banc.getState, banc.setState, w, seen, 'carreau');
    expect(banc.getState().pendingCast?.targetId).toBe('e-vu');
  });

  it('cibler un ALLIÉ derrière un mur → refusé aussi (le gate ignore l’équipe — buffs compris)', () => {
    const { w } = setup();
    const ally = tousLesHerosDeScenario(idsDeTest).find((h) => h.id !== w.id)!;
    ally.pos = { x: 16, y: 4 }; // derrière le mur
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, combatants: [...b.combatants, ally] } });
    castSpell(banc.getState, banc.setState, w, ally, 'carreau');
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/pas de ligne de vue/i);
  });

  it('sur SOI-MÊME : jamais bloqué par la LdV', () => {
    const { w } = setup();
    castSpell(banc.getState, banc.setState, w, w, 'carreau');
    expect(banc.getState().pendingCast?.targetId).toBe(w.id);
  });
});

describe('castSpell — Portée (LDB 47) : refus VISIBLE en combat (B4)', () => {
  it('cible hors de portée → message dans le FEED de combat, pas de modale', () => {
    const { w, seen } = setup();
    w.characteristics['force-mentale'] = 2; // Carreau = FM/2 → 1 case ; e-vu est à 14 cases (LdV dégagée en y=0)
    castSpell(banc.getState, banc.setState, w, seen, 'carreau');
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/hors de portée/i);
    expect(banc.getState().journal.join('\n')).not.toMatch(/hors de portée/i);
  });
});

describe('ZdE « jet puis pose » — LdV vers la case centre À LA POSE', () => {
  it('centre derrière le mur → refus (pose toujours en cours), brèche → zone posée', () => {
    const { w } = setup();
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, selectedSpellId: 'explosion' } });
    banc.getState().cliquerLaCase({ x: 3, y: 0 }); // tout clic ouvre la modale (centre null)
    const pc = banc.getState().pendingCast!;
    expect(pc.zone).toMatchObject({ center: null });
    banc.setState({ pendingCast: { ...pc, result: { cast: true, roll: 11, target: 70, sl: 4, isCritical: false, isFumble: false, log: 'lancé' } as never } });
    banc.getState().jetRegler('incantation', 'carte', 'zone');
    banc.getState().cliquerLaCase({ x: 16, y: 4 }); // centre masqué par le mur
    expect(banc.getState().journal.join('\n')).toMatch(/pas de ligne de vue/i);
    expect(banc.getState().pendingCast?.zone?.placing).toBe(true); // la pose continue
    banc.getState().cliquerLaCase({ x: 16, y: 0 }); // brèche : e-vu dans le rayon → appliqué
    expect(banc.getState().pendingCast).toBeNull();
    void w;
  });
});

describe('Surincantation « +Cible » — candidats filtrés par LdV (sight fourni)', () => {
  it('candidat derrière un mur exclu AVEC sight, inclus SANS (compat hors combat)', () => {
    const { w, seen, hidden } = setup();
    const pool: Combatant[] = [w, seen, hidden];
    const spell = findSpellById('carreau')!;
    const sansSight = overcastTargetCandidates(pool, w, 'e-vu', spell, true, 'arcane', 0).map((c) => c.id);
    expect(sansSight).toContain('e-cache');
    const avecSight = overcastTargetCandidates(pool, w, 'e-vu', spell, true, 'arcane', 0, { scene: banc.getState().scene! as never, smoke: [] }).map((c) => c.id);
    expect(avecSight).not.toContain('e-cache');
  });
});

describe('castOutOfSightTargetIds — grisage du mode incantation', () => {
  it('ennemi derrière le mur grisé, ennemi en ligne dégagée non', () => {
    setup();
    const ids = castOutOfSightTargetIds(banc.getState);
    expect(ids.has('e-cache')).toBe(true);
    expect(ids.has('e-vu')).toBe(false);
  });
});

describe('ciblesHorsDeVue — le grisage que lit le survol', () => {
  const ARC = { label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] } as never;
  /** Le combat de `setup`, en mode combat, avec `battle` et les armes de la lanceuse surchargées. */
  function poser(battle: Record<string, unknown>, armes?: 'arc') {
    const { w } = setup();
    const avant = banc.getState().battle!;
    const combatants = armes === 'arc' ? avant.combatants.map((c) => (c.id === w.id ? { ...c, weapons: [ARC] } : c)) : avant.combatants;
    banc.setState({ mode: 'battle', battle: { ...avant, combatants, ...battle } as never });
  }
  const ids = () => [...ciblesHorsDeVue(banc.getState)].sort();

  it('garde de tête : hors mode combat, ou combat fini → vide', () => {
    poser({});
    banc.setState({ mode: 'exploration' });
    expect(ids()).toEqual([]);
    poser({ over: 'victoire' });
    expect(ids()).toEqual([]);
  });

  it('Incantation armée avec un sort → grisage du SORT, sans arme à distance', () => {
    poser({ action: 'incantation', selectedSpellId: 'carreau' });
    expect(ids()).toEqual(['e-cache']);
  });

  it('Incantation armée sans sort → verrou → vide', () => {
    poser({ action: 'incantation', selectedSpellId: null }, 'arc');
    expect(ids()).toEqual([]);
  });

  it('verrou : Action engagée → vide', () => {
    poser({ action: null, selectedSpellId: null, acted: true }, 'arc');
    expect(ids()).toEqual([]);
  });

  it('défaut : grisage du TIR de l’arme portée', () => {
    poser({ action: null, selectedSpellId: null }, 'arc');
    expect(ids()).toEqual(['e-cache']);
  });
});
