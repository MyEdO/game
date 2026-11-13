/**
 * Chantier naval et dossier du navire jugés par le NOYAU (#3059, lot port) : les gestes `reparerLeNavire` et
 * `carenerLeNavire` débitent le devis `devisDeChantier` et en disent le refus ; `dossierDuNavire` compose le
 * refus d'appareiller et l'effectif présent (`shipboardSouls`). MDG 13 l.643 ; MDG 13 l.150-159 ;
 * MDG 12 l.70-75 ; MDG 14 l.238 ; MDG 12 l.195-364 ; MDG 15 l.319 ; MDG 12 l.230.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { imposerLesD100 } from './battleRng.testkit';
import { REPARATION } from '../engine/seaNavigation';
import { MINUTES_PER_DAY } from '../engine/clock';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type EtatDeJeu, type Partie } from './index';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { findNavalTrait, findVehicleById, NAVAL_TRAITS } from '../data';
import { emptyScene } from './monde/scene';
import { toBrass, toMoney, add as moneyAdd, fromBrass, type Money } from '../engine/money';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import type { CampaignVessel } from './etat';
import { ameliorationsAuChantier, devisDeChantier, devisDAmelioration, dossierDuNavire, raisonDuRefusDAppareiller, refusDAppareiller } from './seaVoyageFlow';
import { resolvePortRef } from './worldMap';
import { PORT_A_CHANTIER, PORT_SANS_CHANTIER } from '../data/navalPorts.testkit';
import { refusDEntrerAuPort } from './portFlow';
import { plafondDePlanque } from './seaActivities';
import { installCost } from '../engine/shipBuild';
import { shipboardSouls } from './shipCrew';
import { refusDeGesteSurLeGroupe } from './bourseFlow';
import { t } from '../i18n';

const COGUE = findVehicleById('cogue')!;
const navire = (patch: Partial<CampaignVessel> = {}): CampaignVessel =>
  ({ vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, ...patch }) as CampaignVessel;

/** Partie à quai : un héros à la bourse `bourse`, le navire `vessel`. */
function aQuai(vessel: CampaignVessel, bourse: Money, mode: 'local' | 'invite' = 'local', etat: Partial<EtatDeJeu> = {}): Partie {
  const entrees: EntreesDeLaPartie = { graine: 2, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
  return creerPartie({
    ...etatInitialDuJeu(),
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 1).map((h) => withBourseMoney(h, bourse, idsDeTest)),
    scene: { ...emptyScene('port', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    gameTime: 8 * 60,
    vessel,
    net: { ...etatInitialDuJeu().net, mode },
    ...etat,
  }, entrees);
}

/** Le groupe au lieu-port `A` (scène `port`) du catalogue `ref` (`MapPlace.port.ref`). */
const auPort = (ref: string): Partial<EtatDeJeu> => ({
  worldMap: { id: 'm', label: 'Mer', places: [{ id: 'A', label: 'Port', pos: { x: 0, y: 0 }, scene: { id: 'port' }, port: resolvePortRef({ ref }) }], routes: [] },
  lieu: 'A',
});

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
      partie.envoyer({ type: 'reparerLeNavire', args: [] });
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
      partie.envoyer({ type: 'reparerLeNavire', args: [] });
      partie.envoyer({ type: 'carenerLeNavire', args: [] });
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
    const vessel = navire({ cargo: [{ uid: 'lot-1', cargoId: 'bois-mer', enc: 2 * COGUE.ship!.capacity, basePriceGold: 10 }], crewLost: 1 });
    const party = tousLesHerosDeScenario(idsDeTest).slice(0, 2);
    const dossier = dossierDuNavire(vessel, party)!;
    expect(dossier.refusDAppareiller).toBe(raisonDuRefusDAppareiller(refusDAppareiller(vessel)!));
    expect(dossier.crewCount).toBe(shipboardSouls({ party, vessel }).crew);
    expect(dossier.crewCount).toBe(Math.max(0, (COGUE.ship!.crew ?? 0) - 1));
  });

  it('cale nominale : aucun refus d’appareiller', () => {
    expect(dossierDuNavire(navire(), tousLesHerosDeScenario(idsDeTest).slice(0, 1))!.refusDAppareiller).toBeNull();
  });
});

describe('#3059 — Amélioration et entrée au port : le geste applique le verdict de l’écran', () => {
  const trait = NAVAL_TRAITS.find((tr) => tr.kind === 'amelioration' && tr.install && (installCost(tr.install, COGUE.ship!.lengthM, 1).gold ?? 0) > 0)!;
  const gold = installCost(trait.install!, COGUE.ship!.lengthM, 1).gold!;

  it('bourse suffisante : la pose débite le devis et porte l’Amélioration', () => {
    const bourse = { gold: gold + 10, silver: 0, brass: 0 };
    const partie = aQuai(navire(), bourse);
    try {
      expect(devisDAmelioration(partie.etat().vessel, trait.id, 1, bourse, null, undefined)).toMatchObject({ gold, refus: null });
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'installerLAmelioration', args: [trait.id, 1] });
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
      const refus = devisDAmelioration(partie.etat().vessel, trait.id, 1, vide, null, undefined).refus;
      expect(refus).toBe(t('sv.upgradeTooExpensive', { label: trait.label, gold }));
      partie.envoyer({ type: 'installerLAmelioration', args: [trait.id, 1] });
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
      party: tousLesHerosDeScenario(idsDeTest).slice(0, 1),
      scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      worldMap: { id: 'm', label: 'Mer', places: [{ id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' }, port: { taille: 4, richesse: 4, production: ['commerce-mer'] } as never }], routes: [] },
      lieu: 'A',
      vessel: null,
    }, entrees);
    try {
      const refus = refusDEntrerAuPort(partie.etat());
      expect(refus).toBe(t('port.sansNavire'));
      partie.envoyer({ type: 'ouvrirLePort', args: [] });
      expect(partie.etat().port).toBeNull();
      expect(partie.etat().journal.some((l) => l.includes(refus!))).toBe(true);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — siège invité : les dépenses du chantier sont à l’hôte', () => {
  it('réparation, carénage, Amélioration et embauche envoyés se refusent (`coop.hoteSeul`), rien de débité ni posé ; l’écran dit le refus de groupe', () => {
    const trait = NAVAL_TRAITS.find((tr) => tr.kind === 'amelioration' && tr.install && (installCost(tr.install, COGUE.ship!.lengthM, 1).gold ?? 0) > 0)!;
    const partie = aQuai(navire({ wounds: { current: B - 4, max: B }, fouling: { level: 2, lastWeek: 0 } }), { gold: 10000, silver: 0, brass: 0 }, 'invite');
    try {
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'reparerLeNavire', args: [] });
      partie.envoyer({ type: 'carenerLeNavire', args: [] });
      partie.envoyer({ type: 'installerLAmelioration', args: [trait.id, 1] });
      partie.envoyer({ type: 'recruterLEquipage', args: ['timonier', 1] });
      const v = partie.etat().vessel!;
      expect(bourseDuGroupe(partie)).toBe(avant);
      expect(v.wounds!.current).toBe(B - 4);
      expect(v.fouling!.level).toBe(2);
      expect(v.upgrades ?? []).toEqual([]);
      expect(v.crew ?? []).toEqual([]);
      expect(partie.etat().journal.filter((l) => l === t('coop.hoteSeul')).length).toBe(4);
      expect(refusDeGesteSurLeGroupe(partie.etat())).toBe(t('groupe.hoteSeul'));
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — siège invité : vente, bradage et Conseil disent le refus de groupe', () => {
  it('vente et bradage au port, paie du Conseil : refusés, rien ne bouge', () => {
    const lot = { uid: 'lot-2', cargoId: 'bois-mer', enc: 10, basePriceGold: 10 };
    const port = { taille: 4, richesse: 4, production: [] as string[] } as never;
    const partie = aQuai(navire({ cargo: [lot] }), { gold: 500, silver: 0, brass: 0 }, 'invite', {
      port: { placeId: 'P', label: 'Port', port, offers: [] },
      pendingCouncil: { today: 7, wageBrass: 240, phase: 'choix' },
    });
    try {
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'fenetreChoisir', args: ['port', 'vendre', 'lot-2'] });
      partie.envoyer({ type: 'fenetreChoisir', args: ['port', 'jeter', 'lot-2'] });
      partie.envoyer({ type: 'fenetreChoisir', args: ['conseil', 'paie', 'paie-reguliere'] });
      const s = partie.etat();
      expect(s.vessel!.cargo).toEqual([lot]);
      expect(bourseDuGroupe(partie)).toBe(avant);
      expect(s.pendingCouncil?.phase).toBe('choix');
      expect(s.journal.filter((l) => l.includes(t('choix.refus.hoteSeul'))).length, 'vente, bradage et paie').toBe(3);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — bradage au port : refusé sans « commerce » ni Demande pour le lot (MDG 15 l.399)', () => {
  it('siège local, port sans « commerce » ni Demande : le geste dit le refus, la cale et la bourse restent', () => {
    const lot = { uid: 'lot-3', cargoId: 'bois-mer', enc: 10, basePriceGold: 10 };
    const port = { taille: 4, richesse: 4, production: [] as string[] } as never;
    const partie = aQuai(navire({ cargo: [lot] }), { gold: 500, silver: 0, brass: 0 }, 'local', {
      port: { placeId: 'P', label: 'Port', port, offers: [] },
    });
    try {
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'fenetreChoisir', args: ['port', 'jeter', 'lot-3'] });
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
      partie.envoyer({ type: 'renvoyerLEquipage', args: ['timonier', 1] });
      expect(partie.etat().vessel!.crew ?? []).toEqual([]);
      expect(partie.etat().journal.some((l) => l.includes('Aucun Timonier à bord.'))).toBe(true);
    } finally {
      partie.fermer();
    }
  });

  it('embaucher un rôle sans barème : refus nommé, aucun poste créé', () => {
    const partie = aQuai(navire(), { gold: 0, silver: 0, brass: 0 });
    try {
      partie.envoyer({ type: 'recruterLEquipage', args: ['role-inexistant', 1] });
      expect(partie.etat().vessel!.crew ?? []).toEqual([]);
      expect(partie.etat().journal.some((l) => l.includes('role-inexistant : aucun barème de solde, rôle non recrutable.'))).toBe(true);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — Activités en mer : valider la semaine est une décision d’hôte (MDG 15 l.266-306)', () => {
  it('siège invité : `fenetreValider(\'seaActivities\')` refusé en tête, aucune cascade ouverte, bourses intactes', () => {
    const heros = tousLesHerosDeScenario(idsDeTest).slice(0, 2).map((h) => withBourseMoney(h, { gold: 100, silver: 0, brass: 0 }, idsDeTest));
    const partie = creerPartie({
      ...etatInitialDuJeu(),
      party: heros,
      scene: { ...emptyScene('mer', 2, 2), label: 'Mer', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      gameTime: 8 * 60,
      vessel: navire(),
      net: { ...etatInitialDuJeu().net, mode: 'invite' },
      pendingSeaActivities: { picks: { [heros[0].id]: { activityId: 'commerce-opportunite', investGold: 10 }, [heros[1].id]: { activityId: 'cartographie', stashGold: 5 } }, day: { kmFrom: 0, kmTo: 0, hours: 0, lines: [] } } as never,
    }, { graine: 5, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} });
    try {
      const fenetres = () => Object.entries(partie.etat()).filter(([k, v]) => k.startsWith('pending') && v).map(([k]) => k);
      const avant = fenetres();
      partie.envoyer({ type: 'fenetreValider', args: ['activitesEnMer'] });
      const s = partie.etat();
      expect(fenetres()).toEqual(avant);
      expect(s.pendingSeaActivities?.opportunityQueue, 'aucune Activité résolue').toBeUndefined();
      expect(s.party.map((h) => toBrass(bourseOf(h)))).toEqual([24000, 24000]); // 100 CO × 240 sous
      expect(s.journal.some((l) => l.includes(t('validation.refus.hoteSeul')))).toBe(true);
    } finally {
      partie.fermer();
    }
  });

  it('plafond de planque : la bourse du héros (7 CO)', () => {
    const hero = withBourseMoney(tousLesHerosDeScenario(idsDeTest)[0], { gold: 7, silver: 0, brass: 0 }, idsDeTest);
    expect(plafondDePlanque({ party: [hero], pendingSeaActivities: null }, hero)).toBe(7);
  });
});

describe('#1652 — la pose d’une Amélioration fait passer sa durée (MDG 12 l.230 ; MDG 12 l.293)', () => {
  afterEach(() => vi.restoreAllMocks());
  const riche = { gold: 100000, silver: 0, brass: 0 };

  /** Pose `traitId` sur un navire `vehicleId` à quai, d100 imposés `des` ; rend le devis et les jours passés. */
  function poser(vehicleId: string, traitId: string, ...des: number[]) {
    const partie = aQuai(navire({ vehicleId }), riche, 'local', auPort(PORT_A_CHANTIER));
    try {
      const devis = devisDAmelioration(partie.etat().vessel, traitId, 1, riche, null, PORT_A_CHANTIER);
      imposerLesD100(...des);
      const avant = partie.etat().gameTime;
      partie.envoyer({ type: 'installerLAmelioration', args: [traitId, 1] });
      expect(partie.etat().vessel!.upgrades?.map((u) => u.id)).toEqual([traitId]);
      return { duree: devis.duree, jours: (partie.etat().gameTime - avant) / MINUTES_PER_DAY };
    } finally {
      partie.fermer();
    }
  }

  it.each([
    ['blindage-fer', 'cogue', 16], ['blindage-fer', 'caravelle-tileenne', 32],
    ['lissage', 'cogue', 8], ['lissage', 'caravelle-tileenne', 16],
  ] as const)('%s sur %s : le devis dit %i jours, et ils passent', (traitId, vehicleId, jours) => {
    expect(poser(vehicleId, traitId)).toEqual({ duree: jours, jours });
  });

  it('Amélioration sans durée au livre (Ancre) : 1d10 jours, maison (`reparation.joursDePose`)', () => {
    expect(findNavalTrait('ancre')!.install!.jours).toBeUndefined();
    expect(poser('cogue', 'ancre', 40)).toEqual({ duree: REPARATION.joursDePose, jours: 4 });
    expect(poser('cogue', 'ancre', 90).jours).toBe(9);
  });
});

describe('#4052 — le Blindage ne s’installe que sur un chantier naval spécialisé (MDG 12 l.230)', () => {
  const riche = { gold: 100000, silver: 0, brass: 0 };
  const SANS = PORT_SANS_CHANTIER, AVEC = PORT_A_CHANTIER;
  const auChantier = (portRef: string, traitId: string) => ameliorationsAuChantier(navire(), riche, null, portRef).find((d) => d.traitId === traitId);

  it.each(['blindage-fer', 'blindage-bronze'])('%s : refusé avec sa cause dans un port sans chantier, le geste le dit, rien de posé ni débité', (traitId) => {
    const refus = t('sv.upgradeNeedsShipyard', { label: findNavalTrait(traitId)!.label });
    expect(auChantier(SANS, traitId)?.refus).toBe(refus);
    const partie = aQuai(navire(), riche, 'local', auPort(SANS));
    try {
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'installerLAmelioration', args: [traitId, 1] });
      expect(partie.etat().journal.some((l) => l.includes(refus))).toBe(true);
      expect(partie.etat().vessel!.upgrades ?? []).toEqual([]);
      expect(bourseDuGroupe(partie)).toBe(avant);
    } finally {
      partie.fermer();
    }
  });

  it.each(['blindage-fer', 'blindage-bronze'])('%s : proposé et posé dans un port à chantier naval spécialisé', (traitId) => {
    expect(auChantier(AVEC, traitId)?.refus).toBeNull();
    const partie = aQuai(navire(), riche, 'local', auPort(AVEC));
    try {
      partie.envoyer({ type: 'installerLAmelioration', args: [traitId, 1] });
      expect(partie.etat().vessel!.upgrades?.map((u) => u.id)).toEqual([traitId]);
    } finally {
      partie.fermer();
    }
  });

  it.each([SANS, AVEC])('Lissage, sans exigence de chantier, reste proposé à %s', (portRef) => {
    expect(auChantier(portRef, 'lissage')?.refus).toBeNull();
  });
});
