/**
 * LE VÉHICULE DE L'ATELIER (#2987 ; `CONTRAT.md`, méthode `vehicule`) : une fiche servie, les pièces de ses postes, ses
 * Améliorations et son apparence donnent le corps que le combat compose pour la même coque (`corpsDuVehicule`), chaque place
 * de ses postes en vigueur, à son libellé, avec la pièce que le corps y monte, et les fiches servies qui s'y montent.
 */
import { describe, expect, it } from 'vitest';
import { erreurDe, modelesCommites, servirLesModeles, suiteDe, table } from './pont.testkit';
import type { VehiculeDeLAtelier } from './pont';
import { findCouleurById } from '../../../src/noyau/index';

const COMMITES = await modelesCommites();

describe('le véhicule de l’atelier (`vehicule`)', () => {
  const atelier = table().appel;
  const CANONS = [...Array(3).fill({ definition: 'canon-moyen', bord: 'tribord' }), ...Array(3).fill({ definition: 'canon-moyen', bord: 'babord' }), { definition: 'canon-moyen', bord: 'proue' }, { definition: 'canon-moyen', bord: 'poupe' }];
  const AMELIORATIONS = ['sabord', 'figure-de-proue', 'ancre', 'nid-de-pie', 'clinfoc', 'fourquines', 'embarcation-de-bord', 'safran'];
  const reponse = (entree: unknown) => atelier('vehicule', entree) as unknown as VehiculeDeLAtelier & { ok: true };
  const placesVides = (bords: [string, number, string][]) => bords.flatMap(([bord, n, libelle]) => Array.from({ length: n }, (_, rang) => ({ bord, rang, label: `${libelle} ${rang + 1}`, piece: null })));

  it('se refuse avant tout `modeles`', () => {
    expect(erreurDe(atelier('vehicule', { definition: 'caraque' }))).toEqual({ categorie: 'validation', message: 'vehicule : aucun modèle, appeler modeles d’abord' });
  });

  it('le corps d’une coque nue, les places de ses bords, les pièces qui s’y montent', () => {
    servirLesModeles(atelier, COMMITES);
    expect(reponse({ definition: 'caraque' })).toEqual({
      ok: true,
      vehicule: { element: 'vehicule--caraque', empreinte: 4, taille: 'empreinte', cap: 'N', palette: {}, postes: [], ameliorations: [], caches: ['avec-sabord'], clips: {} },
      places: placesVides([['proue', 2, 'Proue'], ['tribord', 4, 'Tribord'], ['poupe', 2, 'Poupe'], ['babord', 4, 'Bâbord']]),
      pieces: ['baliste', 'baliste-ade2', 'batterie-tonnerre-de-feu', 'batterie-tonnerre-de-feu-ade2', 'belier-ade2', 'canon-ade2', 'canon-grand',
        'canon-moyen', 'canon-petit', 'canon-a-flammes-nain-ade2', 'canon-a-repetition', 'canon-a-repetition-feu-d-enfer',
        'canon-a-repetition-feu-d-enfer-ade2', 'catapulte-grande', 'catapulte-moyenne', 'catapulte-petite', 'mangonneau-ade2', 'mortier',
        'mortier-ade2', 'onagre-ade2', 'pierrier', 'trebuchet-ade2'],
      ameliorations: [],
      montables: ['ancre', 'belier', 'blindage-bronze', 'blindage-fer', 'bouteur', 'clinfoc', 'embarcation-de-bord', 'figure-de-proue', 'fourquines',
        'murs-blindes', 'nid-de-pie', 'propulsion-a-vapeur', 'proue-idole-de-stromfels', 'ralentisseurs-lateraux', 'sabord', 'safran'],
    });
  });

  it('un engin dont le manifeste n’ancre ni ne nomme aucune Amélioration n’en offre aucune à monter', () => {
    expect(reponse({ definition: 'trebuchet-ade2' }).montables).toEqual([]);
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
    expect(['proue', 'tribord', 'poupe', 'babord'].map((bord) => avec.places.filter((p) => p.bord === bord).length)).toEqual([2, 5, 2, 5]);
    expect(avec.places.filter((p) => p.piece !== null).map((p) => [p.bord, p.rang, p.piece])).toEqual([['tribord', 0, 'canon-moyen']]);
    expect([avec.ameliorations, avec.vehicule.caches]).toEqual([['sabord'], ['sans-sabord']]);
    const sabords = avec.vehicule.ameliorations.filter((a) => a.poste);
    expect(sabords).toHaveLength(10);
    expect(sabords.filter((a) => a.poste!.montre === 'ouvert').map((a) => a.position)).toEqual([avec.vehicule.postes[0].position]);
    const sans = reponse({ definition: 'caraque', postes: CANONS.slice(0, 1), ameliorations: [] });
    expect([sans.vehicule.ameliorations, sans.vehicule.caches]).toEqual([[], ['avec-sabord']]);
    expect(sans.vehicule.postes[0].position).not.toEqual(avec.vehicule.postes[0].position);
  });

  it('chaque place dit la pièce que le corps y monte : une place vide prend la pièce suivante de son bord, une pièce sans place ne se monte pas', () => {
    const tribord = (definition: string) => ({ definition, bord: 'tribord' });
    const { places, vehicule } = reponse({ definition: 'caraque', postes: [tribord('canon-petit'), tribord('canon-grand'), ...Array(3).fill(tribord('canon-moyen'))] });
    expect(places.filter((p) => p.bord === 'tribord').map((p) => p.piece)).toEqual(['canon-petit', 'canon-grand', 'canon-moyen', 'canon-moyen']);
    expect(vehicule.postes).toHaveLength(4);
  });

  it('un engin porte la table rôle → clip de son élément', () => {
    expect(reponse({ definition: 'canon-moyen' }).vehicule.clips).toEqual({ repos: 'repos', marche: 'marche', tir: 'tir' });
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
