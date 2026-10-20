/**
 * ÉCHELLE DE LA SCÈNE — inventaire NOMINATIF des sites qui traduisent entre MÈTRES et CASES (#1507).
 *
 * `Scene.metresPerTile` (défaut 2, `LDB 15 l.12`) est la seule échelle du jeu. Tout ce qui est écrit
 * en mètres — une recette de décor, l'ancre d'une place, le foyer d'une lampe, le rayon d'une source,
 * la portée d'une aura, le gabarit d'un sort, une pente de toit — devient des cases PAR ELLE, et
 * nulle part ailleurs. Ce contrat tient la LISTE de ces sites : un site de plus se déclare ici, avec
 * son rôle, ou il sort ROUGE et NOMMÉ. C'est ce qui a manqué avant ce lot : quatre lecteurs
 * divisaient par le littéral `2` et figeaient l'échelle terrestre, invisibles de tout inventaire.
 *
 * CE QUE CE DÉTECTEUR VOIT, ET LUI SEUL : une DIVISION dont le diviseur est écrit `mpt` / `MPT` /
 * `metresPerTile` / `sceneMetresPerTile(…)`, ou une RECOPIE du défaut (`metresPerTile ?? 2`), dans le
 * code de PRODUCTION de `src` (les tests, les snapshots et les commentaires sont hors mesure).
 * Il ne voit PAS : une division par une variable intermédiaire (`const e = mpt; x / e`), une
 * multiplication (le sens cases→mètres, qui n'a qu'un site canonique, `gpToWorld`), ni un littéral
 * `2` écrit à la main — ce dernier est précisément ce qui a échappé à l'inventaire jusqu'ici, et
 * aucun grep ne peut le distinguer d'un autre 2. La liste ci-dessous est donc une CLÔTURE des sites
 * NOMMÉS, pas une preuve d'absence ailleurs.
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/** Le source SANS ses commentaires : une réf ou une explication n'est pas un site de conversion. */
const sansCommentaire = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const DIVISION = /\/\s*(?:opts\.mpt\b|mpt\b|MPT\b|metresPerTile\b|sceneMetresPerTile\()/;
const RECOPIE = /metresPerTile\s*\?\?\s*2/;

/**
 * Les 21 sites DÉCLARÉS, chacun avec son RÔLE. Le texte est la ligne elle-même : il ne dérive pas
 * avec les numéros de ligne, et un site NEUF porte forcément un texte neuf — donc un rouge nominatif.
 */
const SITES: readonly { fichier: string; texte: string; role: string }[] = [
  // ── LA LECTURE canonique de l'échelle (le seul endroit où le défaut RAW est écrit)
  { fichier: 'noyau/monde/scene.ts', texte: 'return scene?.metresPerTile ?? 2;', role: 'sceneMetresPerTile — LE défaut du monde (LDB 15 l.12), lu par tous les autres' },

  // ── LES COUTURES du décor volumique (#1507) : une par CONCEPT, jamais deux pour le même
  { fichier: 'gameIso/builders/propVolumes.ts', texte: 'const [rx, ry] = rotatePropLocal(p.xM / mpt, p.yM / mpt, facing);', role: 'GÉOMÉTRIE d’une recette de décor → cases du monde' },
  { fichier: 'data/props.types.ts', texte: 'const [ax, ay] = rotatePropLocal(slot.anchor.xM / mpt, slot.anchor.yM / mpt, cap);', role: 'ANCRE d’une place assise → case du corps assis' },
  { fichier: 'noyau/monde/vision.ts', texte: 'const [x, y] = rotatePropLocal(emettrice.center.xM / mpt, emettrice.center.yM / mpt, facing ?? CAP_IDENTITE_PROP);', role: 'FOYER d’une lampe (centre de la primitive émettrice) → offset en cases' },
  { fichier: 'noyau/monde/vision.ts', texte: 'export const rayonEnCases = (radiusM: number, mpt: number): number => radiusM / mpt;', role: 'RAYON d’une source de lumière → cases (RÉEL : le dégradé le lit comme une longueur)' },
  { fichier: 'data/props.types.ts', texte: 'const enCases = (metres: number): number => Math.max(1, Math.ceil(metres / mpt - 1e-9));', role: 'EMPRISE du corps tourné d’un décor → cases de son empreinte (#1509, arrondi haut, plancher 1)' },

  // ── LES PORTÉES de règle chiffrées en mètres
  { fichier: 'noyau/monde/combatGeometry.ts', texte: 'export const porteeEnCases = (metres: number, mpt: number): number => Math.max(1, Math.ceil(metres / mpt));', role: 'PORTÉE d’une aura/d’un effet d’aire → cases (arrondi haut, plancher 1)' },
  { fichier: 'noyau/combatFlow.ts', texte: "Math.max(0, Math.floor((r0m * zoneDiameterMultiplier('arcane', alloc)) / mpt));", role: 'GABARIT d’un sort de zone → cases (arrondi bas, plancher 0)' },
  { fichier: 'noyau/combatFlow.ts', texte: 'const tiles = Math.max(1, Math.round(2 / sceneMetresPerTile(get().scene)));', role: 'recul de 2 m d’une règle RAW → cases' },
  { fichier: 'engine/movement.ts', texte: 'return Math.ceil((2 * Math.max(0, metres)) / metresPerTile);', role: 'coût d’ESCALADE (mètres de dénivelé) → budget de Marche en cases' },
  { fichier: 'engine/scatter.ts', texte: 'const distTiles = Math.max(0, Math.round(distM / metresPerTile));', role: 'DISPERSION d’un tir (mètres) → cases' },
  { fichier: 'noyau/monde/relief.ts', texte: 'return Math.abs(hA - hB) / metresPerTile;', role: 'PENTE : dénivelé métrique rapporté au pas de grille' },

  // ── LE MONDE NAVAL (portées de coque, en mètres au RAW)
  { fichier: 'noyau/combatSlice.ts', texte: 'const gap = Math.max(1, Math.round(75 / mpt));', role: 'ÉCART de départ d’un combat naval (75 m, MDG 12 l.401) → cases' },

  // ── L'ARCHITECTURE et le RENDU
  { fichier: 'noyau/sceneEdit.ts', texte: 'return Math.max(1, Math.floor(ROOF_GABLE_SPAN_MAX_M / sceneMetresPerTile(scene)));', role: 'PORTÉE maximale d’un pignon (m) → cases' },
  { fichier: 'gameIso/builders/highlights.ts', texte: 'const maxTiles = Math.ceil((rangeM * 3) / mpt);', role: 'BANDES de portée au sol (Portée ×3, m) → cases peintes' },
  { fichier: 'gameIso/backends/webgl/cameras.ts', texte: 'const s = CELL / mpt;', role: 'CADENCE de la caméra du dessus (px/m)' },
  { fichier: 'gameIso/backends/webgl/worldTris.ts', texte: 'return (TW * Math.SQRT1_2) / mpt;', role: 'CADENCE de la projection (px/m) — `pxPerM`' },
  { fichier: 'gameIso/stage/GameStage3D.tsx', texte: '() => (xM, zM, yM) => isSheltered(abris, xM / mpt, zM / mpt, yM),', role: 'point MÉTRIQUE du monde 3D → case, pour lire un abri' },
  { fichier: 'gameIso/stage/GameStage3D.tsx', texte: 'const section = shelterSectionAt(abris, xM / mpt, zM / mpt);', role: 'point métrique → case, pour nommer la section d’abri' },
  { fichier: 'gameIso/stage/GameStage3D.tsx', texte: 'const cycles = Math.hypot(g.dx, g.dz) / mpt / 2;', role: 'distance métrique parcourue → cycles de marche (2 cases par cycle)' },
  { fichier: 'gameIso/stage/GameStage3D.tsx', texte: '? { x: frame.partyPos.x + g.dx / mpt, y: frame.partyPos.y + g.dz / mpt, z: frame.partyPos.z }', role: 'déplacement métrique de la caméra → position en cases du groupe' },
];

describe('échelle de la scène — les sites de traduction mètres ⇄ cases sont NOMMÉS', () => {
  const mesures = (): { fichier: string; texte: string }[] => {
    const out: { fichier: string; texte: string }[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      for (const l of sansCommentaire(text).split('\n')) {
        if (!DIVISION.test(l) && !RECOPIE.test(l)) continue;
        out.push({ fichier: rel.slice('src/'.length), texte: l.trim() });
      }
    }
    return out;
  };
  const cle = (s: { fichier: string; texte: string }) => `${s.fichier} :: ${s.texte}`;

  it('aucun site de division par l’échelle qui ne soit DÉCLARÉ (et aucune déclaration morte)', () => {
    const vus = mesures().map(cle).sort();
    const declares = SITES.map(cle).sort();
    expect(vus.length, 'aucun site lu : ce contrat ne mesurerait plus rien').toBeGreaterThan(15);
    expect(vus).toEqual(declares);
  });

  it('chaque site déclaré porte un RÔLE, et chaque rôle de conversion de DÉCOR est unique', () => {
    expect(SITES.filter((s) => !s.role.trim())).toEqual([]);
    // Les CINQ coutures du décor volumique : géométrie, ancre de place, foyer, rayon (#1507), et
    // l'emprise du corps tourné qui décide des cases (#1509).
    // Un CONCEPT = un site. Deux sites pour le même concept, c'est la divergence que ce lot supprime.
    const coutures = SITES.filter((s) => /GÉOMÉTRIE|ANCRE|FOYER|RAYON|EMPRISE/.test(s.role));
    expect(coutures.map((s) => s.role.split(' ')[0])).toEqual(['GÉOMÉTRIE', 'ANCRE', 'FOYER', 'RAYON', 'EMPRISE']);
  });

  it('plus AUCUNE recopie du défaut (`metresPerTile ?? 2`) hors de sa lecture canonique', () => {
    const recopies = mesures().filter((s) => RECOPIE.test(s.texte));
    expect(recopies.map((s) => s.fichier)).toEqual(['noyau/monde/scene.ts']);
  });
});
