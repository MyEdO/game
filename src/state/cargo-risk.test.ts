import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import {
  cargoRaidLossPct, spoilCargoByEnc, spoilCargoByPct, cargoTotalEnc, type CargoLot,
} from '../engine/cargo';
import { applyLandCargoRaid } from './carriers';
import { spoilVesselCargoOnLeak } from './seaVoyageFlow';
import { startCascade } from './cascade';
import { seedBattleRng } from './battleRng';
import { rule, setRule, resetRule } from '../engine/policy';
import type { CascadeStep } from './pendings';
import type { Possession } from '../engine/possession';

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const lot = (cargoId: string, enc: number): CargoLot => ({ cargoId, enc, basePriceGold: 2 });

/** Un héros du groupe (propriétaire du porteur véhicule ci-dessous, SOCLE POSSESSIONS #617/#618). */
function cartHero() {
  return createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
}

/** Un porteur véhicule (charrette EDOC, `chargement` 25) — Possession `nature: 'vehicule'`, chargé de `lots`. */
function cartPossession(ownerId: string, lots: CargoLot[]): Possession {
  return { uid: 'cart-1', ownerId, nature: 'vehicule', vehicleId: 'charrette', location: { kind: 'avec-le-groupe' }, items: [], cargo: lots };
}

describe('Risque cargaison — tronc PUR (#327 lot D)', () => {
  it('cargoRaidLossPct : victoire = 0, fuite = fleePct, défaite = lossPct (bornés 0..100)', () => {
    expect(cargoRaidLossPct('victory', 25, 75)).toBe(0);
    expect(cargoRaidLossPct('fled', 25, 75)).toBe(25);
    expect(cargoRaidLossPct('defeat', 25, 75)).toBe(75);
    expect(cargoRaidLossPct('defeat', 25, 200)).toBe(100); // borné haut
    expect(cargoRaidLossPct('fled', -5, 75)).toBe(0); // borné bas
  });

  it('spoilCargoByEnc : retire un montant borné au CONTENU, au fil des lots, sans égard au type', () => {
    const lots = [lot('vin', 8), lot('sel', 6)];
    const r = spoilCargoByEnc(lots, 10);
    expect(r.removed).toBe(10);
    expect(cargoTotalEnc(r.lots)).toBe(4); // 14 − 10
    // Plus que le contenu : borné au total, jamais négatif.
    expect(spoilCargoByEnc(lots, 999).removed).toBe(14);
    expect(spoilCargoByEnc([], 5).removed).toBe(0);
  });

  it('spoilCargoByPct : retire un % de l’Enc total (arrondi), réparti au fil des lots', () => {
    const lots = [lot('vin', 30), lot('sel', 10)]; // total 40
    expect(spoilCargoByPct(lots, 100).removed).toBe(40);
    expect(spoilCargoByPct(lots, 25).removed).toBe(10);
    expect(spoilCargoByPct(lots, 0).removed).toBe(0);
  });
});

describe('Vol terrestre GRADUÉ par l’issue (#327 A5.1) — applyLandCargoRaid', () => {
  afterEach(() => { resetRule('landRobberyFleePct'); resetRule('landRobberyLossPct'); });

  const slice = (lots: CargoLot[]) => {
    const h = cartHero();
    return { party: [h], vessel: null, worldMap: null, scene: null, possessions: [cartPossession(h.id, lots)] } as never;
  };

  it('victoire : le convoi est sauf (0 Enc perdu)', () => {
    const r = applyLandCargoRaid(slice([lot('vin', 40)]), 'victory');
    expect(r.pct).toBe(0);
    expect(r.losses).toHaveLength(0);
  });

  it('fuite : retire landRobberyFleePct (défaut 25 %) de l’Enc du convoi', () => {
    const r = applyLandCargoRaid(slice([lot('vin', 40)]), 'fled');
    expect(r.pct).toBe(25);
    expect(r.losses.reduce((n, l) => n + l.removed, 0)).toBe(10);
  });

  it('défaite : retire landRobberyLossPct (défaut 75 %) — et respecte la surcharge éditable', () => {
    expect(applyLandCargoRaid(slice([lot('vin', 40)]), 'defeat').losses.reduce((n, l) => n + l.removed, 0)).toBe(30);
    setRule('landRobberyLossPct', 50);
    expect(applyLandCargoRaid(slice([lot('vin', 40)]), 'defeat').losses.reduce((n, l) => n + l.removed, 0)).toBe(20);
  });
});

describe('Vol terrestre — dénouement au teardown de combat (store)', () => {
  beforeEach(() => {
    const h = cartHero();
    useGame.setState({ party: [h], vessel: null, worldMap: null, scene: null, possessions: [cartPossession(h.id, [lot('vin', 40)])], battle: null, cargoRaid: true, journal: [] } as never);
  });
  afterEach(() => useGame.setState({ cargoRaid: false } as never));

  it('resolveCargoRaid(defeat) retire 75 % des lots réels du véhicule et éteint le flag', () => {
    get().resolveCargoRaid('defeat');
    const cart = get().possessions[0];
    expect(cargoTotalEnc(cart.cargo ?? [])).toBe(10); // 40 − 30 (75 %)
    expect(get().cargoRaid).toBe(false);
  });

  it('resolveCargoRaid(victory) ne retire rien (convoi sauf) et éteint le flag', () => {
    get().resolveCargoRaid('victory');
    expect(cargoTotalEnc(get().possessions[0].cargo ?? [])).toBe(40);
    expect(get().cargoRaid).toBe(false);
  });

  it('no-op quand aucun vol n’est en cours', () => {
    useGame.setState({ cargoRaid: false } as never);
    get().resolveCargoRaid('defeat');
    expect(cargoTotalEnc(get().possessions[0].cargo ?? [])).toBe(40);
  });
});

describe('Voie d’eau — la coque percée/heurtée gâte 1d10 Enc (#327 D)', () => {
  it('spoilVesselCargoOnLeak : borné à 1d10 ET au contenu', () => {
    seedBattleRng(3);
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [lot('bois', 100)] } } as never);
    const lines = spoilVesselCargoOnLeak(get, set);
    const removed = 100 - cargoTotalEnc(get().vessel!.cargo!);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(removed).toBeLessThanOrEqual(10);
    expect(lines.join(' ')).toContain('voie d\'eau');
  });

  it('cale vide : rien à gâter, aucune ligne', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [] } } as never);
    expect(spoilVesselCargoOnLeak(get, set)).toHaveLength(0);
  });
});

describe('Cogue pirate — se soumettre : pillage + tribut (#327 A5.3)', () => {
  const hailStep = (): CascadeStep => ({
    id: 'sea-pirate-hail', kind: 'sea-pirate-hail', label: fixtureText('Cogue pirate'), defaultChoice: 'fuir',
    meta: { crisisLabel: 'Cogue pirate', crisisDesc: 'desc' },
    options: [
      { key: 'fuir', label: fixtureText('Fuir') }, { key: 'combattre', label: fixtureText('Combattre') }, { key: 'soumettre', label: fixtureText('Se soumettre') },
    ],
  });

  beforeEach(() => {
    seedBattleRng(5);
    useGame.setState({
      party: [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) })],
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [lot('vin', 30), lot('sel', 20)] } as never,
      worldMap: null, scene: null, battle: null, travelPlan: null, pendingCascade: null, suspendedCascades: [], journal: [],
    } as never);
  });

  it('soumission : pillage piratePillagePct (100 %) de la cale puis insère le choix du tribut ; livrer retire un marin', () => {
    expect(Number(rule('piratePillagePct'))).toBe(100);
    startCascade(get, set, { title: 'Cogue pirate', purpose: 'test', steps: [hailStep()] });
    get().cascadeChoose('sea-pirate-hail', 'soumettre');
    get().cascadeNext();
    // Cale VIDÉE (100 %) + étape de tribut insérée.
    expect(cargoTotalEnc(get().vessel!.cargo ?? [])).toBe(0);
    const p = get().pendingCascade;
    expect(p?.participants.some((s) => s.kind === 'sea-pirate-tribute')).toBe(true);
    // Livrer un marin : crewLost incrémenté (perte réelle).
    get().cascadeChoose('sea-pirate-tribute', 'livrer');
    get().cascadeNext();
    expect((get().vessel!.crewLost ?? 0)).toBeGreaterThan(0);
  });

  it('tribut REFUSÉ → un ABORDAGE RÉEL s’ouvre (deux coques, ennemis présents), cascade PARQUÉE derrière le combat', () => {
    // Navire hostile de l'événement (cogue pirate) porté sur l'état naval → l'abordage se DÉRIVE (aucune
    // route authorée requise). Coque de campagne = `vessel.vehicleId` (barge — coque distincte de l'ennemi).
    set({
      vessel: { vehicleId: 'barge-fluviale', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [] } as never,
      travelPlan: { interrupted: true, sea: { lines: [], boarding: { shipRef: 'cogue', crewRef: 'pirate-fluvial', chefRef: 'chef-pirate', label: 'Cogue pirate' } } } as never,
    } as never);
    startCascade(get, set, { title: 'Cogue pirate', purpose: 'test', steps: [hailStep()] });
    get().cascadeChoose('sea-pirate-hail', 'soumettre');
    get().cascadeNext();
    const crewBefore = get().vessel!.crewLost ?? 0;
    get().cascadeChoose('sea-pirate-tribute', 'refuser');
    get().cascadeNext();
    expect(get().vessel!.crewLost ?? 0).toBe(crewBefore); // refuser ne sacrifie aucun marin
    const battle = get().battle!;
    expect(battle).toBeTruthy();
    expect(battle.combatants.some((c) => c.kind === 'enemy' && c.wounds.current > 0)).toBe(true);
    // Deux coques bord à bord : la cogue ennemie + la coque de campagne (ralliée au camp allié).
    expect(battle.combatants.filter((c) => c.creatureId === 'cogue').length).toBe(1);
    expect(battle.combatants.filter((c) => c.creatureId === 'barge-fluviale').length).toBe(1);
    // UNE seule séquence parquée derrière le combat : la carte d'ENTRÉE de la scène d'abordage
    // (`affichage`) — une révélation étant une étape de cascade (#942 L8), elle relève de la couture
    // universelle de suspension et reprend au teardown. Le hail (`test`) suspendu à sa DERNIÈRE étape
    // n'a AUCUNE étape restante : il se FINALISE (dénouement joué) au lieu d'être parqué, sinon il
    // ressusciterait EN BILAN par-dessus le contexte qui a pris le slot (#1014). Son dénouement est
    // inoffensif ici : `runSeaDay` sort sur `travelPlan.interrupted`, la traversée reprend par
    // `resumeTravel` après le combat.
    expect(get().suspendedCascades.map((c) => c.purpose)).toEqual(['affichage']);
  });

  it('fuir → la poursuite porte la crise posée par le producteur de l’étape (#1906)', () => {
    set({ travelPlan: { interrupted: true, sea: { lines: [], weather: { visibilite: 'degage' } } } as never } as never);
    startCascade(get, set, { title: 'Cogue pirate', purpose: 'test', steps: [{ ...hailStep(), meta: { crisisLabel: 'La Dent de Manann', crisisDesc: 'voile noire' } }] });
    get().cascadeChoose('sea-pirate-hail', 'fuir');
    get().cascadeNext();
    expect(get().travelPlan!.sea!.crisis).toMatchObject({ kind: 'poursuite', label: 'La Dent de Manann', desc: 'voile noire' });
  });

  it('fuir sur une étape SANS crise : erreur nommée, jamais un pirate au nom inventé (#1906)', () => {
    set({ travelPlan: { interrupted: true, sea: { lines: [], weather: { visibilite: 'degage' } } } as never } as never);
    startCascade(get, set, { title: 'Cogue pirate', purpose: 'test', steps: [{ ...hailStep(), meta: undefined }] });
    get().cascadeChoose('sea-pirate-hail', 'fuir');
    expect(() => get().cascadeNext()).toThrow(/sea-pirate-hail.*openPirateHail/);
  });

  it('combattre d’emblée → même abordage dérivé (deux coques, ennemis présents)', () => {
    set({
      vessel: { vehicleId: 'barge-fluviale', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [] } as never,
      travelPlan: { interrupted: true, sea: { lines: [], boarding: { shipRef: 'cogue', crewRef: 'pirate-fluvial', chefRef: 'chef-pirate', label: 'Cogue pirate' } } } as never,
    } as never);
    startCascade(get, set, { title: 'Cogue pirate', purpose: 'test', steps: [hailStep()] });
    get().cascadeChoose('sea-pirate-hail', 'combattre');
    get().cascadeNext();
    const battle = get().battle!;
    expect(battle).toBeTruthy();
    expect(battle.combatants.filter((c) => c.creatureId === 'cogue').length).toBe(1);
    expect(battle.combatants.filter((c) => c.creatureId === 'barge-fluviale').length).toBe(1);
  });

  it('événement SANS navire nommé (Némésis authorée manquante) → aucun abordage, report HONNÊTE (pas de pseudo-récit)', () => {
    set({
      worldMap: null, scene: null, battle: null,
      travelPlan: { interrupted: true, sea: { lines: [] } } as never, // pas de `boarding` dérivable
      journal: [],
    } as never);
    startCascade(get, set, { title: 'Cogue pirate', purpose: 'test', steps: [hailStep()] });
    get().cascadeChoose('sea-pirate-hail', 'combattre');
    get().cascadeNext();
    expect(get().battle).toBeNull();
    expect(get().journal.join(' ')).not.toContain('l’issue reste au récit');
    expect(get().journal.join(' ')).toContain('aucune donnée d’abordage');
  });
});
