/**
 * #2534 — le billet de la diligence du chapitre 1, sur le paquet RÉEL committé.
 *
 * EDO 01 l.142 : un billet La Diligence → Sept Rayons (deux routes de la carte, 40 + 35 km), payé une
 * fois, d'avance, par place (toit = `exterieur`, intérieur au double), marchandable par un Test opposé
 * contre Gunnar et Hultz. LDB 51 l.178 : le tronçon Sept Rayons → Altdorf, sans billet d'auteur, se
 * paie au km. LDB 59 l.43 : le Talent Négociateur vaut un Succès Stupéfiant.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setRule, resetRule } from '../../engine/policy';
import { useGame } from '../../state/store';
import { diligenceCampaign, paquetDuJeu } from '../campaign';
import { makePregensWithWealth, PREGEN } from '../../data/pregens';
import { creditBourse, partyMoneyTotal } from '../../state/bourseFlow';
import { toBrass } from '../../engine/money';
import { prixParPassager, transportCost, type TarifDePassage } from '../../engine/travel';
import type { BargainOutcome } from '../../engine/bargain';
import { t } from '../../i18n';
import { billetApresDepart, offreDePassage } from '../../state/billetFlow';
import { cleDeBillet, parseProject, ProjetRefuse, type ProjectDoc } from '../../state/worldMap';
import { skillBaseValue } from '../../engine/skills';
import { pnjAuPreset } from '../../state/sceneNpc';
import { draineCascade } from '../../state/cascadeTestKit';

const paquet = paquetDuJeu(diligenceCampaign);
const map = paquet.worldMap!;
const T1 = 'route-la-diligence-route-principale';
const T2 = 'route-route-principale-sept-rayons';
const T3 = 'route-sept-rayons-altdorf';
const get = () => useGame.getState();
const bourse = () => toBrass(partyMoneyTotal(get));

/** Les 4 piliers du groupe showcase (`makeShowcaseParty`), avec LEUR Richesse initiale tirée (LDB 05 l.578). */
const SHOWCASE = [PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur].map((s) => `pregen-${s}`);

/** Lance le chapitre 1 avec le groupe showcase et sa bourse, et fait monter à bord (`edo-ch1-depart`). */
function aBord(): void {
  const groupe = makePregensWithWealth().filter((e) => SHOWCASE.includes(e.hero.id));
  expect(groupe).toHaveLength(4);
  useGame.setState({ party: groupe.map((e) => e.hero) });
  get().loadProject(paquet.scenes, paquet.scenes[0].id, paquet.worldMap, paquet.narratif);
  for (const e of groupe) creditBourse(get, useGame.setState, e.hero.id, e.wealth);
  get().acquitterOuverture();
  get().moveParty({ x: 13, y: 31 }); // à portée de la charrette (patron `edo-ch1-chaine-carte.test.ts`)
  get().jouerAction('diligence-remise-charrette', 'monter-a-bord');
  expect(get().flags['edo-ch1-depart']).toBe(true);
}

/** Laisse le trajet en cours s'achever — étapes de la journée de voyage jouées (`draineCascade`),
 *  récapitulatif acquitté — et vérifie l'arrivée à `lieu`. */
function arriver(lieu: string): void {
  draineCascade(get);
  if (get().travelRecap) get().dismissTravelRecap();
  expect(get().travelPlan).toBeNull();
  expect(map.places.find((p) => p.scene === get().scene?.id)?.id, `arrivée à ${lieu}`).toBe(lieu);
}

/** Au virage : le corps de Kastor se fouille (`edo-ch1-corps-kastor-fouille` ouvre le tronçon 2). */
function fouillerLeCorps(): void {
  get().moveParty({ x: 36, y: 3 });
  get().jouerAction('cadavre-kastor-lieberung', 'fouiller');
}

/** Le tarif d'auteur du billet, tel que l'offre de départ le lit. */
function tarifDuBillet(): TarifDePassage {
  const offre = offreDePassage(map, map.routes.find((r) => r.id === T1)!, 'diligence', 'la-diligence', null, {});
  if (!offre || offre.couvert) throw new Error('aucune offre d’achat au départ de La Diligence');
  return offre.tarif;
}

/** Les d100 du prochain jet, dans l'ordre (patron `bargain-soutien-departage.test.ts`). */
function forceD100(...dice: number[]): void {
  const q = [...dice];
  vi.spyOn(Math, 'random').mockImplementation(() => ((q.shift() ?? 1) - 0.5) / 100);
}

/** « Marchander » le billet puis « Conclure » : le joueur jette `joueur`, Gunnar et Hultz `vendeur`. */
function marchander(joueur: (cible: number) => number, vendeur: number): BargainOutcome {
  get().startBilletBargain(T1, 'diligence');
  const pb = get().pendingBargain!;
  expect(pb.contrepartie).toEqual({ kind: 'billet', routeId: T1, vehicule: 'diligence', depuis: 'la-diligence', titre: t('out.bargainTitreBillet') });
  forceD100(joueur(pb.playerSkill), vendeur);
  get().bargainRoll();
  vi.restoreAllMocks();
  get().bargainConfirm();
  return get().marchandagesDeBillet[cleDeBillet(T1, 'diligence', 'la-diligence')];
}
/** Victoire nette de 1 à 5 DR : le joueur réussit d'un Degré (cible − 10), le vendeur fait 27 sur 27 (DR 0). */
const gagneDeUnPeu = (): BargainOutcome => marchander((cible) => cible - 10, 27);

beforeEach(() => setRule('test-auto-bands', 'off'));
afterEach(() => { resetRule('test-auto-bands'); vi.restoreAllMocks(); });

describe('(a) le billet La Diligence → Sept Rayons se paie UNE fois, au départ', () => {
  it('sans marchandage, 4 × 4/- au toit (192 sous) dépasse la bourse tirée du groupe showcase (160 sous) : départ refusé', () => {
    aBord();
    const avant = bourse();
    expect(avant).toBe(160); // 96 + 18 + 25 + 21 : Richesses tirées des 4 piliers
    get().startTravel(T1, 'diligence', { classeId: 'exterieur' });
    expect(bourse(), '4 × 48 = 192 sous > 160 : passage refusé, rien débité').toBe(avant);
    expect(get().travelPlan).toBeNull();
    expect(get().billetEnMain).toBeNull();
  });

  it('marchandé à 3/- : 4 × 36 = 144 débités au départ, le tronçon 2 ne débite rien, le billet s’efface aux Sept Rayons', () => {
    aBord();
    const issue = gagneDeUnPeu();
    expect(issue.won && issue.drNet >= 0 && issue.drNet < 6).toBe(true);
    const avant = bourse();
    get().startTravel(T1, 'diligence', { classeId: 'exterieur' });
    expect(avant - bourse()).toBe(4 * 36);
    expect(get().billetEnMain).toEqual({ routeId: T1, vehicule: 'diligence', classeId: 'exterieur', routesRestantes: [T2] });
    arriver('route-principale');
    fouillerLeCorps();
    expect(get().flags['edo-ch1-corps-kastor-fouille']).toBe(true);
    const auVirage = bourse();
    get().startTravel(T2, 'diligence', { classeId: 'exterieur' });
    expect(bourse(), 'le billet couvre le tronçon 2 : aucun débit').toBe(auVirage);
    arriver('auberge-des-sept-rayons');
    expect(get().billetEnMain).toBeNull();
  });
});

describe('(b) prix des paliers par passager (EDO 01 l.142 ; LDB 59 l.43)', () => {
  const tarif = tarifDuBillet();
  const issue = (won: boolean, drNet: number, negotiator = false): BargainOutcome => ({ won, drNet, negotiator });
  it('perdu → 4/- au toit', () => {
    expect(prixParPassager(tarif, 'exterieur', issue(false, 3))).toBe(48);
    expect(prixParPassager(tarif, 'exterieur')).toBe(48);
  });
  it('gagné → 3/-', () => {
    expect(prixParPassager(tarif, 'exterieur', issue(true, 0))).toBe(36);
    expect(prixParPassager(tarif, 'exterieur', issue(true, 5))).toBe(36);
  });
  it('gagné avec au moins 6 DR net → 2/-', () => {
    expect(prixParPassager(tarif, 'exterieur', issue(true, 6))).toBe(24);
    expect(prixParPassager(tarif, 'exterieur', issue(true, 9))).toBe(24);
  });
  it('intérieur → le double à chaque palier', () => {
    expect(prixParPassager(tarif, 'interieur', issue(false, 0))).toBe(96);
    expect(prixParPassager(tarif, 'interieur', issue(true, 1))).toBe(72);
    expect(prixParPassager(tarif, 'interieur', issue(true, 6))).toBe(48);
  });
  it('Négociateur, gagné → le palier du Succès Stupéfiant (2/-), sans remise de plus ; perdu → sans effet', () => {
    expect(prixParPassager(tarif, 'exterieur', issue(true, 1, true))).toBe(24);
    expect(prixParPassager(tarif, 'exterieur', issue(true, 7, true))).toBe(24);
    expect(prixParPassager(tarif, 'interieur', issue(true, 0, true))).toBe(48);
    expect(prixParPassager(tarif, 'exterieur', issue(false, 1, true))).toBe(48);
  });
  it('le total = prix par passager × passagers', () => {
    expect(toBrass(transportCost(tarif, 'exterieur', 4, issue(true, 1)))).toBe(144);
  });
});

describe('(c) un seul Test de Marchandage par billet', () => {
  it('le vendeur est Gunnar et Hultz, au Marchandage de leur fiche ; après conclusion, le billet ne se remarchande plus', () => {
    aBord();
    const gunnar = pnjAuPreset('edo-gunnar-et-hultz', 'probe')!;
    get().startBilletBargain(T1, 'diligence');
    const pb = get().pendingBargain!;
    expect(pb.opposant.label).toBe('Gunnar et Hultz');
    expect(pb.opposant.valeur).toBe(skillBaseValue(gunnar, 'marchandage'));
    expect(pb.opposant.valeur).toBe(27); // Sociabilité 27, sans Augmentation en Marchandage
    vi.restoreAllMocks();
    get().bargainCancel();
    marchander(() => 99, 1);
    expect(get().pendingBargain).toBeNull();
    expect(get().marchandagesDeBillet[cleDeBillet(T1, 'diligence', 'la-diligence')]?.won).toBe(false);
    get().startBilletBargain(T1, 'diligence');
    expect(get().pendingBargain, 'le billet est déjà marchandé').toBeNull();
  });

  it('gagné d’au moins 6 DR : 4 × 2/- débités au départ', () => {
    aBord();
    const issue = marchander(() => 1, 99);
    expect(issue.won && issue.drNet >= 6).toBe(true);
    const avant = bourse();
    get().startTravel(T1, 'diligence', { classeId: 'exterieur' });
    expect(avant - bourse()).toBe(4 * 24);
  });
});

describe('(d) billet abandonné quand le groupe quitte la diligence', () => {
  it('à pied sur la route couverte : rien n’est débité et le billet en main s’efface', () => {
    aBord();
    gagneDeUnPeu();
    get().startTravel(T1, 'diligence', { classeId: 'exterieur' });
    arriver('route-principale');
    fouillerLeCorps();
    expect(get().billetEnMain?.routesRestantes).toEqual([T2]);
    const avant = bourse();
    get().startTravel(T2, 'pied');
    expect(bourse()).toBe(avant);
    expect(get().billetEnMain).toBeNull();
  });

  it('sur une autre route, ou la même dans un autre mode, le billet est abandonné ; sur sa route en tête, il avance', () => {
    const enMain = { routeId: T1, vehicule: 'diligence', classeId: 'exterieur', routesRestantes: [T2, T3] };
    expect(billetApresDepart(enMain, T3, 'diligence')).toBeNull();
    expect(billetApresDepart(enMain, T2, 'pied')).toBeNull();
    expect(billetApresDepart(enMain, T2, 'diligence')).toEqual({ ...enMain, routesRestantes: [T3] });
  });
});

describe('(e) tronçon sans billet d’auteur : tarif au km (LDB 51 l.178)', () => {
  it('Sept Rayons → Altdorf : 115 km × 1 sou au toit, × 2 en intérieur, par passager', () => {
    const offre = offreDePassage(map, map.routes.find((r) => r.id === T3)!, 'diligence', 'auberge-des-sept-rayons', null, {});
    if (!offre || offre.couvert) throw new Error('aucune offre au départ des Sept Rayons');
    expect(offre.vendeurPresetId).toBeUndefined();
    expect(offre.suite).toEqual([]);
    expect(toBrass(transportCost(offre.tarif, 'exterieur', 4))).toBe(4 * 115);
    expect(toBrass(transportCost(offre.tarif, 'interieur', 4))).toBe(4 * 230);
  });
});

describe('(f) validation du billet au chargement', () => {
  const doc = (): ProjectDoc => structuredClone(diligenceCampaign.paquet) as unknown as ProjectDoc;
  const billet = (d: ProjectDoc) => d.worldMap!.routes.find((r) => r.id === T1)!.billets!.diligence!;
  const refus = (d: ProjectDoc): string => {
    try { parseProject(d); return ''; } catch (e) { if (e instanceof ProjetRefuse) return e.message; throw e; }
  };

  it('le paquet committé passe la porte', () => {
    expect(refus(doc())).toBe('');
  });
  it('une suite NON contiguë est refusée', () => {
    const d = doc();
    billet(d).suite = [T3];
    expect(refus(d)).toMatch(/pas contiguë/);
  });
  it('une route que la suite d’un billet couvre déjà, dans le même sens, ne porte pas son propre billet', () => {
    const d = doc();
    const t2 = d.worldMap!.routes.find((r) => r.id === T2)!;
    t2.billets = { diligence: { prix: { exterieur: 10 }, maison: 'second billet' } };
    expect(refus(d)).toMatch(/par deux billets/);
    delete t2.from;
    t2.billets.diligence!.depuis = 'auberge-des-sept-rayons';
    expect(refus(d), 'le sens inverse est un autre tronçon').toBe('');
  });
  it('une suite vers une route inconnue est refusée', () => {
    const d = doc();
    billet(d).suite = ['route-fantome'];
    expect(refus(d)).toMatch(/inconnue de la carte/);
  });
  it('« depuis » exigé sur une route à double sens', () => {
    const d = doc();
    delete d.worldMap!.routes.find((r) => r.id === T1)!.from;
    expect(refus(d)).toMatch(/double sens/);
    billet(d).depuis = 'la-diligence';
    expect(refus(d)).toBe('');
  });
  it('un vendeur qui n’est pas un preset du narratif est refusé', () => {
    const d = doc();
    billet(d).marchandage!.presetId = 'pnj-fantome';
    expect(refus(d)).toMatch(/preset de PNJ inconnu/);
  });
  it('une classe que le véhicule n’a pas est refusée', () => {
    const d = doc();
    billet(d).prix = { ...billet(d).prix, cabine: 10 };
    expect(refus(d)).toMatch(/classe « cabine » inconnue/);
  });
});
