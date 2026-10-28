/**
 * Chantier naval et dossier du navire jugés par le NOYAU (#3059, lot port) : les gestes `portRepair` et
 * `portCareen` débitent le devis `devisDeChantier` et en disent le refus ; `dossierDuNavire` compose le
 * refus d'appareiller et l'effectif présent (`shipboardSouls`). MDG 13 l.643 ; MDG 13 l.150-159 ;
 * MDG 12 l.70-75 ; MDG 14 l.238 ; MDG 12 l.195-364 ; MDG 15 l.319.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type EtatDeJeu, type Partie } from './index';
import { makePregens } from '../data/pregens';
import { findVehicleById, NAVAL_TRAITS } from '../data';
import { emptyScene } from './monde/scene';
import { toBrass, toMoney, add as moneyAdd, fromBrass, type Money } from '../engine/money';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import type { CampaignVessel } from './etat';
import { devisDeChantier, devisDAmelioration, dossierDuNavire, raisonDuRefusDAppareiller, refusDAppareiller } from './seaVoyageFlow';
import { refusDEntrerAuPort } from './portFlow';
import { plafondDePlanque } from './seaActivities';
import { installCost } from '../engine/shipBuild';
import { shipboardSouls } from './shipCrew';
import { t } from '../i18n';

const COGUE = findVehicleById('cogue')!;
const navire = (patch: Partial<CampaignVessel> = {}): CampaignVessel =>
  ({ vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, ...patch }) as CampaignVessel;

/** Partie à quai : un héros à la bourse `bourse`, le navire `vessel`. */
function aQuai(vessel: CampaignVessel, bourse: Money, mode: 'local' | 'guest' = 'local', etat: Partial<EtatDeJeu> = {}): Partie {
  const entrees: EntreesDeLaPartie = { graine: 2, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
  return creerPartie({
    ...etatInitialDuJeu(),
    party: makePregens().slice(0, 1).map((h) => withBourseMoney(h, bourse)),
    scene: { ...emptyScene('port', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    gameTime: 8 * 60,
    vessel,
    net: { ...etatInitialDuJeu().net, mode },
    ...etat,
  }, entrees);
}

const bourseDuGroupe = (p: Partie) => toBrass(p.etat().party.reduce((s, h) => moneyAdd(s, bourseOf(h)), fromBrass(0)));
const B = COGUE.hull!.char.B;

describe('#3059 — chantier naval : un seul devis pour l’écran et le geste', () => {
  it('réparation : le débit est le devis, la coque est restaurée', () => {
    const partie = aQuai(navire({ wounds: { current: B - 4, max: B } }), { gold: 100, silver: 0, brass: 0 });
    try {
      const devis = devisDeChantier(partie.etat().vessel!, { gold: 100, silver: 0, brass: 0 }, null);
      expect(devis.refusReparation).toBeNull();
      expect(devis.missing).toBe(4);
      expect(devis.reparationGold, '1 CO par Blessure restaurée, coque non lissée (MDG 13 l.643)').toBe(4);
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'portRepair', args: [] });
      expect(avant - bourseDuGroupe(partie)).toBe(toBrass(toMoney({ gold: devis.reparationGold })));
      expect(partie.etat().vessel!.wounds).toEqual({ current: B, max: B });
    } finally {
      partie.fermer();
    }
  });

  it('bourse vide : le devis refuse la réparation et le carénage, le geste dit le même refus', () => {
    const vide = { gold: 0, silver: 0, brass: 0 };
    const partie = aQuai(navire({ wounds: { current: B - 4, max: B }, fouling: { level: 2, lastWeek: 0 } }), vide);
    try {
      const devis = devisDeChantier(partie.etat().vessel!, vide, null);
      // MDG 13 l.643 : 1 CO par Blessure → 4 CO. MDG 13 l.152-159 : Salissures niveau 2 → 10 % du coût de base
      // de la cogue (300 CO) → 30 CO.
      expect(devis.refusReparation).toBe(t('sv.yardTooExpensive', { cost: 4 }));
      expect(devis.refusCarenage).toBe(t('sv.careenTooExpensive', { cost: 30, pct: 10 }));
      partie.envoyer({ type: 'portRepair', args: [] });
      partie.envoyer({ type: 'portCareen', args: [] });
      const journal = partie.etat().journal;
      expect(journal.some((l) => l.includes(devis.refusReparation!))).toBe(true);
      expect(journal.some((l) => l.includes(devis.refusCarenage!))).toBe(true);
      expect(partie.etat().vessel!.wounds!.current).toBe(B - 4);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — dossier du navire : composé des sources du noyau', () => {
  it('cale au-delà du plafond dur : le dossier porte le refus d’appareiller du départ en mer', () => {
    const vessel = navire({ cargo: [{ cargoId: 'bois', enc: 2 * COGUE.ship!.capacity, basePriceGold: 10 }], crewLost: 1 });
    const party = makePregens().slice(0, 2);
    const dossier = dossierDuNavire(vessel, party)!;
    expect(dossier.refusDAppareiller).toBe(raisonDuRefusDAppareiller(refusDAppareiller(vessel)!));
    expect(dossier.crewCount).toBe(shipboardSouls({ party, vessel }).crew);
    expect(dossier.crewCount).toBe(Math.max(0, (COGUE.ship!.crew ?? 0) - 1));
  });

  it('cale nominale : aucun refus d’appareiller', () => {
    expect(dossierDuNavire(navire(), makePregens().slice(0, 1))!.refusDAppareiller).toBeNull();
  });
});

describe('#3059 — Amélioration et entrée au port : le geste applique le verdict de l’écran', () => {
  const trait = NAVAL_TRAITS.find((tr) => tr.kind === 'amelioration' && tr.install && (installCost(tr.install, COGUE.ship!.lengthM, 1).gold ?? 0) > 0)!;
  const gold = installCost(trait.install!, COGUE.ship!.lengthM, 1).gold!;

  it('bourse suffisante : la pose débite le devis et porte l’Amélioration', () => {
    const bourse = { gold: gold + 10, silver: 0, brass: 0 };
    const partie = aQuai(navire(), bourse);
    try {
      expect(devisDAmelioration(partie.etat().vessel, trait.id, 1, bourse, null)).toMatchObject({ gold, refus: null });
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'portInstallUpgrade', args: [trait.id, 1] });
      expect(avant - bourseDuGroupe(partie)).toBe(toBrass(toMoney({ gold })));
      expect(partie.etat().vessel!.upgrades?.map((u) => u.id)).toContain(trait.id);
    } finally {
      partie.fermer();
    }
  });

  it('bourse vide : refus du devis, dit par le geste, rien de posé', () => {
    const vide = { gold: 0, silver: 0, brass: 0 };
    const partie = aQuai(navire(), vide);
    try {
      const refus = devisDAmelioration(partie.etat().vessel, trait.id, 1, vide, null).refus;
      expect(refus).toBe(t('sv.upgradeTooExpensive', { label: trait.label, gold }));
      partie.envoyer({ type: 'portInstallUpgrade', args: [trait.id, 1] });
      expect(partie.etat().journal.some((l) => l.includes(refus!))).toBe(true);
      expect(partie.etat().vessel!.upgrades ?? []).toEqual([]);
    } finally {
      partie.fermer();
    }
  });

  it('sans navire de campagne : entrer au port est refusé, et le geste le dit', () => {
    const entrees: EntreesDeLaPartie = { graine: 2, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
    const partie = creerPartie({
      ...etatInitialDuJeu(),
      party: makePregens().slice(0, 1),
      scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      worldMap: { id: 'm', label: 'Mer', places: [{ id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a', port: { taille: 4, richesse: 4, production: ['commerce'] } as never }], routes: [] },
      vessel: null,
    }, entrees);
    try {
      const refus = refusDEntrerAuPort(partie.etat());
      expect(refus).toBe(t('port.sansNavire'));
      partie.envoyer({ type: 'openPort', args: [] });
      expect(partie.etat().port).toBeNull();
      expect(partie.etat().journal.some((l) => l.includes(refus!))).toBe(true);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — siège invité : les dépenses du chantier disent le refus de dépense du groupe', () => {
  it('réparation, carénage, Amélioration et embauche refusés, rien de débité ni posé', () => {
    const trait = NAVAL_TRAITS.find((tr) => tr.kind === 'amelioration' && tr.install && (installCost(tr.install, COGUE.ship!.lengthM, 1).gold ?? 0) > 0)!;
    const partie = aQuai(navire({ wounds: { current: B - 4, max: B }, fouling: { level: 2, lastWeek: 0 } }), { gold: 10000, silver: 0, brass: 0 }, 'guest');
    try {
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'portRepair', args: [] });
      partie.envoyer({ type: 'portCareen', args: [] });
      partie.envoyer({ type: 'portInstallUpgrade', args: [trait.id, 1] });
      partie.envoyer({ type: 'portHireCrew', args: ['timonier', 1] });
      const v = partie.etat().vessel!;
      expect(bourseDuGroupe(partie)).toBe(avant);
      expect(v.wounds!.current).toBe(B - 4);
      expect(v.fouling!.level).toBe(2);
      expect(v.upgrades ?? []).toEqual([]);
      expect(v.crew ?? []).toEqual([]);
      expect(partie.etat().journal.filter((l) => l.includes(t('groupe.hoteSeul'))).length).toBe(4);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — siège invité : vente, bradage, Conseil et Prêtre de Manann disent le refus de groupe', () => {
  it('vente et bradage au port, paie du Conseil, bénédiction de Manann : refusés, rien ne bouge', () => {
    const lot = { cargoId: 'bois', enc: 10, basePriceGold: 10 };
    const port = { taille: 4, richesse: 4, production: [] as string[] } as never;
    const partie = aQuai(navire({ cargo: [lot] }), { gold: 500, silver: 0, brass: 0 }, 'guest', {
      port: { placeId: 'P', label: 'Port', port, offers: [] },
      pendingCouncil: { today: 7, wageBrass: 240, phase: 'choix' },
      pendingManannPriest: { cost: { gold: 3, silver: 0, brass: 0 } },
    });
    try {
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'portSellCargo', args: [0] });
      partie.envoyer({ type: 'portDumpCargo', args: [0] });
      partie.envoyer({ type: 'councilPay', args: ['paie-reguliere'] });
      partie.envoyer({ type: 'resolveManannPriest', args: [true] });
      const s = partie.etat();
      expect(s.vessel!.cargo).toEqual([lot]);
      expect(bourseDuGroupe(partie)).toBe(avant);
      expect(s.pendingCouncil?.phase).toBe('choix');
      expect(s.pendingManannPriest).not.toBeNull();
      expect(s.journal.filter((l) => l.includes(t('groupe.hoteSeul'))).length).toBe(4);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — bradage au port : refusé sans « commerce » ni Demande pour le lot (MDG 15 l.399)', () => {
  it('siège local, port sans « commerce » ni Demande : le geste dit le refus, la cale et la bourse restent', () => {
    const lot = { cargoId: 'bois', enc: 10, basePriceGold: 10 };
    const port = { taille: 4, richesse: 4, production: [] as string[] } as never;
    const partie = aQuai(navire({ cargo: [lot] }), { gold: 500, silver: 0, brass: 0 }, 'local', {
      port: { placeId: 'P', label: 'Port', port, offers: [] },
    });
    try {
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'portDumpCargo', args: [0] });
      expect(partie.etat().vessel!.cargo).toEqual([lot]);
      expect(bourseDuGroupe(partie)).toBe(avant);
      expect(partie.etat().journal.some((l) => l.includes('Bois : ce port ne rachète pas les cargaisons à brader (ni « commerce » ni Demande).'))).toBe(true);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — escale : embauche et débarquement jugés au noyau', () => {
  it('débarquer un rôle absent : refus nommé « Aucun Timonier à bord. », rien ne bouge', () => {
    const partie = aQuai(navire(), { gold: 0, silver: 0, brass: 0 });
    try {
      partie.envoyer({ type: 'portDismissCrew', args: ['timonier', 1] });
      expect(partie.etat().vessel!.crew ?? []).toEqual([]);
      expect(partie.etat().journal.some((l) => l.includes('Aucun Timonier à bord.'))).toBe(true);
    } finally {
      partie.fermer();
    }
  });

  it('embaucher un rôle sans barème : refus nommé, aucun poste créé', () => {
    const partie = aQuai(navire(), { gold: 0, silver: 0, brass: 0 });
    try {
      partie.envoyer({ type: 'portHireCrew', args: ['role-inexistant', 1] });
      expect(partie.etat().vessel!.crew ?? []).toEqual([]);
      expect(partie.etat().journal.some((l) => l.includes('role-inexistant : aucun barème de solde, rôle non recrutable.'))).toBe(true);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — Activités en mer : valider la semaine est une décision d’hôte (MDG 15 l.266-306)', () => {
  it('siège invité : `seaActivitiesConfirm` refusé en tête, aucune cascade ouverte, bourses intactes', () => {
    const heros = makePregens().slice(0, 2).map((h) => withBourseMoney(h, { gold: 100, silver: 0, brass: 0 }));
    const partie = creerPartie({
      ...etatInitialDuJeu(),
      party: heros,
      scene: { ...emptyScene('mer', 2, 2), label: 'Mer', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      gameTime: 8 * 60,
      vessel: navire(),
      net: { ...etatInitialDuJeu().net, mode: 'guest' },
      pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 0, hours: 0, lines: [] } } as never,
    }, { graine: 5, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} });
    try {
      const fenetres = () => Object.entries(partie.etat()).filter(([k, v]) => k.startsWith('pending') && v).map(([k]) => k);
      const avant = fenetres();
      partie.envoyer({ type: 'seaActivitiesConfirm', args: [{ [heros[0].id]: { activityId: 'commerce-opportunite', investGold: 10 }, [heros[1].id]: { activityId: 'cartographie', stashGold: 5 } }] });
      const s = partie.etat();
      expect(fenetres()).toEqual(avant);
      expect(Object.keys(s.pendingSeaActivities?.picks ?? {})).toEqual([]);
      expect(s.party.map((h) => toBrass(bourseOf(h)))).toEqual([24000, 24000]); // 100 CO × 240 sous
      expect(s.journal.some((l) => l.includes(t('groupe.hoteSeul')))).toBe(true);
    } finally {
      partie.fermer();
    }
  });

  it('plafond de planque : la bourse du héros (7 CO)', () => {
    expect(plafondDePlanque(withBourseMoney(makePregens()[0], { gold: 7, silver: 0, brass: 0 }))).toBe(7);
  });
});
