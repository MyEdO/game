/**
 * Le verdict d'offre d'exploration (#1687, `porteDOffre`) : la source unique du clic comme de la pastille. Sa projection
 * en pastille (`offresUtilisables`) se joue en `src/state/offresUtilisables.test.ts`.
 *
 * Scènes FABRIQUÉES (doctrine : jamais une scène de campagne utilisée comme fixture).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from './monde/scene';
import { porteDOffre } from './interactionsDExploration';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
});

function poser(entities: SceneEntity[], partyPos = { x: 5, y: 6 }): Scene {
  const sc = emptyScene('scene-test', 12, 12);
  sc.entities = entities;
  banc.setState({ scene: sc, mode: 'exploration', partyPos, dialogue: null, flags: {} });
  return sc;
}

const coffre = (over: Partial<SceneEntity> = {}): SceneEntity =>
  ({
    id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, label: 'Coffre bardé de fer',
    usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
    ...over,
  }) as SceneEntity;

describe('offresUtilisables — la pastille de toute entité À PORTÉE, sans survol', () => {
  it('le VERDICT est la source unique du clic comme de la pastille (`porteDOffre`)', () => {
    const sc = poser([coffre()]);
    expect(porteDOffre(sc, sc.entities[0], 'authoree'), 'rien ne refuse une action authorée offerte').toEqual({ ok: true });
  });
});
