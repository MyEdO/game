/**
 * Ciblage homogène — Ligne de Vue des SORTS (LDB 46 l.121 : « sauf indication contraire, vous
 * devez toujours être capable de voir – par exemple, avoir en Ligne de vue – votre cible ») :
 *  • castSpell refuse AVANT la modale (pas de pendingCast) — Projectile comme buff sur allié ;
 *  • ZdE : LdV vers la case CENTRE de la zone (clic-case) ;
 *  • Surincantation : candidats filtrés par LdV quand `sight` est fourni ;
 *  • castOutOfSightTargetIds : grisage hors-LdV du mode incantation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { castSpell, overcastTargetCandidates, castOutOfSightTargetIds } from './combatFlow';
import { pregen, PREGEN, makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { findSpell } from '../data';
import type { Combatant } from '../engine/types';

function wiz() {
  const w = pregen(PREGEN.sorcier);
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
  const seen = spawnEnemy({ ref: 'brigand' }, 'e-vu', { x: 16, y: 0 });
  const hidden = spawnEnemy({ ref: 'brigand' }, 'e-cache', { x: 16, y: 4 });
  const battle = {
    combatants: [w, seen, hidden], order: [w.id, 'e-vu', 'e-cache'], baseOrder: [w.id, 'e-vu', 'e-cache'],
    turn: 0, round: 1, action: 'cast', selectedSpellId: 'carreau', reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  useGame.setState({ battle, scene: wallScene(), party: [] });
  return { w, seen, hidden };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null });
  useGame.getState().seedRng(23);
});

describe('castSpell — Ligne de Vue (LDB 46 l.121)', () => {
  it('cible derrière un mur → refus dans le FEED de combat (pas le journal), pas de modale', () => {
    const { w, hidden } = setup();
    castSpell(useGame.getState, useGame.setState, w, hidden, 'carreau');
    expect(useGame.getState().pendingCast).toBeNull();
    // EN COMBAT, le refus est VISIBLE dans le feed (battle.log) — pas dans le journal d'exploration
    // invisible pendant le combat (B4 : un refus muet passait pour un bug).
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/pas de ligne de vue/i);
    expect(useGame.getState().journal.join('\n')).not.toMatch(/pas de ligne de vue/i);
  });

  it('ligne dégagée (brèche) → la modale s’ouvre', () => {
    const { w, seen } = setup();
    castSpell(useGame.getState, useGame.setState, w, seen, 'carreau');
    expect(useGame.getState().pendingCast?.targetId).toBe('e-vu');
  });

  it('cibler un ALLIÉ derrière un mur → refusé aussi (le gate ignore l’équipe — buffs compris)', () => {
    const { w } = setup();
    const ally = makePregens().find((h) => h.id !== w.id)!;
    ally.pos = { x: 16, y: 4 }; // derrière le mur
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, combatants: [...b.combatants, ally] } });
    castSpell(useGame.getState, useGame.setState, w, ally, 'carreau');
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/pas de ligne de vue/i);
  });

  it('sur SOI-MÊME : jamais bloqué par la LdV', () => {
    const { w } = setup();
    castSpell(useGame.getState, useGame.setState, w, w, 'carreau');
    expect(useGame.getState().pendingCast?.targetId).toBe(w.id);
  });
});

describe('castSpell — Portée (LDB 47) : refus VISIBLE en combat (B4)', () => {
  it('cible hors de portée → message dans le FEED de combat, pas de modale', () => {
    const { w, seen } = setup();
    w.characteristics['force-mentale'] = 2; // Carreau = FM/2 → 1 case ; e-vu est à 14 cases (LdV dégagée en y=0)
    castSpell(useGame.getState, useGame.setState, w, seen, 'carreau');
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/hors de portée/i);
    expect(useGame.getState().journal.join('\n')).not.toMatch(/hors de portée/i);
  });
});

describe('ZdE « jet puis pose » — LdV vers la case centre À LA POSE', () => {
  it('centre derrière le mur → refus (pose toujours en cours), brèche → zone posée', () => {
    const { w } = setup();
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, selectedSpellId: 'explosion' } });
    useGame.getState().battleClickTile({ x: 3, y: 0 }); // tout clic ouvre la modale (centre null)
    const pc = useGame.getState().pendingCast!;
    expect(pc.zone).toMatchObject({ center: null });
    useGame.setState({ pendingCast: { ...pc, result: { cast: true, roll: 11, target: 70, sl: 4, isCritical: false, isFumble: false, log: 'lancé' } as never } });
    useGame.getState().castPlaceZone(true);
    useGame.getState().battleClickTile({ x: 16, y: 4 }); // centre masqué par le mur
    expect(useGame.getState().journal.join('\n')).toMatch(/pas de ligne de vue/i);
    expect(useGame.getState().pendingCast?.zone?.placing).toBe(true); // la pose continue
    useGame.getState().battleClickTile({ x: 16, y: 0 }); // brèche : e-vu dans le rayon → appliqué
    expect(useGame.getState().pendingCast).toBeNull();
    void w;
  });
});

describe('Surincantation « +Cible » — candidats filtrés par LdV (sight fourni)', () => {
  it('candidat derrière un mur exclu AVEC sight, inclus SANS (compat hors combat)', () => {
    const { w, seen, hidden } = setup();
    const pool: Combatant[] = [w, seen, hidden];
    const spell = findSpell('Carreau')!;
    const sansSight = overcastTargetCandidates(pool, w, 'e-vu', spell, true, 'arcane', 0).map((c) => c.id);
    expect(sansSight).toContain('e-cache');
    const avecSight = overcastTargetCandidates(pool, w, 'e-vu', spell, true, 'arcane', 0, { scene: useGame.getState().scene! as never, smoke: [] }).map((c) => c.id);
    expect(avecSight).not.toContain('e-cache');
  });
});

describe('castOutOfSightTargetIds — grisage du mode incantation', () => {
  it('ennemi derrière le mur grisé, ennemi en ligne dégagée non', () => {
    setup();
    const ids = castOutOfSightTargetIds(useGame.getState);
    expect(ids.has('e-cache')).toBe(true);
    expect(ids.has('e-vu')).toBe(false);
  });
});
