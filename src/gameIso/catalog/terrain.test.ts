import { describe, it, expect } from 'vitest';
import { terrainDef, terrainGradient, terrainGradientId, terrainStopsOrdonnes, MISSING_GRADIENT } from './terrain';
import { tousLesTerrains } from '../../noyau/monde/terrain';
import { type TerrainDef } from '../../data/terrains.types';
import { defsGlobaux, degradesDeTerrains } from '../sprites';
import { MISSING_ID, MISSING_TONE } from './missing';

describe('présentation des terrains (dégradé/aperçu dérivés du dataset)', () => {
  it('chaque terrain du dataset résout SON dégradé, dérivé de son id', () => {
    for (const t of tousLesTerrains()) expect(terrainGradient(t.id), t.id).toBe(terrainGradientId(t.id));
  });

  it('id absent du dataset → repli VISIBLE (#877), jamais l’apparence d’un terrain réel', () => {
    expect(terrainGradient('inconnu')).toBe(MISSING_GRADIENT);
    const repli = terrainDef('inconnu');
    expect(repli.id).toBe(MISSING_ID);
    expect(repli.walkable).toBe(false);
    expect(repli.priority).toBe(0);
    expect(repli.swatch).toBe(MISSING_TONE);
    expect(repli.stops).toEqual({});
    expect(tousLesTerrains().map((t) => terrainGradientId(t.id))).not.toContain(MISSING_GRADIENT);
  });

  it('defsGlobaux() émet le dégradé d’alarme du repli, prêt à peindre la case fautive', () => {
    expect(defsGlobaux()).toContain(`<linearGradient id="${MISSING_GRADIENT}"`);
    expect(defsGlobaux()).toContain(`stop-color="${MISSING_TONE}"`);
  });

  it('defsGlobaux() n’émet AUCUN id de dégradé en double — terrains, alarme et FX cohabitent sans s’éteindre', () => {
    const ids = idsDeDegrade(defsGlobaux());
    const doubles = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    expect(
      doubles,
      `defsGlobaux() émet deux fois le(s) dégradé(s) ${doubles.join(', ')} : SVG ne garde que la DERNIÈRE définition, ` +
        'et son porteur se peint aux couleurs de l’autre (le partage de rampe de #1690, réarmé).',
    ).toEqual([]);
    // Sans ce plancher, un `defsGlobaux()` vide rendrait le contrat vert sans rien mesurer.
    expect(ids.length).toBeGreaterThan(tousLesTerrains().length);
    for (const t of tousLesTerrains()) expect(ids, t.id).toContain(terrainGradientId(t.id));
  });
});

/** Ids des `<linearGradient>`/`<radialGradient>` d'un bloc de `<defs>`, dans l'ordre d'émission. */
const idsDeDegrade = (svg: string): string[] => [...svg.matchAll(/<(?:linear|radial)Gradient\s+id="([^"]+)"/g)].map((m) => m[1]);

/** Offsets des `<stop>` du dégradé `id` dans un bloc de `<defs>`, dans l'ordre d'ÉMISSION. */
const offsetsDuDegrade = (svg: string, id: string): number[] => {
  const bloc = new RegExp(`<linearGradient\\s+id="${id}"[^>]*>(.*?)</linearGradient>`, 's').exec(svg);
  return [...(bloc?.[1] ?? '').matchAll(/<stop offset="(\d+)%"/g)].map((m) => Number(m[1]));
};

describe('rampe d’un terrain — l’ordre des arrêts est celui de l’ÉMISSION', () => {
  it('les arrêts se trient par offset croissant, quel que soit l’ordre des clés du Record', () => {
    expect(terrainStopsOrdonnes({ '100%': '#ffffff', '0%': '#000000', '45%': '#808080' })).toEqual([
      ['0%', '#000000'],
      ['45%', '#808080'],
      ['100%', '#ffffff'],
    ]);
  });

  it('l’émetteur de `sprites` émet les arrêts DANS L’ORDRE — un Record écrit à l’envers ne perd aucun arrêt', () => {
    const renverse: TerrainDef = {
      id: 'renverse', type: 'terrains', label: 'Renversé', maison: 'fixture en mémoire', walkable: true,
      priority: 0, swatch: '#808080', stops: { '100%': '#ffffff', '0%': '#000000', '45%': '#808080' },
    };
    const emis = degradesDeTerrains([renverse]);
    expect(offsetsDuDegrade(emis, terrainGradientId(renverse.id))).toEqual([0, 45, 100]);
  });

  it('defsGlobaux() compose CET émetteur sur le dataset — chaque terrain y porte ses arrêts croissants', () => {
    for (const t of tousLesTerrains()) {
      const offsets = offsetsDuDegrade(defsGlobaux(), terrainGradientId(t.id));
      expect(offsets, t.id).toEqual(terrainStopsOrdonnes(t.stops).map(([off]) => Number.parseInt(off, 10)));
      expect(offsets, t.id).toEqual([...offsets].sort((a, b) => a - b));
    }
  });
});
