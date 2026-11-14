/**
 * Unité du prix de base d'une cargaison, par voie (#3646) : l'offre de l'étal, générée par le geste qui ouvre la
 * halle ou le port, se devise en CO par point d'Enc. MSRC 13 l.91 ; MDG 15 l.436.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type EtatDeJeu, type Partie } from './index';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { emptyScene } from './monde/scene';
import type { CampaignVessel } from './etat';
import type { WorldMap } from './worldMap';
import { findCargoById, type CargoDef } from '../engine/cargo';
import { seasonOfMonth } from '../engine/travelStages';
import { toDate } from '../engine/clock';
import { devisDAchatDeCargaison } from './landMarketFlow';
import { devisDAchatEnPort } from './portFlow';
import { CAMPAIGN_VESSEL_CARRIER_ID } from './carriers';

const entrees: EntreesDeLaPartie = { graine: 3, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };

function partie(carte: WorldMap, etat: Partial<EtatDeJeu>): Partie {
  return creerPartie({
    ...etatInitialDuJeu(),
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 1), worldMap: carte, lieu: 'A', gameTime: 8 * 60,
    scene: { ...emptyScene('lieu-a', 2, 2), label: 'Lieu', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    ...etat,
  }, entrees);
}

/** Le prix du LIVRE de la cargaison à la saison de la partie (colonne saisonnière, hors prix à dés). */
function prixDuLivre(p: Partie, cargoId: string): number {
  const prix = (findCargoById(cargoId) as CargoDef).price;
  if ('dice' in prix) throw new Error(`${cargoId} : prix à dés`);
  return prix[seasonOfMonth(toDate(p.etat().gameTime).month)];
}

describe('#3646 — unité du prix de base d’une cargaison, par voie', () => {
  it('terre : un lot complet de 10 Enc d’un bien à P CO au livre coûte P CO avant Marchandage (MSRC 13 l.91)', () => {
    const p = partie({
      id: 'm', label: 'Reikland', routes: [],
      places: [{ id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: { id: 'lieu-a' }, market: { taille: 4, richesse: 4, produits: ['metal', 'vivres', 'laine-terre'] } }],
    }, { possessions: [{ uid: 'convoi', ownerId: tousLesHerosDeScenario(idsDeTest)[0].id, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] }] });
    try {
      p.envoyer({ type: 'ouvrirLeMarche', args: [] });
      const offres = p.etat().landMarket?.offers.filter((o) => !o.wine) ?? [];
      expect(offres.length, 'halle sans offre de bien à prix saisonnier').toBeGreaterThan(0);
      for (const o of offres) {
        const P = prixDuLivre(p, o.cargoId);
        const devis = devisDAchatDeCargaison(p.etat(), 'convoi', o.cargoId, o.enc);
        expect(devis.partiel, o.cargoId).toBe(false);
        expect(devis.estimationGold, `${o.cargoId} : ${o.enc} Enc à ${P} CO les 10 Enc`).toBe((o.enc / 10) * P);
      }
    } finally {
      p.fermer();
    }
  });

  it('mer : un lot de 10 Enc d’un bien à P CO au livre coûte 10·P CO avant Marchandage (MDG 15 l.436)', () => {
    const vessel = { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } as unknown as CampaignVessel;
    const p = partie({
      id: 'm', label: 'Mer', routes: [],
      places: [{ id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'lieu-a' }, port: { taille: 4, richesse: 4, production: ['sel', 'metaux', 'bois-mer'] } as never }],
    }, { vessel });
    try {
      p.envoyer({ type: 'ouvrirLePort', args: [] });
      const offres = p.etat().port?.offers.filter((o) => !o.remisePct && !('dice' in (findCargoById(o.cargoId) as CargoDef).price)) ?? [];
      expect(offres.length, 'port sans offre de bien à prix saisonnier').toBeGreaterThan(0);
      for (const o of offres) {
        const P = prixDuLivre(p, o.cargoId);
        expect(devisDAchatEnPort(p.etat(), CAMPAIGN_VESSEL_CARRIER_ID, o.cargoId, 10).estimationGold, `${o.cargoId} à ${P} CO l’Enc`).toBe(Math.round(10 * P));
      }
    } finally {
      p.fermer();
    }
  });
});
