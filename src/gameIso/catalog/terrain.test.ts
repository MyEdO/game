import { describe, it, expect, afterEach } from 'vitest';
import { terrainGradient, terrainGradientId, MISSING_GRADIENT } from './terrain';
import { terrainDef } from '../../noyau/monde/volume/matieres';
import { tousLesTerrains, terrainEntree, terrainWalkable, terrainStopsOrdonnes } from '../../noyau/monde/terrain';
import { setDataset } from '../../data/overrides';
import { type TerrainDef } from '../../data';
import type { EntreeVivante } from '../../data/datasets';
import { defsGlobaux, degradesDeTerrains } from '../sprites';
import { MISSING_ID, MISSING_TONE } from '../../noyau/monde/volume/missing';

const AVANT = tousLesTerrains().map((t) => ({ ...t }));
afterEach(() => setDataset('terrains', AVANT as never));

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
  it('l’émetteur de `sprites` émet les arrêts DANS L’ORDRE — un Record écrit à l’envers ne perd aucun arrêt', () => {
    const renverse: EntreeVivante<TerrainDef> = {
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

describe('terrains — la façade et le catalogue de rendu lisent VIVANT', () => {
  it('une entrée éditée est vue par la façade ET par le catalogue, sans rechargement', () => {
    const editees = AVANT.map((t) => {
      if (t.id === 'herbe') return { ...t, walkable: false };
      if (t.id === 'eau') return { ...t, swatch: '#0d0d0d' };
      return t;
    });
    expect(terrainWalkable('herbe')).toBe(true);
    expect(terrainDef('eau').swatch).not.toBe('#0d0d0d');
    setDataset('terrains', editees as never);
    expect(terrainWalkable('herbe'), 'la façade a servi un index PÉRIMÉ').toBe(false);
    expect(terrainDef('eau').swatch, 'le catalogue de rendu a servi un index PÉRIMÉ').toBe('#0d0d0d');
  });

  // Ce que ce test mesure : `defsGlobaux()` ré-émet la rampe ÉDITÉE (l'émetteur relit le dataset, il
  // ne sert pas une chaîne assemblée à l'import). Ce que MONTE ce SVG dans le document est un autre
  // fait, prouvé à l'écran par la recette navigateur (#1690 lot 3, étape 5).
  it('`defsGlobaux()` ré-émet la rampe éditée (l’émetteur relit le dataset, sans rechargement)', () => {
    const neuf = '#123456';
    expect(defsGlobaux(), 'la rampe de test existait déjà').not.toContain(`stop-color="${neuf}"`);
    const avantEdition = defsGlobaux();
    setDataset('terrains', AVANT.map((t) => (t.id === 'herbe' ? { ...t, stops: { '0%': neuf, '100%': neuf } } : t)) as never);
    const apres = defsGlobaux();
    expect(apres, 'les `<defs>` ont été assemblés UNE fois au chargement').not.toBe(avantEdition);
    expect(apres).toContain(`<linearGradient id="g_herbe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${neuf}"/>`);
    // Les dégradés des AUTRES terrains et ceux des FX traversent l'édition intacts.
    expect(apres).toContain(`<linearGradient id="g_bois"`);
    expect(apres).toContain(MISSING_GRADIENT);
  });
});

describe('terrains — dégradés SVG dérivés, jamais partagés', () => {
  it('l’id de dégradé se DÉRIVE de l’id du terrain : deux terrains n’en partagent aucun', () => {
    const ids = tousLesTerrains().map((t) => terrainGradientId(t.id));
    expect(new Set(ids).size, 'deux terrains au même dégradé').toBe(ids.length);
    expect(terrainGradient('herbe')).toBe('g_herbe');
    expect(terrainGradient('bois')).toBe('g_bois');
  });

  it('defsGlobaux() émet UN dégradé par terrain, avec SES arrêts — l’herbe garde ses couleurs', () => {
    for (const t of tousLesTerrains()) {
      expect(defsGlobaux(), t.id).toContain(`<linearGradient id="${terrainGradientId(t.id)}"`);
      for (const [off, color] of Object.entries(t.stops)) {
        expect(off, `${t.id}: offset`).toMatch(/^(?:100|[0-9]{1,2})%$/);
        expect(color, `${t.id}: couleur`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    const herbe = terrainEntree('herbe')!;
    const bois = terrainEntree('bois')!;
    expect(herbe.stops['0%']).not.toBe(bois.stops['0%']);
    expect(defsGlobaux()).toContain(`<linearGradient id="g_herbe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${herbe.stops['0%']}"/>`);
    expect(defsGlobaux()).toContain(`<linearGradient id="g_bois" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${bois.stops['0%']}"/>`);
  });

  it('aucun terrain ne dérive vers le dégradé de REPLI VISIBLE (#877)', () => {
    expect(tousLesTerrains().map((t) => terrainGradientId(t.id))).not.toContain(MISSING_GRADIENT);
  });
});
