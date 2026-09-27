/**
 * CONTRAT des defs de TÊTE quadrupèdes (#1082) : exhaustivité des vues, couverture des espèces,
 * axes DÉCLARÉS mesurés à l'exécution (design v2 §1 : « le socle ÉCHOUE si un axe consommé n'est pas
 * déclaré »), et repli VISIBLE d'une clé sans def (#223).
 */
import { describe, it, expect, vi } from 'vitest';
import { QUAD_HEADS, quadHeadDef, quadHeadBone } from './index';
import { quadArt } from '../partArt';
import { quadParts } from '../quadParts';
import { consumedAxes, witnessesOf } from '../axis-fuzz.fixture';
import type { QuadHeadDef } from './types';
import type { QuadArt } from '../partArt';
import { QUAD_SPECIES, WINGED_SPECIES } from '../../creatures';
import { MISSING_TONE } from '../../viewArt';
import type { QuadProps } from '../quadSkeleton';
import { VIEWS, type View } from '../../facing';
const SPECIES: Record<string, QuadProps> = { ...QUAD_SPECIES, ...WINGED_SPECIES };

/** Props d'une espèce qui PORTE cette tête (l'art se juge sur la donnée réelle qui l'appelle). */
const witness = (key: string): QuadProps => witnessesOf(SPECIES, 'head', key)[0];

/** Vue où le socle CONSULTE chaque canal de forme d'une def de tête. */
const CHANNEL_VIEW: Record<'bodyHi' | 'chestCrest', View> = { bodyHi: 'profile', chestCrest: 'front' };
const CHANNELS = Object.keys(CHANNEL_VIEW) as (keyof typeof CHANNEL_VIEW)[];
/** SVG complet d'une espèce pour une vue, tous os confondus. */
const builtSvg = (p: QuadProps, view: View): string =>
  Object.values(quadParts(p, view, 'folded')).flat().map((l) => l.svg).join('');

/** Canaux d'art d'une def, nommés (les optionnels sont sautés quand absents). */
const channels = (d: QuadHeadDef): [string, QuadArt][] => [
  ...VIEWS.map((v) => [`art.${v}`, d.art[v]] as [string, QuadArt]),
  ...(['bodyHi', 'ridge', 'chestCrest'] as const)
    .filter((k) => d[k] != null)
    .map((k) => [k, d[k] as QuadArt] as [string, QuadArt]),
];

describe('defs de tête quadrupèdes : contrat de vues, d\'axes et de repli', () => {
  it('chaque clé de tête portée par une espèce a sa def enregistrée', () => {
    for (const [id, p] of Object.entries(SPECIES))
      expect(QUAD_HEADS[p.head], `espèce ${id} : tête « ${p.head} » sans def`).toBeDefined();
  });

  it('les TROIS vues sont déclarées et rendent un art non vide', () => {
    for (const d of Object.values(QUAD_HEADS)) {
      const p = witness(d.key);
      for (const v of VIEWS)
        expect(quadArt(d.art[v], p), `${d.key} / ${v}`).not.toBe('');
    }
  });

  it('le binding par vue est un os du gabarit : `tete` par défaut, `encolure` pour les clusters', () => {
    const clusters = Object.values(QUAD_HEADS).filter((d) => quadHeadBone(d, 'profile') === 'encolure');
    expect(clusters.map((d) => d.key).sort()).toEqual(['chimere', 'dechiqueteur', 'hydre']);
    for (const d of Object.values(QUAD_HEADS)) {
      expect(quadHeadBone(d, 'front')).toBe('tete');
      expect(quadHeadBone(d, 'back')).toBe('tete');
    }
  });

  it('axes DÉCLARÉS = axes CONSOMMÉS (kit compris — TOUS les témoins × produit des valeurs déclarées)', () => {
    for (const d of Object.values(QUAD_HEADS)) {
      const declared = [...new Set<string>(d.params ?? [])].sort();
      const { used, missingDomain } = consumedAxes(
        channels(d).map(([, art]) => art), witnessesOf(SPECIES, 'head', d.key), declared,
      );
      expect(missingDomain, `${d.key} : axe déclaré sans domaine de fuzz (AXIS_FUZZ)`).toEqual([]);
      expect(used, `${d.key} : axes consommés non déclarés`).toEqual(declared);
    }
  });

  it('canal DÉCLARÉ = canal PEINT : aucun canal de forme n\'est de l\'art mort', () => {
    // Un canal de forme (`bodyHi`/`chestCrest`) n'est consulté que par certaines
    // carrures du socle. Déclaré par une def dont AUCUNE espèce porteuse ne passe par ce chemin,
    // il serait de l'art committé que rien ne rend — invisible aux gardes de contenu, qui
    // n'éprouvent que la def.
    const declares: string[] = [];
    for (const d of Object.values(QUAD_HEADS))
      for (const ch of CHANNELS) {
        if (d[ch] == null) continue;
        declares.push(`${d.key}.${ch}`);
        const peint = witnessesOf(SPECIES, 'head', d.key)
          .filter((p) => builtSvg(p, CHANNEL_VIEW[ch]).includes(quadArt(d[ch], p)));
        expect(peint.map((p) => p.build), `${d.key}.${ch} : canal MORT — aucune espèce porteuse ne le peint`)
          .not.toEqual([]);
      }
    expect(declares.length, 'aucun canal de forme déclaré : la garde ne mesure plus rien').toBeGreaterThan(0);
  });

  it('les couples (canal, espèce porteuse) où le canal reste DORMANT sont un stock GELÉ et nominatif', () => {
    // Une même clé de tête est portée par des espèces de CARRURES différentes (le chien reprend la
    // tête d'ours sur un corps `feline`) : le canal que sa def déclare n'est alors pas consulté
    // pour cette espèce-là. Le stock est énuméré ici, en ÉGALITÉ exacte — une dormance NEUVE
    // échoue, une dormance soldée aussi (le stock se met à jour dans le geste qui la solde).
    const dormants: string[] = [];
    for (const [id, p] of Object.entries(SPECIES)) {
      const d = QUAD_HEADS[p.head];
      for (const ch of CHANNELS)
        if (d?.[ch] != null && !builtSvg(p, CHANNEL_VIEW[ch]).includes(quadArt(d[ch], p)))
          dormants.push(`${d.key}.${ch}@${id} (build ${p.build})`);
    }
    expect(dormants.sort()).toEqual(['ours.bodyHi@chien (build feline)']);
  });

  it('une clé SANS def rend la silhouette de REPLI VISIBLE + un avertissement (jamais un vide silencieux)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = quadHeadDef('espece-de-tete-inconnue-xyz');
    for (const v of VIEWS) expect(quadArt(d.art[v], witness('cheval'))).toContain(MISSING_TONE);
    if (import.meta.env?.DEV) expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
