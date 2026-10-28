/**
 * Achat de cargaison terrestre jugé par le NOYAU (#3059, lot marchand) : `devisDAchatDeCargaison` rend le
 * refus que `landBuyCargo` applique et que l'écran du marché affiche — lot sous le minimum, sans porteur,
 * contenance dépassée. MSRC 13 l.129-131.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type Partie } from './index';
import { makePregens } from '../data/pregens';
import { emptyScene } from './monde/scene';
import { minCargoEnc } from '../engine/landCargo';
import type { Possession } from '../engine/possession';
import type { WorldMap } from './worldMap';
import { carrierById } from './carriers';
import { devisDAchatDeCargaison } from './landMarketFlow';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import type { CargoLot } from '../engine/cargo';
import { t } from '../i18n';

const carte: WorldMap = {
  id: 'm', label: 'Reikland',
  places: [{ id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'ville-a', market: { taille: 4, richesse: 4, produits: ['vivres', 'vin', 'metal', 'commerce'] } }],
  routes: [],
};

/** Ouvre la halle par le geste du noyau, le groupe menant une diligence (Chargement 80) si `avecPorteur`. */
function ouvrir(avecPorteur: boolean, bourseDuMeneur = 0): Partie {
  const party = makePregens().slice(0, 3).map((h, i) => (i === 0 ? withBourseMoney(h, { gold: bourseDuMeneur, silver: 0, brass: 0 }) : h));
  const possessions: Possession[] = avecPorteur
    ? [{ uid: 'convoi', ownerId: party[0].id, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] }]
    : [];
  const entrees: EntreesDeLaPartie = { graine: 3, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
  const partie = creerPartie({
    ...etatInitialDuJeu(),
    party, possessions, worldMap: carte, gameTime: 8 * 60,
    scene: { ...emptyScene('ville-a', 2, 2), label: 'Ville', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
  }, entrees);
  partie.envoyer({ type: 'openLandMarket', args: [] });
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
      const cargoId = offre(partie, minCargoEnc);
      const devis = devisDAchatDeCargaison(partie.etat(), cargoId, minCargoEnc - 1);
      expect(devis.refus).toEqual({ motif: 'lot-minimal', min: minCargoEnc });
      partie.envoyer({ type: 'landBuyCargo', args: [cargoId, minCargoEnc - 1] });
      expect(carrierById(partie.etat(), 'convoi')!.cargo).toEqual([]);
      expect(journalDit(partie, t('lm.lotMinimal', { min: minCargoEnc }))).toBe(true);
    } finally {
      partie.fermer();
    }
  });

  it('lot au minimum, porteur libre, bourse pleine : aucun refus avant Marchandage, estimation au lot partiel', () => {
    const partie = ouvrir(true, 5000);
    try {
      const cargoId = offre(partie, minCargoEnc + 1);
      const devis = devisDAchatDeCargaison(partie.etat(), cargoId, minCargoEnc);
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
      const cargoId = offre(partie, minCargoEnc);
      expect(devisDAchatDeCargaison(partie.etat(), cargoId, minCargoEnc).refus).toEqual({ motif: 'sans-porteur' });
    } finally {
      partie.fermer();
    }
  });
});

/** Halle FIXÉE : une offre de 20 Enc de métal à 10 CO, une diligence vide, un seul héros sans Négociateur,
 *  qui mène donc le Marchandage du groupe (`partyAssisted`). `mode` : siège local ou invité. */
function halleFixee(mode: 'local' | 'guest', cargo: CargoLot[] = [], produits = carte.places[0].market!.produits): Partie {
  const heros = { ...makePregens()[0], talents: [] };
  const entrees: EntreesDeLaPartie = { graine: 3, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
  return creerPartie({
    ...etatInitialDuJeu(),
    party: [heros], worldMap: carte, gameTime: 8 * 60,
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
      partie.envoyer({ type: 'landBuyCargo', args: ['metal', 10] });
      expect(fenetres()).toEqual(avant);
      expect(carrierById(partie.etat(), 'convoi')!.cargo).toEqual([]);
      expect(journalDit(partie, t('cargo.bourseSousPlancher', { plancher: 90 }))).toBe(true);
      expect(devisDAchatDeCargaison(partie.etat(), 'metal', 10)).toMatchObject({ estimationGold: 110, plancherGold: 90, refus: { motif: 'bourse', plancher: 90 } });
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — siège invité : les gestes de la halle sur la bourse et la cale disent le refus de groupe', () => {
  it('vente, bradage, évaluation du vin et transfert refusés, cargaison intacte', () => {
    const lot: CargoLot = { cargoId: 'metal', enc: 12, basePriceGold: 10 };
    const partie = halleFixee('guest', [lot]);
    try {
      partie.envoyer({ type: 'landSellCargo', args: ['convoi', 0] });
      partie.envoyer({ type: 'landDumpCargo', args: ['convoi', 0] });
      partie.envoyer({ type: 'landEvalWine', args: ['metal'] });
      partie.envoyer({ type: 'moveCargo', args: ['convoi', 'ailleurs', 'metal', 5] });
      expect(carrierById(partie.etat(), 'convoi')!.cargo).toEqual([lot]);
      expect(partie.etat().journal.filter((l) => l.includes(t('groupe.hoteSeul'))).length).toBe(4);
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — bradage à la halle : refusé hors d’un Lieu ayant le Commerce en Produits (MSRC 13 l.160)', () => {
  it('siège local, Produits sans « commerce » : le geste dit le refus, la cargaison reste, la bourse aussi', () => {
    const lot: CargoLot = { cargoId: 'metal', enc: 12, basePriceGold: 10 };
    const partie = halleFixee('local', [lot], ['vivres', 'vin', 'metal']);
    try {
      const bourse = bourseOf(partie.etat().party[0]);
      partie.envoyer({ type: 'landDumpCargo', args: ['convoi', 0] });
      expect(carrierById(partie.etat(), 'convoi')!.cargo).toEqual([lot]);
      expect(bourseOf(partie.etat().party[0])).toEqual(bourse);
      expect(journalDit(partie, 'Métal : ce lieu ne brade pas les cargaisons (pas de Commerce en Produits).')).toBe(true);
    } finally {
      partie.fermer();
    }
  });
});
