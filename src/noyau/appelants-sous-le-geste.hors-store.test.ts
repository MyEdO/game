/**
 * #2689 — quand un geste joueur tient la main (Test, désignation, document, Test étendu), ce que l'APPELANT du Flow
 * enchaîne attend sa clôture : le déclencheur suivant de la même case, l'horloge et le sort du décor d'une action
 * jouée, l'avancée d'un dialogue, le reste d'un lot qu'un effet programmé a interrompu. Chemins réels du noyau.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { applyEffects, checkTriggers, runFlow } from './combatEffects';
import { flowFromEffects } from './monde/flow';
import { campagneDeTest } from '../scenes/fixtures/contenuDuCommun';
import { paquetDuJeu } from './campagneLivree';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Dialogue, type Scene, type Trigger } from './monde/scene';
import type { FlowDeScene as Flow } from '../data/schemas/defs-scenes/effets';
import type { Combatant } from '../engine/types';

let banc: Banc;
/** Le narratif du paquet de test, et deux documents que la sonde A ouvre l'un après l'autre. */
const narratifDeTest = paquetDuJeu(campagneDeTest).narratif;
const NARRATIF = {
  ...narratifDeTest,
  documents: [
    ...narratifDeTest.documents,
    { id: 'document-a', titre: 'Document A', prose: 'Texte A.' },
    { id: 'document-b', titre: 'Document B', prose: 'Texte B.' },
  ],
};
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();
const heros = (seed: number): Combatant => ({ ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${seed}`, seed }), id: `h-${seed}` });
const journal = (desc: string): Flow => ({ kind: 'effet', effet: { type: 'journal', desc } });
const effet = (e: Extract<Flow, { kind: 'effet' }>['effet']): Flow => ({ kind: 'effet', effet: e });
const sequence = (...etapes: Flow[]): Flow => ({ kind: 'sequence', etapes });
const testDeForce = (): Flow => ({ kind: 'test', test: { characteristic: 'force', label: 'Force' }, reussite: journal('BRANCHE'), echec: journal('BRANCHE') });

/** Les lignes du journal qui sont des marqueurs de ce banc, dans leur ordre. */
const marqueurs = (): string[] => get().journal.map((e) => e.texte).filter((l) => /^[A-Z]+[0-9]?$/.test(l));

function scene(triggers: Trigger[], entities: Scene['entities'] = []): Scene {
  return {
    type: 'scene', id: 't', label: 't', dimensions: { w: 5, h: 5 }, ambiance: 'interieur',
    reliefDefaults: structuredClone(DEFAULT_RELIEF_DEFAULTS), roofDefaults: structuredClone(DEFAULT_ROOF_DEFAULTS),
    layers: [{ z: 0, tiles: new Array(25).fill('sol') }], entities, dialogues: [], triggers, encounters: [], flags: {},
  };
}
const declencheur = (id: string, flow: Flow): Trigger => ({ id, rect: { x: 0, y: 0, w: 5, h: 5 }, once: true, flow });

/** Joue un Flow de scène par l'exécuteur unique. */
const runFlowDeScene = (flow: Flow): void => { runFlow(get, banc.setState, flow); };

/** Lance puis valide le Test de scène ouvert. */
function resoudreLeTest(): void {
  get().jetLancer('test');
  get().jetValider('test');
}

beforeEach(() => {
  banc.setState({
    screen: 'campaign', battle: null, mode: 'exploration', party: [heros(1), heros(2)], partyPos: { x: 2, y: 2 },
    flags: {}, etats: {}, journal: [], dialogue: null, document: null, pendingTest: null, pendingDesignationHeros: null,
    pendingExtendedTest: null, pendingCascade: null, scheduledEffects: [],
    campaignNarratif: NARRATIF,
  });
  get().ensemencerLeTirage(7);
});

describe('déclencheurs de la même case (sonde A) : le suivant attend le geste du premier', () => {
  it('document A puis drapeau, puis document B : B ne recouvre pas A, la suite du premier n’est pas perdue', () => {
    banc.setState({ scene: scene([
      declencheur('t1', sequence(effet({ type: 'document', documentId: 'document-a' }), effet({ type: 'setFlag', flag: 'apres-a' }))),
      declencheur('t2', effet({ type: 'document', documentId: 'document-b' })),
    ]) });
    checkTriggers(get, banc.setState);
    expect(get().document?.documentId).toBe('document-a');
    expect(get().flags['apres-a']).toBeUndefined();
    get().fenetreFermer('document');
    expect(get().flags['apres-a']).toBe(true);
    expect(get().document?.documentId).toBe('document-b');
    get().fenetreFermer('document');
    expect(get().document).toBeNull();
  });

  it('désignation : le déclencheur suivant se joue au choix, après la suite du premier', () => {
    banc.setState({ scene: scene([
      declencheur('t1', sequence(effet({ type: 'designerHeros', etat: 'sosie' }), journal('APRES'))),
      declencheur('t2', journal('SUIVANT')),
    ]) });
    checkTriggers(get, banc.setState);
    expect(marqueurs()).toEqual([]);
    get().fenetreChoisir('designationHeros', 'heros', 'h-2');
    expect(marqueurs()).toEqual(['APRES', 'SUIVANT']);
  });

  it('Test étendu : le déclencheur suivant attend son issue', () => {
    banc.setState({ scene: scene([
      declencheur('t1', effet({ type: 'extendedTest', characteristic: 'force', difficulty: 'facile', label: 'Enfoncer', drCible: 3, flag: 'cede' })),
      declencheur('t2', journal('SUIVANT')),
    ]) });
    checkTriggers(get, banc.setState);
    expect(get().pendingExtendedTest).not.toBeNull();
    expect(marqueurs()).toEqual([]);
    get().jetAnnuler('testEtendu');
    expect(marqueurs()).toEqual(['SUIVANT']);
  });

  it('nœud `test` : branche, suite du premier, puis le suivant — rien sous la modale', () => {
    banc.setState({ scene: scene([declencheur('t1', sequence(testDeForce(), journal('APRES'))), declencheur('t2', journal('SUIVANT'))]) });
    checkTriggers(get, banc.setState);
    expect(get().pendingTest).not.toBeNull();
    expect(marqueurs()).toEqual([]);
    resoudreLeTest();
    expect(marqueurs()).toEqual(['BRANCHE', 'APRES', 'SUIVANT']);
  });
});

describe('action jouée sur un décor : l’horloge et le sort du décor suivent le jet', () => {
  it('l’action dont le Flow est un Test n’avance l’horloge qu’après le jet, et retire le décor ensuite', () => {
    banc.setState({ scene: scene([], [{ id: 'caisse', kind: 'prop', decor: { id: 'caisse' }, pos: { x: 3, y: 2 }, label: 'Caisse',
      usable: { actions: [{ id: 'forcer', label: 'Forcer', minutes: 30, consume: true, flow: testDeForce() }] } }]) } as never);
    const avant = get().gameTime;
    get().jouerAction('caisse', 'forcer');
    expect(get().pendingTest).not.toBeNull();
    expect(get().gameTime, 'l’horloge ne court pas sous la modale').toBe(avant);
    expect(get().scene!.entities.some((e) => e.id === 'caisse')).toBe(true);
    resoudreLeTest();
    expect(get().gameTime).toBe(avant + 30);
    expect(get().scene!.entities.some((e) => e.id === 'caisse')).toBe(false);
  });
});

describe('choix de dialogue : le dialogue avance après la clôture du geste', () => {
  const dialogue = (flow: Flow): Dialogue => ({
    id: 'd', start: { id: 'n1' },
    nodes: [{ id: 'n1', desc: '…', choices: [{ id: 'tenter', label: 'Tenter', next: { id: 'n2' }, flow }] }, { id: 'n2', desc: 'Suite', choices: [] }],
  });

  it('désignation', () => {
    banc.setState({ dialogue: { dialogue: dialogue(effet({ type: 'designerHeros', etat: 'sosie' })), nodeId: 'n1', session: 1 } });
    get().fenetreChoisir('dialogue', 'reponse', 'tenter');
    expect(get().dialogue?.nodeId).toBe('n1');
    get().fenetreChoisir('designationHeros', 'heros', 'h-1');
    expect(get().dialogue?.nodeId).toBe('n2');
  });

  it('Test', () => {
    banc.setState({ dialogue: { dialogue: dialogue(testDeForce()), nodeId: 'n1', session: 1 } });
    get().fenetreChoisir('dialogue', 'reponse', 'tenter');
    expect(get().dialogue?.nodeId).toBe('n1');
    resoudreLeTest();
    expect(get().dialogue?.nodeId).toBe('n2');
  });
});

describe('geste ouvert en profondeur', () => {
  it('un effet programmé tiré par `setTime` ouvre la désignation : le reste du lot attend le choix', () => {
    banc.setState({ gameTime: 8 * 60, scheduledEffects: [{ executeAt: 9 * 60, flow: flowFromEffects([{ type: 'designerHeros', etat: 'sosie' }]) }] });
    applyEffects(get, banc.setState, [{ type: 'setTime', hour: 10 }, { type: 'journal', desc: 'APRES' }]);
    expect(get().pendingDesignationHeros?.etat).toBe('sosie');
    expect(marqueurs()).toEqual([]);
    get().fenetreChoisir('designationHeros', 'heros', 'h-1');
    expect(marqueurs()).toEqual(['APRES']);
  });
});

describe('le porteur qui s’ouvre dans une séquence d’un autre `purpose` la parque sans perdre la main', () => {
  it('[chute, Test, X] : le Test ouvert sous le dé de chute parque sa séquence ; X attend le Test', () => {
    banc.setState({ party: [heros(1)] });
    get().ensemencerLeTirage(3);
    banc.setState({ journal: [] });
    runFlowDeScene(sequence(effet({ type: 'fall', target: 'groupe', metres: 4 }), testDeForce(), journal('APRES')));
    const chute = get().pendingCascade!.participants[0];
    expect(chute.kind).toBe('chuteDe');
    get().jetImposerLeResultat('cascadeTirage', 8, chute.id);
    get().jetValider('cascade');
    expect(get().pendingTest).not.toBeNull();
    expect(marqueurs(), 'X ne se joue pas sous la modale du Test').toEqual([]);
    resoudreLeTest();
    expect(marqueurs()).toEqual(['BRANCHE', 'APRES']);
  });
});

describe('un geste hors cascade ne s’ouvre pas sur un autre', () => {
  it('un second document remis pendant qu’un premier tient la main lève au lieu de l’écraser', () => {
    get().remettreLeDocument({ title: 'A', text: 'a' });
    expect(() => get().remettreLeDocument({ title: 'B', text: 'b' })).toThrow(/tient la main/);
    expect(get().document?.title).toBe('A');
  });
});
