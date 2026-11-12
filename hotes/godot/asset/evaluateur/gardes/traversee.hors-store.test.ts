// La garde de la traversée des couches (#2972, #3319, #3842) : une couche ne passe pas devant celle qui la couvre.
import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, SkinnedMesh } from 'three';
import type { Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { gardePercementAuRepos, gardeTraversee, lierLesCouches, mesurerTraversee, sansLesZonesMasquees } from './traversee.ts';
import { RANG_DU_CORPS } from '../../element.ts';
import { endroitDe, ordreDesCouches, PORTEE_DE_COUVERTURE_M } from '../../pile.ts';

/** Un carré de 0,2 m de côté à la hauteur `z`, en grille 3 × 3, décalé de `dx` en X. */
function carre(z: number, dx = 0): Float32Array {
  return Float32Array.from([-1, 0, 1].flatMap((y) => [-1, 0, 1].flatMap((x) => [x * 0.1 + dx, y * 0.1, z])));
}
/** Le mesh de `Type` sur `positions`, ses triangles tournés vers +Z, ou vers −Z si `retourne`. */
function maillage<M extends Mesh>(Type: new (g: BufferGeometry) => M, positions: Float32Array, retourne = false): M {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions.slice(), 3));
  const faces = [0, 1, 3, 4].flatMap((i) => (retourne ? [i, i + 3, i + 1, i + 1, i + 3, i + 4] : [i, i + 1, i + 3, i + 1, i + 4, i + 3]));
  g.setIndex(faces);
  return new Type(g);
}
const decaler = (p: Float32Array, dz: number) => p.map((v, i) => (i % 3 === 2 ? v + dz : v));
/** Le carré plié : ses colonnes en X aux hauteurs `zs`. */
const plie = (...zs: [number, number, number]) => carre(0).map((v, i) => (i % 3 === 2 ? zs[Math.floor(i / 3) % 3] : v));
const triangles = (m: Mesh) => (m.geometry.index as BufferAttribute).array;
const libelle = (m: Mesh) => m.name;
type Pose = { positions: Map<Mesh, Float32Array> };
/** L'élément de couche `rang` fait de `meshes`, dont l'ordre se vote dans la pose `neutre`. */
const element = (rang: number, meshes: SkinnedMesh[], neutre: Pose) => ({
  rang, accessoire: false, meshes,
  neutres: meshes.map((m) => ({ positions: neutre.positions.get(m) as Float32Array, indices: (m.geometry.index as BufferAttribute).array })),
});
type Element = ReturnType<typeof element>;
/** Les couches liées dans `pose`, l'ordre voté sans peau, chaque mesh tout entier à l'endroit. */
const lier = (corps: Mesh[], elements: Element[], pose: Pose) => lierLesCouches(corps, elements, pose, ordreDesCouches([]), triangles);
/** Les liaisons de `sujet` sous l'élément du seul mesh `couverture`, dans la pose `positions`. */
const lierSous = (sujet: Mesh, couverture: SkinnedMesh, positions: Map<Mesh, Float32Array>) =>
  lier([sujet], [element(1, [couverture], { positions })], { positions }).liaisons;
const echantillon = (positions: Map<Mesh, Float32Array>, t = 0.5): Echantillon => ({ clip: 'Coup', t, positions, os: new Map() });

describe('traversee', () => {
  const peau = maillage(Mesh, carre(0)), tissu = maillage(SkinnedMesh, carre(0.01));
  peau.name = 'peau';
  tissu.name = 'tissu';
  const repos = new Map<Mesh, Float32Array>([[peau, carre(0)], [tissu, carre(0.01)]]);

  it('chaque sommet derrière la couverture, à portée, se lie ; devant ou hors de portée, aucun', () => {
    expect(lierSous(peau, tissu, repos).map((l) => l.sommets.length)).toEqual([9]);
    expect(lierSous(peau, tissu, new Map([[peau, carre(0.02)], [tissu, carre(0.01)]]))).toEqual([]);
    expect(lierSous(peau, tissu, new Map([[peau, carre(-PORTEE_DE_COUVERTURE_M)], [tissu, carre(0.01)]]))).toEqual([]);
  });

  it('seul l’endroit couvre : sous une double nappe, l’endroit et la doublure d’une autre se lient à son endroit, sans percement', () => {
    const [dessous, doublure, envers, dessus] = [maillage(SkinnedMesh, carre(0.006)), maillage(SkinnedMesh, carre(0.004), true), maillage(SkinnedMesh, carre(0.01), true), maillage(SkinnedMesh, carre(0.014))];
    const pose = { positions: new Map<Mesh, Float32Array>([[peau, carre(0)], [dessous, carre(0.006)], [doublure, carre(0.004)], [envers, carre(0.01)], [dessus, carre(0.014)]]) };
    const endroit = (m: Mesh) => endroitDe({ positions: pose.positions.get(m) as Float32Array, indices: triangles(m) }, [carre(0)]);
    expect([dessous, doublure, envers, dessus].map((m) => endroit(m).length)).toEqual([24, 0, 0, 24]);
    const couches = lierLesCouches([], [element(1, [dessous, doublure], pose), element(2, [envers, dessus], pose)], pose, ordreDesCouches([carre(0)]), endroit);
    expect(couches.liaisons.map((l) => [l.sujet, l.couverture, l.sommets.length])).toEqual([[dessous, dessus, 9], [doublure, dessus, 9]]);
    expect(couches.percements).toEqual([]);
  });

  it('VERT : la couche suit sa couverture ; ROUGE : elle passe devant au-delà de la tolérance, un écart à son pire instant', () => {
    const { liaisons } = lier([peau], [element(1, [tissu], { positions: repos })], { positions: repos });
    const suit = mesurerTraversee(liaisons, echantillon(new Map([[peau, decaler(carre(0), 0.3)], [tissu, decaler(carre(0.01), 0.3)]])));
    expect(suit).toEqual([]);
    const tolere = mesurerTraversee(liaisons, echantillon(new Map([[peau, carre(0.01 + ECART_DE_SUIVI_M * 0.9)], [tissu, carre(0.01)]])));
    expect(tolere).toEqual([]);
    const mesures = [0.02, 0.04].flatMap((z, k) => mesurerTraversee(liaisons, echantillon(new Map([[peau, carre(z)], [tissu, carre(0.01)]]), k)));
    const ecarts = gardeTraversee(mesures, libelle);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ garde: 'traversee', code: 'couche-traversee', mesh: 'tissu', clip: 'Coup', t: 1, seuil: -ECART_DE_SUIVI_M });
    expect(ecarts[0].valeur).toBeCloseTo(-0.03, 6);
  });

  describe('la normale de la couverture au point lié', () => {
    /** Le mesh de `Type` aux sommets `points` et aux triangles `faces`. */
    const mesh = <M extends Mesh>(Type: new (g: BufferGeometry) => M, points: number[][], faces: number[]): M => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(Float32Array.from(points.flat()), 3));
      g.setIndex(faces);
      return new Type(g);
    };
    /** Trois sommets d'un sujet à la hauteur `z`, sous le triangle effilé de l'éventail. */
    const sous = (z: number) => Float32Array.from([[-0.01, -0.097, z], [0.01, -0.097, z], [0, -0.094, z]].flat());
    const sujet = mesh(Mesh, [[0, 0, 0], [0, 0, 0], [0, 0, 0]], [0, 1, 2]);
    /** Un carré de 0,2 m en éventail autour du sommet 4, à la hauteur 0,02 : posé en (0, `y`), il effile le triangle (0, 1, 4) du bord y = −0,1. */
    const eventail = (y: number) => Float32Array.from([[-0.1, -0.1, 0.02], [0.1, -0.1, 0.02], [0.1, 0.1, 0.02], [-0.1, 0.1, 0.02], [0, y, 0.02]].flat());

    it('surface lisse : un triangle effilé qui se retourne seul en pose ne fait rien passer devant lui ; ce qui passe devant la surface reste un écart', () => {
      const nappe = mesh(SkinnedMesh, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
      const liaisons = lierSous(sujet, nappe, new Map<Mesh, Float32Array>([[sujet, sous(0)], [nappe, eventail(-0.09)]]));
      expect(liaisons.map((l) => [...l.lisses])).toEqual([[1, 1, 1]]);
      expect(mesurerTraversee(liaisons, echantillon(new Map<Mesh, Float32Array>([[sujet, sous(0)], [nappe, eventail(-0.11)]])))).toEqual([]);
      const devant = mesurerTraversee(liaisons, echantillon(new Map<Mesh, Float32Array>([[sujet, sous(0.04)], [nappe, eventail(-0.11)]])));
      expect(devant.map((m) => [m.sommets, m.pire])).toEqual([[3, expect.closeTo(-0.02, 6)]]);
    });

    it('arête vive : sous la pointe d’une pyramide, la normale du triangle lié fait foi', () => {
      /** Quatre faces à 75° de l'horizontale autour de la pointe (0, 0, 0,2). */
      const pyramide = Float32Array.from([[-0.05, -0.05, 0.0134], [0.05, -0.05, 0.0134], [0.05, 0.05, 0.0134], [-0.05, 0.05, 0.0134], [0, 0, 0.2]].flat());
      const pointe = mesh(SkinnedMesh, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
      /** Trois sommets du sujet à la hauteur `z`, autour de l'axe de la pyramide. */
      const dans = (z: number) => Float32Array.from([[-0.002, -0.001, z], [0.002, -0.001, z], [0, 0.002, z]].flat());
      const liaisons = lierSous(sujet, pointe, new Map<Mesh, Float32Array>([[sujet, dans(0.18)], [pointe, pyramide]]));
      expect(liaisons.map((l) => [...l.lisses])).toEqual([[0, 0, 0]]);
      expect(mesurerTraversee(liaisons, echantillon(new Map<Mesh, Float32Array>([[sujet, dans(0.18)], [pointe, pyramide]])))).toEqual([]);
      expect(mesurerTraversee(liaisons, echantillon(new Map<Mesh, Float32Array>([[sujet, dans(0.26)], [pointe, pyramide]]))).map((m) => m.sommets)).toEqual([3]);
    });
  });

  it('ROUGE : au repos, une couche qui traverse sa couverture la perce des bouts d’arête sortis au-delà de la tolérance ; VERT : dans la tolérance, ou devant elle sans la traverser', () => {
    const auRepos = (p: Float32Array) => ({ positions: new Map([[peau, p], [tissu, carre(0.01)]]) });
    const perce = (p: Float32Array) => lier([peau], [element(1, [tissu], auRepos(p))], auRepos(p)).percements;
    expect(perce(carre(0))).toEqual([]);
    expect(perce(carre(0.025))).toEqual([]);
    expect(perce(plie(0, 0, 0.01 + ECART_DE_SUIVI_M * 0.9))).toEqual([]);
    const percements = perce(plie(0, 0, 0.03));
    expect(percements).toHaveLength(1);
    expect(percements[0]).toMatchObject({ sujet: peau, couverture: tissu, sommets: 3 });
    expect(percements[0].pire).toBeCloseTo(-0.02, 6);
    expect(perce(plie(0, 0.025, 0.03)).map((p) => [p.sommets, p.pire])).toEqual([[3, expect.closeTo(-0.015, 6)]]);
    expect(gardePercementAuRepos(percements, libelle)).toEqual([expect.objectContaining({ garde: 'traversee', code: 'couche-percee-au-repos', mesh: 'tissu', seuil: -ECART_DE_SUIVI_M })]);
  });

  describe('même couche : celui dont les sommets sont devant l’autre au repos le couvre', () => {
    const autre = maillage(SkinnedMesh, carre(0.005));
    autre.name = 'autre';
    const positions = { positions: new Map<Mesh, Float32Array>([...repos, [autre, carre(0.005)]]) };

    it('le couvert se lie sous celui qui le couvre, jamais l’inverse ; un élément ne se couvre pas lui-même', () => {
      const liaisons = lier([], [element(1, [tissu], positions), element(1, [autre], positions)], positions).liaisons;
      expect(liaisons.map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
      expect(lier([], [element(1, [tissu, autre], positions)], positions).liaisons).toEqual([]);
      expect(lier([], [element(2, [tissu], positions), element(1, [autre], positions)], positions).liaisons.map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
    });

    it('l’ordre se prend au repos neutre, la liaison et le percement au repos de la passe', () => {
      const passe = { positions: new Map<Mesh, Float32Array>([[tissu, carre(0)], [autre, plie(0.02, 0.02, -0.01)]]) };
      const couches = lier([], [element(1, [tissu], positions), element(1, [autre], positions)], passe);
      expect(couches.liaisons.map((l) => [l.sujet, l.couverture, l.sommets.length])).toEqual([[autre, tissu, 3]]);
      expect(couches.percements.map((p) => [p.sujet, p.couverture, p.sommets])).toEqual([[autre, tissu, 3]]);
    });

    it('un élément de couche plus extérieure couvre, même placé dessous', () => {
      const dessous = { positions: new Map<Mesh, Float32Array>([[tissu, plie(-0.01, -0.01, 0.02)], [autre, carre(0)]]) };
      expect(lier([], [element(1, [tissu], dessous), element(2, [autre], dessous)], dessous).percements.map((p) => [p.sujet, p.couverture])).toEqual([[tissu, autre]]);
    });
  });

  it('un mesh de zone est masqué par un élément de couche plus extérieure qui couvre sa zone, pas par un de même couche', () => {
    const torse = new Mesh(), bras = new Mesh(), libre = new Mesh();
    const zones = new Map<Mesh, string | undefined>([[torse, 'torse'], [bras, 'bras'], [libre, undefined]]);
    const montre = sansLesZonesMasquees([{ rang: 1, couvre: ['torse'] }, { rang: 2, couvre: ['bras'] }], (m) => zones.get(m));
    expect(montre([torse, bras, libre], RANG_DU_CORPS)).toEqual([libre]);
    expect(montre([torse, bras, libre], 1)).toEqual([torse, libre]);
    expect(montre([torse, bras, libre], 2)).toEqual([torse, bras, libre]);
  });
});
