import { Bone, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Echantillon } from '../echantillonnage.ts';
import { suivreLesPoignets, VITESSE_DU_POIGNET } from './poignets.ts';

const os = (nom: string, parent: Object3D) => {
  const b = new Bone();
  b.name = nom;
  parent.add(b);
  return b;
};

/** Une scène `avant_bras` > `main`, et l'échantillon (clip, t) où l'avant-bras est tourné de `bras`° autour de z et la
 *  main de `poignet`° autour de y sur lui. */
const scene = new Object3D();
os('main', os('avant_bras', scene));
const tour = (axe: Vector3, degres: number) => new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromAxisAngle(axe, (degres * Math.PI) / 180));
const echantillon = (clip: string, t: number, bras: number, poignet: number): Echantillon => {
  const avantBras = tour(new Vector3(0, 0, 1), bras);
  return { clip, t, positions: new Map(), os: new Map([['avant_bras', avantBras], ['main', avantBras.clone().multiply(tour(new Vector3(0, 1, 0), poignet))]]) };
};
const ecartsDe = (echantillons: readonly Echantillon[]) => {
  const suivi = suivreLesPoignets(scene, ['main']);
  for (const e of echantillons) suivi.echantillon(e);
  return suivi.ecarts();
};
const PAS = 1 / 24;
const SOUS = (VITESSE_DU_POIGNET * PAS) / 2;

describe('gardePoignets', () => {
  it('ROUGE : une main qui saute sur son avant-bras en un pas, la pire pointe du clip est rapportée', () => {
    const ecarts = ecartsDe([echantillon('Frappe', 0, 0, 0), echantillon('Frappe', PAS, 0, 100), echantillon('Frappe', 2 * PAS, 0, -70), echantillon('Frappe', 3 * PAS, 0, -70)]);
    expect(ecarts.map((e) => [e.garde, e.code, e.clip, e.seuil])).toEqual([['poignets', 'poignet-trop-rapide', 'Frappe', VITESSE_DU_POIGNET]]);
    expect(ecarts[0].t).toBeCloseTo(2 * PAS, 9);
    expect(ecarts[0].valeur).toBeCloseTo(170 * 24, 3);
  });

  it('VERT : la même main sous le seuil, et un avant-bras qui emporte la main aussi vite qu’on veut', () => {
    expect(ecartsDe([echantillon('Frappe', 0, 0, 0), echantillon('Frappe', PAS, 170, SOUS), echantillon('Frappe', 2 * PAS, -170, 2 * SOUS)])).toEqual([]);
  });

  it('le premier échantillon d’un clip ne se compare pas au dernier du clip précédent', () => {
    expect(ecartsDe([echantillon('Repos', 0, 0, 0), echantillon('Repos', PAS, 0, 0), echantillon('Frappe', 0, 0, 170), echantillon('Frappe', PAS, 0, 170)])).toEqual([]);
  });

  it('refuse un os absent de la scène', () => {
    expect(() => suivreLesPoignets(scene, ['fantome'])).toThrow(/fantome/);
  });
});
