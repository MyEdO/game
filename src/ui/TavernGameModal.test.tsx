// @vitest-environment jsdom
/**
 * La table de taverne ouverte par le PNJ qui PROPOSE la partie (`SceneEntity.tavernGame`, `NADJ 04 l.72`) :
 * elle s'ouvre sur SON offre, et elle CÈDE à la modale de jet tant que l'arbitre en tient une — une
 * situation = une modale (`docs/ajouter-un-flux-de-jet.md`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { useGame } from '../state/store';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { setRule, resetRule } from '../engine/policy';
import { seedBattleRng } from '../noyau/battleRng';
import { pickActiveModalKey } from '../noyau/modalArbiter';
import { scenario } from '../scenes/test-scenarios/taverne-profil-standard';
import { TavernGameModal } from './TavernGameModal';
import { TAVERN_GAMES, findTavernGameById } from '../engine/tavernGame';
import { creatureLabel, profilsStandard } from '../data';
import { pnjAuProfil } from '../noyau/monde/sceneNpc';
import { tavernGameValue } from '../noyau/tavernFlow';
import { activeSequence } from '../noyau/sequenceCore';
import { ActiveModal } from './ActiveModal';
import { ouvrirDialogue } from '../noyau/dialogue';
import { setBourseBrass } from '../engine/bourse';
const scenarioConstruit = scenario.construire(idsDeTest);

const PNJ = 'habitue-bras-de-fer';
const g = useGame.getState;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  useGame.setState(useGame.getInitialState(), true);
  setRule('jeux-de-taverne', true);
  seedBattleRng(7);
  const dlg = scenarioConstruit.scene.dialogues.find((d) => d.id === 'dlg-bras-de-fer')!;
  useGame.setState({
    party: groupeDeScenario(idsDeTest, 'soldat', 'chasseur'),
    scene: scenarioConstruit.scene,
    screen: 'campaign',
    dialogue: ouvrirDialogue(g(), dlg, PNJ),
  });
});
afterEach(demonterRacines);
afterAll(() => { resetRule('jeux-de-taverne'); });

/** Le joueur choisit « Relever le défi. » dans le dialogue du PNJ — le geste réel. */
const releverLeDefi = () => act(() => { g().fenetreChoisir('dialogue', 'reponse', 'relever-defi'); });

describe('Taverne — la table s’ouvre sur l’offre du PNJ qui la propose', () => {
  it('le choix du dialogue ouvre la table AU NOM du proposeur', () => {
    releverLeDefi();
    expect(g().tavernGames?.npcId).toBe(PNJ);
  });

  it('le jeu OFFERT et son offreur sont présélectionnés à l’écran', () => {
    releverLeDefi();
    const { container } = monterRacine(<TavernGameModal />);
    const texte = container.ownerDocument.body.textContent ?? '';
    expect(texte).toContain('Habitué de la salle : valeur de jeu 30');
    expect(texte).toContain('Test opposé : Force');
  });
});

describe('Taverne — l’habitué joue une FICHE : un profil standard choisi (LDB 77 l.7, #1929)', () => {
  const ouvrirSeul = () => {
    const [soldat] = g().party;
    act(() => { useGame.setState({ party: [soldat], dialogue: null } as never); g().ouvrirLesJeux(); });
    return monterRacine(<TavernGameModal />).container.ownerDocument;
  };
  const bouton = (doc: Document, texte: string) =>
    [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === texte);

  it('aucun champ libre : les profils standard sont offerts, le premier choisi, sa valeur LUE de sa fiche', () => {
    const doc = ouvrirSeul();
    const jeu = findTavernGameById(TAVERN_GAMES[0].id)!;
    expect(doc.querySelector('input[type="number"]#tavern-opp-value'), 'plus de valeur saisie').toBeNull();
    expect(doc.body.textContent).not.toContain('(MJ)');
    for (const id of profilsStandard()) expect(bouton(doc, creatureLabel(id)), id).toBeTruthy();
    const premier = pnjAuProfil(profilsStandard()[0], 'h')!;
    expect(doc.body.textContent).toContain(`${premier.label} : valeur de jeu ${tavernGameValue(premier, jeu)} (de sa fiche).`);
  });

  it('choisir un profil puis Jouer : la partie oppose CETTE fiche, sous son nom et SA valeur', () => {
    const doc = ouvrirSeul();
    const jeu = findTavernGameById('dominos')!;
    const elfe = pnjAuProfil('elfe-haut-et-sylvain', 'h')!;
    expect(tavernGameValue(elfe, jeu), 'un profil qui se distingue du premier').not.toBe(tavernGameValue(pnjAuProfil(profilsStandard()[0], 'h')!, jeu));
    act(() => { bouton(doc, jeu.label)!.click(); });
    act(() => { bouton(doc, creatureLabel('elfe-haut-et-sylvain'))!.click(); });
    expect(doc.body.textContent).toContain(`${elfe.label} : valeur de jeu ${tavernGameValue(elfe, jeu)} (de sa fiche).`);
    act(() => { bouton(doc, 'Jouer')!.click(); });
    const seq = activeSequence<{ opponentName: string; opponentValue: number }>(g)!;
    expect(seq.chargeUtile).toMatchObject({ opponentName: elfe.label, opponentValue: tavernGameValue(elfe, jeu) });
  });
});

describe('Taverne — une situation = une modale', () => {
  it('pendant la manche, seule la modale de jet est à l’écran : la table cède', () => {
    releverLeDefi();
    const [soldat] = g().party;
    act(() => { g().jouerALaTaverne(soldat.id, { gameId: 'bras-de-fer', opponent: { kind: 'pnj', id: PNJ } }); });
    expect(pickActiveModalKey(g()), 'l’arbitre tient la manche').toBe('cascade');
    monterRacine(<><ActiveModal /><TavernGameModal /></>);
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);
    expect(document.querySelector('.tavern-modal')).toBeNull();
  });
});

describe('Taverne — la mise en sous de cuivre et l’effectif de table : l’écran soumet ce que le geste joue (NADJ 16 l.17)', () => {
  const saisir = (input: HTMLInputElement, valeur: string) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, valeur);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const ouvrirAlZahr = () => {
    const [soldat] = g().party;
    setBourseBrass(soldat, 11, idsDeTest);
    act(() => { useGame.setState({ party: [soldat], dialogue: null } as never); g().ouvrirLesJeux(); });
    const doc = monterRacine(<TavernGameModal />).container.ownerDocument;
    act(() => { [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === findTavernGameById('al-zahr')!.label)!.click(); });
    return { doc, soldat };
  };

  it('sans mise : « Jouer » fermé sur le texte du geste', () => {
    const { doc, soldat } = ouvrirAlZahr();
    expect(doc.querySelector('.gated-action-reason')?.textContent).toBe(`${soldat.label} ne pose aucune mise : aucune partie ne s’ouvre.`);
  });

  it('challenger à 11 sous de cuivre, table de 12 : la partie s’ouvre sur 11 sous et douze sièges', () => {
    const { doc } = ouvrirAlZahr();
    saisir(doc.querySelector('#tavern-stake') as HTMLInputElement, '11');
    saisir(doc.querySelector('#tavern-table-players') as HTMLInputElement, '12');
    const jouer = [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Jouer')!;
    expect(jouer.getAttribute('aria-disabled')).toBeNull();
    act(() => { jouer.click(); });
    const seq = activeSequence<{ stakeBrass: number; seats: unknown[] }>(g);
    expect(seq?.chargeUtile.stakeBrass).toBe(11);
    expect(seq?.chargeUtile.seats).toHaveLength(12);
  });
});
