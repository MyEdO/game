import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { checkTriggers } from './combatEffects';
import { flowFromEffects } from './monde/flow';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene, type Trigger } from './monde/scene';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Intégration : `temporalCondition` doit gater le trigger dans `checkTriggers` — il ne se déclenche
 *  qu'en étant DANS la zone ET DANS la fenêtre horaire. On observe un effet `journal` (évite la
 *  question du flag) et on pilote `gameTime` au cran près. */
const sceneWith = (trigger: Trigger): Scene => ({
  type: 'scene', id: 't', label: 't', dimensions: { w: 5, h: 5 }, ambiance: 'interieur', reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
  layers: [{ z: 0, tiles: new Array(25).fill('sol') }], entities: [], dialogues: [], triggers: [trigger], encounters: [], flags: {},
});

const spotTrigger: Trigger = {
  id: 'spot', rect: { x: 0, y: 0, w: 5, h: 5 }, once: false,
  when: { kind: 'time', window: { afterHour: 21, afterMinute: 30, beforeHour: 21, beforeMinute: 45 } },
  flow: flowFromEffects([{ type: 'journal', desc: 'TIC' }]),
};

describe('temporalCondition — intégration checkTriggers (proximité ET fenêtre horaire)', () => {
  function run(gameTime: number, partyPos = { x: 2, y: 2 }) {
    banc.setState({ scene: sceneWith(spotTrigger), partyPos, gameTime, journal: [], flags: {} });
    checkTriggers(banc.getState, banc.setState);
    return banc.getState().journal.join('|');
  }

  it('dans la zone mais AVANT la fenêtre (21:29) → ne se déclenche pas', () => {
    expect(run(21 * 60 + 29)).not.toContain('TIC');
  });
  it('dans la zone ET dans la fenêtre (21:35) → se déclenche', () => {
    expect(run(21 * 60 + 35)).toContain('TIC');
  });
  it('dans la fenêtre mais HORS de la zone → ne se déclenche pas', () => {
    expect(run(21 * 60 + 35, { x: 9, y: 9 })).not.toContain('TIC');
  });
  it('À la borne `before` (21:45, EXCLUSIVE) → ne se déclenche pas', () => {
    expect(run(21 * 60 + 45)).not.toContain('TIC');
  });
});

/** #803 : `Trigger.rect.z` — un trigger posé au rez (z absent/0) ne doit PAS se déclencher pour le
 *  groupe à l'étage au-dessus (même x/y), et réciproquement (patron #782 `SceneEffectZone.z`). */
const groundTrigger: Trigger = {
  id: 'ground', rect: { x: 0, y: 0, w: 5, h: 5 }, once: false,
  flow: flowFromEffects([{ type: 'journal', desc: 'REZ' }]),
};

const upperTrigger: Trigger = {
  id: 'upper', rect: { x: 0, y: 0, w: 5, h: 5, z: 1 }, once: false,
  flow: flowFromEffects([{ type: 'journal', desc: 'ETAGE' }]),
};

describe('Trigger.rect.z — étage (#803)', () => {
  function run(trigger: Trigger, partyPos: { x: number; y: number; z?: number }) {
    banc.setState({ scene: sceneWith(trigger), partyPos, journal: [], flags: {} });
    checkTriggers(banc.getState, banc.setState);
    return banc.getState().journal.join('|');
  }

  it('trigger au rez (z absent) + groupe au rez (z absent) → se déclenche', () => {
    expect(run(groundTrigger, { x: 2, y: 2 })).toContain('REZ');
  });

  it('trigger au rez (z:0) + groupe à l’étage 1, même x/y → ne se déclenche PAS', () => {
    expect(run(groundTrigger, { x: 2, y: 2, z: 1 })).not.toContain('REZ');
  });

  it('trigger à l’étage 1 + groupe à l’étage 1, même x/y → se déclenche', () => {
    expect(run(upperTrigger, { x: 2, y: 2, z: 1 })).toContain('ETAGE');
  });

  it('trigger à l’étage 1 + groupe au rez (z absent) → ne se déclenche PAS', () => {
    expect(run(upperTrigger, { x: 2, y: 2 })).not.toContain('ETAGE');
  });
});
