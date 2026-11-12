import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { resolveShoreLeaveDesertion, semainesDuConseil, choixDePaieOuverts } from './shipCrew';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { MINUTES_PER_DAY, campaignStart, dayIndex } from '../engine/clock';
import { applyEffects } from './combatEffects';
import { makeRNG } from '../engine/dice';
import { toBrass, fromBrass, formatMoney, type Money } from '../engine/money';
import { t } from '../i18n';

import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { setCadence } from '../engine/cadence';
import { fixtureText } from '../i18n/fixtureText';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Navire de campagne PERSISTANT (MDG 14) : le Moral de l'équipage est recalculé une fois par SEMAINE
 * par l'entretien quotidien (`tickShipMorale`), avec la même garde anti-double-comptage que les rations.
 */
beforeEach(() => {
  banc.setState({
    battle: null, mode: 'exploration', journal: [], travelPlan: null, 
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 1), gameTime: 0, lastUpkeepDay: 0, vessel: null,
  });
  seedBattleRng(7);
});

describe('Moral du navire de campagne — recalcul hebdomadaire dans l’entretien quotidien', () => {
  it('moins d’une semaine écoulée → Moral inchangé', () => {
    banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] } } });
    banc.getState().avancerLeTemps(3 * MINUTES_PER_DAY);
    expect(banc.getState().vessel!.morale.score).toBe(75);
    expect(banc.getState().vessel!.morale.lastMoraleWeek).toBe(0);
  });

  it('franchissement de semaine → Moral recalculé (pas-de-paie −3d10) et journalisé', () => {
    banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] } } });
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    const v = banc.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBeLessThan(75); // « Pas de paie » fait toujours chuter le Moral
    expect(banc.getState().journal.join('\n')).toMatch(/Moral de l'équipage/);
  });

  it('sans navire (vessel null) → aucun effet, aucun plantage', () => {
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    expect(banc.getState().vessel).toBeNull();
  });
});

describe('Paie hebdomadaire de l’équipage salarié (MDG 14, #216) — couture à l’entretien, CADENCE AUTO', () => {
  // En cadence auto (Rapide/Auto), la paie se résout SEULE (régulière par défaut) — comportement #216
  // inchangé ; en cadence manuelle un équipage salarié convoque désormais le Conseil de bord (#229, ci-dessous).
  beforeEach(() => setCadence('rapide'));

  it('bourse suffisante → solde prélevée + facteur paie-reguliere (+1d10), aucune dette', () => {
    banc.setState({
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
    });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 10, silver: 0, brass: 0 }); // Mousse hebdo = 288 sc, largement couvert
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    const v = banc.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBeGreaterThan(75); // « La paie est régulière » = +1d10
    expect(v.morale.factors).toEqual([]); // le facteur de paie est injecté pour le recalcul, jamais persisté
    expect(v.wagesOwed).toBeUndefined();
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(toBrass({ gold: 10, silver: 0, brass: 0 }) - 288);
    expect(banc.getState().journal.join('\n')).toMatch(/Solde hebdomadaire de l'équipage versée/);
  });

  it('bourse insuffisante → pas-de-paie (−3d10) + dette accumulée, bourse intacte', () => {
    banc.setState({
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
    });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 0, silver: 10, brass: 0 }); // 120 sc < 288
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    const v = banc.getState().vessel!;
    expect(v.morale.score).toBeLessThan(75); // « Pas de paie »
    expect(v.wagesOwed).toBe(288); // solve due cumulée en sous de cuivre
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(120); // rien n'est prélevé
    expect(banc.getState().journal.join('\n')).toMatch(/Bourse insuffisante pour la solde/);
  });

  it('sans équipage salarié → aucun prélèvement, Moral inchangé (non-régression)', () => {
    banc.setState({
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 5, silver: 0, brass: 0 });
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    const v = banc.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBe(75); // aucun facteur actif → delta 0
    expect(v.wagesOwed).toBeUndefined();
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(toBrass({ gold: 5, silver: 0, brass: 0 })); // bourse intacte
  });

  it('halte de nuit (ouvrirLeRepos puis la validation du repos) franchissant la semaine → le bilan de paie ne se journalise QU’UNE FOIS', () => {
    // Repro #216 : trois écritures indépendantes du MÊME bilan (upkeep.ts, buildNightCascade,
    // fenetreValider('repos')) écrivaient chacune le journal — l'Argent ne bougeait qu'une fois (garde hebdo
    // interne à `tickCampaignVesselWeek`), mais le texte apparaissait ×3 à l'écran.
    banc.setState({
      battle: null, mode: 'exploration', journal: [], travelPlan: null, pendingRest: null,
      party: tousLesHerosDeScenario(idsDeTest).slice(0, 1), gameTime: 7 * MINUTES_PER_DAY - 100, lastUpkeepDay: 6,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
    });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 10, silver: 0, brass: 0 });
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { camp: true } });
    banc.getState().fenetreValider('repos');
    const wageLines = banc.getState().journal.filter((l) => l.includes('Solde hebdomadaire'));
    expect(wageLines).toHaveLength(1);
  });
});

describe('Conseil de bord (#229) — cadence MANUELLE : la paie remonte en modale', () => {
  // Cadence manuelle par défaut (aucune surcharge) : un équipage salarié convoque le conseil au lieu de
  // prélever la solde en silence.
  const withCrew = (money: Money = { gold: 10, silver: 0, brass: 0 }) => {
    banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] } });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, money);
  };

  it('franchissement de semaine avec équipage salarié → pendingCouncil (choix), AUCUNE mutation avant validation', () => {
    withCrew();
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    const s = banc.getState();
    expect(s.pendingCouncil?.phase).toBe('choix');
    expect(s.pendingCouncil?.wageBrass).toBe(288); // barème mousse (paie régulière)
    expect(s.vessel!.morale.score).toBe(75); // Moral NON recalculé
    expect(s.vessel!.morale.lastMoraleWeek).toBe(0); // semaine NON avancée
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(toBrass({ gold: 10, silver: 0, brass: 0 })); // bourse intacte
  });

  it('choix « chiche » → facteur paie-chiche (−2d10) + demi-solde prélevée, bilan joué', () => {
    withCrew();
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    banc.getState().fenetreChoisir('conseil', 'paie', 'paie-chiche');
    const s = banc.getState();
    expect(s.pendingCouncil?.phase).toBe('bilan');
    expect(s.vessel!.morale.score).toBeLessThan(75); // « La paie est chiche » fait chuter le Moral
    expect(s.vessel!.morale.lastMoraleWeek).toBe(1); // semaine avancée à la validation
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(toBrass({ gold: 10, silver: 0, brass: 0 }) - 144); // ½ de 288
    expect((s.pendingCouncil?.results ?? []).some((e) => e.label.includes('chiche'))).toBe(true);
    banc.getState().fenetreFermer('conseil');
    expect(banc.getState().pendingCouncil).toBeNull();
  });

  it('bourse vide → seule « pas de paie » résout (option payante rejetée), dette cumulée', () => {
    withCrew({ gold: 0, silver: 0, brass: 0 });
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    banc.getState().fenetreChoisir('conseil', 'paie', 'paie-reguliere'); // non payable → rejeté
    expect(banc.getState().pendingCouncil?.phase).toBe('choix'); // reste en choix
    banc.getState().fenetreChoisir('conseil', 'paie', 'pas-de-paie');
    const s = banc.getState();
    expect(s.pendingCouncil?.phase).toBe('bilan');
    expect(s.vessel!.wagesOwed).toBe(288); // solde régulière due cumulée
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(0); // bourse intacte (vide)
  });

  it('sans équipage salarié → pas de conseil même en manuel (recalcul immédiat, non-régression)', () => {
    banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] } } });
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    expect(banc.getState().pendingCouncil).toBeNull();
    expect(banc.getState().vessel!.morale.lastMoraleWeek).toBe(1); // recalculé sur place
  });
});

describe('Saut d’horloge long (MDG 14 l.143, l.293-302, #1652) — chaque semaine franchie se règle', () => {
  // Un saut de N semaines règle N semaines, comme N sauts d'une semaine : même solde, mêmes recalculs.
  const soldeMousse = fromBrass(288);
  const recalcs = () => banc.getState().journal.filter((l) => l.startsWith("Moral de l'équipage recalculé")).length;
  const sauter = (pas: number[], conseil?: string) => {
    banc.setState({ gameTime: 0, lastUpkeepDay: 0, journal: [], pendingCouncil: null, pendingCascade: null, suspendedCascades: [], vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] } });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 5000, silver: 0, brass: 0 });
    const avant = toBrass(partyMoneyTotal(banc.getState));
    let jetsAuConseil = 0;
    for (const j of pas) {
      banc.getState().avancerLeTemps(j * MINUTES_PER_DAY);
      if (!conseil) continue;
      banc.getState().fenetreChoisir('conseil', 'paie', conseil);
      jetsAuConseil += banc.getState().pendingCouncil?.results?.length ?? 0;
      banc.getState().fenetreFermer('conseil');
    }
    const s = banc.getState();
    return {
      paye: avant - toBrass(partyMoneyTotal(banc.getState)),
      semaine: s.vessel!.morale.lastMoraleWeek,
      soldes: s.journal.filter((l) => l === t('crew.paid', { money: formatMoney(soldeMousse) })),
      recalcs: recalcs(),
      jetsAuConseil,
    };
  };

  it('cadence auto : un saut de 32 jours = quatre sauts de 8 jours (quatre soldes, quatre recalculs)', () => {
    setCadence('rapide');
    const unSaut = sauter([32]);
    const quatreSauts = sauter([8, 8, 8, 8]);
    expect(quatreSauts).toEqual({ paye: 4 * 288, semaine: 4, soldes: Array(4).fill(t('crew.paid', { money: formatMoney(soldeMousse) })), recalcs: 4, jetsAuConseil: 0 });
    expect(unSaut).toEqual(quatreSauts);
  });

  it('cadence manuelle : un Conseil pour le bloc de 32 jours règle quatre semaines, comme quatre Conseils', () => {
    const unSaut = sauter([32], 'paie-reguliere');
    const quatreSauts = sauter([8, 8, 8, 8], 'paie-reguliere');
    expect(quatreSauts).toEqual({ paye: 4 * 288, semaine: 4, soldes: Array(4).fill(t('crew.paid', { money: formatMoney(soldeMousse) })), recalcs: 4, jetsAuConseil: 4 });
    expect(unSaut).toEqual(quatreSauts);
  });

  it('cadence manuelle : les semaines qui passent pendant que le Conseil siège rejoignent son bloc', () => {
    banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] } });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 5000, silver: 0, brass: 0 });
    banc.getState().avancerLeTemps(8 * MINUTES_PER_DAY);
    expect(semainesDuConseil(banc.getState())).toBe(1);
    banc.getState().avancerLeTemps(14 * MINUTES_PER_DAY);
    expect(semainesDuConseil(banc.getState())).toBe(3);
    banc.getState().fenetreChoisir('conseil', 'paie', 'paie-reguliere');
    expect(banc.getState().vessel!.morale.lastMoraleWeek).toBe(3);
    expect(recalcs()).toBe(3);
    expect(banc.getState().pendingCouncil?.semaines).toBe(3);
    expect(toBrass({ gold: 5000, silver: 0, brass: 0 }) - toBrass(partyMoneyTotal(banc.getState))).toBe(3 * 288);
    expect(banc.getState().journal.filter((l) => l === t('crew.paid', { money: formatMoney(soldeMousse) }))).toHaveLength(3);
  });

  it('cadence auto : la solvabilité se juge semaine par semaine (trois soldes payées, la quatrième due)', () => {
    setCadence('rapide');
    banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] } });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, fromBrass(3 * 288));
    banc.getState().avancerLeTemps(32 * MINUTES_PER_DAY);
    const s = banc.getState();
    const paye = t('crew.paid', { money: formatMoney(soldeMousse) });
    const impaye = t('crew.cannotPay', { money: formatMoney(soldeMousse) });
    const suite = s.journal.flatMap((l) => (l === paye ? ['paid'] : l === impaye ? ['cannotPay'] : l.startsWith("Moral de l'équipage recalculé") ? ['recalc'] : []));
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(0);
    expect(s.vessel!.wagesOwed).toBe(288);
    expect(suite).toEqual(['paid', 'recalc', 'paid', 'recalc', 'paid', 'recalc', 'cannotPay', 'recalc']);
  });

  it('un navire posé par `setVessel` ne doit rien des semaines d’avant sa pose (MDG 14 l.143)', () => {
    setCadence('rapide');
    banc.setState({ gameTime: campaignStart(), lastUpkeepDay: dayIndex(campaignStart()) });
    applyEffects(banc.getState, banc.setState, [{ type: 'setVessel', vehicleId: 'cogue', crew: [{ roleId: 'mousse', count: 2 }] }]);
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 5000, silver: 0, brass: 0 });
    const avant = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().avancerLeTemps(1 * MINUTES_PER_DAY);
    expect({ paye: avant - toBrass(partyMoneyTotal(banc.getState)), recalcs: recalcs() }).toEqual({ paye: 0, recalcs: 0 });
    banc.getState().avancerLeTemps(7 * MINUTES_PER_DAY);
    expect({ paye: avant - toBrass(partyMoneyTotal(banc.getState)), recalcs: recalcs() }).toEqual({ paye: 2 * 288, recalcs: 1 });
  });

  it('cadence manuelle : un choix dont la bourse ne couvre pas la solde du bloc est refusé', () => {
    banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] } });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, fromBrass(3 * 288)); // trois soldes, bloc de quatre
    banc.getState().avancerLeTemps(32 * MINUTES_PER_DAY);
    expect(choixDePaieOuverts(banc.getState())).not.toContain('paie-reguliere');
    expect(choixDePaieOuverts(banc.getState())).toContain('paie-chiche');
  });
});

describe('Désertion à la relâche à terre ACCORDÉE (MDG 14 l.192-202) — seuil = bande de Moral', () => {
  const lowVessel = () => banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 40, lastMoraleWeek: 0, factors: [] } } });

  it('bande basse (canailles, seuil 16) → désertions DÉTERMINISTES au RNG semé, crewLost augmente + ligne visible', () => {
    lowVessel();
    const lines = resolveShoreLeaveDesertion(banc.getState, banc.setState, makeRNG(1));
    const deserters = banc.getState().vessel!.crewLost ?? 0;
    expect(deserters).toBeGreaterThan(0); // 15 marins présents × d100 ≤ 16
    expect(lines.join('\n')).toMatch(/ne sont pas revenus à bord/);
    // même graine → même compte (déterminisme)
    lowVessel();
    resolveShoreLeaveDesertion(banc.getState, banc.setState, makeRNG(1));
    expect(banc.getState().vessel!.crewLost).toBe(deserters);
  });

  it('bande haute (excellent équipage, sans seuil au-dessus de 75) → AUCUNE désertion', () => {
    banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 90, lastMoraleWeek: 0, factors: [] } } });
    const lines = resolveShoreLeaveDesertion(banc.getState, banc.setState, makeRNG(1));
    expect(lines).toEqual([]);
    expect(banc.getState().vessel!.crewLost ?? 0).toBe(0);
  });
});
