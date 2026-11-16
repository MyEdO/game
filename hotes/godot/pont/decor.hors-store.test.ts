/**
 * LE DÉCOR SERVI PAR SON MODÈLE (#4335 ; `CONTRAT.md`, sections « Monde », « Corps d'un combattant » et « Atelier 3D ») :
 * chaque surface d'un décor du volume porte l'id de son type ; la vue sert, pour chaque type dont un élément `decor` est
 * servi, ce modèle et les poses de ce décor, celles dont le volume pose les faces ; l'atelier les sert de même pour
 * l'échantillon d'un décor.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { avecLesSeulsDecors, modelesCommites, mondeDe, morceauxDe, servirLesModeles, suiteDe, table, vueDe } from './pont.testkit';
import { posesDesDecors, sceneDEchantillon } from '../../../src/noyau/index';
import type { DecorServi } from './pont';

const COMMITES = await modelesCommites();
const { appel } = table();

describe('les décors de la scène en cours', () => {
  /** Par type de décor des surfaces du volume, les cases `x,y,z` de leurs triangles. */
  let casesParDecor: Map<string, Set<string>>;
  beforeAll(() => {
    suiteDe(appel('demarrer', { scenario: 'a-bord-de-la-caraque', graine: 7 }));
    casesParDecor = new Map();
    for (const m of morceauxDe(appel, 'partie', mondeDe(appel).monde!))
      for (const s of m.surfaces) {
        if (s.decor === undefined) continue;
        const cases = casesParDecor.get(s.decor) ?? casesParDecor.set(s.decor, new Set()).get(s.decor)!;
        for (let t = s.debut / 3; t < s.fin / 3; t++) cases.add(m.cases.slice(t * 3, t * 3 + 3).join(','));
      }
  });

  it('sans élément `decor` servi, aucun décor ; servi, le seul type qu’il nomme, à chaque case où le volume pose ses faces', () => {
    const [prop] = [...casesParDecor.keys()];
    expect(prop, 'la scène pose au moins un décor').toBeDefined();
    servirLesModeles(appel, COMMITES, avecLesSeulsDecors(COMMITES));
    expect(vueDe(appel('vue')).corps.decors).toEqual({});
    servirLesModeles(appel, COMMITES, avecLesSeulsDecors(COMMITES, prop));
    const { decors } = vueDe(appel('vue')).corps;
    expect(Object.keys(decors)).toEqual([prop]);
    expect(decors[prop].element).toBe(`decor--${prop}`);
    expect(new Set(decors[prop].poses.map((p) => p.prop))).toEqual(new Set([prop]));
    expect(new Set(decors[prop].poses.map(({ case: c }) => `${c.x},${c.y},${c.z}`))).toEqual(casesParDecor.get(prop));
  });
});

describe('l’échantillon d’un décor dans l’atelier', () => {
  it('sert le modèle du décor et sa pose, celle du noyau ; un décor sans modèle, aucun', () => {
    const { appel: atelier } = table();
    servirLesModeles(atelier, COMMITES, avecLesSeulsDecors(COMMITES, 'tonneau'));
    const { decors } = atelier('echantillon', { famille: 'decor', id: 'tonneau' }) as unknown as { decors: Record<string, DecorServi> };
    expect(decors).toEqual({ tonneau: { element: 'decor--tonneau', poses: posesDesDecors(sceneDEchantillon('decor', 'tonneau')) } });
    expect(decors.tonneau.poses).toHaveLength(1);
    expect((atelier('echantillon', { famille: 'decor', id: 'table' }) as unknown as { decors: unknown }).decors).toEqual({});
  });
});
