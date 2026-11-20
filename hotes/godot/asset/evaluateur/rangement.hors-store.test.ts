// Les rigides rangés d'une tenue évaluée (#4351) : un rigide que le jeu range se mesure à la transformation que le jeu
// lui donne, au repos comme à chaque instant d'un clip, et la garde `rigideRange` le mesure contre ce qui est porté.
import { describe, expect, it } from 'vitest';
import { evaluer } from './evaluer.ts';
import { ECART_DE_SUIVI_M } from './gardes/suiviDuCorps.ts';
import { glb, type Piece, type Point } from './gardes/pieces.testkit.ts';
import type { InstantDeRangement } from './rangement.ts';

/** Un cube de côté `cote` centré en `centre`, ses faces tournées vers le dehors. */
function cube(nom: string, cote: number, centre: Point, rigide?: true): Piece {
  const d = cote / 2;
  const sommets = [0, 1, 2, 3, 4, 5, 6, 7].map((k): Point => [centre[0] + (k & 1 ? d : -d), centre[1] + (k & 2 ? d : -d), centre[2] + (k & 4 ? d : -d)]);
  return { nom, sommets, triangles: [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5], ...(rigide ? { rigide } : {}) };
}
/** La translation de (x, y, z), en 16 nombres colonne par colonne. */
const translation = (x: number, y: number, z: number): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

const CLIP = 'Marche';
const base = glb([cube('corps', 0.4, [0, 1, 0])], CLIP);
const fiole = glb([cube('fiole', 0.04, [0, 0, 0], true)]);
/** La fiole à cheval sur la face +Z du corps (z = 0,2), enfoncée de 15 mm. */
const DEDANS = translation(0, 1, 0.205);
/** La fiole posée à 5 mm devant cette face. */
const POSEE = translation(0, 1, 0.225);
const ENFONCEMENT = 0.015;

describe('rangement', () => {
  it('le rangeur reçoit le repos puis chaque instant échantillonné, et le rigide se mesure où il le pose à chacun', async () => {
    const demandes: InstantDeRangement[] = [];
    const fiche = await evaluer({
      base, elements: [fiole],
      ranger: async (demandes_) => {
        demandes.push(...demandes_);
        return [{ meshes: { fiole: demandes_.map((i) => (i.clip === CLIP && i.t > 0.5 ? DEDANS : POSEE)) }, offrants: [] }];
      },
    });
    expect(demandes[0]).toMatchObject({ clip: '', t: 0 });
    expect(demandes.slice(1).every((i) => i.clip === CLIP)).toBe(true);
    expect(demandes).toHaveLength(1 + fiche.mesures.clips[0].echantillons);
    const ecarts = fiche.ecarts.filter((e) => e.garde === 'rigideRange');
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ code: 'objet-dans-un-vetement', mesh: 'élément 1/fiole#0', clip: CLIP, seuil: ECART_DE_SUIVI_M });
    expect(ecarts[0].t).toBeGreaterThan(0.5);
    expect(ecarts[0].valeur).toBeCloseTo(ENFONCEMENT, 6);
  });

  it('ROUGE au repos : rangé dans le corps, un écart sans clip ; posé devant lui, aucun', async () => {
    const dedans = await evaluer({ base, elements: [fiole], ranger: async (i) => [{ meshes: { fiole: i.map((x) => (x.clip === '' ? DEDANS : POSEE)) }, offrants: [] }] });
    const ecarts = dedans.ecarts.filter((e) => e.garde === 'rigideRange');
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0].clip).toBeUndefined();
    expect(ecarts[0].valeur).toBeCloseTo(ENFONCEMENT, 6);
    const posee = await evaluer({ base, elements: [fiole], ranger: async (i) => [{ meshes: { fiole: i.map(() => POSEE) }, offrants: [] }] });
    expect(posee.ecarts.filter((e) => e.garde === 'rigideRange')).toEqual([]);
  });

  it('ni rangeur, ni pose à un instant : le rigide reste où son GLB le pend ; ce qu’offre un élément ne compte pas contre son objet', async () => {
    const tenu = await evaluer({ base, elements: [fiole], ranger: async (i) => [{ meshes: { fiole: i.map(() => null) }, offrants: [] }] });
    expect(tenu.ecarts.filter((e) => e.garde === 'rigideRange')).toEqual([]);
    const sangle = glb([cube('sangle', 0.1, [0, 1, 0.205])]);
    const ranger = (offrants: number[]) => async (i: readonly InstantDeRangement[]) => [null, { meshes: { fiole: i.map(() => translation(0, 1, 0.26)) }, offrants }];
    const offerte = await evaluer({ base, elements: [sangle, fiole], ranger: ranger([0]) });
    expect(offerte.ecarts.filter((e) => e.garde === 'rigideRange')).toEqual([]);
    const autre = await evaluer({ base, elements: [sangle, fiole], ranger: ranger([]) });
    expect(autre.ecarts.filter((e) => e.garde === 'rigideRange').map((e) => [e.clip, e.detail])).toEqual([[undefined, expect.stringContaining('élément 1/sangle#0')], [CLIP, expect.stringContaining('élément 1/sangle#0')]]);
  });

  it('un nom qu’aucun nœud de l’élément ne porte est refusé', async () => {
    await expect(evaluer({ base, elements: [fiole], ranger: async (i) => [{ meshes: { flacon: i.map(() => POSEE) }, offrants: [] }] })).rejects.toThrow(/mesh rangé « flacon » absent de l’élément 1/);
  });
});
