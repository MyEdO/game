/**
 * BILLET d'un passage (#2534) sur la VRAIE carte du chapitre 1 de L'Ennemi dans l'Ombre.
 *
 * EDO 01 l.142 : « ils sont d'accord pour emmener le groupe jusqu'à la prochaine auberge-relais […]
 * (l'auberge des Sept Rayons, à environ 75 km) […] Ils demandent 4/ par personne pour faire le chemin
 * sur le toit, mais descendront à 3/- sur un Test Opposé de Marchandage réussi, et avec au moins 6 DR,
 * ils se contenteront de 2/-. Le prix est doublé pour des places en intérieur. Gunnar et Hultz
 * exigeront d'être payés d'avance ». Tronçon Sept Rayons → Altdorf : aucun prix d'auteur (EDO 02
 * l.184-186), billet implicite au km (LDB 51 l.178).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { toBrass, type Money } from '../engine/money';
import { makePregensWithWealth, PREGEN } from '../data/pregens';
import { setRule } from '../engine/policy';
import { worldMapSchema } from '../data/schemas/defs-scenes/worldmap';
import { exportSave, snapshotSave } from './saves';
import type { Combatant } from '../engine/types';
import type { OpposedResult, TestResult } from '../engine/tests';

const R1 = 'route-la-diligence-route-principale';
const R2 = 'route-route-principale-sept-rayons';
const R3 = 'route-sept-rayons-altdorf';
const CLE = `${R1}:diligence`;

const heros = (i: number): Combatant =>
  ({
    id: `h${i}`, label: `Héros ${i}`, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
  } as unknown as Combatant);

const paquet = paquetDuJeu(diligenceCampaign);

/** Le groupe à La Diligence, la diligence attelée (drapeau de départ posé), péripéties coupées. */
function aLaDiligence(party: Combatant[], bourses: Money[]): void {
  useGame.setState({ party, billetEnMain: null, marchandagesDeBillet: {}, pendingBargain: null });
  useGame.getState().loadProject(paquet.scenes, 'la-diligence', structuredClone(paquet.worldMap!), paquet.narratif);
  const wm = useGame.getState().worldMap!;
  useGame.setState({ worldMap: { ...wm, params: { ...wm.params, perilDie: 0 } } });
  party.forEach((h, i) => creditBourse(useGame.getState, useGame.setState, h.id, bourses[i]));
  poserDrapeau('edo-ch1-depart');
}

function poserDrapeau(f: string): void {
  useGame.setState({ flags: { ...useGame.getState().flags, [f]: true } });
}

/** Mène le voyage en cours à son terme (cascades du jour, haltes de nuit). */
function finirLeVoyage(): void {
  let garde = 0;
  while (garde++ < 400) {
    const s = useGame.getState();
    if (s.pendingCascade) {
      const p = s.pendingCascade;
      const cur = p.participants[p.cursor];
      if (cur?.participants && cur.participants.some((x) => !x.result)) { for (const x of cur.participants) if (!x.result) s.cascadeBatchRoll(x.id); }
      else if (cur?.table && !cur.table.result) s.cascadeTableRoll(cur.id);
      else if (cur && cur.target != null && !cur.result) s.cascadeRoll(cur.id);
      else s.cascadeNext();
    } else if (s.pendingRest) s.restSleep();
    else if (s.travelRecap) s.dismissTravelRecap();
    else break;
  }
}

const SOU = (n: number): Money => ({ gold: 0, silver: 0, brass: n });
const tr = (sl: number, success: boolean): TestResult => ({ roll: 50, target: 40, success, sl, isDouble: false });

/** Ouvre le Marchandage du billet et le conclut sur l'issue imposée (DR net `drNet`, gagné ou non). */
function marchanderLeBillet(won: boolean, drNet: number): void {
  useGame.getState().startBargain({ kind: 'billet', routeId: R1, mode: 'diligence' });
  const pb = useGame.getState().pendingBargain!;
  const moi = tr(won ? drNet : 0, won);
  const lui = tr(won ? 0 : drNet, !won);
  const result: OpposedResult = { attacker: moi, defender: lui, winner: won ? 'attacker' : 'defender', attackerWins: won, netSL: drNet, decidedBy: 'dr' };
  useGame.setState({ pendingBargain: { ...pb, roll: moi, opposantRoll: lui, result } });
  useGame.getState().bargainConfirm();
}

beforeEach(() => {
  seedBattleRng(1);
  setRule('travel-departure-gate', false);
});

describe('billet de Gunnar et Hultz (EDO 01 l.142)', () => {
  const quatre = () => [1, 2, 3, 4].map(heros);
  const bourses = () => [SOU(240), SOU(0), SOU(0), SOU(0)];

  it('(a) le groupe de 4 paie UNE fois en partant ; le tronçon 2 ne débite rien ; billet effacé à l’arrivée', () => {
    aLaDiligence(quatre(), bourses());
    useGame.getState().startTravel(R1, 'diligence', { classeId: 'exterieur' });
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(240 - 4 * 48); // 4/- par place, payé d'avance
    expect(useGame.getState().billetEnMain).toEqual({ routeId: R1, mode: 'diligence', classeId: 'exterieur', routesRestantes: [R2] });
    finirLeVoyage();
    expect(useGame.getState().scene?.id).toBe('route-principale-virage');
    poserDrapeau('edo-ch1-corps-kastor-fouille');
    useGame.getState().startTravel(R2, 'diligence', { classeId: 'exterieur' });
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(240 - 4 * 48); // aucun second débit
    finirLeVoyage();
    expect(useGame.getState().scene?.id).toBe('auberge-des-sept-rayons');
    expect(useGame.getState().billetEnMain).toBeNull();
  });

  it('(b) Marchandage gagné : 3/- la place sur le toit, débité tel que l’écran l’annonce', () => {
    aLaDiligence(quatre(), bourses());
    marchanderLeBillet(true, 2);
    useGame.getState().startTravel(R1, 'diligence', { classeId: 'exterieur' });
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(240 - 4 * 36);
  });

  it('(b) DR net ≥ 6 : 2/- ; intérieur : le double', () => {
    aLaDiligence(quatre(), bourses());
    marchanderLeBillet(true, 6);
    useGame.getState().startTravel(R1, 'diligence', { classeId: 'interieur' });
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(240 - 4 * 48);
  });

  it('(c) UN seul Test par billet : un second Marchandage ne s’ouvre pas', () => {
    aLaDiligence(quatre(), bourses());
    marchanderLeBillet(false, 2);
    expect(useGame.getState().marchandagesDeBillet[CLE]).toEqual({ won: false, drNet: 2, negotiator: false });
    useGame.getState().startBargain({ kind: 'billet', routeId: R1, mode: 'diligence' });
    expect(useGame.getState().pendingBargain).toBeNull();
  });

  it('(c) UN seul Test par billet : annuler APRÈS le jet consigne l’issue, le Marchandage ne se rouvre pas', () => {
    aLaDiligence(quatre(), bourses());
    useGame.getState().startBargain({ kind: 'billet', routeId: R1, mode: 'diligence' });
    useGame.getState().bargainRoll();
    const joue = useGame.getState().pendingBargain!.result!;
    useGame.getState().bargainCancel();
    expect(useGame.getState().marchandagesDeBillet[CLE]).toEqual({ won: joue.attackerWins, drNet: joue.netSL, negotiator: false });
    useGame.getState().startBargain({ kind: 'billet', routeId: R1, mode: 'diligence' });
    expect(useGame.getState().pendingBargain).toBeNull();
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(240); // ni achat ni paiement
  });

  it('(c) le vendeur est tiré de son preset : Gunnar et Hultz, Marchandage = Sociabilité nue (27)', () => {
    aLaDiligence(quatre(), bourses());
    useGame.getState().startBargain({ kind: 'billet', routeId: R1, mode: 'diligence' });
    const pb = useGame.getState().pendingBargain!;
    expect(pb.contrepartie).toEqual({ kind: 'billet', routeId: R1, mode: 'diligence' });
    expect(pb.opposant.label).toBe('Gunnar et Hultz');
    expect(pb.opposant.valeur).toBe(27);
    expect(pb.opposant.portrait?.label).toBe('Gunnar et Hultz');
  });

  it('(d) billet abandonné quand le groupe part à pied', () => {
    aLaDiligence(quatre(), bourses());
    useGame.getState().startTravel(R1, 'diligence', { classeId: 'exterieur' });
    finirLeVoyage();
    poserDrapeau('edo-ch1-corps-kastor-fouille');
    useGame.getState().startTravel(R2, 'pied');
    expect(useGame.getState().billetEnMain).toBeNull();
  });

  it('(d) billet abandonné quand le groupe part sur une autre route', () => {
    aLaDiligence(quatre(), [SOU(600), SOU(0), SOU(0), SOU(0)]);
    useGame.getState().loadProject(paquet.scenes, 'auberge-des-sept-rayons', useGame.getState().worldMap, paquet.narratif);
    useGame.setState({ billetEnMain: { routeId: R1, mode: 'diligence', classeId: 'exterieur', routesRestantes: [R2] } });
    const avant = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().startTravel(R3, 'diligence', { classeId: 'exterieur' });
    expect(useGame.getState().billetEnMain).toBeNull();
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(avant - 4 * 115); // (e) tarif au km : rien ne le couvre
  });

  it('(e) tronçon sans billet d’auteur (Sept Rayons → Altdorf) : 115 km × 1 sou × passagers, au toit', () => {
    aLaDiligence(quatre(), [SOU(600), SOU(0), SOU(0), SOU(0)]);
    useGame.getState().loadProject(paquet.scenes, 'auberge-des-sept-rayons', useGame.getState().worldMap, paquet.narratif);
    const avant = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().startTravel(R3, 'diligence');
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(avant - 4 * 115); // classe par défaut : la moins chère
  });
});

describe('bourse canonique des pré-tirés face au billet', () => {
  /** Le groupe canonique (`makeShowcaseParty` : soldat, tueur, sorcier, chasseur) et sa bourse tirée à la
   *  création (`makePregensWithWealth`) : 4 places au toit à 4/- dépassent ses moyens, à 3/- après un
   *  Marchandage gagné, elle les paie. */
  function avecLesPreTires(): number {
    const ids = [PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur].map((s) => `pregen-${s}`);
    const pre = ids.map((id) => makePregensWithWealth().find((p) => p.hero.id === id)!);
    aLaDiligence(pre.map((p) => p.hero), pre.map((p) => p.wealth));
    return toBrass(partyMoneyTotal(useGame.getState));
  }

  it('Marchandage perdu : 4 × 4/- refusé, rien débité', () => {
    const total = avecLesPreTires();
    expect(total).toBe(160);
    useGame.getState().startTravel(R1, 'diligence', { classeId: 'exterieur' });
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(160);
    expect(useGame.getState().travelPlan).toBeNull();
  });

  it('Marchandage gagné : 4 × 3/- payé', () => {
    avecLesPreTires();
    marchanderLeBillet(true, 1);
    useGame.getState().startTravel(R1, 'diligence', { classeId: 'exterieur' });
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(160 - 4 * 36);
  });
});

describe('sauvegarde : le billet en main et les Marchandages joués survivent à l’export → import', () => {
  it('aller-retour JSON par `exportSave` / `importGame`', () => {
    aLaDiligence([1, 2, 3, 4].map(heros), [SOU(240), SOU(0), SOU(0), SOU(0)]);
    marchanderLeBillet(true, 6);
    useGame.getState().startTravel(R1, 'diligence', { classeId: 'exterieur' });
    const avant = { billetEnMain: useGame.getState().billetEnMain, marchandagesDeBillet: useGame.getState().marchandagesDeBillet };
    expect(avant.billetEnMain).not.toBeNull();
    const json = exportSave(snapshotSave(useGame.getState() as never, useGame.getInitialState() as never, '2026-10-09T00:00:00Z'));
    useGame.setState({ billetEnMain: null, marchandagesDeBillet: {} });
    expect(useGame.getState().importGame(json)).toBeNull();
    expect({ billetEnMain: useGame.getState().billetEnMain, marchandagesDeBillet: useGame.getState().marchandagesDeBillet }).toEqual(avant);
  });
});

describe('validation au chargement des billets (worldMapSchema)', () => {
  const fautes = (billets: unknown, routePatch: Record<string, unknown> = {}) => {
    const wm = structuredClone(paquet.worldMap!) as unknown as { routes: Record<string, unknown>[] };
    const r1 = wm.routes.find((r) => r.id === R1)!;
    Object.assign(r1, { billets }, routePatch);
    return worldMapSchema.safeParse(wm).error?.issues.map((i) => i.path.join('.')) ?? [];
  };
  const billet = (patch: Record<string, unknown> = {}) => ({ diligence: { prix: { exterieur: 48 }, maison: 'test', ...patch } });

  it('la carte du chapitre 1 se charge', () => {
    expect(worldMapSchema.safeParse(paquet.worldMap).error).toBeUndefined();
  });
  it('(f) suite non contiguë refusée à son rang', () => {
    expect(fautes(billet({ suite: [R3] }))).toContain('routes.0.billets.diligence.suite.0');
  });
  it('(f) route à double sens sans « depuis » refusée', () => {
    expect(fautes(billet(), { from: undefined })).toContain('routes.0.billets.diligence.depuis');
    expect(fautes(billet({ depuis: 'la-diligence' }), { from: undefined })).toEqual([]);
  });
  it('classe inconnue du véhicule refusée ; provenance exigée', () => {
    expect(fautes({ diligence: { prix: { soute: 1 }, maison: 'test' } })).toContain('routes.0.billets.diligence.prix');
    expect(fautes({ diligence: { prix: { exterieur: 1 } } })).toContain('routes.0.billets.diligence.source');
  });
  it('« depuis » contraire au sens unique de la route refusé ; conforme, accepté', () => {
    expect(fautes(billet({ depuis: 'route-principale-virage' }))).toContain('routes.0.billets.diligence.depuis');
    expect(fautes(billet({ depuis: 'la-diligence' }))).toEqual([]);
  });
  it('paliers sans vendeur refusés ; avec vendeur acceptés', () => {
    const paliers = [{ drMin: 0, prix: { exterieur: 36 } }];
    expect(fautes(billet({ paliers }))).toContain('routes.0.billets.diligence.paliers');
    expect(fautes(billet({ paliers, presetId: 'edo-gunnar-et-hultz' }))).toEqual([]);
  });
});
