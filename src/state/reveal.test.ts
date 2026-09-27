import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pushReveal } from './combatFlow';
import { revealToStep } from './revealStep';
import { stepInteraction } from './cascade';
import type { RevealEntry } from './pendings';
import { deleteSlot } from './saves';
import { suspendActiveCascade } from './cascade';
import { registerScene } from './store';
import type { Scene } from './scene';
import { spawnEnemy } from './spawn';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

/** Stockage local en mémoire (patron partagé des tests de save). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

/**
 * RÉVÉLATION = étape d'AFFICHAGE de la cascade (#942 L8) : `pushReveal` n'alimente plus une file
 * parallèle, il APPEND une étape dans la séquence d'accueil — celle en vol, sinon une séquence
 * d'affichage qu'il ouvre. Le contrat porte donc sur la SÉQUENCE : ordre d'arrivée, charge riche
 * portée par l'étape, cadence d'auto-fermeture dérivée de la gravité, acquittement par `cascadeNext`.
 */
describe('révélation → étape d’affichage de cascade', () => {
  beforeEach(() => useGame.setState({ pendingCascade: null, suspendedCascades: [], battle: null }));

  it('hors combat sans séquence en vol : la révélation OUVRE une séquence d’affichage, titrée par elle', () => {
    pushReveal(useGame.setState, { kind: 'round', title: 'Entretien quotidien', lines: ['x'], severity: 'minor' });
    const c = useGame.getState().pendingCascade!;
    expect(c.purpose).toBe('affichage');
    expect(c.title).toBe('Entretien quotidien');
    expect(c.cursor).toBe(0);
    expect(c.participants).toHaveLength(1);
    const step = c.participants[0];
    expect(step.kind).toBe('round');
    expect(step.reveal?.lines).toEqual(['x']); // charge riche portée PAR l'étape (rendue par RevealBody)
    expect(step.outcome?.length).toBe(1); // …et ses lignes restent lisibles dans la pile une fois validée
  });

  it('les révélations s’EMPILENT dans l’ordre d’arrivée (le mono est le cas N=1 d’une séquence)', () => {
    pushReveal(useGame.setState, { kind: 'round', title: 'A', lines: ['a'] });
    pushReveal(useGame.setState, { kind: 'effet', title: 'B', lines: ['b'] });
    const c = useGame.getState().pendingCascade!;
    expect(c.participants.map((s) => s.reveal?.title)).toEqual(['A', 'B']);
    expect(c.participants.map((s) => s.id)).toEqual(['cons-round-0', 'cons-effet-1']); // ids uniques dans la séquence
  });

  it('la GRAVITÉ n’arme AUCUN timer : la fermeture est EXPLICITE par défaut (arbitrage #1270)', () => {
    pushReveal(useGame.setState, { kind: 'round', title: 'A', lines: [], severity: 'minor' });
    pushReveal(useGame.setState, { kind: 'mutation', title: 'B', lines: [], severity: 'grave' });
    pushReveal(useGame.setState, { kind: 'effet', title: 'C', lines: [] });
    expect(useGame.getState().pendingCascade!.participants.map((s) => s.autoCloseMs)).toEqual([undefined, undefined, undefined]);
  });

  it('l’auto-fermeture se DÉCLARE au site, à la cadence de la gravité donnée', () => {
    pushReveal(useGame.setState, { kind: 'round', title: 'A', lines: [] }, { autoClose: 'minor' });
    pushReveal(useGame.setState, { kind: 'mutation', title: 'B', lines: [] }, { autoClose: 'grave' });
    expect(useGame.getState().pendingCascade!.participants.map((s) => s.autoCloseMs)).toEqual([3500, 9000]);
  });

  it('`cascadeNext` dépile étape par étape et ferme la séquence à la dernière', () => {
    pushReveal(useGame.setState, { kind: 'round', title: 'A', lines: [] });
    pushReveal(useGame.setState, { kind: 'round', title: 'B', lines: [] });
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('une séquence EN VOL accueille la révélation (append), au lieu d’être parquée', () => {
    useGame.setState({
      pendingCascade: { title: 'Nuit', purpose: 'night', cursor: 0, log: [], participants: [{ id: 'x', kind: 'affichage-test' }] },
    });
    pushReveal(useGame.setState, { kind: 'mutation', title: 'Mutation — X', lines: [] });
    const c = useGame.getState().pendingCascade!;
    expect(c.purpose).toBe('night'); // la révélation rejoint l'hôte…
    expect(c.participants).toHaveLength(2);
    expect(useGame.getState().suspendedCascades).toHaveLength(0); // …et ne le suspend pas
  });

  it('le SITE d’émission peut nommer sa séquence (entretien quotidien → purpose `upkeep`)', () => {
    pushReveal(useGame.setState, { kind: 'round', title: 'Entretien quotidien', lines: [] }, { purpose: 'upkeep' });
    expect(useGame.getState().pendingCascade!.purpose).toBe('upkeep');
  });

  it('SAVE/LOAD RÉEL (saveGame → loadGame) avec une étape d’affichage EN VOL : la révélation traverse la save', () => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    deleteSlot(1);
    pushReveal(useGame.setState, { kind: 'mutation', title: 'Mutation — Écailles', dice: 42, lines: ['a', 'b'], subjectId: 'h1', severity: 'grave' }, { autoClose: 'grave' });
    expect(useGame.getState().saveGame(1)).toBe(true);
    useGame.setState({ pendingCascade: null }); // « nouvelle partie » : l'état est écrasé avant le chargement
    expect(useGame.getState().loadGame(1)).toBe(true); // chemin RÉEL : readSlot → parseSave → applyLoadedSave
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.kind).toBe('mutation');
    expect(step.reveal).toEqual({ kind: 'mutation', title: 'Mutation — Écailles', dice: 42, lines: ['a', 'b'], subjectId: 'h1', severity: 'grave' });
    expect(step.autoCloseMs).toBe(9000); // la cadence DÉCLARÉE est de la DONNÉE : elle survit au JSON
    useGame.getState().cascadeNext(); // …et la séquence restaurée se dénoue normalement
    expect(useGame.getState().pendingCascade).toBeNull();
    deleteSlot(1);
  });
});

/**
 * CARTE D'ENTRÉE DE ZONE (#942 L8, correctif D1/D2) : la mise en contexte narrative d'une scène passe
 * AVANT les Tests de Psychologie déclenchés par la même arrivée (elle ouvre SA séquence, qui parque
 * celle de Sang-froid — reprise à la clôture), et elle ne SURVIT PAS au départ de la scène qu'elle narre.
 */
describe('carte d’entrée de zone — préséance et durée de vie', () => {
  const CRYPTE: Scene = {
    ...testScene,
    id: 'probe-crypte',
    label: 'Crypte',
    startMessage: 'Vous poussez la porte de la crypte.',
    encounters: [],
    entities: [
      { id: 'start', kind: 'heroStart', pos: { x: 6, y: 10 } },
      { id: 'squ1', kind: 'personnage', ref: 'squelette', pos: { x: 10, y: 10 } },
    ],
  };

  function heroHaineux() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    // Haine ciblant un GROUPE du squelette présent en scène (lu sur la créature réelle, jamais deviné)
    // → `openEncounterPsych` ouvre sa cascade « Sang-froid » à l'entrée.
    const squelette = spawnEnemy({ ref: 'squelette' }, 'squ-probe', { x: 0, y: 0 });
    hero.psychTraits = [{ type: 'haine', cible: (squelette.groups ?? [])[0] }];
    return hero;
  }

  it('la carte passe DEVANT les Tests de rencontre, qui reprennent à sa clôture', () => {
    useGame.setState({ party: [heroHaineux()], pendingCascade: null, suspendedCascades: [], battle: null });
    useGame.getState().startScene(CRYPTE);
    const c = useGame.getState().pendingCascade!;
    expect(c.participants[0].kind).toBe('sceneEntry'); // la carte est l'étape COURANTE, pas la dernière
    expect(c.purpose).toBe('affichage');
    expect(useGame.getState().suspendedCascades.map((s) => s.purpose)).toEqual(['test']); // Sang-froid PARQUÉ
    useGame.getState().cascadeNext(); // « Continuer » ferme la carte…
    expect(useGame.getState().suspendedCascades).toHaveLength(0);
    expect(useGame.getState().pendingCascade!.purpose).toBe('test'); // …et rend la main aux Tests de rencontre
  });

  it('la carte d’une scène QUITTÉE ne resurgit pas : le changement de scène la purge de la pile parquée', () => {
    const suite: Scene = { ...testScene, id: 'probe-suite', label: 'Salle basse', startMessage: 'Un escalier descend.', encounters: [], entities: [{ id: 'start', kind: 'heroStart', pos: { x: 2, y: 2 } }] };
    registerScene(CRYPTE);
    registerScene(suite);
    useGame.setState({ party: [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) })], pendingCascade: null, suspendedCascades: [], battle: null });
    useGame.getState().startScene(CRYPTE);
    expect(useGame.getState().pendingCascade!.participants[0].reveal?.kind).toBe('sceneEntry');
    suspendActiveCascade(useGame.getState, useGame.setState); // ce que fait l'ouverture d'un combat sur la carte ouverte
    expect(useGame.getState().suspendedCascades).toHaveLength(1);
    useGame.getState().transitionTo('probe-suite');
    // La carte de la scène QUITTÉE a disparu de la pile ; celle de la scène d'arrivée est à l'écran.
    expect(useGame.getState().suspendedCascades).toHaveLength(0);
    expect(useGame.getState().pendingCascade!.title).toBe('Salle basse');
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull(); // rien derrière : la Crypte ne revient pas
  });

  it('une révélation appendue DERRIÈRE la carte survit à la transition SANS être sautée', () => {
    // Scène de crypte JOUABLE en combat (la rencontre de fixture) : `startCombat` est le vrai parqueur.
    const crypteCombat: Scene = { ...CRYPTE, id: 'probe-crypte-combat', encounters: testScene.encounters, entities: testScene.entities };
    const suite: Scene = { ...testScene, id: 'probe-suite-2', label: 'Salle basse', startMessage: 'Un escalier descend.', encounters: [], entities: [{ id: 'start', kind: 'heroStart', pos: { x: 2, y: 2 } }] };
    registerScene(crypteCombat);
    registerScene(suite);
    useGame.setState({ party: [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) })], pendingCascade: null, suspendedCascades: [], battle: null });
    useGame.getState().startScene(crypteCombat);
    pushReveal(useGame.setState, { kind: 'effet', title: 'Conséquence B', lines: ['b'] }); // rejoint la séquence d'affichage EN VOL, derrière la carte
    expect(useGame.getState().pendingCascade!.participants).toHaveLength(2);
    useGame.getState().cascadeNext(); // la carte est acquittée : le curseur pointe « Conséquence B »
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
    useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true }); // parque la séquence mixte
    useGame.getState().transitionTo('probe-suite-2'); // purge la carte de la scène quittée
    const parked = useGame.getState().suspendedCascades.find((c) => c.purpose === 'affichage')!;
    expect(parked.participants.map((s) => s.reveal?.title)).toEqual(['Conséquence B']);
    expect(parked.participants[parked.cursor]?.reveal?.title).toBe('Conséquence B'); // curseur RECALÉ : l'étape reste À JOUER, pas en bilan
  });

  it('une séquence parquée SANS carte d’entrée traverse la transition avec son curseur INCHANGÉ', () => {
    const suite: Scene = { ...testScene, id: 'probe-suite-3', label: 'Salle basse', startMessage: 'Un escalier descend.', encounters: [], entities: [{ id: 'start', kind: 'heroStart', pos: { x: 2, y: 2 } }] };
    registerScene(CRYPTE);
    registerScene(suite);
    useGame.setState({ party: [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) })], pendingCascade: null, suspendedCascades: [], battle: null });
    useGame.getState().startScene(CRYPTE);
    suspendActiveCascade(useGame.getState, useGame.setState); // la carte d'entrée est parquée…
    // …et sous elle, un jour de voyage parqué plus tôt, curseur au milieu de ses étapes.
    useGame.setState({
      suspendedCascades: [
        { title: 'Jour 2', purpose: 'travelDay', cursor: 1, log: [], participants: [{ id: 'j1', kind: 'progression' }, { id: 'j2', kind: 'orientation' }, { id: 'j3', kind: 'entretien' }] },
        ...useGame.getState().suspendedCascades,
      ],
    });
    useGame.getState().transitionTo('probe-suite-3');
    const voyage = useGame.getState().suspendedCascades.find((c) => c.purpose === 'travelDay')!;
    expect(voyage.cursor).toBe(1);
    expect(voyage.participants.map((s) => s.id)).toEqual(['j1', 'j2', 'j3']);
  });
});

/**
 * UNE RÉVÉLATION RAPPORTE UN TIRAGE, ELLE N'EN OUVRE PAS (#1262 V2 L6) — `revealToStep` est la seule
 * fabrique d'étape EXEMPTÉE du lint de forge (`eslint.config.js`) hors des mints de `rollSeam` : tant
 * que son `opts.table` acceptait une déclaration OUVERTE (`result` optionnel), elle pouvait produire
 * une étape d'interaction `'table'` — un tirage à faire, sans enjeu, qu'aucune porte n'a montée. Le
 * type le refuse désormais (`CascadeTableDone`) ; ce couple test + directive en est la mesure.
 */
describe('#1262 V2 L6 — `revealToStep` ne produit jamais un tirage À FAIRE', () => {
  const ENTRY: RevealEntry = { kind: 'miscast', title: 'Colère des dieux', lines: ['ligne 77'], subjectId: 'H1' };

  it('table RÉSOLUE : l’étape reste un AFFICHAGE, dé et ligne portés par la rangée', () => {
    const step = revealToStep(ENTRY, 0, {
      table: { tableId: 'wrath-table', spec: { n: 1, sides: 100 }, result: { roll: 77, die: 77, id: 'blaspheme', lines: ['ligne 77'] } },
    });
    expect(stepInteraction(step), 'un dé DÉJÀ tombé se lit, il ne se relance pas').toBe('affichage');
    expect(step.table!.result!.roll).toBe(77);
  });

  it('déclaration OUVERTE : refusée au TYPE — la directive est TUEUSE (sous `CascadeTableDecl`, elle serait inutilisée)', () => {
    // @ts-expect-error — `result` requis (`CascadeTableDone`) : sans lui l'étape LANCERAIT un tirage muet
    expect(() => revealToStep(ENTRY, 0, { table: { tableId: 'wrath-table', spec: { n: 1, sides: 100 } } })).toBeTypeOf('function');
  });
});
