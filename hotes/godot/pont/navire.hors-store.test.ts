/**
 * LE NAVIRE D'UNE SCÈNE (#3686 ; `CONTRAT.md`, sections « Monde », « Vue » et « Corps d'un combattant ») : la scène
 * entre en jeu les ponts de son navire posés ; la vue le sert par le corps de son véhicule, au centre de ses ponts ; le
 * monde garde le sol de ses ponts pour le pointage sans le peindre, et le plateau ne dessine aucune de leurs arêtes.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { modelesCommites, servirLesModeles, suiteDe, table, vueDe } from './pont.testkit';
import type { VolumeDuMonde } from '../../../src/noyau/index';

const COMMITES = modelesCommites();
const { appel } = table();

describe('la caraque posée dans la scène À bord de la caraque', () => {
  beforeAll(() => {
    suiteDe(appel('demarrer', { scenario: 'a-bord-de-la-caraque', graine: 7 }));
  });

  it('sans élément de son type servi, aucun navire ; servi, son corps au centre de ses ponts, à sa taille réelle', () => {
    expect(vueDe(appel('vue')).corps.navires).toEqual({});
    servirLesModeles(appel, COMMITES);
    const { navires } = vueDe(appel('vue')).corps;
    expect(Object.keys(navires)).toEqual(['caraque']);
    expect(navires.caraque).toMatchObject({ centre: { x: 10.5, y: 4 }, corps: { element: 'vehicule--caraque', taille: 'reelle', cap: 'E' } });
    expect(navires.caraque.corps.ameliorations.map((a) => a.element)).toEqual(expect.arrayContaining(['amelioration--embarcation-de-bord', 'amelioration--nid-de-pie']));
  });

  it('le monde garde le sol des ponts pour le pointage, sans le peindre ; le plateau ne dessine aucune de leurs arêtes', () => {
    const { monde } = appel('monde') as unknown as { monde: VolumeDuMonde };
    expect(monde.hauteurs.map((h) => h.z)).toEqual([0, 1, 2, 3]);
    expect(monde.surfaces.filter((s) => s.navire === 'caraque').length).toBeGreaterThan(0);
    expect(monde.surfaces.filter((s) => s.navire === undefined).map((s) => s.matiere)).not.toContain('relief--pilier');
    expect(vueDe(appel('vue')).plateau!.aretes).toEqual([]);
  });
});
