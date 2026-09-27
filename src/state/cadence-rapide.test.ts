import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { startCascade } from './cascade';
import { freeCons } from './rollSeam';
import { spyApplier } from './cascadeTestKit';
import { tickCombatAuto } from './combatAuto';

import type { CascadeStep } from './pendings';
import { resetCadence, setCadence } from '../engine/cadence';

/**
 * Cadence RAPIDE — le pilote `tickCombatAuto` auto-résout les cascades (jets de nuit/voyage → RÉSUMÉ)
 * sans jet manuel, et reste INERTE en mode « manuel ». (Les jets de COMBAT bespoke — attaque/défense —
 * sont vérifiés par la recette navigateur ; ici on couvre le chemin cascade générique du driver.)
 */
describe('Cadence Rapide — auto-résolution des cascades par le driver', () => {
  const applied: string[] = [];
  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, pendingCascade: null, journal: [], net: { ...useGame.getState().net, mode: 'local' } });
    spyApplier('tally', applied, (step) => step.id, (step) => ({ consequences: freeCons([step.id]) }));
  });
  afterEach(() => resetCadence());

  function hero() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    useGame.setState({ party: [h] });
    return h;
  }
  const step = (id: string, actorId: string): CascadeStep =>
    ({ id, kind: 'tally', actorId, label: fixtureText(id), rollLabel: 'Résistance', target: 55, result: null});

  it('manuel (défaut) : le driver ne touche PAS la cascade', () => {
    const h = hero();
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)] });
    tickCombatAuto(useGame.getState, useGame.setState);
    expect(applied).toHaveLength(0); // rien auto-résolu
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
  });

  it('rapide : auto-résout toute la cascade jusqu’au bilan, sans jet manuel', () => {
    useGame.getState().seedRng(3);
    setCadence('rapide');
    const h = hero();
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)] });
    tickCombatAuto(useGame.getState, useGame.setState);
    expect(applied).toEqual(['s1', 's2']); // toutes les conséquences appliquées d'office
    // BILAN voyage/nuit : on s'arrête au RÉSUMÉ (curseur en fin), pas de fermeture auto (« on voit le résultat »).
    expect(useGame.getState().pendingCascade!.cursor).toBe(2);
  });
});

/**
 * Auto-combat (cadence 'auto') — un CHOIX de cascade combat (ex. déviation Critique) est tranché par son
 * DÉFAUT authoré (`defaultChoice`), pas laissé en hang ; un choix SANS défaut reste au joueur.
 */
describe('Auto-combat — choix de cascade tranché par le défaut authoré', () => {
  const chosen: (string | undefined)[] = [];
  beforeEach(() => {
    chosen.length = 0;
    useGame.setState({ battle: null, pendingCascade: null, net: { ...useGame.getState().net, mode: 'local' } });
    spyApplier('tally-choix', chosen, (step) => step.chosen);
    setCadence('auto');
  });
  afterEach(() => resetCadence());

  const choix = (id: string, actorId: string, withDefault: boolean): CascadeStep => ({
    id, kind: 'tally-choix', actorId, label: fixtureText(id),
    options: [{ key: 'devier', label: fixtureText('Dévier') }, { key: 'subir', label: fixtureText('Subir') }],
    ...(withDefault ? { defaultChoice: 'devier' } : {}),
  });

  it('choix AVEC défaut → auto-tranché sur le défaut (pas de hang)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    useGame.setState({ party: [h] });
    startCascade(useGame.getState, useGame.setState, { title: 'C', purpose: 'combat', steps: [choix('dev', h.id, true)] });
    tickCombatAuto(useGame.getState, useGame.setState);
    expect(chosen).toEqual(['devier']);                 // tranché via defaultChoice
    expect(useGame.getState().pendingCascade).toBeNull(); // l'étape unique se ferme
  });

  it('choix SANS défaut → NON auto-résolu (décision au joueur, la modale reste)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    useGame.setState({ party: [h] });
    startCascade(useGame.getState, useGame.setState, { title: 'C', purpose: 'combat', steps: [choix('dev', h.id, false)] });
    tickCombatAuto(useGame.getState, useGame.setState);
    expect(chosen).toHaveLength(0);                      // rien tranché
    expect(useGame.getState().pendingCascade!.cursor).toBe(0); // reste sur le choix (visible)
  });
});
