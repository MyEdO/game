/**
 * L'EXPLORÉ S'ACCUMULE AU NOYAU (#3059 E4) : la transition du jeu fond la vue du groupe dans
 * `explored[sceneId]` à chaque écriture qui change une entrée de la vision (`transitionDuJeu.ts`,
 * `exploreeVue`), sans stage ni appel d'hôte. Couloir d'une rangée : à `lightLevel` 0 le groupe ne voit que
 * sa case, la nuit (`gameTime` 0) six cases devant lui, le jour toute la rangée (`visionState.test.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { afterEach, describe, expect, it } from 'vitest';
import { ouvrirLeBanc, surUnBancHorsTest, type Banc } from './banc.testkit';
import { emptyScene, type Scene } from './monde/scene';
import { registerScene, resetSceneRegistry } from './monde/registreDesScenes';
import { computeStateVisible } from './visionState';
import { appliquerLInstantane, instantaneDeLaCoop } from './coop';
import { initialNet, type EtatDeJeu } from './etat';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

const MIDI = 12 * 60;
const HEROS = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 7 });

afterEach(() => resetSceneRegistry());

const couloir = (id: string): Scene => emptyScene(id, 7, 1);
const rangee = (...xs: number[]): string[] => xs.map((x) => `${x},0,0`).sort();
const explore = (banc: Banc, sceneId: string): string[] => [...(banc.getState().explored[sceneId] ?? [])].sort();

/** Le groupe en exploration à la case 0 du couloir `scene`. */
function poser(banc: Banc, scene: Scene, etat: Partial<EtatDeJeu>): void {
  banc.setState({ scene, mode: 'exploration', party: [HEROS], partyPos: { x: 0, y: 0, z: 0 }, battle: null, dialogue: null, explored: {}, ...etat });
}

describe('l’exploré suit la vision à chaque écriture, sans stage', () => {
  it('une marche de six pas, jouée en UN appel, retient chacune des six vues', () => {
    const banc = ouvrirLeBanc();
    poser(banc, couloir('couloir'), { gameTime: MIDI, lightLevel: 0 });
    expect(explore(banc, 'couloir')).toEqual(rangee(0));

    banc.actions.cliquerLaCase({ x: 6, y: 0, z: 0 });

    expect(banc.getState().partyPos).toMatchObject({ x: 6, y: 0 });
    expect(explore(banc, 'couloir')).toEqual(rangee(0, 1, 2, 3, 4, 5, 6));
  });

  it('une heure qui passe accumule ce que le jour révèle', () => {
    const banc = ouvrirLeBanc();
    poser(banc, couloir('couloir'), { gameTime: 0, lightLevel: null });
    expect(explore(banc, 'couloir')).toEqual(rangee(0, 1, 2, 3, 4, 5));

    banc.actions.avancerLeTemps(MIDI);

    expect(explore(banc, 'couloir')).toEqual(rangee(0, 1, 2, 3, 4, 5, 6));
  });

  it('une lumière qui change accumule ce qu’elle révèle', () => {
    const banc = ouvrirLeBanc();
    poser(banc, couloir('couloir'), { gameTime: MIDI, lightLevel: 0 });

    banc.setState({ lightLevel: null });

    expect(explore(banc, 'couloir')).toEqual(rangee(0, 1, 2, 3, 4, 5, 6));
  });

  it('une écriture qui ne touche aucune entrée de la vision laisse l’exploré à sa référence', () => {
    const banc = ouvrirLeBanc();
    poser(banc, couloir('couloir'), { gameTime: MIDI, lightLevel: 0 });
    const avant = banc.getState().explored;

    banc.setState({ flags: { neutre: true } });

    expect(banc.getState().explored).toBe(avant);
  });
});

describe('aucun état transitoire n’entre dans l’exploré', () => {
  it('quitterLaScene : la scène quittée ne reçoit rien de l’arrivée, la scène d’arrivée rien de la case de départ', () => {
    const banc = ouvrirLeBanc();
    const a = couloir('couloir-a');
    registerScene(a);
    registerScene(couloir('couloir-b'));
    poser(banc, a, { gameTime: 0, lightLevel: null });

    banc.actions.quitterLaScene('couloir-b', undefined, { x: 6, y: 0, z: 0 });

    expect(explore(banc, 'couloir-a')).toEqual(rangee(0, 1, 2, 3, 4, 5));
    expect(explore(banc, 'couloir-b')).toEqual(rangee(1, 2, 3, 4, 5, 6));
  });

  it('lancerLeCombat : l’exploré est celui d’avant uni à la vue du combat posé, rien d’autre', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [HEROS] });
    banc.actions.lancerLaScene(testScene());
    const sceneId = banc.getState().scene!.id;
    const avant = explore(banc, sceneId);

    banc.actions.lancerLeCombat('enc-mutants', undefined, { noSurprise: true });

    expect(banc.getState().battle).not.toBeNull();
    expect(explore(banc, sceneId)).toEqual([...new Set([...avant, ...computeStateVisible(banc.getState())])].sort());
  });
});

describe('coop : parité hôte / invité', () => {
  /** Joue la marche de six pas dans le noir sur un banc du siège `mode`, et rend l'exploré et les instantanés de chaque pas. */
  const jouer = (mode: 'hote' | 'invite') => surUnBancHorsTest((banc) => {
    poser(banc, couloir('couloir'), { gameTime: MIDI, lightLevel: 0, net: { ...initialNet(), mode, mySeat: mode === 'hote' ? 0 : 1 } });
    const instantanes: Record<string, unknown>[] = [];
    banc.subscribe((etat) => { instantanes.push(instantaneDeLaCoop(etat)); });
    banc.actions.cliquerLaCase({ x: 6, y: 0, z: 0 });
    return { explore: explore(banc, 'couloir'), instantanes };
  });

  it('les mêmes gestes donnent le même exploré chez l’hôte et chez l’invité', () => {
    const hote = jouer('hote');
    expect(hote.explore).toEqual(rangee(0, 1, 2, 3, 4, 5, 6));
    expect(jouer('invite').explore).toEqual(hote.explore);
  });

  it('l’invité qui applique chaque instantané de l’hôte finit sur le même exploré', () => {
    const hote = jouer('hote');
    const invite = surUnBancHorsTest((banc) => {
      banc.setState({ net: { ...initialNet(), mode: 'invite', mySeat: 1 } });
      for (const data of hote.instantanes) banc.setState(appliquerLInstantane(data, banc.getState()).etat);
      return explore(banc, 'couloir');
    });
    expect(invite).toEqual(hote.explore);
  });
});
