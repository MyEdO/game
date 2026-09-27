/**
 * LA PASTILLE HORS COMBAT (#1687 lot 3-I-b) — `offresUtilisables` est la PROJECTION d'`actionsDe`
 * dans l'invariant d'affichage `OffreRendue`, pas une seconde source d'offre : ce qui est offert se
 * dit au dériveur unique, ce qui est joué passe par `jouerAction`.
 *
 * Scènes FABRIQUÉES (doctrine : jamais une scène de campagne utilisée comme fixture).
 */
import { describe, expect, it, vi } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from './scene';
import { offresUtilisables, porteDOffre } from './offresUtilisables';
import { useGame, type GameState } from './store';

const TABLE = 'table-ronde-4-tabourets';

function poser(entities: SceneEntity[], partyPos = { x: 5, y: 6 }): Scene {
  const sc = emptyScene(12, 12);
  sc.entities = entities;
  useGame.setState({ scene: sc, mode: 'exploration', partyPos, dialogue: null, flags: {} } as Partial<GameState>);
  return sc;
}

const coffre = (over: Partial<SceneEntity> = {}): SceneEntity =>
  ({
    id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, label: 'Coffre bardé de fer',
    usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
    ...over,
  }) as SceneEntity;

describe('offresUtilisables — la pastille de toute entité À PORTÉE, sans survol', () => {
  it('rend UN porteur, ses offres nommées, et un engagement qui passe par `jouerAction`', () => {
    poser([coffre()]);
    const jouerAction = vi.fn();
    useGame.setState({ jouerAction } as Partial<GameState>);
    const groupes = offresUtilisables(useGame.getState());
    expect(groupes.length, 'un seul porteur : la seule entité à portée — aucun survol n’a eu lieu').toBe(1);
    expect(groupes[0].porteurId).toBe('coffre');
    expect(groupes[0].porteurLabel, 'le nom que l’infobulle affichera').toBe('Coffre bardé de fer');
    expect(groupes[0].offres.map((o) => [o.id, o.label, o.cost, o.gate]))
      .toEqual([['fouiller', 'Fouiller', null, { ok: true }]]);

    groupes[0].offres[0].onSelect();
    expect(jouerAction, 'l’exécuteur UNIQUE, nommé — la pastille ne connaît aucune autre porte')
      .toHaveBeenCalledWith('coffre', 'fouiller');
  });

  it('rien à offrir, ou hors de portée : aucune pastille', () => {
    poser([{ id: 'caisse', kind: 'prop', pos: { x: 5, y: 5 } } as SceneEntity]);
    expect(offresUtilisables(useGame.getState()), 'décor sans offre').toEqual([]);

    poser([coffre()], { x: 7, y: 7 });
    expect(offresUtilisables(useGame.getState()), 'une case de trop : le clic marche, la pastille ne promet rien').toEqual([]);

    poser([coffre()], { x: 5, y: 5, z: 1 } as never);
    expect(offresUtilisables(useGame.getState()), 'un étage au-dessus : hors de portée aussi').toEqual([]);

    // La forme SYMÉTRIQUE — le groupe au rez, la chose à l'étage, 8-adjacente dans le plan : c'est
    // celle qu'une portée z-aveugle servait, et la seule que le plan seul ne peut pas trancher.
    poser([coffre({ pos: { x: 4, y: 3 }, z: 1 } as never)], { x: 4, y: 4 });
    expect(offresUtilisables(useGame.getState()), 'adjacent dans le plan, un plancher entre les deux').toEqual([]);
    poser([coffre({ pos: { x: 4, y: 3 } })], { x: 4, y: 4 });
    expect(offresUtilisables(useGame.getState()).map((g) => g.porteurId), 'témoin de plain-pied : la pastille monte').toEqual(['coffre']);
  });

  it('DEUX entités à portée : DEUX porteurs — le champ ne dépend d’aucun pixel survolé', () => {
    poser([coffre(), coffre({ id: 'coffre-2', pos: { x: 6, y: 5 }, label: 'Un second coffre' })]);
    const groupes = offresUtilisables(useGame.getState());
    expect(groupes.map((g) => g.porteurId), 'les deux voisins offrent, les deux portent leur pastille')
      .toEqual(['coffre', 'coffre-2']);
  });

  it('une offre REFUSÉE reste offerte, avec sa raison (loi du refus visible)', () => {
    const sc = poser([{ id: 'table', kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, label: 'Table ronde', usable: { assise: true } } as SceneEntity]);
    const libres = offresUtilisables(useGame.getState())[0].offres;
    expect(libres.map((o) => [o.id, o.gate.ok])).toEqual([['sasseoir', true]]);

    const seatAssignments = { table: Object.fromEntries(
      ['place-1', 'place-2', 'place-3', 'place-4'].map((s) => [s, { kind: 'entity' as const, entityId: `pnj-${s}` }]),
    ) };
    useGame.setState({ scene: { ...sc, seatAssignments } } as Partial<GameState>);
    const prises = offresUtilisables(useGame.getState())[0].offres;
    expect(prises.length, 'le geste ne disparaît pas : il se refuse').toBe(1);
    expect(prises[0].gate).toEqual({ ok: false, reason: 'Toutes les places sont occupées.' });
  });

  it('le VERDICT est la source unique du clic comme de la pastille (`porteDOffre`)', () => {
    const sc = poser([coffre()]);
    expect(porteDOffre(sc, sc.entities[0], 'authoree'), 'rien ne refuse une action authorée offerte').toEqual({ ok: true });
  });
});
