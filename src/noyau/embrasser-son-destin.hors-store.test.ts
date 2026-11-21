import { describe, expect, it } from 'vitest';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { engage } from '../engine/engagement';
import type { Combatant } from '../engine/types';
import { fenetreADessiner } from '../hote/gestes';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { campGain } from './combat/advantagePool';
import { withPreRollFixedDie } from './combatFlow';
import type { BattleState } from './etat';
import { emptyScene } from './monde/scene';

const SORT = 'embrasser-son-destin';
const CHOIX = 'jetRegler@incantation#choixDeCibles';
const FUIR = 'jetRegler@desengagement#fuir';
const AVANTAGE = 'jetRegler@desengagement#sacrifier';
const ESQUIVE = 'jetLancer@desengagement';

function ouvrirLeCombat() {
  const lanceur = combattantDeTest({
    id: 'lanceur', label: 'Lanceur', kind: 'heros', pos: { x: 4, y: 4, z: 1 },
    characteristics: { intelligence: 50, 'force-mentale': 40 },
    skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 35 }],
    spells: [SORT],
  });
  const ennemi = (id: string, x: number, y: number, z = 1) => combattantDeTest({
    id, label: id, kind: 'ennemi', pos: { x, y, z }, characteristics: { 'force-mentale': 45 },
  });
  const rate = ennemi('rate', 6, 4);
  const reussit = ennemi('reussit', 4, 6);
  const loin = ennemi('loin', 7, 6);
  const enBas = ennemi('en-bas', 4, 5, 0);
  const allie = combattantDeTest({ id: 'allie', label: 'Allié', kind: 'heros', pos: { x: 6, y: 5, z: 1 } });
  const neutre = combattantDeTest({ id: 'neutre', label: 'Neutre', kind: 'pnj', pos: { x: 4, y: 3, z: 1 } });
  const scene = { ...emptyScene('fumee-du-destin'), metresPerTile: 2 };
  scene.layers.push({ ...scene.layers[0], z: 1 });

  const participants = [lanceur, rate, reussit, loin, enBas, allie];
  const order = participants.map((c) => c.id);
  const battle: BattleState = {
    combatants: [...participants, neutre], order, baseOrder: order, turn: 0, round: 1,
    action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
    acted: false, log: [], over: null,
  };
  const banc = ouvrirLeBanc({
    cadence: 'manuel', desFixes: true, reglesMaison: { 'magie-vdm-incantation': false, 'combat-aa-avantage-groupe': false },
  });
  banc.setState({ mode: 'battle', scene, battle, party: [lanceur, allie], net: { ...banc.getState().net, gmSeat: 0 } });
  return { banc, lanceur, rate, reussit, loin, enBas, allie, neutre };
}

const gesteOffert = (banc: Banc, cle: string) => fenetreADessiner(banc.getState())?.gestes.find((geste) => geste.cle === cle);

function jeterLIncantation(banc: Banc): void {
  const { getState: jeu, setState } = banc;
  withPreRollFixedDie(jeu, setState, () => jeu().jetLancer('incantation'), () => jeu().jetImposerLeResultat('incantation', 13));
  expect(jeu().pendingCast?.result?.cast).toBe(true);
}

function resoudreLeCalme(banc: Banc, cible: Combatant, de: number, success: boolean): void {
  const jeu = banc.getState;
  const cascade = jeu().pendingCascade!;
  const etape = cascade.participants[cascade.cursor];
  expect(etape).toMatchObject({ kind: 'testDeclenche', actorId: cible.id, rollLabel: 'Calme', difficulty: 'intermediaire', target: 45 });
  jeu().jetLancer('cascade', etape.id);
  jeu().jetImposerLeResultat('cascade', de, etape.id);
  expect(jeu().pendingCascade?.participants[cascade.cursor].result).toMatchObject({ roll: de, sl: 0, success });
  jeu().jetValider('cascade');
}

function lancerSurLesEnnemis(combat: ReturnType<typeof ouvrirLeCombat>): void {
  const { banc, lanceur, rate, reussit } = combat;
  const jeu = banc.getState;
  jeu().incanterLeSort(lanceur.id, SORT);
  const choix = gesteOffert(banc, CHOIX);
  expect(choix).toMatchObject({ ouvert: true, rendu: 'choix' });
  expect(choix?.arguments.find((arg) => arg.nom === 'valeur')).toMatchObject({
    valeur: 'allies',
    valeurs: [
      { valeur: 'allies', libelle: 'Alliés', refus: null },
      { valeur: 'ennemis', libelle: 'Ennemis', refus: null },
    ],
  });
  jeu().jetRegler('incantation', 'choixDeCibles', 'ennemis');
  jeterLIncantation(banc);
  expect(gesteOffert(banc, CHOIX)?.ouvert).toBe(false);
  jeu().jetRegler('incantation', 'choixDeCibles', 'allies');
  expect(jeu().pendingCast?.choixDeCibles).toBe('ennemis');
  jeu().jetValider('incantation');

  expect(jeu().pendingCascade?.participants.filter((etape) => etape.kind === 'testDeclenche').map((etape) => etape.actorId))
    .toEqual([rate.id, reussit.id]);
  resoudreLeCalme(banc, rate, 47, false);
  resoudreLeCalme(banc, reussit, 43, true);
  expect(jeu().pendingCascade).toBeNull();
}

function effetDeFuite(banc: Banc, acteur: Combatant) {
  return banc.getState().battle!.combatants.find((c) => c.id === acteur.id)?.activeEffects?.find((effet) => effet.fleeForbidden);
}

function passerAuTourSuivant(banc: Banc): void {
  const jeu = banc.getState;
  const avant = jeu().battle!;
  jeu().terminerLeTour();
  if (jeu().battle?.turn === avant.turn && jeu().battle?.round === avant.round) jeu().terminerLeTour();
}

function passerUnRound(banc: Banc): void {
  const jeu = banc.getState;
  const { round, order } = jeu().battle!;
  for (let tour = 0; tour < order.length && jeu().battle!.round === round; tour += 1) {
    passerAuTourSuivant(banc);
  }
  expect(jeu().battle!.round).toBe(round + 1);
  if (jeu().pendingRoundStart) jeu().fenetreValider('debutDuRound');
}

describe('Embrasser son destin (VDM 09 l.342–354)', () => {
  it('teste uniquement les ennemis de la ZdE et distingue les deux verdicts à 0 DR', () => {
    const combat = ouvrirLeCombat();
    lancerSurLesEnnemis(combat);
    const { banc, lanceur, rate, reussit, loin, enBas, allie, neutre } = combat;

    expect(effetDeFuite(banc, rate)).toMatchObject({
      duration: { scale: 'rounds', left: 4 },
      sourceSpellId: SORT,
      spell: { spellId: SORT, casterId: lanceur.id },
    });
    for (const acteur of [lanceur, reussit, loin, enBas, allie, neutre]) {
      expect(effetDeFuite(banc, acteur), acteur.id).toBeUndefined();
    }
  });

  it('ferme la Fuite pendant quatre Rounds et laisse jouer les désengagements sûrs', () => {
    const combat = ouvrirLeCombat();
    const { banc, rate, allie } = combat;
    const jeu = banc.getState;
    lancerSurLesEnnemis(combat);
    passerAuTourSuivant(banc);
    expect(jeu().battle!.order[jeu().battle!.turn]).toBe(rate.id);
    engage(rate, allie);
    campGain(jeu, rate, 2);
    jeu().rompreLEngagement();
    expect(jeu().pendingDisengage).toMatchObject({ canSacrifice: true, canFuir: false });
    expect(gesteOffert(banc, FUIR)).toMatchObject({ ouvert: false });
    expect(gesteOffert(banc, AVANTAGE)).toMatchObject({ ouvert: true, raison: null });
    expect(gesteOffert(banc, ESQUIVE)).toMatchObject({ ouvert: true, raison: null });
    jeu().jetRegler('desengagement', 'fuir', true);
    expect(jeu().pendingDisengage?.phase).toBe('choix');
    expect(jeu().refus?.texte).toBeTruthy();

    jeu().jetRegler('desengagement', 'sacrifier', true);
    expect(jeu().pendingDisengage).toBeNull();
    expect(rate.advantage).toBe(0);
    expect(rate.engagedWith).toEqual([]);
    const horsZone = { x: 7, y: 4, z: 1 };
    jeu().cliquerLaCase(horsZone, undefined, { confirm: true });
    expect(rate.pos).toEqual(horsZone);
    engage(rate, allie);
    jeu().rompreLEngagement();
    expect(gesteOffert(banc, FUIR)).toMatchObject({ ouvert: false });
    jeu().jetAnnuler('desengagement');

    for (const restant of [3, 2, 1]) {
      passerUnRound(banc);
      expect(effetDeFuite(banc, rate)?.duration).toEqual({ scale: 'rounds', left: restant });
    }
    passerUnRound(banc);
    expect(effetDeFuite(banc, rate)).toBeUndefined();

    passerAuTourSuivant(banc);
    expect(jeu().battle!.order[jeu().battle!.turn]).toBe(rate.id);
    engage(rate, allie);
    jeu().rompreLEngagement();
    expect(gesteOffert(banc, FUIR)).toMatchObject({ ouvert: true, raison: null });
    jeu().jetRegler('desengagement', 'fuir', true);
    expect(jeu().pendingDisengage?.phase).toBe('fuir');
  });

  it('sur les alliés, ne fait pas jouer de Test de Calme aux ennemis proches', () => {
    const { banc, lanceur, rate, reussit } = ouvrirLeCombat();
    const jeu = banc.getState;
    jeu().incanterLeSort(lanceur.id, SORT);
    expect(gesteOffert(banc, CHOIX)).toMatchObject({ ouvert: true });
    jeu().jetRegler('incantation', 'choixDeCibles', 'allies');
    jeterLIncantation(banc);
    jeu().jetValider('incantation');

    expect(jeu().pendingCast).toBeNull();
    expect(jeu().pendingCascade).toBeNull();
    expect(effetDeFuite(banc, rate)).toBeUndefined();
    expect(effetDeFuite(banc, reussit)).toBeUndefined();
  });
});
