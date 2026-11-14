/**
 * Achat de cargaison terrestre jugé par le NOYAU (#3059, lot marchand) : `devisDAchatDeCargaison` rend le
 * refus que le choix `acheter` applique à la halle et que l'écran du marché affiche — lot sous le minimum, sans porteur,
 * contenance dépassée. MSRC 13 l.129-131.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type Partie } from './index';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { emptyScene } from './monde/scene';
import { minCargoEnc } from '../engine/landCargo';
import type { Possession } from '../engine/possession';
import type { WorldMap } from './worldMap';
import { carrierById } from './carriers';
import { devisDAchatDeCargaison } from './landMarketFlow';
import { refusDeGesteSurLeGroupe } from './bourseFlow';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import type { CargoLot } from '../engine/cargo';
import { t } from '../i18n';
import { acheterAuMarche } from './cargaison.testkit';

/** Achète par les choix de la halle, chacun envoyé comme un hôte l'envoie. */
const acheter = (partie: Partie, porteur: string, cargoId: string, enc: number) =>
  acheterAuMarche(partie.etat, 'marcheDeTerre', porteur, cargoId, enc, (args) => partie.envoyer({ type: 'fenetreChoisir', args }));

const carte: WorldMap = {
  id: 'm', label: 'Reikland',
  places: [{ id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: { id: 'ville-a' }, market: { taille: 4, richesse: 4, produits: ['vivres', 'vin-eau-de-vie', 'metal', 'commerce-terre'] } }],
  routes: [],
};

/** Ouvre la halle par le geste du noyau, le groupe menant une diligence (Chargement 80) si `avecPorteur`. */
function ouvrir(avecPorteur: boolean, bourseDuMeneur = 0): Partie {
  const party = tousLesHerosDeScenario(idsDeTest).slice(0, 3).map((h, i) => (i === 0 ? withBourseMoney(h, { gold: bourseDuMeneur, silver: 0, brass: 0 }, idsDeTest) : h));
  const possessions: Possession[] = avecPorteur
    ? [{ uid: 'convoi', ownerId: party[0].id, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] }]
    : [];
  const entrees: EntreesDeLaPartie = { graine: 3, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
  const partie = creerPartie({
    ...etatInitialDuJeu(),
    party, possessions, worldMap: carte, lieu: 'A', gameTime: 8 * 60,
    scene: { ...emptyScene('ville-a', 2, 2), label: 'Ville', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
  }, entrees);
  partie.envoyer({ type: 'ouvrirLeMarche', args: [] });
  return partie;
}

/** Offre d'au moins `enc` Enc à la halle ouverte. */
function offre(partie: Partie, enc: number): string {
  const o = partie.etat().landMarket?.offers.find((x) => x.enc >= enc);
  expect(o, 'halle sans offre assez grande').toBeTruthy();
  return o!.cargoId;
}

const journalDit = (partie: Partie, texte: string) => partie.etat().journal.some((l) => l.includes(texte));

describe('#3059 — achat de cargaison : un seul refus pour l’écran et le geste', () => {
  it('lot sous le minimum : refusé par le devis, et le geste ne charge rien en le disant', () => {
    const partie = ouvrir(true);
    try {
      const cargoId = offre(partie, minCargoEnc());
      const devis = devisDAchatDeCargaison(partie.etat(), 'convoi', cargoId, minCargoEnc() - 1);
      expect(devis.refus).toEqual({ motif: 'lot-minimal', min: minCargoEnc() });
      acheter(partie, 'convoi', cargoId, minCargoEnc() - 1);
      expect(carrierById(partie.etat(), 'convoi')!.cargo).toEqual([]);
      expect(journalDit(partie, t('lm.lotMinimal', { min: minCargoEnc() }))).toBe(true);
    } finally {
      partie.fermer();
    }
  });

  it('lot au minimum, porteur libre, bourse pleine : aucun refus avant Marchandage, estimation au lot partiel', () => {
    const partie = ouvrir(true, 5000);
    try {
      const cargoId = offre(partie, minCargoEnc() + 1);
      const devis = devisDAchatDeCargaison(partie.etat(), 'convoi', cargoId, minCargoEnc());
      expect(devis.refus).toBeNull();
      expect(devis.plancherGold).toBeLessThanOrEqual(devis.estimationGold);
      expect(devis.partiel).toBe(true);
    } finally {
      partie.fermer();
    }
  });

  it('sans porteur : refus nommé, quel que soit le lot', () => {
    const partie = ouvrir(false);
    try {
      const cargoId = offre(partie, minCargoEnc());
      expect(devisDAchatDeCargaison(partie.etat(), 'convoi', cargoId, minCargoEnc()).refus).toEqual({ motif: 'sans-porteur' });
    } finally {
      partie.fermer();
    }
  });
});

/** Halle FIXÉE : une offre de 20 Enc de métal à 10 CO, une diligence vide, un seul héros sans Négociateur,
 *  qui mène donc le Marchandage du groupe (`partyAssisted`). `mode` : siège local ou invité. */
function halleFixee(mode: 'local' | 'invite', cargo: CargoLot[] = [], produits = carte.places[0].market!.produits): Partie {
  const heros = { ...tousLesHerosDeScenario(idsDeTest)[0], talents: [] };
  const entrees: EntreesDeLaPartie = { graine: 3, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
  return creerPartie({
    ...etatInitialDuJeu(),
    party: [heros], worldMap: carte, lieu: 'A', gameTime: 8 * 60,
    possessions: [{ uid: 'convoi', ownerId: heros.id, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [], cargo }],
    scene: { ...emptyScene('ville-a', 2, 2), label: 'Ville', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    landMarket: { placeId: 'A', label: 'Grünburg', market: { ...structuredClone(carte.places[0].market!), produits: [...produits] }, offers: [{ cargoId: 'metal', label: 'Métal', enc: 20, basePrice: 10, wine: false }] },
    net: { ...etatInitialDuJeu().net, mode },
  }, entrees);
}

describe('#3059 — achat de cargaison : bourse sous le prix plancher au meilleur Marchandage (MSRC 13 l.127 ; LDB 59 l.43)', () => {
  it('bourse vide, lot partiel de 10 Enc : plancher 90 CO (110 CO − 20 points), refus avant le jet, rien de chargé', () => {
    const partie = halleFixee('local');
    try {
      expect(hasBargainBonus(partie.etat().party[0]), 'fixture : le meneur n’est pas Négociateur').toBe(false);
      const fenetres = () => Object.entries(partie.etat()).filter(([k, v]) => k.startsWith('pending') && v).map(([k]) => k);
      const avant = fenetres();
      acheter(partie, 'convoi', 'metal', 10);
      expect(fenetres()).toEqual(avant);
      expect(carrierById(partie.etat(), 'convoi')!.cargo).toEqual([]);
      expect(journalDit(partie, t('cargo.bourseSousPlancher', { plancher: '90 CO' }))).toBe(true);
      expect(devisDAchatDeCargaison(partie.etat(), 'convoi', 'metal', 10)).toMatchObject({ estimationGold: 110, plancherGold: 90, refus: { motif: 'bourse', plancher: 90 } });
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — siège invité : les gestes de la halle sur la bourse et la cale sont à l’hôte', () => {
  it('vente et bradage refusés par la fenêtre, évaluation du vin et transfert envoyés refusés (`coop.hoteSeul`), cargaison intacte', () => {
    const lot: CargoLot = { uid: 'lot-1', cargoId: 'metal', enc: 12, basePriceGold: 10 };
    const partie = halleFixee('invite', [lot]);
    try {
      partie.envoyer({ type: 'fenetreChoisir', args: ['marcheDeTerre', 'vendre', 'lot-1'] });
      partie.envoyer({ type: 'fenetreChoisir', args: ['marcheDeTerre', 'jeter', 'lot-1'] });
      partie.envoyer({ type: 'evaluerLeVin', args: ['metal'] });
      partie.envoyer({ type: 'deplacerLaCargaison', args: ['lot-1', 'convoi', 5] });
      expect(carrierById(partie.etat(), 'convoi')!.cargo).toEqual([lot]);
      expect(partie.etat().journal.filter((l) => l.includes(t('choix.refus.hoteSeul'))).length, 'vente et bradage').toBe(2);
      expect(partie.etat().journal.filter((l) => l === t('coop.hoteSeul')).length, 'évaluation et transfert').toBe(2);
      expect(refusDeGesteSurLeGroupe(partie.etat()), 'le refus de groupe que lit l’écran').toBe(t('groupe.hoteSeul'));
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — bradage à la halle : refusé hors d’un Lieu ayant le Commerce en Produits (MSRC 13 l.160)', () => {
  it('siège local, Produits sans « commerce » : le geste dit le refus, la cargaison reste, la bourse aussi', () => {
    const lot: CargoLot = { uid: 'lot-2', cargoId: 'metal', enc: 12, basePriceGold: 10 };
    const partie = halleFixee('local', [lot], ['vivres', 'vin-eau-de-vie', 'metal']);
    try {
      const bourse = bourseOf(partie.etat().party[0]);
      partie.envoyer({ type: 'fenetreChoisir', args: ['marcheDeTerre', 'jeter', 'lot-2'] });
      expect(carrierById(partie.etat(), 'convoi')!.cargo).toEqual([lot]);
      expect(bourseOf(partie.etat().party[0])).toEqual(bourse);
      expect(journalDit(partie, 'Métal : ce lieu ne brade pas les cargaisons (pas de Commerce en Produits).')).toBe(true);
    } finally {
      partie.fermer();
    }
  });
});
