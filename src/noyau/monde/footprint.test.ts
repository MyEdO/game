import { describe, it, expect, afterEach } from 'vitest';
import {
  sizeFootprint,
  footprintN,
  footprintTiles,
  occupiesTile,
  footprintChebyshev,
  footprintsOverlap,
  distanceDeCombat,
  decorFootGeometry,
  propFootTiles,
} from './footprint';
import { datasetObject, setObjectDataset } from '../../data/overrides';
import { findPropById } from '../../data';
import { entityBlockedAt } from './sceneRules';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from './scene';
import { chebyshev } from '../../engine/grid';
import type { Combatant } from '../../engine/types';
import type { SizeCategory } from '../../engine/size';

const C = (x: number, y: number, size?: SizeCategory): Combatant => ({ pos: { x, y }, size }) as unknown as Combatant;

// Empreinte de grille par Taille — LDB 15 l.12 (« 2, 4 ou même plus de cases ») ne donne AUCUN barème
// par catégorie : les 7 valeurs sont MAISON, en donnée éditable (`sizes.json::footprintSide`).
describe('footprint — empreinte N×N par Taille (donnée `sizes.json::footprintSide`)', () => {
  it('côté N (défaut de donnée) : Minuscule→Moyenne 1, Grande 2, Énorme 3, Monstrueuse 4', () => {
    expect(sizeFootprint('minuscule')).toBe(1);
    expect(sizeFootprint('moyenne')).toBe(1);
    expect(sizeFootprint(undefined)).toBe(1); // défaut Moyenne
    expect(sizeFootprint('grande')).toBe(2); // = les « 4 cases » du texte canon
    expect(sizeFootprint('enorme')).toBe(3);
    expect(sizeFootprint('monstrueuse')).toBe(4);
  });

  it('footprintN : empreinte autorée (NAVIRE) ⊥ Taille créature — `footprint` prime sur `size`', () => {
    expect(footprintN({ size: 'grande' })).toBe(2); // dérivée de la Taille créature
    expect(footprintN({})).toBe(1); // défaut Moyenne
    expect(footprintN({ footprint: 3 })).toBe(3); // empreinte AUTORÉE (un navire) — SANS Taille créature
    expect(footprintN({ size: 'monstrueuse', footprint: 2 })).toBe(2); // `footprint` explicite prime sur `size`
  });

  // CÂBLAGE : la barre vit dans `sizes.json` (éditable au Codex, catégorie « Tailles ») — l'éditer
  // change l'empreinte réellement occupée sur la grille (tuiles couvertes comprises).
  describe('câblage donnée → géométrie', () => {
    const seed = structuredClone(datasetObject('sizes'));
    afterEach(() => setObjectDataset('sizes', structuredClone(seed)));

    it('porter Grande à 5 dans sizes.json rend une créature Grande 5×5 (côté ET tuiles occupées)', () => {
      const s = structuredClone(datasetObject('sizes'));
      s.footprintSide.grande = 5;
      setObjectDataset('sizes', s);
      expect(sizeFootprint('grande')).toBe(5);
      expect(footprintN({ size: 'grande' })).toBe(5);
      expect(footprintTiles({ x: 0, y: 0 }, sizeFootprint('grande'))).toHaveLength(25);
    });

    it('ramener Monstrueuse à 1 la rend 1×1 (aucune valeur en dur dans le code)', () => {
      const s = structuredClone(datasetObject('sizes'));
      s.footprintSide.monstrueuse = 1;
      setObjectDataset('sizes', s);
      expect(sizeFootprint('monstrueuse')).toBe(1);
    });
  });

  it('footprintTiles : côté 1 = la tuile ; côté 2 = bloc 2×2 ancré au coin NO', () => {
    expect(footprintTiles({ x: 3, y: 7 }, 1)).toEqual([{ x: 3, y: 7 }]);
    expect(footprintTiles({ x: 5, y: 5 }, 2)).toEqual([
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 },
    ]);
    expect(footprintTiles({ x: 0, y: 0 }, 3)).toHaveLength(9);
    expect(footprintTiles({ x: 0, y: 0 }, 4)).toHaveLength(16);
  });

  it('occupiesTile : couvre les N×N tuiles à partir du coin NO', () => {
    const p = { x: 5, y: 5 };
    expect(occupiesTile(p, 2, 6, 6)).toBe(true);
    expect(occupiesTile(p, 2, 5, 5)).toBe(true);
    expect(occupiesTile(p, 2, 7, 5)).toBe(false); // hors du 2×2
    expect(occupiesTile(p, 1, 6, 5)).toBe(false);
  });

  it('footprintChebyshev coïncide avec chebyshev pour deux empreintes 1×1', () => {
    const a = { x: 2, y: 3 }, b = { x: 6, y: 5 };
    expect(footprintChebyshev(a, 1, b, 1)).toBe(chebyshev(a, b));
  });

  it('adjacence par empreinte : un bloc 2×2 est « au contact » si UNE tuile touche la cible', () => {
    const big = { x: 5, y: 5 }; // occupe 5..6 × 5..6
    expect(footprintChebyshev(big, 2, { x: 7, y: 6 }, 1)).toBe(1); // colle au bord est → distance 1 (adjacent)
    expect(footprintChebyshev(big, 2, { x: 8, y: 6 }, 1)).toBe(2); // une tuile de marge → distance 2
    expect(footprintChebyshev(big, 2, { x: 6, y: 6 }, 1)).toBe(0); // dans l'empreinte → 0 (chevauchement)
  });

  it('footprintsOverlap : détecte la collision de placement', () => {
    expect(footprintsOverlap({ x: 5, y: 5 }, 2, { x: 6, y: 6 }, 1)).toBe(true);
    expect(footprintsOverlap({ x: 5, y: 5 }, 2, { x: 7, y: 7 }, 1)).toBe(false);
  });

  it('distanceDeCombat : coïncide avec chebyshev pour le 1×1, mais un grand est au contact par son bord', () => {
    expect(distanceDeCombat(C(0, 0), C(3, 0))).toBe(3); // deux 1×1 → identique à chebyshev
    expect(distanceDeCombat(C(5, 5, 'grande'), C(7, 6))).toBe(1); // 2×2 adjacent au bord est
    expect(distanceDeCombat(C(5, 5, 'grande'), C(8, 6))).toBe(2); // une tuile de marge
    expect(distanceDeCombat(C(0, 0), {} as Combatant)).toBe(Infinity); // cible non posée
  });
});

describe('propFootTiles — l’empreinte d’un décor vient du CATALOGUE', () => {
  /** L'échelle des scènes de ce fichier — LUE, jamais redite : `emptyScene` ne pose pas de
   *  `metresPerTile`, donc c'est le défaut du monde (`LDB 15 l.12`) qui s'applique. */
  const MPT = sceneMetresPerTile(emptyScene('scene-test', 4, 4));

  it('cases couvertes : le rectangle du corps ancré au coin NO ; la seule case pour une ref hors catalogue', () => {
    expect(propFootTiles('abreuvoir', { x: 3, y: 2 }, 'S', MPT)).toEqual([{ x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(propFootTiles('tente', { x: 0, y: 0 }, 'S', MPT)).toHaveLength(4);
    expect(propFootTiles('tonneau', { x: 7, y: 1 }, 'S', MPT)).toEqual([{ x: 7, y: 1 }]);
    expect(propFootTiles('decor-hors-catalogue', { x: 7, y: 1 }, 'S', MPT)).toEqual([{ x: 7, y: 1 }]);
    expect(propFootTiles(undefined, { x: 7, y: 1 }, 'S', MPT)).toEqual([{ x: 7, y: 1 }]);
  });

  /**
   * L'EMPREINTE TOURNE AVEC LE CAP pour un décor à RECETTE (#1509) : ses cases sont celles de son
   * CORPS tourné. `table-2x1` est la première recette multi-case du catalogue — 2×1 aux caps N/S,
   * 1×2 aux caps E/O.
   */
  it('un décor à RECETTE couvre les cases de son corps tourné (table-2x1 : 2×1 en N/S, 1×2 en E/O)', () => {
    expect(propFootTiles('table-2x1', { x: 3, y: 2 }, 'S', MPT)).toEqual([{ x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(propFootTiles('table-2x1', { x: 3, y: 2 }, 'N', MPT)).toEqual([{ x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(propFootTiles('table-2x1', { x: 3, y: 2 }, 'E', MPT)).toEqual([{ x: 3, y: 2 }, { x: 3, y: 3 }]);
    expect(propFootTiles('table-2x1', { x: 3, y: 2 }, 'O', MPT)).toEqual([{ x: 3, y: 2 }, { x: 3, y: 3 }]);
  });

  /**
   * L'ÉTENDUE N'EST PAS LA PORTE. La dérivation (#1509) alimente les CASES d'un décor ; ce qui décide
   * qu'un décor BLOQUE reste `entityBlockedAt` (`sceneRules.ts`) : interaction ou solidité. Ces
   * quatre recettes ne sont pas `solid` — elles ne doivent PAS se mettre à murer
   * leur case du seul fait que leur corps a désormais une empreinte. Liste NOMINATIVE : un
   * cinquième décor de cette famille se déclare ici, ou il passe sans preuve.
   */
  const TRAVERSABLES_A_RECETTE = ['cheminee', 'enseigne', 'clocheton', 'applique-murale'] as const;

  it.each(TRAVERSABLES_A_RECETTE)('%s : recette NON solide — sa case reste traversable', (ref) => {
    expect(findPropById(ref)?.solid, `${ref} est solide : ce contrat mesurerait autre chose`).toBeFalsy();
    const scene: Scene = { ...emptyScene('scene-test', 8, 8), entities: [{ id: 'd-1', kind: 'prop', decor: { id: ref }, pos: { x: 3, y: 3 } }] as SceneEntity[] };
    expect(entityBlockedAt(scene, 3, 3, 0)).toBe(false);
  });

  it('témoin : un décor à recette SOLIDE, lui, bloque bien sa case (sans quoi le contrat ci-dessus passerait sur du vide)', () => {
    const scene: Scene = { ...emptyScene('scene-test', 8, 8), entities: [{ id: 'd-1', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 3, y: 3 } }] as SceneEntity[] };
    expect(entityBlockedAt(scene, 3, 3, 0)).toBe(true);
  });
});

describe('decorFootGeometry — empreinte rectangulaire des décors (`PropData.foot`)', () => {
  it('absent ou 1×1 → identité (le décor historique ne bouge pas)', () => {
    expect(decorFootGeometry(undefined)).toEqual({ offX: 0, offY: 0, sx: 1, sy: 1, scale: 1 });
    expect(decorFootGeometry({ w: 1, h: 1 })).toEqual({ offX: 0, offY: 0, sx: 1, sy: 1, scale: 1 });
  });
  it('tente 2×2 → centre du bloc (+0.5,+0.5), échelle ×2', () => {
    expect(decorFootGeometry({ w: 2, h: 2 })).toEqual({ offX: 0.5, offY: 0.5, sx: 2, sy: 2, scale: 2 });
  });
  /**
   * DEUX grandeurs, deux emplois (#1509 L9′) : `sx`/`sy` est l'étendue AXE PAR AXE — ce que suit toute
   * figure posée au sol sur l'empreinte (le halo d'interaction) — quand `scale` reste l'échelle du
   * DESSIN, isotrope, celle d'une vignette de billboard qui s'agrandit sans se déformer.
   */
  it('tribune 3×1 → centre (+1,0), étendue 3×1, échelle de dessin = côté max (×3)', () => {
    expect(decorFootGeometry({ w: 3, h: 1 })).toEqual({ offX: 1, offY: 0, sx: 3, sy: 1, scale: 3 });
  });
  it('table murale 1×2 → l’étendue distingue les axes là où l’échelle de dessin les confond', () => {
    expect(decorFootGeometry({ w: 1, h: 2 })).toEqual({ offX: 0, offY: 0.5, sx: 1, sy: 2, scale: 2 });
  });
  it('valeurs dégénérées (0/négatives) ramenées à 1', () => {
    expect(decorFootGeometry({ w: 0, h: -2 })).toEqual({ offX: 0, offY: 0, sx: 1, sy: 1, scale: 1 });
  });
});
