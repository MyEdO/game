// @vitest-environment jsdom
/**
 * La table de taverne ouverte par le PNJ qui PROPOSE la partie (`SceneEntity.tavernGame`, `NADJ 04 l.72`) :
 * elle s'ouvre sur SON offre, et elle CÈDE à la modale de jet tant que l'arbitre en tient une — une
 * situation = une modale (`docs/ajouter-un-flux-de-jet.md`).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { useGame } from '../state/store';
import { pregenParty, PREGEN } from '../data/pregens';
import { setRule, resetRule } from '../engine/policy';
import { seedBattleRng } from '../state/battleRng';
import { pickActiveModalKey } from '../state/modalArbiter';
import { scenario } from '../scenes/test-scenarios/taverne-profil-standard';
import { TavernGameModal } from './TavernGameModal';
import { TAVERN_GAMES, findTavernGameById } from '../engine/tavernGame';
import { creatureLabel, profilsStandard } from '../data';
import { pnjAuProfil } from '../state/sceneNpc';
import { tavernGameValue } from '../state/tavernFlow';
import { activeSequence } from '../state/sequenceCore';
import { ActiveModal } from './ActiveModal';

const PNJ = 'habitue-bras-de-fer';
const g = useGame.getState;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  useGame.setState(useGame.getInitialState(), true);
  setRule('tavern-games', true);
  seedBattleRng(7);
  const dlg = scenario.scene.dialogues.find((d) => d.id === 'dlg-bras-de-fer')!;
  useGame.setState({
    party: pregenParty(PREGEN.soldat, PREGEN.chasseur),
    scene: scenario.scene,
    dialogue: { dialogue: dlg, nodeId: dlg.start, speakerId: PNJ },
  } as never);
});
afterEach(demonterRacines);
afterAll(() => { resetRule('tavern-games'); });

/** Le joueur choisit « Relever le défi. » dans le dialogue du PNJ — le geste réel. */
const releverLeDefi = () => act(() => { g().chooseDialogue(0); });

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
    act(() => { useGame.setState({ party: [soldat], dialogue: null } as never); g().openTavernGames(); });
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
    expect(seq.payload).toMatchObject({ opponentName: elfe.label, opponentValue: tavernGameValue(elfe, jeu) });
  });
});

describe('Taverne — une situation = une modale', () => {
  it('pendant la manche, seule la modale de jet est à l’écran : la table cède', () => {
    releverLeDefi();
    const [soldat] = g().party;
    act(() => { g().playTavernGame({ gameId: 'bras-de-fer', challengerId: soldat.id, opponent: { kind: 'npc', id: PNJ } }); });
    expect(pickActiveModalKey(g()), 'l’arbitre tient la manche').toBe('cascade');
    monterRacine(<><ActiveModal /><TavernGameModal /></>);
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);
    expect(document.querySelector('.tavern-modal')).toBeNull();
  });
});
