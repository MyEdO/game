/**
 * L'ADVERSAIRE DE TAVERNE À FICHE (#1279 S4-b) — un PNJ de la SCÈNE joue de SA fiche, jamais d'une
 * valeur nue recopiée.
 *
 * Le RAW authore ce cas deux fois, et c'est un PNJ NOMMÉ qui propose la partie, jamais une abstraction :
 *  · `NADJ 04 l.72` — « Elle jouera une partie de L'Impératrice écarlate avec quiconque lui propose,
 *    la mise de départ étant d'1 pistole par partie. »
 *  · `EDO 01 l.200` — « il leur propose une partie d'Impératrice Écarlate, un jeu de cartes populaire
 *    dans l'Empire, pour passer le temps. »
 *
 * CE QUE CES TESTS VERROUILLENT : la valeur de Test de l'adversaire est DÉRIVÉE de sa fiche par les
 * collecteurs canoniques (`tavernGameValue` → `testValue`, avances comprises) — donc deux PNJ aux
 * avances différentes ne jouent PAS la même valeur, et aucun ne joue celle du challenger.
 *
 * HORS PÉRIMÈTRE, DIT (#1279 S4-c) : ce que la partie ÉCRIRAIT sur cette fiche (États d'attrition,
 * bourse) ne s'y dépose pas — la dérivation est éphémère, faute de registre de Combatants persistants
 * hors combat. Aucun test ici ne le simule.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { findTavernGameById } from '../engine/tavernGame';
import { playTavernGame, tavernGameValue, tavernNpcOffers } from './tavernFlow';
import { sceneNpc } from './sceneNpc';
import { activeSequence, sequenceBoardOf } from './sequenceCore';
import { cascadeAppliers } from './cascade';
import type { CascadeStep } from './pendings';
import { applyEffects } from './combatEffects';
import { setRule, resetRule } from '../engine/policy';
import { emptyScene } from './scene';
import { t } from '../i18n';
import { fixtureText } from '../i18n/fixtureText';
import type { Combatant } from '../engine/types';
import { scenario as scenarioEdo } from '../scenes/test-scenarios/96-presets-edo';

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

/** Une entité de scène `personnage` à statbloc AUTHORÉ. `CustomStatblock.skills` porte la valeur de
 *  Test FINALE (`SkillRef`) ; les avances s'en dérivent au spawn (valeur − Caractéristique) — c'est donc
 *  bien une FICHE que l'on pose, pas un nombre de Test posé à la main sur la partie. */
function pnjDeScene(id: string, label: string, pariFinal: number, offre?: { gameId: string; stakeBrass?: number }) {
  return {
    id, kind: 'personnage' as const, pos: { x: 2, y: 2 }, label,
    statblock: {
      type: 'statblock' as const,
      label,
      char: {
        'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
        agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
      },
      skills: [{ id: 'pari', value: pariFinal }],
    },
    ...(offre ? { tavernGame: offre } : {}),
  };
}

function poseScene(entities: ReturnType<typeof pnjDeScene>[]): void {
  const party = makePregens().slice(0, 2) as Combatant[];
  set({ party, scene: { ...emptyScene(), entities }, battle: null, sequence: null, pendingCascade: null });
}

describe('#1279 S4-b — l’adversaire de taverne à FICHE', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); });

  it('sa valeur de jeu est DÉRIVÉE de sa fiche : deux PNJ aux avances de Pari différentes ne jouent pas la même', () => {
    poseScene([pnjDeScene('pnj-fort', 'Plantule', 70), pnjDeScene('pnj-faible', 'Un quidam', 30)]);
    const jeu = findTavernGameById('dominos')!;
    const fort = sceneNpc(get().scene, 'pnj-fort')!;
    const faible = sceneNpc(get().scene, 'pnj-faible')!;

    expect(tavernGameValue(fort, jeu)).toBe(tavernGameValue(faible, jeu) + 40);
    // …et surtout : ce ne sont PAS des valeurs de table, ce sont des lectures de fiche.
    expect(tavernGameValue(faible, jeu)).toBe(30);
  });

  it('la partie ouverte contre lui porte SA valeur et SON nom — jamais un id brut ni une valeur saisie', () => {
    poseScene([pnjDeScene('pnj-plantule', 'Plantule', 55)]);
    const jeu = findTavernGameById('dominos')!;
    const challenger = get().party[0]!;

    playTavernGame(get, set, { gameId: 'dominos', challengerId: challenger.id, opponent: { kind: 'npc', id: 'pnj-plantule' } });

    const seq = activeSequence<{ opponentValue: number; opponentName: string; opponentId?: string }>(get)!;
    expect(seq.payload.opponentId).toBe('pnj-plantule');
    expect(seq.payload.opponentName).toBe('Plantule');
    expect(seq.payload.opponentValue).toBe(tavernGameValue(sceneNpc(get().scene, 'pnj-plantule')!, jeu));
    expect(seq.payload.opponentValue).toBe(55);
  });

  it('la valeur du PNJ est la SIENNE, pas celle du challenger (le défaut de l’adversaire abstrait)', () => {
    poseScene([pnjDeScene('pnj-plantule', 'Plantule', 55)]);
    const challenger = get().party[0]!;
    const jeu = findTavernGameById('dominos')!;

    playTavernGame(get, set, { gameId: 'dominos', challengerId: challenger.id, opponent: { kind: 'npc', id: 'pnj-plantule' } });
    const seq = activeSequence<{ opponentValue: number }>(get)!;

    expect(seq.payload.opponentValue).not.toBe(tavernGameValue(challenger, jeu));
  });

  it('la SCÈNE décide : `tavernGame` sur l’entité déclare le jeu et la mise de départ (patron `NADJ 04 l.72`)', () => {
    poseScene([
      pnjDeScene('pnj-plantule', 'Plantule', 55, { gameId: 'dominos', stakeBrass: 12 }),
      pnjDeScene('pnj-muet', 'Un buveur', 35),
    ]);

    const offres = tavernNpcOffers(get().scene);
    expect(offres).toHaveLength(1);
    expect(offres[0]).toMatchObject({ id: 'pnj-plantule', label: 'Plantule', gameId: 'dominos', stakeBrass: 12 });
  });

  it('un id qui ne désigne aucun PNJ de scène n’ouvre AUCUNE partie (jamais un repli silencieux sur une valeur)', () => {
    poseScene([pnjDeScene('pnj-plantule', 'Plantule', 55)]);
    const challenger = get().party[0]!;

    playTavernGame(get, set, { gameId: 'dominos', challengerId: challenger.id, opponent: { kind: 'npc', id: 'pnj-fantome' } });

    expect(activeSequence(get)).toBeNull();
    expect(get().journal.slice(-1)[0]).toBe(t('tavern.adversaireAbsent', { jeu: findTavernGameById('dominos')!.label }));
  });
});

describe('#1906 — une partie REFUSÉE le dit au journal, jamais un retour muet', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); poseScene([]); });
  const dominos = () => findTavernGameById('dominos')!.label;

  it('jeu inconnu', () => {
    playTavernGame(get, set, { gameId: 'jeu-fantome', challengerId: get().party[0]!.id, opponent: { kind: 'profil', id: 'humain' } });
    expect(activeSequence(get)).toBeNull();
    expect(get().journal.slice(-1)[0]).toBe(t('tavern.jeuInconnu', { id: 'jeu-fantome' }));
  });

  it('challenger sorti du groupe', () => {
    playTavernGame(get, set, { gameId: 'dominos', challengerId: 'heros-parti', opponent: { kind: 'profil', id: 'humain' } });
    expect(activeSequence(get)).toBeNull();
    expect(get().journal.slice(-1)[0]).toBe(t('tavern.challengerAbsent', { jeu: dominos() }));
  });

  it('adversaire héros sorti du groupe', () => {
    playTavernGame(get, set, { gameId: 'dominos', challengerId: get().party[0]!.id, opponent: { kind: 'hero', id: 'heros-parti' } });
    expect(activeSequence(get)).toBeNull();
    expect(get().journal.slice(-1)[0]).toBe(t('tavern.adversaireAbsent', { jeu: dominos() }));
  });

  it('socle : un challenger disparu en cours de séquence LÈVE, jamais un tableau muet', () => {
    playTavernGame(get, set, { gameId: 'dominos', challengerId: get().party[0]!.id, opponent: { kind: 'profil', id: 'humain' } });
    const seq = activeSequence(get);
    expect(seq).not.toBeNull();
    set({ sequence: { ...seq!, payload: { ...(seq!.payload as object), challengerId: 'heros-parti' } } } as never);
    expect(() => sequenceBoardOf(get)).toThrow(/tableau de taverne — challenger/);
  });

  it('étape `tavern-drink` sans lanceur : erreur nommée, jamais un id affiché pour nom', () => {
    const step: CascadeStep = { id: 'pinte', kind: 'tavern-drink', label: fixtureText('Pinte'), actorId: get().party[0]!.id, result: { roll: 90, target: 40, sl: -5, success: false } };
    expect(() => cascadeAppliers['tavern-drink']!.apply(get, set, step, undefined, { steps: [step], index: 0 })).toThrow(/tavern-drink.*torchonRate/);
  });

  it('profil de coéquipier inconnu', () => {
    const jeu = findTavernGameById('middenball')!;
    playTavernGame(get, set, { gameId: jeu.id, challengerId: get().party[0]!.id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'profil-fantome' });
    expect(activeSequence(get)).toBeNull();
    expect(get().journal.slice(-1)[0]).toBe(t('tavern.coequipierSansProfil', { jeu: jeu.label, profil: 'profil-fantome' }));
  });
});

/**
 * LE CAS RÉELLEMENT LIVRÉ (#1279 S4-b) — un PNJ nommé de campagne porte son profil par `presetId`,
 * et n'a NI `ref` NI `statblock`. Les cas synthétiques ci-dessus (tous à `statblock`) étaient
 * AVEUGLES à cette forme : sans routage du preset, `spawnEnemy` tombait en branche « ref absente » et
 * rendait une fiche vide au nom générique — l'adversaire à fiche redevenait l'adversaire nu.
 */
describe('#1279 S4-b — le PNJ authoré par PRESET (forme réelle de la campagne)', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); });

  it('un PNJ à `presetId` joue de SON profil de campagne — nom et Compétence, jamais un repli générique', () => {
    set({
      party: makePregens().slice(0, 2) as Combatant[],
      campaignNarratif: scenarioEdo.narratif,
      scene: { ...emptyScene(), entities: scenarioEdo.scene.entities },
      battle: null, sequence: null, pendingCascade: null,
    });

    const phillipe = sceneNpc(get().scene, 'npc-phillipe');
    expect(phillipe, 'le preset doit se résoudre en fiche').toBeTruthy();
    expect(phillipe!.label).toBe('Phillipe Descartes');
    // `EDO 23` lui donne Pari 50 : c'est SA valeur qui doit sortir du collecteur canonique, pas un
    // défaut de Caractéristique.
    expect(tavernGameValue(phillipe!, findTavernGameById('dominos')!)).toBe(50);
  });

  it('la scène EDO le déclare joueur de taverne, et la modale lit son jeu ET sa mise authorés', () => {
    set({
      party: makePregens().slice(0, 2) as Combatant[],
      campaignNarratif: scenarioEdo.narratif,
      scene: { ...emptyScene(), entities: scenarioEdo.scene.entities },
      battle: null, sequence: null, pendingCascade: null,
    });

    const offres = tavernNpcOffers(get().scene);
    expect(offres).toEqual([{ id: 'npc-phillipe', label: 'Phillipe Descartes', gameId: 'dominos', stakeBrass: 24 }]);
  });
});

/**
 * LE NOM VIENT DE L'ENTITÉ (L2 #1548) — un PNJ de taverne renommé par l'auteur joue et s'affiche sous
 * SON nom, jamais sous le libellé d'espèce de la fiche qu'il référence. Même invariant que l'infirmerie
 * (`arene-flow.test.ts` « Frère Anselm ») : la fiche donne les VALEURS, l'entité donne le NOM — et il
 * est résolu par la projection UNIQUE `sceneNpc`, pas recomposé au site.
 */
describe('L2 #1548 — le PNJ de taverne RENOMMÉ garde son nom', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); });

  /** Entité renommée : le statbloc porte le libellé d'ESPÈCE, l'entité le nom de l'AUTEUR. */
  function pnjRenomme(id: string, nom: string, espece: string, offre?: { gameId: string; stakeBrass?: number }) {
    const e = pnjDeScene(id, espece, 45, offre);
    return { ...e, label: nom };
  }

  it('l’offre de la salle porte le nom de l’ENTITÉ, pas le libellé de sa fiche', () => {
    poseScene([pnjRenomme('pnj-gerta', 'Gerta la Rusée', 'Batelière', { gameId: 'dominos', stakeBrass: 12 })]);

    expect(sceneNpc(get().scene, 'pnj-gerta')!.label).toBe('Gerta la Rusée');
    expect(tavernNpcOffers(get().scene)[0]).toMatchObject({ id: 'pnj-gerta', label: 'Gerta la Rusée' });
  });

  it('la manche ouverte contre lui le NOMME de son nom d’auteur, et joue les valeurs de sa fiche', () => {
    poseScene([pnjRenomme('pnj-gerta', 'Gerta la Rusée', 'Batelière')]);
    const challenger = get().party[0]!;

    playTavernGame(get, set, { gameId: 'dominos', challengerId: challenger.id, opponent: { kind: 'npc', id: 'pnj-gerta' } });

    const seq = activeSequence<{ opponentName: string; opponentValue: number }>(get)!;
    expect(seq.payload.opponentName).toBe('Gerta la Rusée');
    expect(seq.payload.opponentValue).toBe(45); // Pari de la FICHE
  });
});

/**
 * LES TROIS LECTURES ÉLARGIES (`tavernActor`) — sans elles, un adversaire de SCÈNE n'est pas trouvé
 * dans `party`, la manche retombe sur le montage MONO à jet adverse figé, et le PNJ à fiche perd sa
 * rangée. La sonde mesure la RANGÉE, pas la valeur : c'est elle que le repli faisait disparaître.
 */
describe('#1279 S4-b — l’adversaire de scène GARDE sa rangée dans la manche', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); });

  it('la manche ouvre une BANDE à deux rangées (challenger + PNJ), jamais un mono à jet figé', () => {
    poseScene([pnjDeScene('pnj-plantule', 'Plantule', 55)]);
    const challenger = get().party[0]!;

    playTavernGame(get, set, { gameId: 'dominos', challengerId: challenger.id, opponent: { kind: 'npc', id: 'pnj-plantule' } });

    const rows = get().pendingCascade?.participants.flatMap((s) => s.participants ?? []) ?? [];
    expect(rows.map((r) => r.id).sort()).toEqual([challenger.id, 'pnj-plantule'].sort());
  });
});

/**
 * LE PROPOSEUR OUVRE SA TABLE (#1279, dernier delta) — quand c'est le DIALOGUE d'un PNJ qui ouvre les
 * jeux (« Volontiers, une partie ? »), la modale s'ouvre sur SON offre : le joueur qui vient
 * d'accepter n'a pas à re-désigner celui qui la lui proposait. Le déclencheur est GÉNÉRIQUE — le
 * speaker du dialogue en cours (`state.dialogue.speakerId`) s'il porte une offre (`tavernGame`) —
 * jamais un id de PNJ nommé au code.
 */
describe('#1279 — la table s’ouvre sur l’offre du PROPOSEUR', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); setRule('tavern-games', true); });
  afterAll(() => { resetRule('tavern-games'); });

  it('l’Effet de dialogue du proposeur PASSE son id : la modale s’ouvre pré-sélectionnée sur lui', () => {
    poseScene([pnjDeScene('pnj-plantule', 'Plantule', 55, { gameId: 'dominos', stakeBrass: 12 })]);
    set({ dialogue: { dialogue: { id: 'd', start: 'n1', nodes: [] }, nodeId: 'n1', speakerId: 'pnj-plantule' } as never });

    applyEffects(get, set, [{ type: 'openTavernGames' }]);

    expect(get().tavernGames, 'la table est ouverte').toBeTruthy();
    expect(get().tavernGames!.npcId, 'sur l’offre de CELUI QUI PARLE').toBe('pnj-plantule');
  });

  it('hors dialogue (affordance du lieu), l’ouverture reste GÉNÉRIQUE : aucun PNJ imposé', () => {
    poseScene([pnjDeScene('pnj-plantule', 'Plantule', 55, { gameId: 'dominos' })]);
    set({ dialogue: null });

    applyEffects(get, set, [{ type: 'openTavernGames' }]);

    expect(get().tavernGames).toBeTruthy();
    expect(get().tavernGames!.npcId, 'le joueur choisit tout').toBeUndefined();
  });

  it('un speaker SANS offre n’impose rien (le prédicat lit la donnée de la scène, pas l’identité)', () => {
    poseScene([pnjDeScene('pnj-muet', 'Un quidam', 30)]); // aucune `tavernGame`
    set({ dialogue: { dialogue: { id: 'd', start: 'n1', nodes: [] }, nodeId: 'n1', speakerId: 'pnj-muet' } as never });

    applyEffects(get, set, [{ type: 'openTavernGames' }]);

    expect(get().tavernGames!.npcId).toBeUndefined();
  });
});

/** #1882 — un personnage SANS fiche n'a aucune valeur à opposer : la salle ne le propose pas (jamais sous
 *  son id brut), sa faute est dite à l'auteur par `validateScene`. */
describe('#1882 — la salle ne propose que des adversaires À FICHE', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); });

  it('un proposeur sans porteur de fiche est exclu de l’offre ; le proposeur à fiche reste', () => {
    const { statblock: _sansFiche, ...sansFiche } = pnjDeScene('pnj-vide', 'Sans fiche', 40, { gameId: 'dominos' });
    poseScene([pnjDeScene('pnj-gerta', 'Gerta', 45, { gameId: 'dominos' }), sansFiche as ReturnType<typeof pnjDeScene>]);
    expect(tavernNpcOffers(get().scene).map((o) => o.id)).toEqual(['pnj-gerta']);
  });
});
