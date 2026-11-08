/**
 * LE VÉHICULE DE L'ATELIER (#2987 ; `CONTRAT.md`, méthode `vehicule`) : une fiche servie, les pièces de ses postes, ses
 * Améliorations et son apparence donnent le corps que le combat compose pour la même coque (`corpsDuVehicule`), les places
 * de chacun de ses bords dans ses postes en vigueur et les fiches servies qui s'y montent.
 */
import { describe, expect, it } from 'vitest';
import { erreurDe, modelesCommites, servirLesModeles, suiteDe, table } from './pont.testkit';
import type { VehiculeDeLAtelier } from './pont';
import { findCouleurById } from '../../../src/noyau/index';

const COMMITES = modelesCommites();

describe('le véhicule de l’atelier (`vehicule`)', () => {
  const atelier = table().appel;
  const CANONS = [...Array(3).fill({ definition: 'canon-moyen', bord: 'tribord' }), ...Array(3).fill({ definition: 'canon-moyen', bord: 'babord' }), { definition: 'canon-moyen', bord: 'proue' }, { definition: 'canon-moyen', bord: 'poupe' }];
  const AMELIORATIONS = ['sabord', 'figure-de-proue', 'ancre', 'nid-de-pie', 'clinfoc', 'fourquines', 'embarcation-de-bord', 'safran'];
  const reponse = (entree: unknown) => atelier('vehicule', entree) as unknown as VehiculeDeLAtelier & { ok: true };

  it('se refuse avant tout `modeles`', () => {
    expect(erreurDe(atelier('vehicule', { definition: 'caraque' }))).toEqual({ categorie: 'validation', message: 'vehicule : aucun modèle, appeler modeles d’abord' });
  });

  it('le corps d’une coque nue, les places de ses bords, les pièces qui s’y montent', () => {
    servirLesModeles(atelier, COMMITES);
    expect(reponse({ definition: 'caraque' })).toEqual({
      ok: true,
      vehicule: { element: 'vehicule--caraque', empreinte: 4, taille: 'empreinte', cap: 'N', palette: {}, postes: [], ameliorations: [], caches: ['avec-sabord'] },
      postes: [{ bord: 'proue', label: 'Proue', places: 2 }, { bord: 'tribord', label: 'Tribord', places: 4 }, { bord: 'poupe', label: 'Poupe', places: 2 }, { bord: 'babord', label: 'Bâbord', places: 4 }],
      pieces: ['canon-grand', 'canon-moyen', 'canon-petit'],
      ameliorations: [],
    });
  });

  it('le même corps que le combat donne à la même coque, hors de son cap', () => {
    const { vue } = suiteDe(atelier('demarrer', { scenario: 'caraque', graine: 7 }));
    const auCombat = vue.corps.vehicules['caraque-rendu'];
    expect(auCombat.ameliorations.length).toBeGreaterThan(0);
    const { vehicule } = reponse({ definition: 'caraque', postes: CANONS, ameliorations: AMELIORATIONS, embleme: { id: 'taureau-rouge' } });
    expect(vehicule).toEqual({ ...auCombat, cap: 'N' });
  });

  it('une Amélioration montée change les places de ses bords, les pièces qui y vont et les nœuds cachés ; retirée, tout revient', () => {
    const avec = reponse({ definition: 'caraque', postes: CANONS.slice(0, 1), ameliorations: ['sabord'] });
    expect(avec.postes.map((p) => [p.bord, p.places])).toEqual([['proue', 2], ['tribord', 10], ['poupe', 2], ['babord', 10]]);
    expect([avec.ameliorations, avec.vehicule.caches]).toEqual([['sabord'], ['sans-sabord']]);
    const sabords = avec.vehicule.ameliorations.filter((a) => a.poste);
    expect(sabords).toHaveLength(22);
    expect(sabords.filter((a) => a.poste!.montre === 'ouvert').map((a) => a.position)).toEqual([avec.vehicule.postes[0].position]);
    const sans = reponse({ definition: 'caraque', postes: CANONS.slice(0, 1), ameliorations: [] });
    expect([sans.vehicule.ameliorations, sans.vehicule.caches]).toEqual([[], ['avec-sabord']]);
    expect(sans.vehicule.postes[0].position).not.toEqual(avec.vehicule.postes[0].position);
  });

  it('la palette et l’emblème de son apparence', () => {
    const { vehicule } = reponse({ definition: 'caraque', couleurs: { vet1: { id: 'peau-brune' } }, embleme: { id: 'taureau-rouge' } });
    expect([vehicule.palette, vehicule.embleme]).toEqual([{ vet1: findCouleurById('peau-brune')!.color }, { id: 'taureau-rouge' }]);
  });

  it('se refuse sur une fiche non servie, une pièce qui ne se monte pas, un bord inconnu, une Amélioration non servie ou une couleur inconnue', () => {
    const refus = (entree: unknown) => erreurDe(atelier('vehicule', entree));
    expect(refus({ definition: 'cogue' }).message).toMatch(/^vehicule : definition, la fiche d’un véhicule servi par modeles \(/);
    expect(refus({ definition: 'caraque', postes: [{ definition: 'caraque', bord: 'tribord' }] }).message).toMatch(/^vehicule : postes, /);
    expect(refus({ definition: 'caraque', postes: [{ definition: 'canon-moyen', bord: 'hune' }] }).message).toMatch(/^vehicule : postes, /);
    expect(refus({ definition: 'caraque', ameliorations: ['robuste'] }).message).toMatch(/^vehicule : ameliorations, /);
    expect(refus({ definition: 'caraque', couleurs: { vet1: { id: 'arc-en-ciel' } } })).toMatchObject({ categorie: 'validation', message: expect.stringMatching(/^vehicule : apparence, couleurs\.vet1/) });
  });
});
