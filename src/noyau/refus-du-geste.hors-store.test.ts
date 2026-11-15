/**
 * #3610 — le refus d'un verbe de la barre est une fonction pure du geste (`refusDuGeste`), dont l'offre est la projection
 * sur ses candidats. Garde de PROPRIÉTÉ sur chaque scénario de test, à chaque tour d'un actif que pilote le siège :
 *  - le geste de chaque offre ouverte est admis par SON entrée, celui d'une offre fermée est refusé, et, seule entrée de
 *    son verbe, de la raison même de l'offre (`Offre.gate`) ;
 *  - un verbe appelé sans son argument omissible est jugé comme le candidat que son corps prend par défaut ;
 *  - un argument hors de tout candidat (id inconnu, combattant de l'autre camp) est refusé.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { lancerLeScenario } from './lancementDeScenario';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { advanceTurn } from './combatFlow';
import { armeADistanceParDefaut, estVerbeDeLaBarre, etatDeLaBarre, offresDeLActif, refusDuGeste } from './actionRegistry';
import { seedBattleRng } from './battleRng';
import { mountablesNear } from './mount';
import { rechargeDuTour, servablePostes } from './monde/shipPostes';
import { waterSprayCandidates } from '../engine/suffocation';
import { battementFoes, distraireFoes } from './combatManeuvers';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import type { BattleState, Jeu } from './etat';
import type { GesteDuNoyau, VerbesDeLaBarre } from './actionsDuNoyau';
import type { Scene } from './monde/scene';

/** Pour chaque verbe à argument omissible, l'appel qui l'omet et celui qui désigne le candidat que son CORPS prend alors
 *  (`combatSlice.ts`), lu aux fonctions mêmes que lit le corps. */
const CAS_DU_CORPS: { readonly [V in keyof VerbesDeLaBarre]?: (a: Combatant, b: BattleState, scene: Scene | null) => { omis: unknown[]; designe: unknown }[] } = {
  rechargerLArme: (a, b) => [{ omis: [], designe: rechargeDuTour(a, b, undefined)?.arme.uid }],
  aspergerDEau: (a, b) => [{ omis: [], designe: waterSprayCandidates(a, b.combatants.filter((c) => c.kind === a.kind))[0]?.id }],
  faireUnBattement: (a, b) => [{ omis: [], designe: battementFoes(a, b)[0]?.id }],
  tenterDeDistraire: (a, b) => [{ omis: [], designe: distraireFoes(a, b)[0]?.id }],
  monterEnSelle: (a, b, scene) => [{ omis: [], designe: mountablesNear(b, scene, a)[0]?.id }],
  servirLePoste: (a, b, scene) => [{ omis: [], designe: servablePostes(scene, a, b.combatants)[0]?.poste.item.uid }],
  chanterLaChanson: (a) => [{ omis: [], designe: a.id }],
  manoeuvrerLeNavire: (a) => [{ omis: [], designe: a.id }],
  // La munition se désigne toujours ; l'arme omise est la première arme à distance du porteur.
  approvisionnerLArme: (a) => (a.items ?? []).filter((i) => i.kind === 'ammo').map((m) => ({ omis: [m.uid], designe: [m.uid, armeADistanceParDefaut(a)?.uid] })),
};

/** Des arguments HORS de tout candidat, par verbe : un id que rien ne porte, et, pour une cible ou une coque, un
 *  combattant de l'autre camp. */
function horsCandidat(a: Combatant, b: BattleState): GesteDuNoyau[] {
  const X = 'id-etranger';
  const autre = b.combatants.find((c) => c.kind !== a.kind)?.id ?? X;
  const munition = (a.items ?? []).find((i) => i.kind === 'ammo')?.uid ?? X;
  const gestes: [string, unknown[]][] = [
    ['armerLAttaque', [X]], ['lancerLAttaqueDeZone', [X]], ['rechargerLArme', [X]], ['approvisionnerLArme', [X]],
    ['approvisionnerLArme', [munition, X]], ['aspergerDEau', [X]], ['aspergerDEau', [autre]], ['gagnerLAvantage', [X]],
    ['faireUnBattement', [X]], ['tenterDeDistraire', [X]], ['manoeuvrerSurSoi', [X]], ['monterEnSelle', [X]],
    ['servirLePoste', [X]], ['manoeuvrerLeNavire', [autre]],
    ['chanterLaChanson', [autre]], ['chanterLaChanson', [X]],
  ];
  return gestes.map(([verbe, args]) => ({ verbe, args }) as GesteDuNoyau);
}

/** Les écarts du tour de l'actif de `s`, barre ouverte. */
function ecartsDuTour(s: Jeu, ou: string): string[] {
  const barre = etatDeLaBarre(s);
  if (barre.forme !== 'ouverte') return [];
  const ecarts: string[] = [];
  const offres = offresDeLActif({ scene: s.scene, active: barre.active, battle: barre.battle, netMode: s.net.mode, gameTime: s.gameTime, state: s });
  for (const o of offres) {
    if (!o.geste || !estVerbeDeLaBarre(o.geste.verbe)) continue;
    const v = refusDuGeste(s, o.geste);
    const jugee = JSON.stringify('refus' in v ? v.refus : v.def.id);
    if (o.gate.ok && ('refus' in v || v.def.id !== o.actionId)) ecarts.push(`${ou} ${o.actionId} ${JSON.stringify(o.geste)} ouverte, jugée ${jugee}`);
    if (!o.gate.ok && !('refus' in v)) ecarts.push(`${ou} ${o.actionId} ${JSON.stringify(o.geste)} fermée (${o.gate.reason}), admise par ${jugee}`);
    const seuleEntree = new Set(offres.filter((x) => x.def.run === o.def.run).map((x) => x.actionId)).size === 1;
    if (!o.gate.ok && seuleEntree && 'refus' in v && v.refus !== o.gate.reason) ecarts.push(`${ou} ${o.actionId} fermée (${o.gate.reason}), refusée d'une autre raison : ${v.refus}`);
  }
  for (const [verbe, cas] of Object.entries(CAS_DU_CORPS)) {
    for (const { omis, designe } of cas!(barre.active, barre.battle, s.scene)) {
      const vOmis = refusDuGeste(s, { verbe, args: omis } as GesteDuNoyau);
      const args = Array.isArray(designe) ? designe : [designe];
      const vDesigne = args.includes(undefined) ? undefined : refusDuGeste(s, { verbe, args } as GesteDuNoyau);
      const attendu = vDesigne && !('refus' in vDesigne) ? vDesigne.def.id : null;
      const obtenu = 'refus' in vOmis ? null : vOmis.def.id;
      if (obtenu !== attendu) ecarts.push(`${ou} ${verbe}(${JSON.stringify(omis)}) admis par ${obtenu}, défaut du corps ${JSON.stringify(designe)} admis par ${attendu}`);
    }
  }
  for (const g of horsCandidat(barre.active, barre.battle)) {
    const v = refusDuGeste(s, g);
    if (!('refus' in v)) ecarts.push(`${ou} ${JSON.stringify(g)} hors candidat, admis par ${v.def.id}`);
  }
  return ecarts;
}

describe('#3610 — refusDuGeste : l’offre est la projection du refus de son geste', () => {
  it.each(testScenarios.filter((sc) => sc.autoCombat).map((sc) => [sc.id] as const))('scénario %s : chaque tour piloté', (id) => {
    const banc = ouvrirLeBanc();
    seedBattleRng(1);
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((sc) => sc.id === id)!, idsDeTest));
    const ecarts: string[] = [];
    for (let pas = 0; pas < 8 && banc.getState().battle && !banc.getState().battle!.over; pas++) {
      const s = banc.getState();
      if (s.battle!.turn < 0) { banc.actions.fenetreValider('debutDuRound'); continue; }
      ecarts.push(...ecartsDuTour(s, `${id}#${pas}`));
      advanceTurn(banc.getState, banc.setState);
    }
    expect(ecarts).toEqual([]);
  });
});

describe('#3610 — Dissiper : le mode s’offre une fois, chaque Sort dissipable porte son geste (LDB 46 l.158-162)', () => {
  const mk = (id: string, extra: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
    id, name: id, kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 20 }], talents: [], spells: [], pos: { x: 1, y: 1 },
    ...extra,
  }) as unknown as Combatant);

  it('dissipation une fois, dissipation-sort par Sort, son geste admis par le corps qu’il déclare', () => {
    const banc = ouvrirLeBanc();
    const sort = (spellId: string, casterId: string) => ({ label: spellId, characteristic: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 }, spell: { spellId, ni: 2, casterId, label: spellId } });
    const cible = mk('cible', { kind: 'ennemi', pos: { x: 5, y: 5 }, activeEffects: [sort('malefice', 'e1'), sort('aveuglement', 'e2')] } as never);
    banc.setState({ battle: { combatants: [mk('mage'), cible], order: ['mage', 'cible'], turn: 0, round: 1, acted: false, over: null, log: [], reachable: new Map(), movementUsed: 0 } as never });
    const s = banc.getState();
    const offres = offresDeLActif({ scene: s.scene, active: s.battle!.combatants[0], battle: s.battle!, netMode: s.net.mode, gameTime: s.gameTime, state: s });
    expect(offres.filter((o) => o.actionId === 'dissipation').map((o) => o.geste)).toEqual([{ verbe: 'armerLeMode', args: ['dissipation'] }]);
    expect(offres.filter((o) => o.actionId === 'dissipation-sort').map((o) => o.geste)).toEqual([
      { verbe: 'dissiperLeSort', args: ['mage', 'malefice', 'e1'] },
      { verbe: 'dissiperLeSort', args: ['mage', 'aveuglement', 'e2'] },
    ]);
    banc.getState().dissiperLeSort('mage', 'aveuglement', 'e2');
    expect(banc.getState().pendingDispel, 'le geste du candidat n’ouvre pas sa Dissipation').toMatchObject({ spellId: 'aveuglement' });
  });
});
