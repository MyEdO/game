/**
 * Le plan des ponts d'un navire (#3686), lu dans la seule source de leur forme : `ponts` de sa fiche (`vehicles.json`),
 * que la construction de son modèle 3D lit aussi (`scripts/personnage-3d/vehicule/plan_de_jeu.py`). Une case de 2 m
 * (`sceneMetresPerTile`), la proue à `x = 0`, tribord à `y = 0`, la hauteur en mètres depuis la flottaison ; le centre du
 * plan est l'origine du modèle ; un étage par pont. Une trappe est la case du pont du dessous à la hauteur du pont du
 * dessus, l'étage du dessus y est vide ; son échelle (`MOTS_DES_PONTS.echelle`) est l'arête escaladable qui la joint au
 * pont (LDB 15 l.55).
 */
import type { MapSpec, WallSpec } from './mapSpec';
import { findVehicleById } from '../data';
import { MOTS_DES_PONTS, grilleDesPonts, type AreteDePont, type CaseDePont } from '../data/schemas/grammaire/carte-ascii';
import { garanti } from '../lib/garanti';
import { tableTotale } from '../lib/tableTotale';
import { terrainAbsent, terrainsAvecGlyphe } from './monde/terrain';

/** Le plancher des ponts : le terrain du glyphe `=` des plans. */
const PLANCHER = garanti(terrainsAvecGlyphe()['='], '=', 'terrain du plancher');

/** Les ponts du navire `id` : leurs hauteurs par glyphe, leur grille, les arêtes d'un mot comme `WallSpec`, et leur plan
 *  (`MapSpec`) : cases, cloisons, portes et échelles de la source, sans pièces ni décor. */
export function pontsDeLaFiche(id: string): { hauteurs: Readonly<Record<string, number>>; grille: ReturnType<typeof grilleDesPonts>; aretesDe: (mot: string) => WallSpec[]; plan: MapSpec } {
  const fiche = garanti(findVehicleById(id), id, 'véhicule');
  const [ponts, hauteurs] = garanti(fiche.ponts, id, 'ponts du véhicule');
  const grille = grilleDesPonts(ponts);
  const caseDuPont = (x: number, y: number, z: number): CaseDePont | undefined =>
    grille.cases.find((c) => c.x === x && c.y === y && c.z === z);
  /** L'arête de pont `e` comme `WallSpec`, portée par la case qui existe de ses deux côtés (la seconde d'abord). */
  const areteDuPlan = (e: AreteDePont): WallSpec => {
    const seconde = caseDuPont(e.x, e.y, e.z);
    if (e.sens === 't') return seconde ? { x: e.x, y: e.y, side: 'O', z: e.z } : { x: e.x - 1, y: e.y, side: 'E', z: e.z };
    return seconde ? { x: e.x, y: e.y, side: 'N', z: e.z } : { x: e.x, y: e.y - 1, side: 'S', z: e.z };
  };
  const aretesDe = (mot: string): WallSpec[] => grille.aretes.filter((e) => e.glyphe === mot).map(areteDuPlan);
  // Les cartes `walled` des ponts : une échelle y est une arête ouverte, un sabord une arête de coque murée.
  const cartes = Object.fromEntries(ponts.map((carte, z) => [`z${z}`, carte.split('\n').map((ligne, l) =>
    ligne.split(MOTS_DES_PONTS.echelle).join(' ').split(MOTS_DES_PONTS.sabord).join(l % 2 === 0 ? '-' : '|')).join('\n')]));
  return {
    hauteurs,
    grille,
    aretesDe,
    plan: {
      id,
      label: fiche.label,
      size: [grille.w, grille.h],
      terrain: terrainAbsent(),
      legend: tableTotale(Object.keys(hauteurs), () => PLANCHER),
      walled: cartes,
      elevate: hauteurs,
      walls: aretesDe(MOTS_DES_PONTS.echelle).map((e): WallSpec => ({ ...e, climb: { kind: 'ladder' } })),
    },
  };
}
