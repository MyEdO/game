/**
 * Les offres d'exploration (#1687) : ce que chaque entité À PORTÉE du groupe offre hors combat (`offresDExploration`),
 * et le verdict de chaque offre (`porteDOffre`), source unique du clic comme de la pastille.
 *
 * Scènes FABRIQUÉES (doctrine : jamais une scène de campagne utilisée comme fixture).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from './monde/scene';
import { offresDExploration, porteDOffre } from './interactionsDExploration';
import { tableTotale } from '../lib/tableTotale';
import { t } from '../i18n';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

const TABLE = 'table-ronde-4-tabourets';

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
    usable: { actions: [{ id: 'fouiller', flow: { kind: 'sequence', etapes: [] }, unique: true }] },
    ...over,
  }) as SceneEntity;

describe('offresDExploration — les offres de toute entité À PORTÉE, sans survol', () => {
  it('le VERDICT est la source unique du clic comme de la pastille (`porteDOffre`)', () => {
    const sc = poser([coffre()]);
    expect(porteDOffre(sc, sc.entities[0], 'authoree'), 'rien ne refuse une action authorée offerte').toEqual({ ok: true });
  });

  it('rend UN porteur à portée, ses offres nommées et leur verdict — aucun survol n’a eu lieu', () => {
    poser([coffre()]);
    const porteurs = offresDExploration(banc.getState());
    expect(porteurs.map((p) => [p.porteurId, p.porteurLabel])).toEqual([['coffre', 'Coffre bardé de fer']]);
    expect(porteurs[0].offres.map((o) => [o.id, o.label, o.gate])).toEqual([['fouiller', 'Fouiller', { ok: true }]]);
  });

  it('rien à offrir, ou hors de portée : aucun porteur', () => {
    poser([{ id: 'caisse', kind: 'prop', pos: { x: 5, y: 5 } } as SceneEntity]);
    expect(offresDExploration(banc.getState()), 'décor sans offre').toEqual([]);

    poser([coffre({ combat: { hiddenUntilCombat: true } } as never)]);
    expect(offresDExploration(banc.getState()), 'un ennemi d’embuscade n’offre rien').toEqual([]);

    poser([coffre()], { x: 7, y: 7 });
    expect(offresDExploration(banc.getState()), 'une case de trop').toEqual([]);

    poser([coffre()], { x: 5, y: 5, z: 1 } as never);
    expect(offresDExploration(banc.getState()), 'un étage au-dessus').toEqual([]);

    poser([coffre({ pos: { x: 4, y: 3 }, z: 1 } as never)], { x: 4, y: 4 });
    expect(offresDExploration(banc.getState()), 'adjacent dans le plan, un plancher entre les deux').toEqual([]);
    poser([coffre({ pos: { x: 4, y: 3 } })], { x: 4, y: 4 });
    expect(offresDExploration(banc.getState()).map((p) => p.porteurId), 'témoin de plain-pied').toEqual(['coffre']);
  });

  it('le porteur d’une entité que le groupe ne connaît pas (`entiteConnue`) garde son offre, au nom neutre', () => {
    const pnj = coffre({ id: 'passeur', kind: 'personnage', label: 'Passeur' });
    poser([pnj]);
    expect(offresDExploration(banc.getState()).map((p) => [p.porteurId, p.porteurLabel, p.offres.map((o) => o.id)]), 'en vue').toEqual([['passeur', 'Passeur', ['fouiller']]]);
    banc.setState({ lightLevel: 0 });
    expect(offresDExploration(banc.getState()).map((p) => [p.porteurId, p.porteurLabel, p.offres.map((o) => o.id)]), 'dans le noir').toEqual([['passeur', t('vision.horsDeVue'), ['fouiller']]]);
  });

  it('DEUX entités à portée : DEUX porteurs', () => {
    poser([coffre(), coffre({ id: 'coffre-2', pos: { x: 6, y: 5 }, label: 'Un second coffre' })]);
    expect(offresDExploration(banc.getState()).map((p) => p.porteurId)).toEqual(['coffre', 'coffre-2']);
  });

  it('une offre REFUSÉE reste offerte, avec sa raison', () => {
    const sc = poser([{ id: 'table', kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: TABLE }, label: 'Table ronde', usable: { assise: true } } as SceneEntity]);
    expect(offresDExploration(banc.getState())[0].offres.map((o) => [o.id, o.gate.ok])).toEqual([['sasseoir', true]]);
    const seatAssignments = { table: tableTotale(
      ['place-1', 'place-2', 'place-3', 'place-4'], (s) => ({ kind: 'entite' as const, entityId: `pnj-${s}` }),
    ) };
    banc.setState({ scene: { ...sc, seatAssignments } });
    const prises = offresDExploration(banc.getState())[0].offres;
    expect(prises.map((o) => [o.id, o.gate])).toEqual([['sasseoir', { ok: false, reason: t('seating.occupied') }]]);
  });
});
