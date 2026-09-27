/**
 * « La Barge du Sel » BOUT EN BOUT, au store (#684 gating de carte + #717 cadre de chapitre) : le
 * chapitre s'ouvre, le cap pris sur les planches OUVRE la traversée, et l'accostage FERME le
 * chapitre. Aucune donnée de fixture — la campagne committée est le sujet.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { routesFrom, visiblePlaces } from '../../state/worldMap';
import type { ConditionCtx } from '../../engine/flowCore';
import { builtinCampaigns, paquetDuJeu } from '../campaign';

const barge = paquetDuJeu(builtinCampaigns.find((c) => c.id === 'barge-du-sel')!);
const CAP = 'sel-cap-donne';
const ACCOSTE = 'sel-ilot-accoste';

const get = () => useGame.getState();
/** Contexte de Condition tel que la carte le voit en jeu (drapeaux courants + horloge). */
const ctx = (): ConditionCtx => ({ flags: get().flags, gameTime: get().gameTime });

beforeEach(() => {
  useGame.getState().loadProject(barge.scenes, barge.scenes[0].id, barge.worldMap, barge.narratif);
});

describe('chapitre « La Barge du Sel » — de l’ouverture à la clôture, sur la donnée committée', () => {
  it('l’ouverture cérémonielle s’arme au chargement du paquet et pose la borne du chapitre', () => {
    expect(get().pendingOuverture?.titre).toBe(barge.narratif.ouverture!.titre);
    expect(get().chapitreDepuis).toBeNull();
    useGame.getState().acquitterOuverture();
    expect(get().pendingOuverture).toBeNull();
    expect(get().chapitreDepuis).not.toBeNull();
  });

  it('le cap se prend SUR LES PLANCHES : au premier pas la traversée est encore fermée, au rang 5 elle s’ouvre', () => {
    useGame.getState().acquitterOuverture();
    const carte = get().worldMap!;

    useGame.getState().moveParty({ x: 2, y: 4 }); // un pas dans le sable : le départ s'énonce, pas le cap
    expect(get().flags[CAP]).toBeFalsy();
    expect(visiblePlaces(carte, ctx()).map((p) => p.id)).toEqual(['quai-du-sel']);
    expect(routesFrom(carte, 'quai-du-sel', ctx())).toEqual([]);

    useGame.getState().moveParty({ x: 2, y: 5 }); // les planches d'embarquement
    expect(get().flags[CAP]).toBe(true);
    expect(visiblePlaces(carte, ctx()).map((p) => p.id)).toEqual(['quai-du-sel', 'ilot-du-sel']);
    expect(routesFrom(carte, 'quai-du-sel', ctx()).map((r) => r.id)).toEqual(['route-quai-ilot']);
  });

  it('ARRIVER ne suffit pas : le drapeau d’accostage se pose au premier PAS sur l’îlot, et le récap s’arme là', () => {
    useGame.getState().acquitterOuverture();
    useGame.getState().moveParty({ x: 2, y: 5 });

    useGame.getState().transitionTo('barge-du-sel-ilot');

    // NON-VACUITÉ D'ABORD : le groupe accosté se tient bel et bien DANS le rect du trigger d'arrivée.
    // Sans cette borne, un rect qui rétrécirait hors du point d'arrivée rendrait le « pas encore
    // déclenché » ci-dessous vert pour une raison FAUSSE : rien à déclencher, au lieu de rien relu.
    const rect = get().scene!.triggers.find((t) => t.id === 'barge-du-sel-arrivee')!.rect;
    const pos = get().partyPos;
    expect(
      pos.x >= rect.x && pos.x < rect.x + rect.w && pos.y >= rect.y && pos.y < rect.y + rect.h,
      `le groupe accoste en (${pos.x},${pos.y}), hors du rect du trigger d’arrivée ${JSON.stringify(rect)}.`,
    ).toBe(true);

    // Un trigger de scène n'est relu que par `moveParty` (`checkTriggers` n'a pas d'autre appelant) :
    // le groupe qui vient d'accoster n'a rien déclenché — le chapitre n'est PAS clos à l'arrivée.
    expect(get().flags[ACCOSTE]).toBeFalsy();
    expect(get().pendingChapterRecap).toBeNull();

    useGame.getState().moveParty({ x: 3, y: 2 });
    expect(get().flags[ACCOSTE]).toBe(true);

    const recap = get().pendingChapterRecap!;
    expect(recap.titre).toBe(barge.narratif.cloture!.titre);
    expect(recap.chronique.length).toBeGreaterThanOrEqual(1); // l'objectif du convoyage, soldé à l'accostage
    expect(recap.lieux).toEqual(['Le quai de départ', 'L’îlot du sel']); // les deux lieux, l'îlot révélé
  });
});
