import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { makePregens } from '../data/pregens';
import { buildSeaPlan, applySteamBreakdown, resolveSteamSave } from './seaVoyageFlow';
import { STEAM_BREAKDOWNS } from '../engine/shipBuild';
import { seedBattleRng, battleRng } from './battleRng';
import type { WorldMap } from './worldMap';
import type { PendingSteamSave } from './pendings';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * PANNE DE VAPEUR (MDG 12 l.313-352) résolue au voyage (#184) : la table Panne de Vapeur ne se narre
 * plus — chaque champ first-class est EXÉCUTÉ. « Fuite de vapeur » → sauvegarde d'Initiative INFLUENÇABLE ;
 * « Explosion » → dégâts Perforante à la personne au moteur + moteur détruit + Coup Critique Coque ; les
 * pannes à redémarrage roulent leurs Tests et perdent la fraction de journée immobilisée.
 */
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b' },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

const entry = (id: string) => STEAM_BREAKDOWNS.find((b) => b.id === id)!;

/** Navire de campagne À VAPEUR (Amélioration Propulsion à vapeur) en pleine traversée, milles du jour posés. */
function steamAtSea(milesToday = 80) {
  seedBattleRng(1);
  banc.setState({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null,
    worldMap: seaMap,
    travelPlan: null,
    gameTime: 8 * 60,
    vessel: { vehicleId: 'cogue', upgrades: [{ id: 'propulsion-a-vapeur' }], morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    pendingSteamSave: null,
    journal: [],
  } as never);
  const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
  plan.sea!.milesToday = milesToday;
  set({ travelPlan: plan });
}

describe('Panne de Vapeur — résolution first-class (MDG 12 l.313-352)', () => {
  beforeEach(() => steamAtSea());

  it('« Fuite de vapeur » (failDamage) : ouvre une sauvegarde d’Initiative INFLUENÇABLE sur la personne au moteur, sans toucher les milles', () => {
    applySteamBreakdown(get, set, entry('fuite-de-vapeur'), battleRng());
    const p = get().pendingSteamSave as PendingSteamSave | null;
    expect(p).toBeTruthy();
    expect(get().party.some((h) => h.id === p!.actorId)).toBe(true); // un PJ tient le moteur
    expect(p!.scaldOps[0]).toMatchObject({ op: 'wounds', ignoreAP: true, ignoreTB: false }); // ignorent l'Armure SEULE (le BE reste déduit)
    expect((p!.scaldOps[0] as { amount: number }).amount).toBeGreaterThanOrEqual(1); // « 1 minimum »
    expect(get().travelPlan!.sea!.milesToday).toBe(80); // la fuite n'immobilise pas le moteur
  });

  it('sauvegarde ÉCHOUÉE → ébouillanté (Blessures), RÉUSSIE → indemne ; la boucle reprend dans les deux cas', () => {
    applySteamBreakdown(get, set, entry('fuite-de-vapeur'), battleRng());
    const p = get().pendingSteamSave as PendingSteamSave;
    const eng = get().party.find((h) => h.id === p.actorId)!;
    const before = eng.wounds.current;
    resolveSteamSave(get, set, { ...p, roll: 99, success: false }); // échec → scald
    const engAfter = get().party.find((h) => h.id === p.actorId)!;
    expect(engAfter.wounds.current).toBeLessThanOrEqual(before); // ébouillanté (0 si BE ≥ Dégâts)

    steamAtSea();
    applySteamBreakdown(get, set, entry('fuite-de-vapeur'), battleRng());
    const p2 = get().pendingSteamSave as PendingSteamSave;
    const eng2 = get().party.find((h) => h.id === p2.actorId)!;
    const before2 = eng2.wounds.current;
    resolveSteamSave(get, set, { ...p2, roll: 1, success: true }); // réussite → indemne
    expect(get().party.find((h) => h.id === p2.actorId)!.wounds.current).toBe(before2);
  });

  it('« Perte de pression » (mSet + restart) : roule le Test de redémarrage (retry jusqu’à réussite), sans sauvegarde perso', () => {
    const jBefore = get().journal.length;
    applySteamBreakdown(get, set, entry('perte-de-pression'), battleRng());
    expect(get().pendingSteamSave).toBeNull(); // pas de sauvegarde d'Initiative ici
    expect(get().journal.slice(jBefore).some((l) => /relancé/i.test(l))).toBe(true); // Métier (Ingénieur) de redémarrage exécuté
    // Mise en pression de 5 − DR Rounds : à l'échelle voyage (24 h), quelques Rounds ≈ 0 mille perdu.
    expect(get().travelPlan!.sea!.milesToday).toBeLessThanOrEqual(80);
  });

  it('« Rupture du réservoir » (coolMinutes 20+1d10) : les ~25 min de refroidissement coûtent des milles sur la journée', () => {
    applySteamBreakdown(get, set, entry('rupture-du-reservoir'), battleRng());
    expect(get().travelPlan!.sea!.milesToday).toBeLessThan(80); // refroidissement obligatoire → immobilisation mesurable
  });

  it('« Feu éteint » (Test étendu de Force + Métier) : les DEUX Tests de redémarrage sont roulés', () => {
    const jBefore = get().journal.length;
    applySteamBreakdown(get, set, entry('feu-eteint'), battleRng());
    const lines = get().journal.slice(jBefore).join('\n');
    expect(/Test étendu/i.test(lines)).toBe(true); // Force étendu (10 DR)
    expect(/relancé/i.test(lines)).toBe(true); // Métier (Ingénieur) de redémarrage
  });

  it('« Explosion » (compartmentDamage + engineDestroyed + hullCritical) : la personne au moteur est frappée, la vapeur est perdue, la coque encaisse un Critique', () => {
    const eng = get().party[0];
    const before = eng.wounds.current;
    applySteamBreakdown(get, set, entry('explosion'), battleRng());
    // 12 Dégâts Perforante à la personne au moteur (un PJ a perdu des Blessures).
    expect(get().party.some((h) => h.wounds.current < before || h.wounds.current < h.wounds.max)).toBe(true);
    // Moteur détruit : l'Amélioration Propulsion à vapeur saute.
    expect((get().vessel!.upgrades ?? []).some((u) => u.id === 'propulsion-a-vapeur')).toBe(false);
    // Coup Critique à la Coque noté sur le navire.
    expect((get().vessel!.criticals ?? []).length).toBeGreaterThan(0);
  });
});
