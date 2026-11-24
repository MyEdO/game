/**
 * Chantier naval jugé par le NOYAU (#3059, lot port) : les gestes `reparerLeNavire` et `carenerLeNavire`
 * débitent le devis `devisDeChantier` et en disent le refus. MDG 13 l.643 ; MDG 13 l.150-159 ;
 * MDG 12 l.195-364 ; MDG 15 l.319 ; MDG 12 l.230.
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
import {
  ameliorationsAuChantier,
  devisDeChantier,
  reparateurDuGroupe,
  devisDAmelioration,
} from './seaVoyageFlow';
import { resolvePortRef } from './worldMap';
import { PORT_A_CHANTIER, PORT_SANS_CHANTIER } from '../data/navalPorts.testkit';
import { refusAQuai, rolesRecrutables } from './portFlow';
import { plafondDePlanque } from './seaActivities';
import { installCost, piecesDeLaReparation } from '../engine/shipBuild';
import { encDeLaCapacite, itemFromTrappingById } from '../engine/items';
import type { CargoLot } from '../engine/cargo';
import { resolveStake, voyageStakeRef } from '../data';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { avanceEtapeCascade, draineCascade, inexplique, soutienDe } from './cascade.testkit';
import type { Combatant } from '../engine/types';
import { refusDeGesteSurLeGroupe } from './bourseFlow';
import { t } from '../i18n';

const COGUE = findVehicleById('cogue')!;
const navire = (patch: Partial<CampaignVessel> = {}): CampaignVessel =>
  ({ vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, ...patch }) as CampaignVessel;

/** Partie à quai : un héros à la bourse `bourse` au lieu `A`, le navire `vessel` à quai à ce lieu (`escale`). */
function aQuai(vessel: CampaignVessel, bourse: Money, mode: 'local' | 'invite' = 'local', etat: Partial<EtatDeJeu> = {}): Partie {
  const entrees: EntreesDeLaPartie = { graine: 2, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
  return creerPartie(etatAQuai(vessel, bourse, mode, etat), entrees);
}

/** L'état d'une partie à quai (`aQuai`). */
function etatAQuai(vessel: CampaignVessel, bourse: Money, mode: 'local' | 'invite', etat: Partial<EtatDeJeu>): EtatDeJeu {
  return {
    ...etatInitialDuJeu(),
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 1).map((h) => withBourseMoney(h, bourse, idsDeTest)),
    scene: { ...emptyScene('port', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    gameTime: 8 * 60,
    worldMap: { id: 'm', label: 'Mer', places: [{ id: 'A', label: 'Port', pos: { x: 0, y: 0 }, scene: { id: 'port' } }], routes: [] },
    lieu: 'A',
    vessel: { escale: 'A', ...vessel },
    net: { ...etatInitialDuJeu().net, mode },
    ...etat,
  };
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
      const devis = devisDeChantier(partie.etat().vessel!, { gold: 100, silver: 0, brass: 0 }, null, partie.etat().party);
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
    const partie = aQuai(navire({ wounds: { current: B - 4, max: B }, fouling: { level: 2, lastTestDay: 0 } }), vide);
    try {
      const devis = devisDeChantier(partie.etat().vessel!, vide, null, partie.etat().party);
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

  // MSRC 12 l.62-64 ; MSRC 07 l.174, l.178
  it.each([
    ['barque-fluviale', 8, 5],
    ['bateau-de-patrouille', 60, 55],
  ] as const)('Bouteur sur %s : le chantier propose et débite le tarif de ce type', (vehicleId, gold, enc) => {
    const bourse = { gold: 100, silver: 0, brass: 0 };
    const partie = aQuai(navire({ vehicleId }), bourse, 'local', auPort(PORT_A_CHANTIER));
    try {
      const devis = ameliorationsAuChantier(partie.etat().vessel!, bourse, null, PORT_A_CHANTIER)
        .find(({ traitId }) => traitId === 'bouteur');
      expect(devis).toMatchObject({ gold, enc, refus: null });
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'installerLAmelioration', args: ['bouteur', 1] });
      expect(avant - bourseDuGroupe(partie)).toBe(toBrass(toMoney({ gold })));
      expect(partie.etat().vessel!.upgrades).toContainEqual({ id: 'bouteur' });
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
      const refus = refusAQuai(partie.etat());
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
    const partie = aQuai(navire({ wounds: { current: B - 4, max: B }, fouling: { level: 2, lastTestDay: 0 } }), { gold: 10000, silver: 0, brass: 0 }, 'invite');
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

describe('#4214 — un geste à quai porte sur le navire à quai au lieu du groupe (`refusAQuai`)', () => {
  const riche = { gold: 100000, silver: 0, brass: 0 };
  /** Le groupe à Dietershafen (`D`, chantier naval spécialisé, MDG 03 l.196), le navire à quai à `escale`. */
  const groupeADietershafen = (escale: string, vessel: Partial<CampaignVessel> = {}) => aQuai(navire({ escale, ...vessel }), riche, 'local', {
    worldMap: {
      id: 'm', label: 'Mer', routes: [], places: [
        { id: 'S', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'salzenmund' }, port: resolvePortRef({ ref: 'salzenmund' }) },
        { id: 'D', label: 'Dietershafen', pos: { x: 1, y: 0 }, scene: { id: 'port' }, port: resolvePortRef({ ref: 'dietershafen' }) },
      ],
    },
    lieu: 'D',
  });
  const navireAbime = { wounds: { current: B - 4, max: B }, fouling: { level: 2, lastTestDay: 0 }, waterLitres: 0 };
  const role = rolesRecrutables()[0].id;
  const gestes = [
    ['installerLAmelioration', ['blindage-fer', 1]], ['reparerLeNavire', []], ['carenerLeNavire', []],
    ['ouvrirLePort', []], ['recruterLEquipage', [role, 1]], ['avitaillerLeNavire', [{}, 1]],
  ] as const;

  it.each(gestes)('groupe à Dietershafen, navire à Salzenmund : %s refusé avec sa cause, rien de payé ni posé', (type, args) => {
    const partie = groupeADietershafen('S', navireAbime);
    try {
      const avant = { bourse: bourseDuGroupe(partie), vessel: partie.etat().vessel };
      partie.envoyer({ type, args: [...args] } as never);
      expect(partie.etat().journal.some((l) => l.includes(t('port.pasAQuai')))).toBe(true);
      expect(bourseDuGroupe(partie)).toBe(avant.bourse);
      expect(partie.etat().vessel).toEqual(avant.vessel);
      expect(partie.etat().port).toBeNull();
    } finally {
      partie.fermer();
    }
  });

  it.each(gestes)('groupe et navire à Dietershafen : %s accepté', (type, args) => {
    const partie = groupeADietershafen('D', navireAbime);
    try {
      const avant = partie.etat().vessel;
      partie.envoyer({ type, args: [...args] } as never);
      expect(partie.etat().journal.some((l) => l.includes(t('port.pasAQuai')))).toBe(false);
      if (type === 'ouvrirLePort') expect(partie.etat().port?.placeId).toBe('D');
      else expect(partie.etat().vessel).not.toEqual(avant);
    } finally {
      partie.fermer();
    }
  });
});

describe('#4239 — le groupe répare lui-même la coque au chantier (MDG 13 l.641-643 ; MDG 15 l.306, l.418 ; MDG 12 l.295)', () => {
  const bourse = { gold: 0, silver: 0, brass: 0 };
  const CONSTRUCTEUR = 'constructeur-de-navires';
  const CHARPENTIER = 'charpentier';
  const PIECES = 'pieces-detachees-de-navire';
  let n = 0;
  const idNeuf = () => `p4239-${n++}`;

  /** Le héros de scénario `i`, ses seuls Métiers de réparation `metiers` (spec → avances), portant `pieces` Enc de pièces détachées. */
  function reparateur(metiers: Record<string, number>, pieces: number, i = 0): Combatant {
    const h = structuredClone(tousLesHerosDeScenario(idsDeTest)[i]);
    h.skills = [
      ...h.skills.filter((s) => s.id !== 'metier'),
      ...Object.entries(metiers).map(([spec, advances]) => ({ id: 'metier', spec, characteristic: 'dexterite' as const, advances })),
    ];
    h.items = [...(h.items ?? []), ...Array.from({ length: pieces }, () => itemFromTrappingById(PIECES, idNeuf)!)];
    return h;
  }
  /** Un lot de cale de `enc` Enc de la marchandise `cargoId`. */
  const lot = (cargoId: string, enc: number): CargoLot => ({ uid: idNeuf(), cargoId, enc, basePriceGold: 7 });
  const ENDOMMAGE = navire({ wounds: { current: B - 8, max: B }, criticals: [{ id: 'c1' } as never], reparationTemporaire: true });
  /** Banc du noyau à quai : le groupe `party`, le navire `vessel` à quai au lieu `A`. */
  const bancDe = (party: Combatant[], vessel: CampaignVessel = ENDOMMAGE, etat: Partial<EtatDeJeu> = {}) =>
    ouvrirLeBanc({ graine: 2, cadence: 'manuel', etat: etatAQuai(vessel, bourse, 'local', { party, ...etat }) });
  type Get = Banc['getState'];
  const piecesDe = (get: Get) => encDeLaCapacite(get().party, 'shipParts');
  const enCale = (get: Get) => (get().vessel!.cargo ?? []).filter((l) => l.cargoId === PIECES).reduce((s, l) => s + l.enc, 0);
  const etape = (get: Get) => get().pendingCascade!.participants[0];
  const puces = (get: Get) => (etape(get).mods ?? []).filter((m) => m.ref && 'id' in m.ref && m.ref.id === 'reparer-les-navires');
  const refus = (get: Get) => devisDeChantier(get().vessel!, bourse, null, get().party).refusReparationParLeGroupe;
  /** Ouvre le geste et joue le Test au d100 `d100`, puis ses dés d'issue `d10` (×10 pour `imposerLesD100`), jusqu'à la
   *  clôture de la séquence ; rend les `kind` joués. */
  function jouer(get: Get, d100: number, ...d10: number[]): string[] {
    get().reparerParLeGroupe();
    imposerLesD100(d100, ...d10.map((d) => d * 10));
    return draineCascade(get, 10);
  }

  it.each([
    ['Constructeur seul', { [CONSTRUCTEUR]: 10 }, CONSTRUCTEUR],
    ['Charpentier seul', { [CHARPENTIER]: 10 }, CHARPENTIER],
    ['Charpentier 5 au-dessus du Constructeur : le Constructeur, sans malus, a la meilleure cible', { [CONSTRUCTEUR]: 10, [CHARPENTIER]: 15 }, CONSTRUCTEUR],
    ['Charpentier 15 au-dessus du Constructeur : le Charpentier, malus compris', { [CONSTRUCTEUR]: 10, [CHARPENTIER]: 25 }, CHARPENTIER],
  ])('réparateur — %s', (_cas, metiers, spec) => {
    const { getState: get } = bancDe([reparateur(metiers, 10)]);
    expect(refus(get)).toBeNull();
    get().reparerParLeGroupe();
    expect(etape(get).teste?.skill?.spec).toBe(spec);
    expect(puces(get).map((m) => m.value), 'MDG 13 l.641 : –10 sur tous les jets').toEqual(spec === CHARPENTIER ? [REPARATION.charpentierMalus] : []);
  });

  it('le malus du Charpentier entre UNE fois dans la cible, et l’étape l’explique', () => {
    const party = [reparateur({ [CHARPENTIER]: 15 }, 10)];
    const { getState: get } = bancDe(party);
    const valeur = reparateurDuGroupe(party)!.ligne.valeur!;
    get().reparerParLeGroupe();
    expect(etape(get).target, 'MDG 13 l.641').toBe(valeur + REPARATION.charpentierMalus);
    expect(inexplique(etape(get))).toBe(0);
  });

  it('un second héros au même Métier soutient le réparateur (LDB 12)', () => {
    const party = [reparateur({ [CONSTRUCTEUR]: 10 }, 10, 0), reparateur({ [CONSTRUCTEUR]: 5 }, 0, 1)];
    const { getState: get } = bancDe(party);
    const r = reparateurDuGroupe(party)!;
    expect(r.ligne.soutien?.count).toBe(1);
    get().reparerParLeGroupe();
    expect(soutienDe(etape(get))).toBe(r.ligne.soutien!.bonus);
    expect(soutienDe(etape(get))).toBeGreaterThan(0);
  });

  it('personne ne sait réparer : refus nommé, aucun jet', () => {
    const { getState: get } = bancDe([reparateur({}, 10)]);
    expect(refus(get)).toBe(t('sv.sansReparateur'));
    get().reparerParLeGroupe();
    expect(get().pendingCascade).toBeNull();
    expect(get().journal.some((l) => l.includes(t('sv.sansReparateur')))).toBe(true);
  });

  it('hors quai : refus du quai', () => {
    const h = reparateur({ [CONSTRUCTEUR]: 10 }, 10);
    const { getState: get } = bancDe([h], navire({ escale: 'B', wounds: { current: B - 8, max: B } }));
    expect(devisDeChantier(get().vessel!, bourse, refusAQuai(get()), get().party).refusReparationParLeGroupe).toBe(t('port.pasAQuai'));
    get().reparerParLeGroupe();
    expect(get().pendingCascade).toBeNull();
  });

  it('coque pleine portant un Critique : le constructeur passe, le refus du groupe ne dit pas la coque intacte', () => {
    const d = devisDeChantier(navire({ wounds: { current: B, max: B }, criticals: [{ id: 'c1' } as never] }), bourse, null, [reparateur({ [CONSTRUCTEUR]: 10 }, 10)]);
    expect(d.refusReparation).toBeNull();
    expect(d.refusReparationParLeGroupe).toBe(t('sv.aucuneBlessureARestaurer'));
  });

  it('sans pièces détachées, ni en cale ni sur les héros : refus nommé, aucun jet', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 0)], { ...ENDOMMAGE, cargo: [lot(PIECES, 1)] });
    expect(refus(get)).toBe(t('sv.sansPiecesDetachees', { enc: piecesDeLaReparation(1, false) }));
    get().reparerParLeGroupe();
    expect(get().pendingCascade).toBeNull();
  });

  it('deux envois avant résolution : deux Tests à des ids distincts, joués l’un après l’autre', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 10)], navire({ wounds: { current: B - 20, max: B } }));
    get().reparerParLeGroupe();
    get().reparerParLeGroupe();
    const ids = get().pendingCascade!.participants.map((s) => s.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    imposerLesD100(1, 60, 30, 1, 40, 20);
    const issue = ['mer-reparation-du-groupe', 'mer-reparation-du-groupe-blessures', 'mer-reparation-du-groupe-duree'];
    expect(draineCascade(get, 10)).toEqual([...issue, ...issue]);
    expect(get().vessel!.wounds!.current).toBe(B - 20 + 6 + 4);
  });

  it('réussite : +1d10 Blessures persistées, Critiques intacts, marqueur levé, 1d10 h, 2 Enc par tranche de 5', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 10)]);
    const avant = get().gameTime;
    jouer(get, 1, 6, 3);
    expect(get().vessel!.wounds).toEqual({ current: B - 2, max: B });
    expect(get().vessel!.criticals).toEqual([{ id: 'c1' }]);
    expect(get().vessel!.reparationTemporaire).toBeUndefined();
    expect(get().gameTime - avant).toBe(3 * 60);
    expect(piecesDe(get), '6 Blessures = 2 tranches = 4 Enc').toBe(10 - 4);
  });

  it('coque pleine sous le seul marqueur temporaire : la réussite le lève, sans dé de Blessures ni pièce dépensée', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 0)], navire({ wounds: { current: B, max: B }, reparationTemporaire: true }));
    expect(refus(get)).toBeNull();
    get().reparerParLeGroupe();
    expect(resolveStake(etape(get).stake!).text).toBe(resolveStake(voyageStakeRef('mer-reparation-du-groupe-permanente')).text);
    imposerLesD100(1, 30);
    expect(draineCascade(get, 10)).toEqual(['mer-reparation-du-groupe', 'mer-reparation-du-groupe-duree']);
    expect(get().vessel!.reparationTemporaire).toBeUndefined();
    expect(get().vessel!.wounds).toEqual({ current: B, max: B });
  });

  it('réussite plafonnée par les Blessures manquantes', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 10)], navire({ wounds: { current: B - 3, max: B } }));
    jouer(get, 1, 9, 1);
    expect(get().vessel!.wounds).toEqual({ current: B, max: B });
    expect(piecesDe(get)).toBe(10 - 2);
  });

  it('coque lissée : +50 % de pièces (MDG 12 l.295), Lissage conservé', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 10)], navire({ wounds: { current: B - 8, max: B }, upgrades: [{ id: 'lissage' } as never] }));
    expect(devisDeChantier(get().vessel!, bourse, null, get().party).lissage).toBe(true);
    jouer(get, 1, 6, 3);
    expect(get().vessel!.wounds!.current).toBe(B - 2);
    expect(piecesDe(get), '2 tranches × 2 Enc × 1,5 = 6 Enc').toBe(10 - 6);
    expect(get().vessel!.upgrades?.map((u) => u.id)).toEqual(['lissage']);
  });

  it('plafond du stock : 2 Enc ne paient qu’une tranche de 5 Blessures', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 2)]);
    jouer(get, 1, 8, 2);
    expect(get().vessel!.wounds!.current).toBe(B - 8 + 5);
    expect(piecesDe(get)).toBe(0);
  });

  it('pièces en cale seule (MDG 15 l.418) : le geste passe et la cale paie', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 0)], { ...ENDOMMAGE, cargo: [lot(PIECES, 20)] });
    expect(refus(get)).toBeNull();
    jouer(get, 1, 6, 3);
    expect(get().vessel!.wounds!.current).toBe(B - 2);
    expect(enCale(get), '6 Blessures = 4 Enc').toBe(20 - 4);
  });

  it('pièces en cale et sur les héros : la cale d’abord, puis les héros', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 10)], { ...ENDOMMAGE, cargo: [lot(PIECES, 2), lot('bois-mer', 5)] });
    jouer(get, 1, 6, 3);
    expect(get().vessel!.wounds!.current).toBe(B - 2);
    expect(enCale(get)).toBe(0);
    expect(get().vessel!.cargo!.map((l) => l.cargoId), 'les autres marchandises restent').toEqual(['bois-mer']);
    expect(piecesDe(get)).toBe(10 - 2);
  });

  it('pièces portées par un autre héros que le réparateur : elles paient, prises sur lui', () => {
    const party = [reparateur({ [CONSTRUCTEUR]: 5 }, 0, 0), reparateur({ [CHARPENTIER]: 15 }, 3, 1)];
    const { getState: get } = bancDe(party);
    expect(refus(get)).toBeNull();
    jouer(get, 1, 6, 2);
    expect(get().vessel!.wounds!.current, '3 Enc paient une tranche de 5').toBe(B - 8 + 5);
    expect(get().party.map((h) => encDeLaCapacite([h], 'shipParts'))).toEqual([0, 1]);
  });

  it('le navire appareille pendant la cascade : l’issue n’écrit rien hors quai', () => {
    const mer = {
      id: 'm', label: 'Mer',
      places: [{ id: 'A', label: 'Port', pos: { x: 0, y: 0 }, scene: { id: 'port' } }, { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' } }],
      routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
    } as EtatDeJeu['worldMap'];
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 10)], ENDOMMAGE, { worldMap: mer });
    get().reparerParLeGroupe();
    get().partirEnVoyage('r1', 'mer');
    expect(get().vessel!.escale).toBeUndefined();
    imposerLesD100(1, 60, 30);
    expect(avanceEtapeCascade(get)).toBe('mer-reparation-du-groupe');
    expect(get().pendingCascade?.participants.filter((s) => s.kind.startsWith('mer-reparation-du-groupe-')) ?? [], 'aucun dé d’issue hors quai').toEqual([]);
    expect(get().vessel!.wounds).toEqual({ current: B - 8, max: B });
    expect(get().vessel!.reparationTemporaire).toBe(true);
    expect(piecesDe(get)).toBe(10);
  });

  it('échec : 1d10 heures (maison), coque, marqueur et pièces intacts', () => {
    const { getState: get } = bancDe([reparateur({ [CONSTRUCTEUR]: 10 }, 10)]);
    const avant = get().gameTime;
    jouer(get, 100, 4);
    expect(get().vessel!.wounds).toEqual({ current: B - 8, max: B });
    expect(get().vessel!.reparationTemporaire).toBe(true);
    expect(get().gameTime - avant).toBe(4 * 60);
    expect(piecesDe(get)).toBe(10);
  });
});
