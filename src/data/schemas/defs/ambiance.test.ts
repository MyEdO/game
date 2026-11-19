/**
 * `fogTint` est une DONNÉE éditable qui pilote les trois rendus (couleur de sommet three, `brightness`
 * du voile iso, lumière d'ambiance POV) : le schéma doit refuser AU CHARGEMENT toute valeur qui casse
 * la politique — hors de [0,1], ordre inversé, ou `explored` nul (dénominateur du cran POV).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './ambiance';
import ambianceJson from '../../ambiance.json';

const BON = { visible: 1, explored: 0.42, unknown: 0.15 };
const avec = (fogTint: Record<string, number>) => ({ ...ambianceJson, fogTint });

describe('ambiance.json — `fogTint` est borné et ORDONNÉ', () => {
  it('la donnée réelle passe (et le témoin de ce fichier EST la donnée réelle)', () => {
    expect(schema.safeParse(ambianceJson).success).toBe(true);
    expect(schema.safeParse(avec(BON)).success).toBe(true);
    expect(ambianceJson.fogTint).toEqual(BON);
  });

  const refuses: [string, Record<string, number>][] = [
    ['`explored` nul — le cran POV `unknown` y divise (→ Infinity)', { visible: 1, explored: 0, unknown: 0.15 }],
    ['ordre inversé — jamais-vu plus lumineux que le souvenir', { visible: 1, explored: 0.42, unknown: 0.9 }],
    ['facteur négatif', { visible: 1, explored: 0.42, unknown: -0.1 }],
    ['facteur > 1 — une teinte sur-expose au lieu d’éclaircir', { visible: 1, explored: 1.4, unknown: 0.15 }],
    ['`visible` hors de [0,1]', { visible: 1.2, explored: 0.42, unknown: 0.15 }],
  ];
  for (const [cas, fogTint] of refuses)
    it(`REFUSÉ : ${cas}`, () => {
      expect(schema.safeParse(avec(fogTint)).success).toBe(false);
    });

  it('un souvenir plus lumineux que le vu est refusé par le MÊME ordre', () => {
    expect(schema.safeParse(avec({ visible: 0.3, explored: 0.42, unknown: 0.15 })).success).toBe(false);
  });

  it('le message d’erreur DIT la règle (un auteur doit savoir quoi corriger)', () => {
    const inverse = schema.safeParse(avec({ visible: 1, explored: 0.42, unknown: 0.9 }));
    expect(inverse.success).toBe(false);
    if (!inverse.success) expect(inverse.error.issues.map((i) => i.message).join('\n')).toContain('visible ≥ explored ≥ unknown');
    const nul = schema.safeParse(avec({ visible: 1, explored: 0, unknown: 0.15 }));
    expect(nul.success).toBe(false);
    if (!nul.success) expect(nul.error.issues.map((i) => i.message).join('\n')).toContain('doit être > 0');
  });
});

/**
 * `weather[].precip` (#1176 P2-6) — la PRÉCIPITATION MONDE est une donnée éditable qui pilote un
 * semis de milliers d'instances par frame : le schéma doit refuser AU CHARGEMENT ce qui ne tombe pas
 * (vitesse nulle ou négative), ce qui noie la frame (densité), et ce qui n'est pas une couleur.
 */
const avecPrecip = (precip: unknown) => {
  const base = ambianceJson;
  return {
    ...base,
    iso: { ...base.iso, weather: { ...base.iso.weather, pluie: { ...base.iso.weather.pluie, precip } } },
  };
};
const PRECIP_BON = {
  density: 0.3, fallMs: 9, windMs: { x: 1.2, z: 0.5 },
  widthM: 0.03, lengthM: 0.45, ceilingM: 9, color: '#aebfd0', opacity: 0.45,
};

describe('ambiance.json — `weather[].precip` est borné (#1176 P2-6)', () => {
  it('la donnée réelle passe, et le témoin de ce fichier EST la donnée réelle', () => {
    expect(schema.safeParse(ambianceJson).success).toBe(true);
    expect(schema.safeParse(avecPrecip(PRECIP_BON)).success).toBe(true);
    expect(ambianceJson.iso.weather.pluie.precip)
      .toEqual(PRECIP_BON);
  });

  it('un type SANS précipitation reste valide — le brouillard ne tombe pas', () => {
    expect(schema.safeParse(avecPrecip(undefined)).success).toBe(true);
  });

  const refuses: [string, Record<string, unknown>][] = [
    ['densité NÉGATIVE — un semis à l’envers', { ...PRECIP_BON, density: -0.2 }],
    ['densité NULLE — une météo qui ne montre rien s’écrit `clair`, pas `density: 0`', { ...PRECIP_BON, density: 0 }],
    ['densité hors budget — des dizaines de milliers de quads par frame', { ...PRECIP_BON, density: 12 }],
    ['vitesse de chute nulle — la précipitation reste suspendue', { ...PRECIP_BON, fallMs: 0 }],
    ['vitesse de chute négative — il pleut vers le haut', { ...PRECIP_BON, fallMs: -9 }],
    ['plafond nul — aucun volume où semer', { ...PRECIP_BON, ceilingM: 0 }],
    ['opacité > 1', { ...PRECIP_BON, opacity: 1.4 }],
    ['couleur qui n’en est pas une', { ...PRECIP_BON, color: 'bleu-gris' }],
    ['particule plus LARGE que longue', { ...PRECIP_BON, widthM: 0.9, lengthM: 0.4 }],
    ['vent PLUS FORT que la chute — la pluie file à l’horizontale', { ...PRECIP_BON, windMs: { x: 20, z: 0 } }],
    ['champ inconnu (frappe de l’auteur)', { ...PRECIP_BON, vitesse: 9 }],
  ];
  for (const [cas, precip] of refuses)
    it(`REFUSÉ : ${cas}`, () => {
      expect(schema.safeParse(avecPrecip(precip)).success).toBe(false);
    });

  it('le message d’erreur DIT la règle', () => {
    const penche = schema.safeParse(avecPrecip({ ...PRECIP_BON, windMs: { x: 20, z: 0 } }));
    expect(penche.success).toBe(false);
    if (!penche.success) expect(penche.error.issues.map((i) => i.message).join('\n')).toContain('SOUS la vitesse de chute');
    const large = schema.safeParse(avecPrecip({ ...PRECIP_BON, widthM: 0.9, lengthM: 0.4 }));
    expect(large.success).toBe(false);
    if (!large.success) expect(large.error.issues.map((i) => i.message).join('\n')).toContain('`lengthM` ≥ `widthM`');
  });
});

/**
 * `weather[].brume` (#1247) — les NAPPES de brume volumique. Le schéma doit refuser au CHARGEMENT ce
 * qui ne se trie pas (deux nappes à la même cote), ce qui ne se voit pas (alpha nul), ce qui noie la
 * frame (plus de quatre nappes) et ce qui ferme le POV (resserrement nul ou > 1).
 */
const avecBrume = (brume: unknown) => {
  const base = ambianceJson;
  return {
    ...base,
    iso: { ...base.iso, weather: { ...base.iso.weather, brouillard: { ...base.iso.weather.brouillard, brume } } },
  };
};
const BRUME_BONNE = {
  color: '#aab4bd',
  layers: [{ hM: 0.6, alpha: 0.3 }, { hM: 2.2, alpha: 0.22 }, { hM: 4.5, alpha: 0.14 }],
  povTightenK: 0.45,
};

describe('ambiance.json — `weather[].brume` est bornée (#1247)', () => {
  it('la donnée réelle passe, et le témoin de ce fichier EST la donnée réelle', () => {
    expect(schema.safeParse(ambianceJson).success).toBe(true);
    expect(ambianceJson.iso.weather.brouillard.brume)
      .toEqual(BRUME_BONNE);
  });

  it('un type SANS brume reste valide — la pluie n’en pose aucune', () => {
    expect(schema.safeParse(avecBrume(undefined)).success).toBe(true);
  });

  const refuses: [string, Record<string, unknown>][] = [
    ['cotes NON croissantes — deux nappes qui se croisent ne se trient pas', { ...BRUME_BONNE, layers: [{ hM: 2, alpha: 0.2 }, { hM: 1, alpha: 0.2 }] }],
    ['deux nappes à la MÊME cote', { ...BRUME_BONNE, layers: [{ hM: 2, alpha: 0.2 }, { hM: 2, alpha: 0.1 }] }],
    ['alpha nul — une nappe invisible se supprime, elle ne s’écrit pas', { ...BRUME_BONNE, layers: [{ hM: 1, alpha: 0 }] }],
    ['alpha > 1', { ...BRUME_BONNE, layers: [{ hM: 1, alpha: 1.2 }] }],
    ['aucune nappe — une brume sans nappe ne se montre pas', { ...BRUME_BONNE, layers: [] }],
    ['cinq nappes — au-delà de quatre, c’est un voile plein', {
      ...BRUME_BONNE,
      layers: [1, 2, 3, 4, 5].map((h) => ({ hM: h, alpha: 0.1 })),
    }],
    ['couleur qui n’en est pas une', { ...BRUME_BONNE, color: 'gris' }],
    ['resserrement POV nul — la vue se ferme au nez du joueur', { ...BRUME_BONNE, povTightenK: 0 }],
    ['resserrement POV > 1 — une météo n’ALLONGE pas la portée du milieu', { ...BRUME_BONNE, povTightenK: 1.5 }],
    ['champ inconnu (frappe de l’auteur)', { ...BRUME_BONNE, epaisseur: 3 }],
  ];
  for (const [cas, brume] of refuses)
    it(`REFUSÉ : ${cas}`, () => {
      expect(schema.safeParse(avecBrume(brume)).success).toBe(false);
    });

  it('le message d’erreur DIT la règle', () => {
    const desordre = schema.safeParse(avecBrume({ ...BRUME_BONNE, layers: [{ hM: 2, alpha: 0.2 }, { hM: 1, alpha: 0.2 }] }));
    expect(desordre.success).toBe(false);
    if (!desordre.success) expect(desordre.error.issues.map((i) => i.message).join('\n')).toContain('croître STRICTEMENT');
  });
});

/**
 * `faceShade` (#1300) — le MODELÉ DE FORME de la voie volumique, en donnée. Le schéma doit refuser au
 * CHARGEMENT ce qui rend le modelé faux plutôt qu'étrange : une paire cycliquement ADJACENTE jumelle
 * (l'angle qu'elles forment cesse de se lire — le défaut même que ce bloc corrige), un contraste qui
 * enfonce la famille la plus sombre sous le plancher de luminance, un facteur qui ÉCLAIRE au lieu de
 * retirer, et un cycle qui n'a pas ses quatre directions.
 */
const avecFaceShade = (faceShade: unknown) => ({ ...ambianceJson, faceShade });
const SHADE_BON = { haut: 1, verticales: [0.95, 0.86, 0.7, 0.58], bas: 0.55 };

describe('ambiance.json — `faceShade` est borné et SÉPARE les familles adjacentes (#1300)', () => {
  it('la donnée réelle passe, et le témoin de ce fichier EST la donnée réelle', () => {
    expect(schema.safeParse(ambianceJson).success).toBe(true);
    expect(ambianceJson.faceShade).toEqual(SHADE_BON);
  });

  const refuses: [string, Record<string, unknown>][] = [
    ['deux familles cycliquement ADJACENTES jumelles — leur angle ne se lit plus', { ...SHADE_BON, verticales: [0.95, 0.9, 0.9, 0.61] }],
    ['la première verticale ÉGALE à l’horizontale — le sol et le mur −z rendent la même valeur, l’arête de plinthe disparaît', { ...SHADE_BON, verticales: [1, 0.9, 0.73, 0.61] }],
    ['le BOUCLAGE du cycle jumelé — la quatrième et la première sont adjacentes elles aussi', { ...SHADE_BON, verticales: [0.9, 0.8, 0.7, 0.9] }],
    ['cycle NON monotone — l’ordre de la grille ne se lit plus comme une rotation', { ...SHADE_BON, verticales: [0.9, 0.61, 0.73, 1] }],
    ['contraste trop fort — la famille la plus sombre passe sous le plancher de luminance', { ...SHADE_BON, verticales: [1, 0.8, 0.6, 0.4] }],
    ['un facteur qui ÉCLAIRE (> 1) — le modelé retire de la lumière, il n’en ajoute pas', { ...SHADE_BON, verticales: [1.3, 1, 0.8, 0.7] }],
    ['un facteur NUL — une face noire n’est pas un modelé', { ...SHADE_BON, bas: 0 }],
    ['trois verticales — le cycle de la grille en a quatre', { ...SHADE_BON, verticales: [1, 0.9, 0.73] }],
    ['cinq verticales', { ...SHADE_BON, verticales: [1, 0.9, 0.8, 0.7, 0.6] }],
    ['horizontale haute hors bornes', { ...SHADE_BON, haut: 1.2 }],
    ['champ inconnu (frappe de l’auteur)', { ...SHADE_BON, plafond: 0.5 }],
  ];
  for (const [cas, faceShade] of refuses)
    it(`REFUSÉ : ${cas}`, () => {
      expect(schema.safeParse(avecFaceShade(faceShade)).success).toBe(false);
    });

  it('le message d’erreur DIT la règle', () => {
    const jumelles = schema.safeParse(avecFaceShade({ ...SHADE_BON, verticales: [0.95, 0.9, 0.9, 0.61] }));
    expect(jumelles.success).toBe(false);
    if (!jumelles.success)
      expect(jumelles.error.issues.map((i) => i.message).join('\n')).toContain('cycliquement adjacentes');
  });
});

/**
 * `entreeEnScene` (#1372) — le RAYON et le PLAFOND du voile de chargement sont une donnée éditable
 * qui décide de ce que le joueur voit à l'ouverture d'une carte : un rayon nul ouvre la scène sur des
 * quads nus, un plafond nul aussi, et un plafond démesuré laisse l'écran voilé sur un SVG en panne.
 * Le schéma doit refuser ces quatre-là AU CHARGEMENT.
 */
const avecEntree = (entreeEnScene: unknown) => ({ ...ambianceJson, entreeEnScene });
const ENTREE_BON = { rayonM: 12, plafondMs: 2000 };

describe('ambiance.json — `entreeEnScene` est borné (#1372)', () => {
  it('la donnée réelle passe, et le témoin de ce fichier EST la donnée réelle', () => {
    expect(schema.safeParse(ambianceJson).success).toBe(true);
    expect(ambianceJson.entreeEnScene).toEqual(ENTREE_BON);
  });

  const refuses: [string, Record<string, unknown>][] = [
    ['rayon NUL — aucun sujet n’est « proche », la scène s’ouvre sur des quads nus', { ...ENTREE_BON, rayonM: 0 }],
    ['rayon négatif', { ...ENTREE_BON, rayonM: -3 }],
    ['rayon démesuré — le voile attend la carte entière, il n’y a plus de progressif', { ...ENTREE_BON, rayonM: 400 }],
    ['plafond NUL — le voile tombe avant la première texture', { ...ENTREE_BON, plafondMs: 0 }],
    ['plafond négatif', { ...ENTREE_BON, plafondMs: -1 }],
    ['plafond démesuré — ce n’est plus une borne de sécurité', { ...ENTREE_BON, plafondMs: 60000 }],
    ['rayon absent', { plafondMs: 2000 }],
    ['plafond absent', { rayonM: 12 }],
    ['champ inconnu (frappe de l’auteur)', { ...ENTREE_BON, rayonCases: 8 }],
  ];
  for (const [cas, entree] of refuses)
    it(`REFUSÉ : ${cas}`, () => {
      expect(schema.safeParse(avecEntree(entree)).success).toBe(false);
    });

  it('le message d’erreur DIT la règle (un auteur doit savoir quoi corriger)', () => {
    const rayon = schema.safeParse(avecEntree({ ...ENTREE_BON, rayonM: 0 }));
    expect(rayon.success).toBe(false);
    if (!rayon.success) expect(rayon.error.issues.map((i) => i.message).join('\n')).toContain('le rayon doit être > 0');
    const plafond = schema.safeParse(avecEntree({ ...ENTREE_BON, plafondMs: 60000 }));
    expect(plafond.success).toBe(false);
    if (!plafond.success) expect(plafond.error.issues.map((i) => i.message).join('\n')).toContain('≤ 10000 ms');
  });
});
