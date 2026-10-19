import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { resolveShoreLeaveDesertion } from './shipCrew';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { MINUTES_PER_DAY } from '../engine/clock';
import { makeRNG } from '../engine/dice';
import { toBrass, type Money } from '../engine/money';

import { makePregens } from '../data/pregens';
import { resetCadence, setCadence } from '../engine/cadence';
import { fixtureText } from '../i18n/fixtureText';

/**
 * Navire de campagne PERSISTANT (MDG 14) : le Moral de l'équipage est recalculé une fois par SEMAINE
 * par l'entretien quotidien (`tickShipMorale`), avec la même garde anti-double-comptage que les rations.
 */
beforeEach(() => {
  useGame.setState({
    battle: null, mode: 'exploration', journal: [], travelPlan: null, 
    party: makePregens().slice(0, 1), gameTime: 0, lastUpkeepDay: 0, vessel: null,
  });
  seedBattleRng(7);
});

describe('Moral du navire de campagne — recalcul hebdomadaire dans l’entretien quotidien', () => {
  it('moins d’une semaine écoulée → Moral inchangé', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] } } });
    useGame.getState().advanceTime(3 * MINUTES_PER_DAY);
    expect(useGame.getState().vessel!.morale.score).toBe(75);
    expect(useGame.getState().vessel!.morale.lastMoraleWeek).toBe(0);
  });

  it('franchissement de semaine → Moral recalculé (pas-de-paie −3d10) et journalisé', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] } } });
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const v = useGame.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBeLessThan(75); // « Pas de paie » fait toujours chuter le Moral
    expect(useGame.getState().journal.join('\n')).toMatch(/Moral de l'équipage/);
  });

  it('sans navire (vessel null) → aucun effet, aucun plantage', () => {
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    expect(useGame.getState().vessel).toBeNull();
  });
});

describe('Paie hebdomadaire de l’équipage salarié (MDG 14, #216) — couture à l’entretien, CADENCE AUTO', () => {
  // En cadence auto (Rapide/Auto), la paie se résout SEULE (régulière par défaut) — comportement #216
  // inchangé ; en cadence manuelle un équipage salarié convoque désormais le Conseil de bord (#229, ci-dessous).
  beforeEach(() => setCadence('rapide'));
  afterEach(() => resetCadence());

  it('bourse suffisante → solde prélevée + facteur paie-reguliere (+1d10), aucune dette', () => {
    useGame.setState({
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
    });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 10, silver: 0, brass: 0 }); // Mousse hebdo = 288 sc, largement couvert
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const v = useGame.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBeGreaterThan(75); // « La paie est régulière » = +1d10
    expect(v.morale.factors).toEqual([]); // le facteur de paie est injecté pour le recalcul, jamais persisté
    expect(v.wagesOwed).toBeUndefined();
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(toBrass({ gold: 10, silver: 0, brass: 0 }) - 288);
    expect(useGame.getState().journal.join('\n')).toMatch(/Solde hebdomadaire de l'équipage versée/);
  });

  it('bourse insuffisante → pas-de-paie (−3d10) + dette accumulée, bourse intacte', () => {
    useGame.setState({
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
    });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 0, silver: 10, brass: 0 }); // 120 sc < 288
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const v = useGame.getState().vessel!;
    expect(v.morale.score).toBeLessThan(75); // « Pas de paie »
    expect(v.wagesOwed).toBe(288); // solve due cumulée en sous de cuivre
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(120); // rien n'est prélevé
    expect(useGame.getState().journal.join('\n')).toMatch(/Bourse insuffisante pour la solde/);
  });

  it('sans équipage salarié → aucun prélèvement, Moral inchangé (non-régression)', () => {
    useGame.setState({
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 5, silver: 0, brass: 0 });
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const v = useGame.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBe(75); // aucun facteur actif → delta 0
    expect(v.wagesOwed).toBeUndefined();
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(toBrass({ gold: 5, silver: 0, brass: 0 })); // bourse intacte
  });

  it('halte de nuit (openRest/restSleep) franchissant la semaine → le bilan de paie ne se journalise QU’UNE FOIS', () => {
    // Repro #216 : trois écritures indépendantes du MÊME bilan (upkeep.ts, buildNightCascade,
    // restSleep) écrivaient chacune le journal — l'Argent ne bougeait qu'une fois (garde hebdo
    // interne à `tickCampaignVesselWeek`), mais le texte apparaissait ×3 à l'écran.
    useGame.setState({
      battle: null, mode: 'exploration', journal: [], travelPlan: null, pendingRest: null,
      party: makePregens().slice(0, 1), gameTime: 7 * MINUTES_PER_DAY - 100, lastUpkeepDay: 6,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
    });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 10, silver: 0, brass: 0 });
    useGame.getState().openRest({ lieu: fixtureText('Ici'), places: { camp: true } });
    useGame.getState().restSleep();
    const wageLines = useGame.getState().journal.filter((l) => l.includes('Solde hebdomadaire'));
    expect(wageLines).toHaveLength(1);
  });
});

describe('Conseil de bord (#229) — cadence MANUELLE : la paie remonte en modale', () => {
  // Cadence manuelle par défaut (aucune surcharge) : un équipage salarié convoque le conseil au lieu de
  // prélever la solde en silence.
  const withCrew = (money: Money = { gold: 10, silver: 0, brass: 0 }) => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] } });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, money);
  };

  it('franchissement de semaine avec équipage salarié → pendingCouncil (choix), AUCUNE mutation avant validation', () => {
    withCrew();
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const s = useGame.getState();
    expect(s.pendingCouncil?.phase).toBe('choix');
    expect(s.pendingCouncil?.wageBrass).toBe(288); // barème mousse (paie régulière)
    expect(s.vessel!.morale.score).toBe(75); // Moral NON recalculé
    expect(s.vessel!.morale.lastMoraleWeek).toBe(0); // semaine NON avancée
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(toBrass({ gold: 10, silver: 0, brass: 0 })); // bourse intacte
  });

  it('choix « chiche » → facteur paie-chiche (−2d10) + demi-solde prélevée, bilan joué', () => {
    withCrew();
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    useGame.getState().councilPay('paie-chiche');
    const s = useGame.getState();
    expect(s.pendingCouncil?.phase).toBe('bilan');
    expect(s.vessel!.morale.score).toBeLessThan(75); // « La paie est chiche » fait chuter le Moral
    expect(s.vessel!.morale.lastMoraleWeek).toBe(1); // semaine avancée à la validation
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(toBrass({ gold: 10, silver: 0, brass: 0 }) - 144); // ½ de 288
    expect((s.pendingCouncil?.results ?? []).some((e) => e.label.includes('chiche'))).toBe(true);
    useGame.getState().councilClose();
    expect(useGame.getState().pendingCouncil).toBeNull();
  });

  it('bourse vide → seule « pas de paie » résout (option payante rejetée), dette cumulée', () => {
    withCrew({ gold: 0, silver: 0, brass: 0 });
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    useGame.getState().councilPay('paie-reguliere'); // non payable → rejeté
    expect(useGame.getState().pendingCouncil?.phase).toBe('choix'); // reste en choix
    useGame.getState().councilPay('pas-de-paie');
    const s = useGame.getState();
    expect(s.pendingCouncil?.phase).toBe('bilan');
    expect(s.vessel!.wagesOwed).toBe(288); // solde régulière due cumulée
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(0); // bourse intacte (vide)
  });

  it('sans équipage salarié → pas de conseil même en manuel (recalcul immédiat, non-régression)', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] } } });
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    expect(useGame.getState().pendingCouncil).toBeNull();
    expect(useGame.getState().vessel!.morale.lastMoraleWeek).toBe(1); // recalculé sur place
  });
});

describe('Désertion à la relâche à terre ACCORDÉE (MDG 14 l.192-202) — seuil = bande de Moral', () => {
  const lowVessel = () => useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 40, lastMoraleWeek: 0, factors: [] } } });

  it('bande basse (canailles, seuil 16) → désertions DÉTERMINISTES au RNG semé, crewLost augmente + ligne visible', () => {
    lowVessel();
    const lines = resolveShoreLeaveDesertion(useGame.getState, useGame.setState, makeRNG(1));
    const deserters = useGame.getState().vessel!.crewLost ?? 0;
    expect(deserters).toBeGreaterThan(0); // 15 marins présents × d100 ≤ 16
    expect(lines.join('\n')).toMatch(/ne sont pas revenus à bord/);
    // même graine → même compte (déterminisme)
    lowVessel();
    resolveShoreLeaveDesertion(useGame.getState, useGame.setState, makeRNG(1));
    expect(useGame.getState().vessel!.crewLost).toBe(deserters);
  });

  it('bande haute (excellent équipage, sans seuil au-dessus de 75) → AUCUNE désertion', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 90, lastMoraleWeek: 0, factors: [] } } });
    const lines = resolveShoreLeaveDesertion(useGame.getState, useGame.setState, makeRNG(1));
    expect(lines).toEqual([]);
    expect(useGame.getState().vessel!.crewLost ?? 0).toBe(0);
  });
});
