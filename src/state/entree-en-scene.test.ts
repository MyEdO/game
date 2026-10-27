// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { GARDES_D_UNE_PARTIE_A_L_AUTRE, etatInitialDeLAdaptateur, useGame, type EtatDeLAdaptateur } from './store';
import { stockageDesSauvegardes } from './saves';
import { AUTO_SLOT, lireLaSauvegarde } from '../hote/sauvegardes';
import { snapshotSave } from '../noyau/persistance/save';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import { tableTotale } from '../lib/tableTotale';

/**
 * ENTRÉE EN SCÈNE (#2817 D5) : le noyau émet `EVT.ARRIVEE_EN_SCENE`, l'adaptateur remet son interface.
 * Une partie neuve (`startScene`) remet l'interface hors des préférences de vue et de touches ; un
 * changement de scène (`transitionTo`) ne remet que la caméra et les gestes, puis pose le point de
 * reprise chez le seul propriétaire de la sauvegarde.
 */

const g = useGame.getState;

const INIT = etatInitialDeLAdaptateur();
const CLES = Object.keys(INIT) as (keyof typeof INIT)[];
/** Une valeur NON initiale pour CHACUN des champs d'interface, dérivée de l'état initial. */
const salir = () => useGame.setState(tableTotale<keyof EtatDeLAdaptateur, unknown>(CLES, sale) as Partial<EtatDeLAdaptateur>);
const sale = (k: string) => ({ sale: k });
const GARDES = CLES.filter((k) => GARDES_D_UNE_PARTIE_A_L_AUTRE.includes(k));
const DE_LA_PARTIE = CLES.filter((k) => !GARDES_D_UNE_PARTIE_A_L_AUTRE.includes(k));
const CAMERA = ['camEdge', 'camPan'] as const;

const scene = (id: string): Scene => ({
  ...emptyScene('scene-test', 6, 6),
  id,
  label: id,
  entities: [{ id: `depart-${id}`, kind: 'heroStart', pos: { x: 1, y: 1 } }],
});

afterEach(() => {
  g().resetKeyBindings();
  localStorage.clear();
});

describe('entrée en scène — la remise de l’interface (#2817 D5)', () => {
  it('les champs gardés d’une partie à l’autre sont exactement les préférences de vue et de touches', () => {
    expect([...GARDES_D_UNE_PARTIE_A_L_AUTRE].sort()).toEqual(['camRot', 'keyOverrides', 'povActive', 'viewMode', 'zoom']);
  });

  it('une partie neuve remet tout l’état d’interface hors les gardés', () => {
    salir();
    g().startScene(scene('entree-a'));
    for (const k of DE_LA_PARTIE) expect(g()[k], `${k} remis`).toEqual(INIT[k]);
    for (const k of GARDES) expect(g()[k], `${k} gardé`).toEqual(sale(k));
  });

  it('un changement de scène ne remet que la caméra, et sauvegarde le point de reprise chez l’hôte', () => {
    g().loadProject({ scenes: [scene('entree-a'), scene('entree-b')], entryId: 'entree-a', projet: null });
    salir();
    g().transitionTo('entree-b');
    for (const k of CLES) expect(g()[k], `${k}`).toEqual((CAMERA as readonly string[]).includes(k) ? INIT[k] : sale(k));
    expect(lireLaSauvegarde(stockageDesSauvegardes(), AUTO_SLOT)?.data.campaignSceneId, 'le point de reprise est la scène d’arrivée').toBe('entree-b');
  });

  it('chez l’invité, le changement de scène ne sauvegarde rien : la sauvegarde vit chez l’hôte', () => {
    g().loadProject({ scenes: [scene('entree-a'), scene('entree-b')], entryId: 'entree-a', projet: null });
    useGame.setState({ net: { ...g().net, mode: 'guest', mySeat: 1 } });
    g().transitionTo('entree-b');
    expect(g().campaignSceneId, 'témoin : la scène a changé').toBe('entree-b');
    expect(lireLaSauvegarde(stockageDesSauvegardes(), AUTO_SLOT)).toBeNull();
    useGame.setState({ net: useGame.getInitialState().net });
  });
});

describe('une touche reliée est une préférence du joueur, pas un état de partie (#2817 D5)', () => {
  it('elle survit au lancement d’une partie', () => {
    g().setKeyBinding('pov-forward', 'KeyZ');
    g().startScene(scene('entree-a'));
    expect(g().keyOverrides['pov-forward']).toBe('KeyZ');
  });

  it('elle survit au chargement d’une sauvegarde faite avant de la relier', () => {
    g().startScene(scene('entree-a'));
    g().setKeyBinding('pov-forward', 'KeyA');
    const save = snapshotSave(g(), '2026-10-20T00:00:00.000Z');
    g().setKeyBinding('pov-forward', 'KeyZ');
    expect(g().importGame(JSON.stringify(save)), 'témoin : la sauvegarde est acceptée').toBeNull();
    expect(g().keyOverrides['pov-forward']).toBe('KeyZ');
  });
});
