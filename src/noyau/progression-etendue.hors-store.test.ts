import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { openRoundEndCascade } from './combatFlow';
import { cumulEtenduDeRangee } from './progresEtendu';
import { createHero } from '../engine/character';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { unarmedWeapon } from '../engine/items';
import { setRule, resetRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, ShipPoste, Weapon } from '../engine/types';
import type { BatchParticipant, CascadeStep } from './pendings';
import { actorIn } from './monde/combatants';
import { ciblePsy } from '../engine/psych/ciblage';
import { serveChef } from './monde/shipPostes';
import { buildStageSteps } from './travelPostes';
import { applierDe } from './cascade';

/**
 * Progression d'un Test ÉTENDU (LDB 12 l.170-185) : la fenêtre annonce le cumul que le résolveur applique.
 * Peur de combat (LDB 21 l.25 ; Sans Peur LDB 10 l.1051), poste servi (MDG 12 l.448-462 ; LDB 62 l.333),
 * règle optionnelle « DR 0 = ±1 » (LDB 12 l.185).
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Peur de combat — la barre de la rangée = le cumul appliqué (LDB 21 l.25)', () => {
  const band = (): CascadeStep => banc.getState().pendingCascade!.participants[0];
  const row = (id: string): BatchParticipant => band().participants!.find((p) => p.id === id)!;
  const heroOf = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;

  /** Combat à un héros face à une source de Peur, Peur ENTAMÉE (`calmeDR`) sur l'Indice `indice`. */
  function peurEntamee(indice: number, calmeDR: number, sansPeur = false) {
    banc.getState().ensemencerLeTirage(2);
    banc.setState({ party: [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H1', seed: 1 })] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    if (sansPeur) {
      // Sans Peur ne vaut que face à une source NOUVELLE (`sansPeurFace`) : la Peur d'Indice voulu naît d'une Phobie.
      E.size = 'moyenne';
      E.groups = ['ogre'];
      H.psychTraits = [{ type: 'phobie', cible: ciblePsy.groupe('ogre'), indice }];
      H.talents = [...(H.talents ?? []), { talentId: 'sans-peur', spec: 'ogre', times: 1 }];
    } else {
      E.size = 'grande';
      H.psychState = [{ type: 'peur', sourceId: E.id, indice, calmeDR, lastTestRound: b.round - 2 }];
    }
    banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id) }, pendingCascade: null });
    openRoundEndCascade(banc.getState, banc.setState);
    expect(band().psychologieDeCombat?.kind).toBe('peur');
    return { H: actorIn(banc.getState(), H.id)!, E };
  }

  /** Pose le dé de la rangée du héros (champ que `jetLancer('cascadeEnBande')` écrit). */
  function jet(id: string, sl: number, success: boolean) {
    const pc = banc.getState().pendingCascade!;
    const participants = band().participants!.map((p) => (p.id === id ? { ...p, result: { roll: success ? 1 : 99, target: p.target, sl, success } } : p));
    banc.setState({ pendingCascade: { ...pc, participants: [{ ...band(), participants }, ...pc.participants.slice(1)] } });
  }

  it('échec DR −2 sur un cumul de 3 (Indice 5) : la barre annonce 1/5, la Peur garde 1 DR', () => {
    const { H, E } = peurEntamee(5, 3);
    jet(H.id, -2, false);
    expect(cumulEtenduDeRangee(row(H.id), band().participants!)).toEqual({ cum: 1, target: 5 });
    banc.getState().jetValider('cascade');
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur.calmeDR).toBe(1);
    expect(peur.surmontee).toBeFalsy();
  });

  it('Sans Peur, réussite DR 1 sur l’Indice 4 : la barre annonce 4/4, la Peur est surmontée', () => {
    const { H, E } = peurEntamee(4, 0, true);
    expect(row(H.id).meta?.sansPeur).toBe(true);
    jet(H.id, 1, true);
    expect(cumulEtenduDeRangee(row(H.id), band().participants!)).toEqual({ cum: 4, target: 4 });
    banc.getState().jetValider('cascade');
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur.surmontee).toBe(true);
  });
});

const servant = (id: string): Combatant =>
  combattantDeTest({ id, label: id, kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 50, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(10), advantage: 0, conditions: [], fortune: 0, resilience: 0,
    skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 10 }], talents: [], weapons: [unarmedWeapon()],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } });

describe('Poste servi à effectif COMPLET — la cible appliquée est celle annoncée (MDG 12 l.448-462)', () => {
  it('canon Recharge 6, Arme d’équipe 3, trois servants : cible 6 ; 4 DR + DR 2 → la pièce est chargée', () => {
    const crew = ['g1', 'g2', 'g3'];
    const poste = { side: 'tribord', loaded: false, reloadProgress: 4, crewIds: crew,
      item: { uid: 'canon', label: 'Canon moyen', kind: 'distance', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75,
        reload: 6, qualities: [{ id: 'recharge', value: 6 }, { id: 'arme-d-equipe', value: 3 }] } } as unknown as ShipPoste;
    const ship = combattantDeTest({ id: 'ship', label: 'Frégate', kind: 'heros', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille',
      crewIds: crew, postes: [poste], pos: { x: 5, y: 5 }, conditions: [], weapons: [unarmedWeapon()] });
    const servants = crew.map(servant);
    serveChef(servants[0], poste); // le chef sert la pièce : il en porte l'arme dérivée (`shipPostes.ts`)
    banc.setState({ battle: { combatants: [ship, ...servants], order: ['ship'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never,
      party: crew.map(servant), facing: { ship: 'N' }, pendingReload: null, scene: null as never });
    banc.getState().rechargerLArme('canon');
    const pr = banc.getState().pendingReload!;
    expect(pr.reload).toBe(6);
    banc.setState({ pendingReload: { ...pr, roll: 20, sl: 2, success: true } });
    banc.getState().jetValider('rechargement');
    const apres = banc.getState().battle!.combatants.find((c) => c.id === 'ship')!.postes![0];
    expect(apres.loaded).toBe(true);
  });
});

describe('Règle optionnelle « DR 0 = ±1 » lue par le pas canonique (LDB 12 l.185)', () => {
  afterEach(() => resetRule('test-etendu-dr-minimum'));
  it('Rechargement, réussite à DR 0 sous la règle : la progression gagne 1 DR', () => {
    setRule('test-etendu-dr-minimum', true);
    const arbalete = { uid: 'arb', label: 'Arbalète', type: 'distance', group: 'arbalete', damage: { flat: 9, plusBF: false }, range: 60,
      reload: 2, loaded: false, reloadProgress: 0, qualities: [{ id: 'recharge', value: 2 }] } as unknown as Weapon;
    const tireur = combattantDeTest({ id: 't', label: 'Tireur', kind: 'heros', weapons: [unarmedWeapon(), arbalete], pos: { x: 5, y: 5 } });
    banc.setState({ battle: { combatants: [tireur], order: ['t'], turn: 0, round: 1, acted: false, log: [] } as never, party: [tireur], scene: null as never,
      pendingReload: { actorId: 't', weaponUid: 'arb', reload: 2, progressBefore: 0, skillValue: 50, difficulty: 'intermediaire', ligne: { base: 50, mods: [], target: 50, difficulty: 'intermediaire' }, roll: 45, target: 50, sl: 0, success: true } });
    banc.getState().jetValider('rechargement');
    const w = banc.getState().battle!.combatants[0].weapons.find((x) => x.uid === 'arb')!;
    expect(w.reloadProgress).toBe(1);
  });
});

describe('Focalisation — Test étendu, un échec cumule son DR négatif (LDB 46 l.130 ; LDB 12 l.174)', () => {
  it('réserve 3 sur NI 8, échec DR −2 : la réserve tombe à 1', () => {
    const w = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 1, careerTalent: { id: 'magie-mineure' }, talentsRolled: false });
    w.focus = { spell: 'manifestation-de-demon-mineur', dr: 3 };
    banc.setState({ party: [w] });
    banc.setState({ pendingFocus: { casterId: w.id, spellId: 'manifestation-de-demon-mineur', result: { dr: 0, success: false, sl: -2, isCritical: false, isFumble: false, roll: 87, target: 65, log: 'échec' } } });
    banc.getState().jetValider('focalisation');
    expect(banc.getState().party.find((h) => h.id === w.id)!.focus).toEqual({ spell: 'manifestation-de-demon-mineur', dr: 1 });
  });
});

describe('Cartographie à deux (EDOC 8 l.161) : la barre de chaque rangée suit l’ordre du résolveur', () => {
  it('progression 1, échec DR −1 puis réussite DR 1 : la 2ᵉ barre annonce 1, la progression appliquée est 1', () => {
    const carto = (id: string): Combatant => combattantDeTest({ id, label: id, kind: 'heros', weapons: [unarmedWeapon()],
      skills: [{ id: 'metier', spec: 'cartographe', characteristic: 'dexterite', advances: 20 }] });
    banc.setState({ party: [carto('a'), carto('b')],
      travelPlan: { routeId: 'r', km: 24, postes: { a: { activityId: 'etablir-cartes' }, b: { activityId: 'etablir-cartes' } }, extendedProgress: 1 } as never });
    const steps = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete');
    const batch = steps.find((s) => s.kind === 'etapePosteEnBande')!;
    const [a, b] = ['a', 'b'].map((id) => batch.participants!.find((p) => p.id === id)!);
    a.result = { roll: 90, target: a.target!, sl: -1, success: false };
    b.result = { roll: 10, target: b.target!, sl: 1, success: true };
    expect(cumulEtenduDeRangee(b, batch.participants!)?.cum).toBe(1);
    applierDe('etapePosteEnBande')!(banc.getState, banc.setState, batch, undefined, { steps: [batch], index: 0 });
    const agg = steps.find((s) => s.kind === 'etapeBilan')!;
    applierDe('etapeBilan')!(banc.getState, banc.setState, agg, undefined, { steps, index: steps.indexOf(agg) });
    expect(banc.getState().travelPlan!.extendedProgress).toBe(1);
  });
});
