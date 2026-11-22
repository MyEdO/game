// Les rigides rangés d'une tenue évaluée (#4351) : un rigide que le jeu range se mesure à la transformation que le jeu
// lui donne à chaque instant d'un clip, et s'y mesure contre les vêtements comme un membre de la zone de l'os de son
// emplacement : mêmes zones voisines, même plafond du clip.
import { describe, expect, it } from 'vitest';
import { evaluer, type CoucheDeLElement } from './evaluer.ts';
import { ECART_DE_SUIVI_M } from './gardes/suiviDuCorps.ts';
import { glb, type Piece, type Point } from './gardes/pieces.testkit.ts';
import type { InstantDeRangement } from './rangement.ts';

/** Un cube de côté `cote` centré en (0, 1, 0), ses faces tournées vers le dehors, de zone `zone`, skinné à `jambe`. */
function cube(nom: string, cote: number, zone: string): Piece {
  const d = cote / 2;
  const sommets = [0, 1, 2, 3, 4, 5, 6, 7].map((k): Point => [k & 1 ? d : -d, 1 + (k & 2 ? d : -d), k & 4 ? d : -d]);
  return { nom, sommets, triangles: [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5], zone };
}
/** Une plaquette rigide de 4 cm tournée vers +Z, en grille 3 × 3, penchée : son bord -X à 1 cm derrière son centre, son
 *  bord +X à 1 cm devant. */
const PLAQUETTE: Piece = {
  nom: 'fiole', rigide: true,
  sommets: [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x): Point => [x * 0.02, y * 0.02, x * 0.01])),
  triangles: [0, 1, 3, 4].flatMap((i) => [i, i + 1, i + 3, i + 1, i + 4, i + 3]),
};
/** La translation de (x, y, z), en 16 nombres colonne par colonne. */
const translation = (x: number, y: number, z: number): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

const CLIP = 'Marche';
const base = glb([cube('corps', 0.3, 'torse')], CLIP);
/** La même base, avec une silhouette `large` qui ne déplace aucun sommet. */
const AVEC_SILHOUETTE = glb([{ ...cube('corps', 0.3, 'torse'), formes: { large: () => [0, 0, 0] } }], CLIP);
const robe = glb([cube('robe', 0.4, 'bras')]);
const gilet = glb([cube('gilet', 0.4, 'torse')]);
const fiole = glb([PLAQUETTE]);
const couches: (CoucheDeLElement | null)[] = [{ couche: 'tenue', couvre: [] }, null];
/** L'os de l'emplacement : celui du corps, de zone `torse`. */
const OS = 'jambe';
/** La plaquette à cheval sur la face +Z de la robe (z = 0,2) : un bord 14 mm derrière, son milieu 4 mm derrière, l'autre
 *  bord 6 mm devant. */
const DEDANS = translation(0, 1, 0.196);
/** La plaquette toute devant cette face, à 1 cm au plus près. */
const POSEE = translation(0, 1, 0.22);
const rigides = (fiche: Awaited<ReturnType<typeof evaluer>>) => fiche.ecarts.filter((e) => e.code === 'objet-dans-un-vetement');

describe('rangement', () => {
  it('le rangeur reçoit le repos puis chaque instant échantillonné, et le rigide se mesure où il le pose à chacun', async () => {
    const demandes: InstantDeRangement[] = [];
    const fiche = await evaluer({
      base, elements: [robe, fiole], couches,
      ranger: async (instants) => {
        demandes.push(...instants);
        return [null, { meshes: { fiole: instants.map((i) => (i.clip === CLIP && i.t > 0.5 ? DEDANS : POSEE)) }, offrants: [], os: OS }];
      },
    });
    expect(demandes[0]).toMatchObject({ clip: '', t: 0 });
    expect(demandes.slice(1).every((i) => i.clip === CLIP)).toBe(true);
    expect(demandes).toHaveLength(1 + fiche.mesures.clips[0].echantillons);
    const ecarts = rigides(fiche);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ garde: 'membreDansUnVetement', mesh: 'élément 2/fiole#0', clip: CLIP, seuil: ECART_DE_SUIVI_M });
    expect(ecarts[0].detail).toContain('de zone torse, derrière élément 1/robe#0');
    expect(ecarts[0].t).toBeGreaterThan(0.5);
    expect(ecarts[0].valeur).toBeCloseTo(0.014, 6);
  });

  it('posé devant le vêtement, ou laissé où son GLB le pend : aucun écart ; à cheval sur lui : un sous le clip, un au repos', async () => {
    const sous = (pose: number[] | null, offrants: number[] = [], vetement = robe, plafondsDesMembres = {}) => evaluer({ base, elements: [vetement, fiole], couches, plafondsDesMembres, ranger: async (i) => [null, { meshes: { fiole: i.map(() => pose) }, offrants, os: OS }] });
    expect(rigides(await sous(POSEE))).toEqual([]);
    expect(rigides(await sous(null))).toEqual([]);
    const dedans = rigides(await sous(DEDANS));
    expect(dedans.map((e) => e.clip)).toEqual([CLIP, undefined]);
    expect(dedans[1]).toMatchObject({ garde: 'rigideRange', mesh: 'élément 2/fiole#0', seuil: -ECART_DE_SUIVI_M });
    expect(dedans[1].valeur).toBeCloseTo(-0.006, 6);
    expect(rigides(await sous(DEDANS, [0])), 'la robe offre sa case').toEqual([]);
    const sousUneSilhouette = await evaluer({ base: AVEC_SILHOUETTE, elements: [robe, fiole], couches, silhouettes: { large: 1 }, ranger: async (i) => [null, { meshes: { fiole: i.map(() => DEDANS) }, offrants: [], os: OS }] });
    expect(rigides(sousUneSilhouette).map((e) => e.garde), 'au repos d’une silhouette aussi').toContain('rigideRange');
    expect(rigides(await sous(DEDANS, [], gilet)).map((e) => e.clip), 'un vêtement de sa zone : au repos seul, comme une couche').toEqual([undefined]);
    expect(rigides(await sous(DEDANS, [], robe, { [CLIP]: 1 })).map((e) => e.clip), 'au plafond du clip').toEqual([undefined]);
  });

  it('un nom qu’aucun nœud de l’élément ne porte est refusé', async () => {
    await expect(evaluer({ base, elements: [fiole], ranger: async (i) => [{ meshes: { flacon: i.map(() => POSEE) }, offrants: [], os: OS }] })).rejects.toThrow(/mesh rangé « flacon » absent de l’élément 1/);
  });
});
