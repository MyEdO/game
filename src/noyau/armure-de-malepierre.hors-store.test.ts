import { describe, expect, it } from 'vitest';
import { engage, isEngagedWith, setEngaged } from '../engine/engagement';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { armureUtilisable, endommagerLEquipementPorte } from '../engine/items';
import type { Combatant } from '../engine/types';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { testScene } from '../scenes/test-fixture';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { advanceTurn } from './combatFlow';
import { buildEncounter, type AuthoredEnemy } from './monde/encounterAuthoring';

const PIECES = ['plastron', 'brassards', 'jambieres-d-acier', 'heaume'];
const ID_DU_PORTEUR = 'enemy-enc-armure-0';

function installerLeCombat(ref: string, inventaire?: Record<string, boolean>, adversairePnj?: string) {
  const banc = ouvrirLeBanc({ desFixes: true });
  const party = groupeDeScenario(idsDeTest, 'soldat', 'tueur', 'chasseur', 'pretre');
  const scene = testScene();
  const enemies: AuthoredEnemy[] = [{
    creature: { id: ref }, pos: { x: 7, y: 10 }, inventaire, side: adversairePnj ? 'allie' : 'ennemi',
  }];
  if (adversairePnj) enemies.push({ creature: { id: adversairePnj }, pos: { x: 7, y: 11 } });
  const { entities, encounter } = buildEncounter({ id: 'enc-armure', enemies });
  scene.entities = [scene.entities[0], ...entities];
  scene.encounters = [encounter];
  banc.setState({ party });
  banc.getState().lancerLaScene(scene);
  banc.getState().lancerLeCombat(encounter.id, undefined, { noSurprise: true });
  const battle = banc.getState().battle!;
  const order = [...party.map((h) => h.id), ...entities.map((e) => e.id)];
  banc.setState({ battle: { ...battle, order, baseOrder: order } });
  const combattant = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;
  return {
    banc,
    porteur: () => combattant(ID_DU_PORTEUR),
    heros: () => party.map((h) => combattant(h.id)),
    combattant,
  };
}

function finDuDernierTour(banc: Banc) {
  const battle = banc.getState().battle!;
  banc.setState({ battle: { ...battle, turn: battle.order.length - 1 } });
  advanceTurn(banc.getState, banc.setState);
  expect(banc.getState().battle?.round).toBe(battle.round + 1);
}

function expositions(banc: Banc) {
  const { pendingCorruption, corruptionQueue } = banc.getState();
  return [pendingCorruption, ...corruptionQueue].flatMap((p) => p ? [
    [p.heroId, p.level, p.test?.skill?.id, p.test?.difficulty, p.menace],
  ] : []);
}

const mineure = (id: string) => [id, 'mineure', 'resistance', 'intermediaire', 'corruption'];

function resister(banc: Banc, id: string) {
  const jeu = banc.getState();
  expect(jeu.pendingCorruption?.heroId).toBe(id);
  jeu.jetImposerLeResultat('corruption', 1);
  banc.getState().jetValider('corruption');
}

function piecesDeMalepierre(porteur: Combatant) {
  return (porteur.items ?? []).filter((i) => i.qualities?.some((q) => q.id === 'armure-de-malepierre'));
}

describe('Armure de malepierre — MDG 16 l.506, arbitrage du 2026-11-16 (#4372)', () => {
  it('au premier Round puis aux deux suivants, seuls les adversaires encore Engagés ont un Test par Round', () => {
    const { banc, porteur, heros } = installerLeCombat('vrisk-gratte-le-fer');
    const [a, b, proche, ancien] = heros();
    expect(piecesDeMalepierre(porteur()).filter((i) => i.equipped).map((i) => i.trappingId)).toEqual(PIECES);
    expect(banc.getState().pendingRoundStart?.round).toBe(1);
    banc.getState().fenetreValider('debutDuRound');
    expect(expositions(banc)).toEqual([]);

    proche.pos = { x: 7, y: 9 };
    engage(a, porteur());
    engage(porteur(), b);
    setEngaged(ancien, porteur());
    finDuDernierTour(banc);
    expect(expositions(banc)).toEqual([mineure(a.id), mineure(b.id)]);
    expect(isEngagedWith(porteur(), ancien.id)).toBe(false);

    resister(banc, a.id);
    resister(banc, b.id);
    expect(expositions(banc)).toEqual([]);

    banc.getState().fenetreValider('debutDuRound');
    const [adversaire] = heros();
    engage(adversaire, porteur());
    finDuDernierTour(banc);
    expect(expositions(banc)).toEqual([mineure(adversaire.id)]);
    resister(banc, adversaire.id);

    banc.getState().fenetreValider('debutDuRound');
    for (let coup = 0; coup < 3; coup++) endommagerLEquipementPorte(porteur());
    expect(piecesDeMalepierre(porteur()).filter(armureUtilisable)).toEqual([]);
    engage(heros()[0], porteur());
    finDuDernierTour(banc);
    expect(expositions(banc)).toEqual([]);
  });

  it('un adversaire PNJ soumis aux règles de personnage joue un seul Test en ligne', () => {
    const { banc, porteur, combattant } = installerLeCombat('vrisk-gratte-le-fer', undefined, 'marta-gerbenshreiber');
    const cible = combattant('enemy-enc-armure-1');
    expect(cible).toMatchObject({ kind: 'ennemi', followsCharacterRules: true });
    banc.getState().fenetreValider('debutDuRound');
    engage(cible, porteur());
    finDuDernierTour(banc);
    expect(expositions(banc)).toEqual([]);
    const lignes = banc.getState().battle!.log.filter((e) =>
      e.actorId === porteur().id && e.text.includes(cible.label) && e.text.includes('Test de Résistance Intermédiaire (+0)'),
    );
    expect(lignes).toHaveLength(1);
  });

  it.each(PIECES)('la pièce %s portée seule suffit', (seulePortee) => {
    const inventaire = Object.fromEntries(PIECES.filter((id) => id !== seulePortee).map((id) => [id, false]));
    const { banc, porteur, heros } = installerLeCombat('vrisk-gratte-le-fer', inventaire);
    expect(piecesDeMalepierre(porteur()).map((i) => [i.trappingId, i.equipped])).toEqual(
      PIECES.map((id) => [id, id === seulePortee]),
    );
    banc.getState().fenetreValider('debutDuRound');
    const [adversaire] = heros();
    engage(adversaire, porteur());
    finDuDernierTour(banc);
    expect(expositions(banc)).toEqual([mineure(adversaire.id)]);
  });

  it.each([
    { ref: 'vrisk-gratte-le-fer', inventaire: Object.fromEntries(PIECES.map((id) => [id, false])) },
    { ref: 'wulfrik', inventaire: undefined },
  ])('$ref n’expose personne sans pièce porteuse équipée', ({ ref, inventaire }) => {
    const { banc, porteur, heros } = installerLeCombat(ref, inventaire);
    expect(porteur().items?.find((i) => i.trappingId === 'cotte-de-mailles')?.equipped).toBe(true);
    expect(piecesDeMalepierre(porteur()).map((i) => [i.trappingId, i.equipped])).toEqual(
      inventaire ? PIECES.map((id) => [id, false]) : [],
    );
    banc.getState().fenetreValider('debutDuRound');
    const [adversaire] = heros();
    engage(adversaire, porteur());
    finDuDernierTour(banc);
    expect(expositions(banc)).toEqual([]);
  });
});
