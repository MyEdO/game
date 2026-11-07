/**
 * #3610 — le refus d'un verbe de la barre est une fonction pure du geste (`refusDuGeste`), dont l'offre est la projection
 * sur ses candidats. Garde de PROPRIÉTÉ sur chaque scénario de test, à chaque tour d'un actif que pilote le siège :
 *  - le geste de chaque offre ouverte est admis, et celui d'une offre fermée, seule entrée pertinente de son verbe, est
 *    refusé de la raison même de l'offre (`Offre.gate`) ;
 *  - un verbe appelé sans son argument optionnel est jugé comme le candidat que son corps prend par défaut.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { lancerLeScenario } from './lancementDeScenario';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { advanceTurn } from './combatFlow';
import { estVerbeDeLaBarre, etatDeLaBarre, offresDeLActif, refusDuGeste } from './actionRegistry';
import { seedBattleRng } from './battleRng';
import { mountablesNear } from './mount';
import { rechargeDuTour, servablePostes } from './monde/shipPostes';
import { waterSprayCandidates } from '../engine/suffocation';
import { battementFoes, distraireFoes } from './combatManeuvers';
import type { Combatant } from '../engine/types';
import type { BattleState, Jeu } from './etat';
import type { GesteDuNoyau, VerbesDeLaBarre } from './actionsDuNoyau';

/** Le candidat que le CORPS de chaque verbe à argument optionnel prend quand il est omis (`combatSlice.ts`), en argument
 *  du verbe : la même fonction que lit le corps. */
const DEFAUT_DU_CORPS: { readonly [V in keyof VerbesDeLaBarre]?: (a: Combatant, b: BattleState) => unknown } = {
  rechargerLArme: (a, b) => rechargeDuTour(a, b, undefined)?.arme.uid,
  aspergerDEau: (a, b) => waterSprayCandidates(a, b.combatants.filter((c) => c.kind === a.kind))[0]?.id,
  faireUnBattement: (a, b) => battementFoes(a, b)[0]?.id,
  tenterDeDistraire: (a, b) => distraireFoes(a, b)[0]?.id,
  monterEnSelle: (a, b) => mountablesNear(b, a)[0]?.id,
  servirLePoste: (a, b) => {
    const sp = servablePostes(a, b.combatants)[0];
    return sp && { hullId: sp.hull.id, posteUid: sp.poste.item.uid };
  },
};

/** Les écarts du tour de l'actif de `s`, barre ouverte. */
function ecartsDuTour(s: Jeu, ou: string): string[] {
  const barre = etatDeLaBarre(s);
  if (barre.forme !== 'ouverte') return [];
  const ecarts: string[] = [];
  const offres = offresDeLActif({ active: barre.active, battle: barre.battle, netMode: s.net.mode, gameTime: s.gameTime, state: s });
  for (const o of offres) {
    if (!o.geste || !estVerbeDeLaBarre(o.geste.verbe)) continue;
    const v = refusDuGeste(s, o.geste);
    if (o.gate.ok && 'refus' in v) ecarts.push(`${ou} ${o.actionId} ${JSON.stringify(o.geste)} ouverte, refusée : ${v.refus}`);
    const memeVerbe = offres.filter((x) => x.def.run === o.def.run).map((x) => x.actionId);
    if (!o.gate.ok && new Set(memeVerbe).size === 1 && !('refus' in v && v.refus === o.gate.reason)) {
      ecarts.push(`${ou} ${o.actionId} ${JSON.stringify(o.geste)} fermée (${o.gate.reason}), jugée ${JSON.stringify('refus' in v ? v.refus : v.def.id)}`);
    }
  }
  for (const [verbe, defaut] of Object.entries(DEFAUT_DU_CORPS)) {
    const candidat = defaut!(barre.active, barre.battle);
    const omis = refusDuGeste(s, { verbe, args: [] } as GesteDuNoyau);
    const designe = candidat === undefined ? undefined : refusDuGeste(s, { verbe, args: [candidat] } as GesteDuNoyau);
    const attendu = designe ? !('refus' in designe) : false;
    if (!('refus' in omis) !== attendu) ecarts.push(`${ou} ${verbe}() ${'refus' in omis ? `refusé (${omis.refus})` : 'admis'}, défaut du corps ${JSON.stringify(candidat)} ${attendu ? 'admis' : 'refusé'}`);
  }
  return ecarts;
}

describe('#3610 — refusDuGeste : l’offre est la projection du refus de son geste', () => {
  it.each(testScenarios.filter((sc) => sc.autoCombat).map((sc) => [sc.id] as const))('scénario %s : chaque tour piloté', (id) => {
    const banc = ouvrirLeBanc();
    seedBattleRng(1);
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((sc) => sc.id === id)!));
    const ecarts: string[] = [];
    for (let pas = 0; pas < 8 && banc.getState().battle && !banc.getState().battle!.over; pas++) {
      const s = banc.getState();
      if (s.battle!.turn < 0) { banc.actions.fenetreValider('roundStart'); continue; }
      ecarts.push(...ecartsDuTour(s, `${id}#${pas}`));
      advanceTurn(banc.getState, banc.setState);
    }
    expect(ecarts).toEqual([]);
  });
});
