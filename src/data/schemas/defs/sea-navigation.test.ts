/** #1595 — couverture des tables de Navigation maritime (MDG 13 l.125, l.140, l.316, l.320, l.326,
 *  l.343, l.345, l.380, l.394), patron `structureCriticals.test.ts`. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import seaNavigationJson from '../../sea-navigation.json';

type Bande = { min: number | null; max: number | null };
type Doc = {
  vitesseMax: { table: Bande[] };
  orientation: { reperes: Bande[]; changementDeCap: Bande[] };
  poursuite: { drDeltas: Bande[] };
  phares: { voirLaLumiere: Bande[] };
};
const clone = () => structuredClone(seaNavigationJson) as unknown as Doc;

describe('sea-navigation.json — chaque table couvre son domaine d’un seul tenant', () => {
  it('le schéma accepte le document RÉEL', () => {
    expect(validateDataset('sea-navigation.json', seaNavigationJson)).toBeNull();
  });

  it.each([
    ['vitesseMax.table', (d: Doc) => d.vitesseMax.table],
    ['orientation.reperes', (d: Doc) => d.orientation.reperes],
    ['orientation.changementDeCap', (d: Doc) => d.orientation.changementDeCap],
    ['poursuite.drDeltas', (d: Doc) => d.poursuite.drDeltas],
    ['phares.voirLaLumiere', (d: Doc) => d.phares.voirLaLumiere],
  ])('REFUSE une rangée du milieu de %s sans plafond', (chemin, table) => {
    const trouee = clone();
    table(trouee)[1].max = null;
    expect(validateDataset('sea-navigation.json', trouee)).toMatch(new RegExp(`${chemin.replace('.', '\\.')} : .*la rangée n° 2 n'a pas de borne haute`));
  });

  it('REFUSE une table Ça va lâcher qui ne commence pas au-delà de M+4 (MDG 13 l.125)', () => {
    const decalee = clone();
    decalee.vitesseMax.table[0].min = 4;
    expect(validateDataset('sea-navigation.json', decalee)).toMatch(/vitesseMax\.table : .*la rangée n° 1 commence à 4 au lieu de 5/);
  });

  it('« 5 milles ou moins » (MDG 13 l.343) : la première bande de Voir la lumière reste OUVERTE en bas', () => {
    const refermee = clone();
    refermee.phares.voirLaLumiere[0].min = 0;
    expect(validateDataset('sea-navigation.json', refermee)).toMatch(/phares\.voirLaLumiere : .*la rangée n° 1 est la PREMIÈRE et porte un plancher \(0\)/);
  });

  it('REFUSE un trou dans Voir la lumière, bornée à 15 milles (MDG 13 l.345)', () => {
    const trouee = clone();
    trouee.phares.voirLaLumiere[1].min = 7;
    expect(validateDataset('sea-navigation.json', trouee)).toMatch(/phares\.voirLaLumiere : .*la rangée n° 2 commence à 7 au lieu de 6/);
    const courte = clone();
    courte.phares.voirLaLumiere[2].max = 14;
    expect(validateDataset('sea-navigation.json', courte)).toMatch(/phares\.voirLaLumiere : .*s'arrête à 14 au lieu de 15/);
  });

  it('REFUSE un Changement de cap qui ne couvre pas le d10 + 2 (MDG 13 l.320, l.326)', () => {
    const courte = clone();
    const cap = courte.orientation.changementDeCap;
    cap[cap.length - 1].max = 11;
    expect(validateDataset('sea-navigation.json', courte)).toMatch(/orientation\.changementDeCap : .*s'arrête à 11 au lieu de 12/);
  });
});
