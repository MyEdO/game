import { describe, expect, it } from 'vitest';
import { wallPartDepthM, wallPartRelief, WALL_PARTS, type WallPart, type WallPartRelief } from './index';
import { structureAppearance } from './index';
import { FASCIA_THICK_M, roofFasciaThickM, roofMaterial } from '../roofs';
import { WALL_PART_KEYS, RELIEF_PART_KEYS, schema } from '../../../data/schemas/defs/structureAppearance';
import type { StructureAppearanceDef } from './types';

/** CALIBRAGE épinglé du relief mince (#1176 P1-E) — ce test garde les VALEURS, jamais la topologie :
 *  les comptes de triangles et de paires coplanaires (`worldTris.test.ts`) sont insensibles à une
 *  profondeur (une boîte reste une boîte), et laissaient donc passer une saillie ramenée à 2 cm. Toucher
 *  une profondeur, c'est toucher ce tableau — la justification voyage dans le même diff. Le calibrage
 *  lui-même (pourquoi 0,26 m) vit au commentaire de `wallPartRelief`, avec la table des biais mesurés. */
const CALIBRAGE: Record<WallPart, WallPartRelief> = {
  face: { famille: 'matiere' },
  poteau: { famille: 'matiere' },
  couronnement: { famille: 'matiere' },
  parapet: { famille: 'matiere' },
  arase: { famille: 'matiere' },
  merlon: { famille: 'matiere' },
  jambage: { famille: 'matiere' },
  panneau: { famille: 'saillie', jutM: 0.26 },
  plinthe: { famille: 'saillie', jutM: 0.26 },
  bande: { famille: 'saillie', jutM: 0.26 },
  moulure: { famille: 'saillie', jutM: 0.28 },
  chambranle: { famille: 'saillie', jutM: 0.28 },
  vantail: { famille: 'traversant', thickM: 0.17 },
  linteau: { famille: 'traversant', thickM: 0.17 },
  seuil: { famille: 'traversant', thickM: 0.17 },
  'vantail-planche': { famille: 'traversant', thickM: 0.21 },
  poignee: { famille: 'traversant', thickM: 0.28 },
  meneau: { famille: 'traversant', thickM: 0.12 },
  barreau: { famille: 'traversant', thickM: 0.1 },
  traverse: { famille: 'traversant', thickM: 0.13 },
  gravats: { famille: 'traversant', thickM: 0.6 },
  'gravats-tas': { famille: 'traversant', thickM: 0.8 },
  vitre: { famille: 'traversant', thickM: 0 },
};

/** Épaisseur (m) d'une partie traversante du catalogue. */
function thickDe(part: WallPart): number {
  const r = wallPartRelief(part);
  expect(r.famille).toBe('traversant');
  return r.famille === 'traversant' ? r.thickM : NaN;
}

describe('RELIEF MINCE — le CALIBRAGE des profondeurs, épinglé valeur par valeur', () => {
  it('les 23 parties de mur portent EXACTEMENT les profondeurs du catalogue', () => {
    expect(WALL_PARTS.length).toBe(23);
    expect(Object.fromEntries(WALL_PARTS.map((p) => [p, wallPartRelief(p)]))).toEqual(CALIBRAGE);
  });

  it('la planche de rive d’un toit suit le même calibrage que les saillies de mur', () => {
    expect(FASCIA_THICK_M).toBe(0.26);
    const juts = WALL_PARTS.map(wallPartRelief).filter((r) => r.famille === 'saillie').map((r) => r.jutM);
    expect(Math.min(...juts)).toBe(0.26);
    expect(FASCIA_THICK_M).toBeGreaterThanOrEqual(Math.min(...juts));
  });

  it('porte FERMÉE : vantail < joints de planches < bouton (le bouton traverse et saille des deux côtés)', () => {
    expect(thickDe('vantail')).toBeLessThan(thickDe('vantail-planche'));
    expect(thickDe('vantail-planche')).toBeLessThan(thickDe('poignee'));
    // Le vantail bouche l'ouverture : même épaisseur que le linteau qui la coiffe, il l'affleure.
    expect(thickDe('vantail')).toBe(thickDe('linteau'));
  });

  it('une partie de mur INCONNUE lève en se NOMMANT (jamais un TypeError au milieu de la géométrie)', () => {
    expect(() => wallPartRelief('zzz' as WallPart)).toThrowError(/partie de mur inconnue : zzz/);
    expect(() => wallPartDepthM({} as StructureAppearanceDef, 'zzz' as WallPart, 0.168)).toThrowError(/inconnue/);
  });
});

describe('RELIEF ÉDITABLE — la surcharge par apparence (et par matériau de toit) MORD', () => {
  const wallM = 0.168;
  const plain = structureAppearance('plain');

  it('`relief.jut` remplace la saillie par défaut d’une partie POSÉE (épaisseur = mur + 2 × saillie)', () => {
    expect(wallPartDepthM(plain, 'moulure', wallM)).toBeCloseTo(wallM + 2 * 0.28, 12);
    const surchargee: StructureAppearanceDef = { ...plain, relief: { jut: { moulure: 0.05 } } };
    expect(wallPartDepthM(surchargee, 'moulure', wallM)).toBeCloseTo(wallM + 2 * 0.05, 12);
    // …et SEULE la partie surchargée bouge : les voisines gardent le défaut du catalogue.
    expect(wallPartDepthM(surchargee, 'panneau', wallM)).toBeCloseTo(wallM + 2 * 0.26, 12);
  });

  it('`relief.thick` remplace l’épaisseur d’une partie TRAVERSANTE', () => {
    expect(wallPartDepthM(plain, 'gravats', wallM)).toBeCloseTo(0.6, 12);
    const surchargee: StructureAppearanceDef = { ...plain, relief: { thick: { gravats: 1.4 } } };
    expect(wallPartDepthM(surchargee, 'gravats', wallM)).toBeCloseTo(1.4, 12);
    expect(wallPartDepthM(surchargee, 'gravats-tas', wallM)).toBeCloseTo(0.8, 12);
  });

  // Défense en profondeur : le schéma REFUSE déjà une telle surcharge au chargement (test plus bas) ;
  // ce cas-ci mesure le résolveur seul, sur un objet fabriqué en mémoire.
  it('une partie qui EST la matière du mur ignore toute surcharge : son épaisseur est celle du mur', () => {
    const surchargee: StructureAppearanceDef = { ...plain, relief: { jut: { face: 9 }, thick: { face: 9 } } };
    expect(wallPartDepthM(surchargee, 'face', wallM)).toBe(wallM);
  });

  it('`fasciaThickM` d’un matériau de toit remplace l’épaisseur par défaut de la planche de rive', () => {
    const tuile = roofMaterial('tuile');
    expect(tuile.fasciaThickM).toBeUndefined(); // aucune donnée ne surcharge aujourd'hui : le défaut sert
    expect(roofFasciaThickM(tuile)).toBe(FASCIA_THICK_M);
    expect(roofFasciaThickM({ ...tuile, fasciaThickM: 0.42 })).toBe(0.42);
  });
});

describe('SCHÉMA de `structureAppearance.json` — les clés de relief sont CONTRAINTES', () => {
  /** Une entrée minimale valide, sur laquelle greffer le `relief` à éprouver. */
  const entree = (relief?: unknown) => [
    { id: 'x', type: 'structureAppearance', label: 'X', face: '#111', post: '#222', ...(relief ? { relief } : {}) },
  ];

  it('la liste de clés du schéma est la MÊME que `WALL_PARTS` (recopie gardée, cf. pureté de src/data)', () => {
    expect([...WALL_PART_KEYS]).toEqual([...WALL_PARTS]);
  });

  it('les clés de `relief` sont EXACTEMENT les parties non-`matiere` — le schéma ne promet rien d’inerte', () => {
    const surchargeables = WALL_PARTS.filter((p) => wallPartRelief(p).famille !== 'matiere');
    expect([...RELIEF_PART_KEYS]).toEqual([...surchargeables]);
    expect(RELIEF_PART_KEYS.length).toBe(16);
    // Une partie de la famille `matiere` authorée en surcharge échoue au CHARGEMENT : `wallPartDepthM`
    // rend l'épaisseur du MUR pour ces parties-là, la surcharge n'agirait sur rien.
    for (const inerte of WALL_PARTS.filter((p) => wallPartRelief(p).famille === 'matiere')) {
      expect([inerte, schema.safeParse(entree({ jut: { [inerte]: 0.3 } })).success]).toEqual([inerte, false]);
      expect([inerte, schema.safeParse(entree({ thick: { [inerte]: 0.3 } })).success]).toEqual([inerte, false]);
    }
  });

  it('la forme réelle `{ jut, thick }` par partie passe', () => {
    expect(schema.safeParse(entree({ jut: { moulure: 0.3 }, thick: { vantail: 0.2 } })).success).toBe(true);
    expect(schema.safeParse(entree({})).success).toBe(true);
    expect(schema.safeParse(entree()).success).toBe(true);
  });

  it('une clé de partie FAUTIVE échoue au chargement (elle n’est plus ignorée en silence)', () => {
    expect(schema.safeParse(entree({ jut: { mouluree: 0.3 } })).success).toBe(false);
    expect(schema.safeParse(entree({ thick: { zzz: 0.3 } })).success).toBe(false);
    expect(schema.safeParse(entree({ juts: { moulure: 0.3 } })).success).toBe(false);
    expect(schema.safeParse(entree({ jut: { moulure: 'gros' } })).success).toBe(false);
  });
});

describe('SCHÉMA de `structureAppearance.json` — le linteau du corps de garde vit dans SON bloc', () => {
  const entree = (extra: object) => [{ id: 'x', type: 'structureAppearance', label: 'X', face: '#111', post: '#222', ...extra }];

  it('`corpsDeGarde.lintelPx` est requis ; `door` ne porte pas de linteau', () => {
    expect(schema.safeParse(entree({ corpsDeGarde: { lintelPx: 4 } })).success).toBe(true);
    expect(schema.safeParse(entree({ corpsDeGarde: {} })).success).toBe(false);
    expect(schema.safeParse(entree({ door: { openingFrac: 0.5, lintelPx: 4 } })).success).toBe(false);
  });
});
