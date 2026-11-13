import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { pushReveal } from './combatEffects';
import { revealToStep } from './revealStep';
import { stepInteraction } from './cascade';
import type { RevealEntry } from './pendings';
import { suspendActiveCascade } from './cascade';
import { registerScene } from './monde/registreDesScenes';
import type { Scene } from './monde/scene';
import { spawnEnemy } from './monde/spawn';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { cascadeDeTest } from './cascade.testkit';
import { parseSceneDeProjet } from './worldMap';
import { cleDeFixture } from './noyau.testkit';
import { ciblePsy } from '../engine/psych/ciblage';
import { groupesDe } from '../engine/groups';

/**
 * RÉVÉLATION = étape d'AFFICHAGE de la cascade (#942 L8) : `pushReveal` n'alimente plus une file
 * parallèle, il APPEND une étape dans la séquence d'accueil — celle en vol, sinon une séquence
 * d'affichage qu'il ouvre. Le contrat porte donc sur la SÉQUENCE : ordre d'arrivée, charge riche
 * portée par l'étape, acquittement par `jetValider('cascade')`, et traversée de la sauvegarde.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('révélation → étape d’affichage de cascade', () => {
  beforeEach(() => banc.setState({ pendingCascade: null, suspendedCascades: [], battle: null }));

  it('hors combat sans séquence en vol : la révélation OUVRE une séquence d’affichage, titrée par elle', () => {
    pushReveal(banc.setState, { kind: 'round', title: 'Entretien quotidien', lines: ['x'] });
    const c = banc.getState().pendingCascade!;
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
    pushReveal(banc.setState, { kind: 'round', title: 'A', lines: ['a'] });
    pushReveal(banc.setState, { kind: 'effet', title: 'B', lines: ['b'] });
    const c = banc.getState().pendingCascade!;
    expect(c.participants.map((s) => s.reveal?.title)).toEqual(['A', 'B']);
    expect(c.participants.map((s) => s.id)).toEqual(['cons-round-0', 'cons-effet-1']); // ids uniques dans la séquence
  });

  it('`jetValider@cascade` dépile étape par étape et ferme la séquence à la dernière', () => {
    pushReveal(banc.setState, { kind: 'round', title: 'A', lines: [] });
    pushReveal(banc.setState, { kind: 'round', title: 'B', lines: [] });
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade!.cursor).toBe(1);
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('une étape d’affichage EN VOL traverse la sauvegarde, et la séquence restaurée se dénoue', () => {
    const reveal = { kind: 'mutation', title: 'Mutation — Écailles', dice: 42, lines: ['a', 'b'], subjectId: 'h1' } satisfies RevealEntry;
    pushReveal(banc.setState, reveal);
    const texte = sauverLeBanc(banc);
    banc.setState({ pendingCascade: null });
    chargerSurLeBanc(banc, texte);
    const step = banc.getState().pendingCascade!.participants[0];
    expect(step.kind).toBe('mutation');
    expect(step.reveal).toEqual(reveal);
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('une séquence EN VOL accueille la révélation (append), au lieu d’être parquée', () => {
    banc.setState({
      pendingCascade: cascadeDeTest([{ id: 'x', kind: cleDeFixture('affichage-test') }], { title: 'Nuit', purpose: 'night' }),
    });
    pushReveal(banc.setState, { kind: 'mutation', title: 'Mutation — X', lines: [] });
    const c = banc.getState().pendingCascade!;
    expect(c.purpose).toBe('night'); // la révélation rejoint l'hôte…
    expect(c.participants).toHaveLength(2);
    expect(banc.getState().suspendedCascades).toHaveLength(0); // …et ne le suspend pas
  });

  it('le SITE d’émission peut nommer sa séquence (entretien quotidien → purpose `upkeep`)', () => {
    pushReveal(banc.setState, { kind: 'round', title: 'Entretien quotidien', lines: [] }, { purpose: 'upkeep' });
    expect(banc.getState().pendingCascade!.purpose).toBe('upkeep');
  });
});

/**
 * CARTE D'ENTRÉE DE ZONE (#942 L8, correctif D1/D2) : la mise en contexte narrative d'une scène passe
 * AVANT les Tests de Psychologie déclenchés par la même arrivée (elle ouvre SA séquence, qui parque
 * celle de Sang-froid — reprise à la clôture), et elle ne SURVIT PAS au départ de la scène qu'elle narre.
 */
describe('carte d’entrée de zone — préséance et durée de vie', () => {
  it('une introduction calculée traverse le parse et la révélation en texte', () => {
    const texte = ['Vous entrez', 'dans la salle.'].join(' ');
    const scene = parseSceneDeProjet({
      ...testScene(), id: 'probe-intro-calculée',
      startMessage: { texte }, encounters: [],
      entities: [{ id: 'start', kind: 'heroStart', pos: { x: 2, y: 2 } }],
    });
    banc.setState({ party: [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })], pendingCascade: null, suspendedCascades: [], battle: null });
    banc.getState().lancerLaScene(scene);
    expect(banc.getState().pendingCascade!.participants[0].reveal?.lines).toEqual([texte]);
  });

  const CRYPTE: Scene = {
    ...testScene(),
    id: 'probe-crypte',
    label: 'Crypte',
    startMessage: { texte: 'Vous poussez la porte de la crypte.' },
    encounters: [],
    entities: [
      { id: 'start', kind: 'heroStart', pos: { x: 6, y: 10 } },
      { id: 'squ1', kind: 'personnage', creature: { id: 'squelette' }, pos: { x: 10, y: 10 } },
    ],
  };

  function heroHaineux() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    // Haine ciblant un GROUPE du squelette présent en scène (lu sur la créature réelle, jamais deviné)
    // → `openEncounterPsych` ouvre sa cascade « Sang-froid » à l'entrée.
    const squelette = spawnEnemy({ ref: 'squelette' }, 'squ-probe', { x: 0, y: 0 });
    expect(groupesDe(squelette)).toContain('mort-vivant');
    hero.psychTraits = [{ type: 'haine', cible: ciblePsy.groupe('mort-vivant') }];
    return hero;
  }

  it('la carte passe DEVANT les Tests de rencontre, qui reprennent à sa clôture', () => {
    banc.setState({ party: [heroHaineux()], pendingCascade: null, suspendedCascades: [], battle: null });
    banc.getState().lancerLaScene(CRYPTE);
    const c = banc.getState().pendingCascade!;
    expect(c.participants[0].kind).toBe('entreeEnScene'); // la carte est l'étape COURANTE, pas la dernière
    expect(c.purpose).toBe('affichage');
    expect(banc.getState().suspendedCascades.map((s) => s.purpose)).toEqual(['test']); // Sang-froid PARQUÉ
    banc.getState().jetValider('cascade'); // « Continuer » ferme la carte…
    expect(banc.getState().suspendedCascades).toHaveLength(0);
    expect(banc.getState().pendingCascade!.purpose).toBe('test'); // …et rend la main aux Tests de rencontre
  });

  it('la carte d’une scène QUITTÉE ne resurgit pas : le changement de scène la purge de la pile parquée', () => {
    const suite: Scene = { ...testScene(), id: 'probe-suite', label: 'Salle basse', startMessage: { texte: 'Un escalier descend.' }, encounters: [], entities: [{ id: 'start', kind: 'heroStart', pos: { x: 2, y: 2 } }] };
    registerScene(CRYPTE);
    registerScene(suite);
    banc.setState({ party: [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })], pendingCascade: null, suspendedCascades: [], battle: null });
    banc.getState().lancerLaScene(CRYPTE);
    expect(banc.getState().pendingCascade!.participants[0].reveal?.kind).toBe('entreeEnScene');
    suspendActiveCascade(banc.getState, banc.setState); // ce que fait l'ouverture d'un combat sur la carte ouverte
    expect(banc.getState().suspendedCascades).toHaveLength(1);
    banc.getState().quitterLaScene('probe-suite');
    // La carte de la scène QUITTÉE a disparu de la pile ; celle de la scène d'arrivée est à l'écran.
    expect(banc.getState().suspendedCascades).toHaveLength(0);
    expect(banc.getState().pendingCascade!.title).toBe('Salle basse');
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade).toBeNull(); // rien derrière : la Crypte ne revient pas
  });

  it('une révélation appendue DERRIÈRE la carte survit à la transition SANS être sautée', () => {
    // Scène de crypte JOUABLE en combat (la rencontre de fixture) : `lancerLeCombat` est le vrai parqueur.
    const crypteCombat: Scene = { ...CRYPTE, id: 'probe-crypte-combat', encounters: testScene().encounters, entities: testScene().entities };
    const suite: Scene = { ...testScene(), id: 'probe-suite-2', label: 'Salle basse', startMessage: { texte: 'Un escalier descend.' }, encounters: [], entities: [{ id: 'start', kind: 'heroStart', pos: { x: 2, y: 2 } }] };
    registerScene(crypteCombat);
    registerScene(suite);
    banc.setState({ party: [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })], pendingCascade: null, suspendedCascades: [], battle: null });
    banc.getState().lancerLaScene(crypteCombat);
    pushReveal(banc.setState, { kind: 'effet', title: 'Conséquence B', lines: ['b'] }); // rejoint la séquence d'affichage EN VOL, derrière la carte
    expect(banc.getState().pendingCascade!.participants).toHaveLength(2);
    banc.getState().jetValider('cascade'); // la carte est acquittée : le curseur pointe « Conséquence B »
    expect(banc.getState().pendingCascade!.cursor).toBe(1);
    banc.getState().lancerLeCombat('enc-mutants', undefined, { noSurprise: true }); // parque la séquence mixte
    banc.getState().quitterLaScene('probe-suite-2'); // purge la carte de la scène quittée
    const parked = banc.getState().suspendedCascades.find((c) => c.purpose === 'affichage')!;
    expect(parked.participants.map((s) => s.reveal?.title)).toEqual(['Conséquence B']);
    expect(parked.participants[parked.cursor]?.reveal?.title).toBe('Conséquence B'); // curseur RECALÉ : l'étape reste À JOUER, pas en bilan
  });

  it('une séquence parquée SANS carte d’entrée traverse la transition avec son curseur INCHANGÉ', () => {
    const suite: Scene = { ...testScene(), id: 'probe-suite-3', label: 'Salle basse', startMessage: { texte: 'Un escalier descend.' }, encounters: [], entities: [{ id: 'start', kind: 'heroStart', pos: { x: 2, y: 2 } }] };
    registerScene(CRYPTE);
    registerScene(suite);
    banc.setState({ party: [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })], pendingCascade: null, suspendedCascades: [], battle: null });
    banc.getState().lancerLaScene(CRYPTE);
    suspendActiveCascade(banc.getState, banc.setState); // la carte d'entrée est parquée…
    // …et sous elle, un jour de voyage parqué plus tôt, curseur au milieu de ses étapes.
    banc.setState({
      suspendedCascades: [
        cascadeDeTest([{ id: 'j1', kind: 'equipage-progression' }, { id: 'j2', kind: 'equipage-orientation' }, { id: 'j3', kind: 'equipage-entretien' }], { title: 'Jour 2', purpose: 'travelDay', cursor: 1 }),
        ...banc.getState().suspendedCascades,
      ],
    });
    banc.getState().quitterLaScene('probe-suite-3');
    const voyage = banc.getState().suspendedCascades.find((c) => c.purpose === 'travelDay')!;
    expect(voyage.cursor).toBe(1);
    expect(voyage.participants.map((s) => s.id)).toEqual(['j1', 'j2', 'j3']);
  });
});

/**
 * UNE RÉVÉLATION RAPPORTE UN TIRAGE, ELLE N'EN OUVRE PAS (#1262 V2 L6) — `revealToStep` est la seule
 * fabrique d'étape EXEMPTÉE du lint de forge (`oxlint.config.mjs`) hors des mints de `rollSeam` : son
 * `opts.table` n'accepte qu'une déclaration RÉSOLUE (`CascadeTableDone`), jamais une étape d'interaction
 * `'table'` — un tirage à faire, sans enjeu, qu'aucune porte n'a montée. Ce couple test + directive en est la mesure.
 */
describe('#1262 V2 L6 — `revealToStep` ne produit jamais un tirage À FAIRE', () => {
  const ENTRY: RevealEntry = { kind: 'incantationImparfaite', title: 'Colère des dieux', lines: ['ligne 77'], subjectId: 'H1' };

  it('table RÉSOLUE : l’étape reste un AFFICHAGE, dé et ligne portés par la rangée', () => {
    const step = revealToStep(ENTRY, 0, {
      table: { tableId: 'wrath-table', result: { roll: 77, die: 77, id: 'blaspheme', lines: ['ligne 77'] } },
    });
    expect(stepInteraction(step), 'un dé DÉJÀ tombé se lit, il ne se relance pas').toBe('affichage');
    expect(step.table!.result!.roll).toBe(77);
  });

  it('déclaration OUVERTE : refusée au TYPE — la directive est TUEUSE (sous `CascadeTableDecl`, elle serait inutilisée)', () => {
    // @ts-expect-error — `result` requis (`CascadeTableDone`) : sans lui l'étape LANCERAIT un tirage muet
    expect(() => revealToStep(ENTRY, 0, { table: { tableId: 'wrath-table' } })).toBeTypeOf('function');
  });
});
