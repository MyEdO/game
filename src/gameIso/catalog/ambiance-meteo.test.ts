/**
 * LUMIÈRE DÉRIVÉE DE LA MÉTÉO (#1247) — le contrat n'est PAS l'égalité des valeurs entre les deux
 * voies (une lumière multiplie, un voile interpole : elles ne coïncident qu'en un point), c'est
 * l'égalité du SENS. Une météo qui ÉCLAIRCIT l'écran en affine ne doit pas l'ASSOMBRIR en volumique.
 *
 * C'est le défaut que ce banc verrouille : `dim = 1 − alpha` assombrissait TOUT, alors que la moitié
 * du registre (brouillard, neige) porte une teinte plus claire que la scène et l'ÉCLAIRCIT en affine.
 */
import { describe, expect, it } from 'vitest';
import { ALBEDO_REF, AMBIANCE, METEO_SANS_EFFET, weatherLightScalars } from './ambiance';
import type { WeatherFxId } from '../../data/ambiance.types';
import { luminanceHex } from '../shade';

const TYPES = ['pluie', 'brouillard', 'neige', 'tempete'] as const;
/** Une scène d'EXTÉRIEUR sous cette météo — la porte des deux voies (`sceneWeatherFx`). */
const dehors = (weather: WeatherFxId | 'clair') => ({ weather, ambiance: 'exterieur' } as const);

/** Ce que le VOILE D'ÉCRAN de la voie affine rend sur l'albédo de référence : `(1−a)·albédo + a·teinte`,
 *  en luminance sRGB — la composition d'un rect translucide, telle quelle. */
function apresVoileAffine(id: WeatherFxId): number {
  const fx = AMBIANCE.iso.weather[id]!;
  return (1 - fx.alpha) * ALBEDO_REF + fx.alpha * luminanceHex(fx.tint)!;
}

/** Ce que la LUMIÈRE de la voie volumique rend sur le même albédo : elle multiplie. */
function apresLumiereVolumique(id: WeatherFxId): number {
  return ALBEDO_REF * weatherLightScalars(dehors(id)).dim;
}

const sens = (v: number) => Math.sign(Number((v - ALBEDO_REF).toFixed(6)));

describe('weatherLightScalars — le SENS de la météo est le MÊME des deux côtés (#1247)', () => {
  for (const id of TYPES)
    it(`${id} : signe(Δ volumique) == signe(Δ affine) sur l’albédo de référence`, () => {
      const affine = apresVoileAffine(id);
      const volumique = apresLumiereVolumique(id);
      expect(sens(affine), `témoin : ${id} doit VRAIMENT déplacer l’écran en affine`).not.toBe(0);
      expect(sens(volumique), `${id} : affine ${affine.toFixed(4)} vs volumique ${volumique.toFixed(4)}`)
        .toBe(sens(affine));
    });

  it('le registre porte bien les DEUX sens — sans quoi le contrat serait vide', () => {
    const signes = TYPES.map((id) => sens(apresVoileAffine(id)));
    expect(signes, 'la donnée réelle a des météos claires ET des météos sombres').toContain(1);
    expect(signes).toContain(-1);
  });

  it('sur l’albédo de RÉFÉRENCE, l’appariement est EXACT (c’est là qu’il est posé)', () => {
    for (const id of TYPES) expect(apresLumiereVolumique(id)).toBeCloseTo(apresVoileAffine(id), 12);
  });

  it('le facteur DÉPASSE 1 pour une teinte plus claire que la scène (neige, brouillard)', () => {
    expect(weatherLightScalars(dehors('neige')).dim).toBeGreaterThan(1);
    expect(weatherLightScalars(dehors('brouillard')).dim).toBeGreaterThan(1);
    expect(weatherLightScalars(dehors('tempete')).dim).toBeLessThan(1);
    expect(weatherLightScalars(dehors('pluie')).dim).toBeLessThan(1);
  });

  it('le SENS ne dépend pas de l’albédo : un facteur multiplie tous les albédos du même côté', () => {
    for (const id of TYPES) {
      const { dim } = weatherLightScalars(dehors(id));
      for (const albedo of [0.05, 0.25, 0.5, 0.75, 1])
        expect(Math.sign(albedo * dim - albedo)).toBe(Math.sign(dim - 1));
    }
  });

  it('hors météo (beau temps, intérieur) : aucun effet, et l’objet neutre est rendu tel quel', () => {
    expect(weatherLightScalars(dehors('clair'))).toBe(METEO_SANS_EFFET);
    expect(weatherLightScalars({ weather: 'tempete', ambiance: 'interieur' })).toBe(METEO_SANS_EFFET);
    expect(METEO_SANS_EFFET.dim).toBe(1);
  });
});
