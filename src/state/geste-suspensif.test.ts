/**
 * GESTE JOUEUR au milieu d'un Flow d'auteur (handler `suspensif`, `combatEffects.ts`) : le pending qu'il
 * ouvre porte la SUITE (patron `openSkillTest(..., after)`), et sa clôture la rejoue — aucune étape posée
 * après le geste ne se perd. Chemin réel : `runFlow` / `applyEffects`, puis le geste de clôture du store.
 * EDO 02 l.91 (désignation) ; LDB 12 l.172-174 (Test étendu) ; EDO Appendice 2 (porte).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { applyEffects, runFlow } from './combatEffects';
import type { Flow } from './flow';
import type { Effect } from './scene';

const get = () => useGame.getState();
const heros = (label: string, seed: number) => {
  const h = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed }), id: `h-${seed}` };
  h.fortune = 2; h.resilience = 2; h.characteristics.force = 45;
  return h;
};
const apres = (flag: string): Flow => ({ kind: 'do', effect: { type: 'setFlag', flag } });
const puis = (effect: Effect, flag: string): Flow => ({ kind: 'seq', steps: [{ kind: 'do', effect }, apres(flag)] });

beforeEach(() => {
  useGame.setState({ battle: null, party: [heros('Vivant', 1), heros('Autre', 2)], flags: {}, etats: {},
    pendingDesignationHeros: null, pendingExtendedTest: null, pendingForceDoor: null, pendingCascade: null, suspendedCascades: [] } as never);
});

describe('designerHeros — la désignation porte la suite du Flow', () => {
  it('`runFlow` : l’étape qui suit la désignation se joue au CHOIX, pas avant, pas jamais', () => {
    runFlow(get, useGame.setState, puis({ type: 'designerHeros', etat: 'sosie' }, 'apres-designation'));
    expect(get().pendingDesignationHeros?.etat).toBe('sosie');
    expect(get().flags['apres-designation']).toBeUndefined();
    get().designerHerosChoisir('h-2');
    expect(get().etats.sosie).toBe('h-2');
    expect(get().flags['apres-designation']).toBe(true);
  });

  it('`runFlow` : la suite au-delà du LOT (un `if` qui suit) attend elle aussi le choix', () => {
    runFlow(get, useGame.setState, { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'designerHeros', etat: 'sosie' } },
      { kind: 'if', cond: { kind: 'etat', etat: 'sosie' }, then: apres('sosie-designe'), else: apres('sosie-absent') },
    ] });
    expect(get().flags['sosie-absent'], 'la branche ne s’évalue pas avant la désignation').toBeUndefined();
    get().designerHerosChoisir('h-1');
    expect(get().flags['sosie-designe']).toBe(true);
    expect(get().flags['sosie-absent']).toBeUndefined();
  });

  it('`applyEffects` : le reste du LOT est la suite', () => {
    applyEffects(get, useGame.setState, [{ type: 'designerHeros', etat: 'sosie' }, { type: 'setFlag', flag: 'reste-du-lot' }]);
    expect(get().flags['reste-du-lot']).toBeUndefined();
    get().designerHerosChoisir('h-1');
    expect(get().flags['reste-du-lot']).toBe(true);
  });

  it('l’invite de l’Effet est portée par la désignation', () => {
    runFlow(get, useGame.setState, { kind: 'do', effect: { type: 'designerHeros', etat: 'sosie', invite: 'Lequel ?' } });
    expect(get().pendingDesignationHeros?.invite).toBe('Lequel ?');
  });

  it('plus aucun héros vivant pendant la désignation : elle se clôt SANS choix et la suite se joue', () => {
    runFlow(get, useGame.setState, puis({ type: 'designerHeros', etat: 'sosie' }, 'apres-designation'));
    get().designerHerosChoisir();
    expect(get().pendingDesignationHeros, 'un vivant reste : la clôture sans choix est refusée').not.toBeNull();
    useGame.setState({ party: get().party.map((h) => ({ ...h, dead: true })) });
    get().designerHerosChoisir();
    expect(get().pendingDesignationHeros).toBeNull();
    expect(get().etats.sosie).toBeUndefined();
    expect(get().flags['apres-designation']).toBe(true);
  });

  it('aucun héros vivant à l’ouverture : rien ne s’ouvre, la suite se joue aussitôt', () => {
    useGame.setState({ party: get().party.map((h) => ({ ...h, dead: true })) });
    runFlow(get, useGame.setState, puis({ type: 'designerHeros', etat: 'sosie' }, 'apres-designation'));
    expect(get().pendingDesignationHeros).toBeNull();
    expect(get().flags['apres-designation']).toBe(true);
  });
});

describe('extendedTest / forceDoor — même patron, même suite', () => {
  const crochetage: Effect = { type: 'extendedTest', characteristic: 'force', difficulty: 'facile', label: 'Enfoncer', targetDR: 3, flag: 'cede' };
  const porte: Effect = { type: 'forceDoor', label: 'Porte', doorBE: 0, doorB: 6, flag: 'porte-ouverte' };

  it('Test étendu atteint : la suite se joue après l’issue', () => {
    get().seedRng(7);
    runFlow(get, useGame.setState, puis(crochetage, 'apres-test'));
    expect(get().flags['apres-test']).toBeUndefined();
    let garde = 0;
    while (get().pendingExtendedTest && garde++ < 60) {
      const p = get().pendingExtendedTest!;
      get().extendedTestRoll(p.rounds[p.rounds.length - 1].id);
      get().extendedTestNext();
    }
    expect(get().flags.cede).toBe(true);
    expect(get().flags['apres-test']).toBe(true);
  });

  it('Test étendu abandonné : la suite se joue aussi', () => {
    runFlow(get, useGame.setState, puis(crochetage, 'apres-test'));
    get().extendedTestCancel();
    expect(get().flags.cede).toBeUndefined();
    expect(get().flags['apres-test']).toBe(true);
  });

  it('porte enfoncée : la suite se joue après l’ouverture', () => {
    get().seedRng(7);
    runFlow(get, useGame.setState, puis(porte, 'apres-porte'));
    expect(get().flags['apres-porte']).toBeUndefined();
    let garde = 0;
    while (get().pendingForceDoor && garde++ < 60) {
      for (const part of get().pendingForceDoor!.participants) get().forceDoorRoll(part.id);
      get().forceDoorConfirm();
    }
    expect(get().flags['porte-ouverte']).toBe(true);
    expect(get().flags['apres-porte']).toBe(true);
  });

  it('porte abandonnée : la suite se joue aussi', () => {
    runFlow(get, useGame.setState, puis(porte, 'apres-porte'));
    get().forceDoorCancel();
    expect(get().flags['apres-porte']).toBe(true);
  });
});
