/**
 * LES TABLEAUX D'UN MORCEAU EN OCTETS (#3948, `CONTRAT.md`, section « Transport ») : `enOctets` range les tableaux de
 * chaque géométrie en `Float32` à la suite, l'en-tête n'en garde que les bornes ; la porte `appelerEnOctets` du pont
 * rend, recollée à `octets()`, la réponse d'`appeler` au `Math.fround` près, et aucune autre réponse ne tient d'octets.
 */
import { describe, expect, it } from 'vitest';
import { enOctets, type BornesEnOctets } from './octets';
import { mondeDe, table } from './pont.testkit';
import { tableTotale } from '../../../src/lib/tableTotale';
import type { MorceauxDuPont, Pont } from './pont';

const TABLEAUX = ['positions', 'normales', 'couleurs', 'cases'] as const;
const FAMILLES = ['volume', 'toits', 'couronnes'] as const;

/** Une géométrie dont chaque tableau porte des valeurs que `Float32` arrondit, et des `0x0a` dans leurs octets. */
const geometrie = (cle: string, triangles: number) => ({
  cle,
  empreinte: `e-${cle}`,
  positions: Array.from({ length: 9 * triangles }, (_, i) => i * 0.1 + 0.001),
  normales: Array.from({ length: 9 * triangles }, (_, i) => (i % 3) - 1),
  couleurs: Array.from({ length: 12 * triangles }, (_, i) => (i % 7) / 7),
  cases: Array.from({ length: 3 * triangles }, (_, i) => i % 5),
  surfaces: [{ matiere: 'terrain--herbe', debut: 0, fin: 3 * triangles }],
});
const REPONSE: MorceauxDuPont = {
  volume: [{ ...geometrie('sol/0/0/0', 2), rangee: 0 }, { ...geometrie('pose/0/0/0', 1), rangee: 8 }],
  toits: [geometrie('toit-a', 3)],
  couronnes: [geometrie('couronne-a', 1)],
};

/** Les bornes de chaque tableau de l'en-tête, dans l'ordre des familles, des géométries et des tableaux. */
const bornesDe = (entete: ReturnType<typeof enOctets>['entete']): BornesEnOctets[] =>
  FAMILLES.flatMap((f) => entete[f].flatMap((g) => TABLEAUX.map((t) => g[t])));

describe('enOctets', () => {
  const { entete, octets } = enOctets(REPONSE);
  const sources = FAMILLES.flatMap((f) => REPONSE[f].flatMap((g) => TABLEAUX.map((t) => g[t])));

  it('les bornes se suivent depuis 0, en multiples de 4, jusqu’à 4 fois le nombre de nombres', () => {
    const bornes = bornesDe(entete);
    expect(bornes.map(([d]) => d)).toEqual([0, ...bornes.slice(0, -1).map(([, f]) => f)]);
    expect(bornes.flat().every((b) => b % 4 === 0)).toBe(true);
    expect([entete.octets, octets.byteLength]).toEqual(Array(2).fill(4 * sources.reduce((n, t) => n + t.length, 0)));
  });

  it('chaque tableau se lit sur ses bornes, dans l’ordre des familles, des géométries et des champs', () => {
    expect(bornesDe(entete).map(([d, f]) => new Float32Array(octets, d, (f - d) / 4))).toEqual(sources.map((t) => Float32Array.from(t)));
  });

  it('l’en-tête porte les deux bornes de chaque tableau, le reste de chaque géométrie inchangé', () => {
    const sansTableaux = (g: object) => Object.fromEntries(Object.entries(g).filter(([k]) => !(TABLEAUX as readonly string[]).includes(k)));
    for (const f of FAMILLES) {
      expect(entete[f].map((g) => TABLEAUX.map((t) => g[t].length)), `${f} : deux bornes par tableau`).toEqual(REPONSE[f].map(() => [2, 2, 2, 2]));
      expect(entete[f].map(sansTableaux), f).toEqual(REPONSE[f].map(sansTableaux));
    }
  });

  it('une réponse vide tient 0 octet', () => {
    const vide = enOctets({ volume: [], toits: [], couronnes: [] });
    expect([vide.entete, vide.octets.byteLength]).toEqual([{ octets: 0, volume: [], toits: [], couronnes: [] }, 0]);
  });
});

/** `reponse`, chaque tableau de chaque géométrie remplacé par ce qu'en fait `tableau`. */
const parTableau = <A, B>(reponse: Record<(typeof FAMILLES)[number], Record<(typeof TABLEAUX)[number], A>[]>, tableau: (a: A) => B) => ({
  ...reponse,
  ...tableTotale(FAMILLES, (f) => reponse[f].map((g) => ({ ...g, ...tableTotale(TABLEAUX, (t) => tableau(g[t])) }))),
});

/** La réponse d'`appelerEnOctets` recollée à `octets()` : chaque borne remplacée par les nombres qu'elle tranche. */
function recolle(pont: Pont, entree: string): Record<string, unknown> {
  const { octets: longueur, ...entete } = JSON.parse(pont.appelerEnOctets('morceaux', entree)) as ReturnType<typeof enOctets>['entete'] & { ok: true };
  const tenus = pont.octets()!;
  expect(tenus.byteLength).toBe(longueur);
  const tableau = ([d, f]: BornesEnOctets) => Array.from(new Float32Array(tenus, d, (f - d) / 4));
  return parTableau(entete, tableau);
}

describe('appelerEnOctets', () => {
  it('morceaux recollé à octets() est la réponse d’appeler au Math.fround près ; une autre méthode et un refus ne tiennent aucun octet', () => {
    const { pont, appel } = table();
    appel('demarrer', { scenario: 'diligence' });
    const monde = mondeDe(appel);
    const cles = (liste: { cle: string }[]) => liste.map(({ cle }) => cle);
    const entree = JSON.stringify({ source: 'partie', volume: cles(monde.monde!.morceaux), toits: cles(monde.toits), couronnes: cles(monde.couronnes) });
    const json = JSON.parse(pont.appeler('morceaux', entree)) as MorceauxDuPont & { ok: true };
    expect(FAMILLES.map((f) => json[f].length > 0), 'des géométries de chaque famille').toEqual([true, true, true]);
    expect(recolle(pont, entree)).toEqual(parTableau(json, (t: number[]) => t.map(Math.fround)));

    expect(pont.appelerEnOctets('vue')).toBe(pont.appeler('vue'));
    expect(pont.octets(), 'après vue').toBeNull();

    recolle(pont, entree);
    const refus = pont.appelerEnOctets('morceaux', JSON.stringify({ source: 'ailleurs', volume: [], toits: [], couronnes: [] }));
    expect([JSON.parse(refus).ok, refus]).toEqual([false, pont.appeler('morceaux', JSON.stringify({ source: 'ailleurs', volume: [], toits: [], couronnes: [] }))]);
    expect(pont.octets(), 'après un refus de morceaux').toBeNull();
    pont.appeler('quitter');
  });
});
