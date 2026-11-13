/**
 * LE VOLUME REPRIS (#3993) : `volumeDepuis(apres, etat(avant))` rend le volume du calcul entier de `apres`
 * (`volumeDepuis(apres, null)`) ; ce qu'une retouche ne touche pas reste l'objet du précédent ; une scène neuve aux
 * mêmes entrées rend le même volume (`volumeDuMonde`).
 */
import { describe, expect, it } from 'vitest';
import { volumeDepuis, volumeDuMonde, type EtatDuVolume, type VolumeDuMonde } from './volume';
import { collapsedTileKey, emptyScene, setTileCollapsed, structureDownKey, type Scene, type SceneEntity } from '../scene';
import { buildScene } from '../../mapSpec';
import { poserLesNavires, provenanceDesNavires } from '../../planDeNavire';
import { bumperDataset } from '../../../data/versionDataset';
import { jsonCanonique } from '../../../lib/jsonCanonique.mjs';
import type { Dir8 } from '../../../geometry/dir8';
import { addLayer, moveEntityTo, paintCrenellated, paintHeight, paintTiles, removeLayer, resizeGrid, setEdgeWall } from '../../sceneEdit';

const W = 16;
const H = 12;
const i = (x: number, y: number) => y * W + x;

/** 16 × 12 cases de plancher : une volée de marches sur la rangée 3, un bois, un bloc `mur` en (8, 2) coiffé à
 *  l'étage d'un chemin de ronde de pierre crénelé, un tablier de planches à l'étage sur (3..6, 7..8), une case de
 *  planches au-dessus de lui en (4, 7), une table qui porte une lettre, un tonneau, deux murs. */
function fort(): Scene {
  const s = emptyScene('fort', W, H);
  s.layers[0].tiles = Array(W * H).fill('plancher');
  s.layers[0].height = Array(W * H).fill(0);
  [0.4, 0.8, 1.2, 1.6].forEach((m, k) => (s.layers[0].height![i(3 + k, 3)] = m));
  for (const [x, y] of [[12, 8], [13, 8], [12, 9], [13, 9]]) s.layers[0].tiles[i(x, y)] = 'bois';
  s.layers[0].tiles[i(8, 2)] = 'mur';
  s.layers.push({ z: 1, tiles: Array(W * H).fill('vide'), height: Array(W * H).fill(0), crenellated: Array(W * H).fill(null) });
  s.layers[1].tiles[i(8, 2)] = 'pierre';
  s.layers[1].height![i(8, 2)] = 4;
  s.layers[1].crenellated![i(8, 2)] = 'mur-en-pierre';
  for (let y = 7; y <= 8; y++)
    for (let x = 3; x <= 6; x++) {
      s.layers[1].tiles[i(x, y)] = 'planches';
      s.layers[1].height![i(x, y)] = 3;
    }
  s.layers.push({ z: 2, tiles: Array(W * H).fill('vide'), height: Array(W * H).fill(0) });
  s.layers[2].tiles[i(4, 7)] = 'planches';
  s.layers[2].height![i(4, 7)] = 6;
  s.entities.push(
    { id: 'table-1', kind: 'prop', decor: { id: 'table' }, pos: { x: 10, y: 5 } },
    { id: 'lettre-1', kind: 'prop', decor: { id: 'lettre' }, pos: { x: 10, y: 5 }, sur: 'table-1' },
    { id: 'tonneau-1', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 2, y: 9 } },
  );
  s.walls = [{ x: 5, y: 5, side: 'N', z: 0 }, { x: 10, y: 8, side: 'E', z: 0 }];
  return s;
}

/** Une caraque `id` ancrée en (`x`, `y`), cap `facing`. */
const nav = (id: string, x: number, y: number, facing: Dir8 = 'O'): SceneEntity => ({ id, kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x, y }, facing });
/** Un bassin de 24 × 24 cases d'eau qui porte `entities`. */
const bassin = (entities: SceneEntity[]): Scene => buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', entities });

const entier = (s: Scene) => volumeDepuis(s, null);

/** Le volume de `apres` repris de `etat` est celui de son calcul entier (clés, empreintes, tableaux, `hauteurs`) ; rend
 *  le volume et l'état repris. */
function reprendEgal(apres: Scene, etat: EtatDuVolume, quoi: string) {
  const repris = volumeDepuis(apres, etat);
  expect(repris.volume, quoi).toEqual(entier(apres).volume);
  return repris;
}

const solDe = (e: EtatDuVolume, x: number, y: number, z: number) => jsonCanonique(e.sols.get(z)![i(x, y)]);

describe('volumeDepuis : la reprise rend le calcul entier (#3993)', () => {
  const s = fort();
  const avant = entier(s);

  it('le terrain d’une case peint', () => {
    reprendEgal(paintTiles(s, { x: 7, y: 6 }, 'dalle', 1, 0), avant.etat, 'terrain');
  });

  it('une hauteur dont l’effet porte à deux cases : la marche (4, 3) aplanie change le sol de (2, 3)', () => {
    const apres = paintHeight(s, { x: 4, y: 3 }, 0, 1, 0);
    expect(solDe(entier(apres).etat, 2, 3, 0), 'le sol à deux cases change').not.toBe(solDe(avant.etat, 2, 3, 0));
    reprendEgal(apres, avant.etat, 'hauteur à distance 2');
  });

  it('un mur posé au rez qui déplace un montant du tablier de l’étage', () => {
    const apres = setEdgeWall(s, 7, 10, 'N', 0, 'wall');
    const montants = (e: EtatDuVolume) => jsonCanonique([...e.montants.get(1)!]);
    expect(montants(entier(apres).etat), 'les montants de l’étage changent').not.toBe(montants(avant.etat));
    reprendEgal(apres, avant.etat, 'montant');
  });

  it('une entité déplacée ; la table qui porte la lettre déplacée, puis son sol relevé', () => {
    reprendEgal(moveEntityTo(s, 'tonneau-1', { x: 5, y: 10 }), avant.etat, 'tonneau déplacé');
    reprendEgal(moveEntityTo(s, 'table-1', { x: 12, y: 3 }), avant.etat, 'table déplacée');
    const releve = paintHeight(s, { x: 10, y: 5 }, 0.8, 1, 0);
    const lettre = (e: EtatDuVolume) => e.decorsDEntite.get('lettre-1')!;
    expect(lettre(entier(releve).etat).pied, 'le pied de la lettre suit son support').not.toBe(lettre(avant.etat).pied);
    reprendEgal(releve, avant.etat, 'support relevé');
  });

  it('un décor qui s’allume puis s’éteint : ses surfaces portent `luminaire` exactement quand il éclaire', () => {
    const eclaire = (light: SceneEntity['light']): Scene => ({ ...s, entities: s.entities.map((e) => (e.id === 'tonneau-1' ? { ...e, light } : e)) });
    const luminairesDuTonneau = (e: EtatDuVolume) =>
      e.morceaux.get('pose/0/0/1')!.morceau.surfaces.filter((f) => f.matiere.startsWith('prop--')).map((f) => f.luminaire);
    let etat = avant.etat;
    for (const [k, light] of [undefined, { radiusM: 5 }, undefined].entries()) {
      const repris = reprendEgal(eclaire(light), etat, `pas ${k}`);
      const attendus = luminairesDuTonneau(repris.etat);
      expect(attendus.length, `pas ${k} : le tonneau a des surfaces`).toBeGreaterThan(0);
      expect(attendus, `pas ${k}`).toEqual(attendus.map(() => (light ? true : undefined)));
      etat = repris.etat;
    }
  });

  it('une case du tablier effondrée, sous une case de planches dont le montant descend alors jusqu’au rez', () => {
    const apres = setTileCollapsed(s, 4, 7, 1);
    const montants = (e: EtatDuVolume) => jsonCanonique([...e.montants.get(2)!]);
    expect(montants(entier(apres).etat), 'les montants du dessus changent').not.toBe(montants(avant.etat));
    reprendEgal(apres, avant.etat, 'effondrement');
  });

  it('une case crénelée', () => {
    reprendEgal(paintCrenellated(s, { x: 5, y: 7 }, 'mur-en-pierre', 1, 1), avant.etat, 'crénelage');
  });

  it('un morceau dont seul le rang d’un quad change : les arbres du bois, après une hauteur peinte à côté', () => {
    const { etat } = reprendEgal(paintHeight(s, { x: 11, y: 7 }, 0.4, 1, 0), avant.etat, 'rang seul');
    const [ancien, neuf] = [avant.etat.morceaux.get('pose/0/1/1')!, etat.morceaux.get('pose/0/1/1')!];
    expect(neuf.faces.length).toBe(ancien.faces.length);
    neuf.faces.forEach((f, k) => expect(f.face, 'mêmes faces').toBe(ancien.faces[k].face));
    expect(neuf.morceau.empreinte, 'le morceau se refait').not.toBe(ancien.morceau.empreinte);
  });

  it('un enchaînement de retouches, chacune depuis la précédente, retour à la scène de départ compris ; chaque volume relu après les suivantes reste celui de son calcul entier', () => {
    const gestes: ((t: Scene) => Scene)[] = [
      (t) => paintTiles(t, { x: 7, y: 6 }, 'dalle', 1, 0),
      (t) => paintHeight(t, { x: 4, y: 3 }, 0, 1, 0),
      (t) => setEdgeWall(t, 7, 10, 'N', 0, 'wall'),
      (t) => moveEntityTo(t, 'table-1', { x: 12, y: 3 }),
      (t) => setTileCollapsed(t, 4, 7, 1),
      (t) => paintCrenellated(t, { x: 5, y: 7 }, 'mur-en-pierre', 1, 1),
      () => s,
      (t) => paintHeight(t, { x: 11, y: 7 }, 0.4, 1, 0),
    ];
    const vus: { scene: Scene; volume: VolumeDuMonde }[] = [{ scene: s, volume: avant.volume }];
    let [scene, etat] = [s, avant.etat];
    for (const [k, geste] of gestes.entries()) {
      scene = geste(scene);
      const repris = reprendEgal(scene, etat, `retouche ${k}`);
      vus.push({ scene, volume: repris.volume });
      etat = repris.etat;
    }
    for (const [k, vu] of vus.entries()) expect(vu.volume, `volume ${k} relu`).toEqual(entier(vu.scene).volume);
  });

  it('effondré puis intact (drapeau rendu à `false`), et deux scènes aux mêmes couches dont les effondrements diffèrent, en alternance (#4044)', () => {
    const a = setTileCollapsed(s, 4, 7, 1);
    const b = setTileCollapsed(s, 5, 8, 1);
    const intacte: Scene = { ...a, flags: { ...a.flags, [collapsedTileKey(4, 7, 1)]: false } };
    for (const t of [a, b, intacte]) expect(t.layers, 'mêmes couches').toBe(s.layers);
    let etat = avant.etat;
    for (const [k, scene] of [a, intacte, a, b, a, b, s].entries()) etat = reprendEgal(scene, etat, `pas ${k}`).etat;
  });

  it('deux scènes aux mêmes couches, une tuile d’étage effondrée chacune, calculées l’une après l’autre : le sol de la seconde suit ses seuls effondrements (#4044)', () => {
    const trianglesDeSol = (v: VolumeDuMonde, x: number, y: number, z: number) =>
      v.morceaux.filter((m) => m.cle.startsWith('sol/')).reduce((n, m) => n + m.cases.filter((_, k) => k % 3 === 0 && m.cases[k] === x && m.cases[k + 1] === y && m.cases[k + 2] === z).length, 0);
    const a = setTileCollapsed(s, 4, 7, 1);
    const b = setTileCollapsed(s, 5, 8, 1);
    expect(b.layers, 'mêmes couches').toBe(a.layers);
    entier(a);
    const v = entier(b).volume;
    expect(trianglesDeSol(v, 5, 8, 1), 'la tuile effondrée de b').toBe(0);
    expect(trianglesDeSol(v, 4, 7, 1), 'la tuile intacte de b').toBeGreaterThan(0);
  });

  it('la scène à navire : une case d’eau peinte, la mer reprise', () => {
    const s0 = bassin([nav('c1', 10, 2)]);
    const v0 = entier(poserLesNavires(s0));
    const { etat } = reprendEgal(poserLesNavires(paintTiles(s0, { x: 20, y: 20 }, 'sable', 1, 0)), v0.etat, 'navire');
    expect(etat.mer.size, 'la flottaison du navire').toBeGreaterThan(0);
    for (const [cle, faces] of etat.mer) expect(faces).toBe(v0.etat.mer.get(cle));
  });

  it('un autre cadre : une couche ajoutée, une couche changée de cote, la carte élargie, la carte allongée', () => {
    reprendEgal(addLayer(s, 3), avant.etat, 'couche ajoutée');
    reprendEgal(addLayer(removeLayer(s, 2), 3), avant.etat, 'cote changée');
    reprendEgal(resizeGrid(s, W + 2, H), avant.etat, 'largeur');
    reprendEgal(resizeGrid(s, W, H + 2), avant.etat, 'hauteur');
  });

  it('la scène à navire : le navire déplacé, le navire retourné', () => {
    const s0 = bassin([nav('c1', 10, 2)]);
    const v0 = entier(poserLesNavires(s0));
    const navire = (f: (e: SceneEntity) => SceneEntity): Scene => poserLesNavires({ ...s0, entities: s0.entities.map((e) => (e.id === 'c1' ? f(e) : e)) });
    const cases = (t: Scene) => jsonCanonique([...provenanceDesNavires(t).cases]);
    const gestes: [string, (e: SceneEntity) => SceneEntity][] = [
      ['déplacé', (e) => ({ ...e, pos: { x: 10, y: 6 } })],
      ['retourné', (e) => ({ ...e, facing: 'E' })],
    ];
    const [deplace] = gestes.map(([quoi, f]) => {
      const apres = navire(f);
      expect(cases(apres), `${quoi} : les cases du navire changent`).not.toBe(cases(poserLesNavires(s0)));
      return reprendEgal(apres, v0.etat, quoi).volume;
    });
    const precedents = new Set(v0.volume.morceaux);
    expect(deplace.morceaux.some((m) => precedents.has(m)), 'déplacé : un morceau repris du précédent').toBe(true);
    expect(deplace.morceaux.some((m) => !precedents.has(m)), 'déplacé : un morceau refait').toBe(true);
  });

  it('la scène à navire : deux caraques échangées, le navire renommé', () => {
    const ab = entier(poserLesNavires(bassin([nav('a', 10, 2), nav('b', 10, 14)])));
    reprendEgal(poserLesNavires(bassin([nav('a', 10, 14), nav('b', 10, 2)])), ab.etat, 'échangés');
    reprendEgal(poserLesNavires(bassin([nav('c', 10, 2), nav('b', 10, 14)])), ab.etat, 'renommé');
  });
});

describe('volumeDepuis : la reprise ne refait que ce que la retouche touche (#3993)', () => {
  it('une case peinte en (2, 2) : les morceaux hors de son bloc (`<genre>/<z>/0/0`) sont ceux du précédent', () => {
    const avant = entier(fort());
    const apres = volumeDepuis(paintTiles(fort(), { x: 2, y: 2 }, 'dalle', 1, 0), avant.etat).volume;
    const precedents = new Map(avant.volume.morceaux.map((m) => [m.cle, m]));
    const loin = apres.morceaux.filter((m) => !m.cle.endsWith('/0/0'));
    expect(loin.length, 'des morceaux hors du voisinage').toBeGreaterThan(0);
    for (const m of loin) expect(m, m.cle).toBe(precedents.get(m.cle));
  });

  it('une scène neuve aux mêmes entrées rend le même volume : un nom, une structure abattue', () => {
    const s = fort();
    const v = volumeDuMonde(s);
    expect(volumeDuMonde({ ...s, label: 'x' })).toBe(v);
    expect(volumeDuMonde({ ...s, flags: { ...s.flags, [structureDownKey(10, 8, 'E', 0)]: true } })).toBe(v);
  });

  it('une retouche d’un seul des champs que lit le volume rend, par `volumeDuMonde`, le volume de son calcul entier', () => {
    const retouches: [string, (t: Scene) => Scene][] = [
      ['layers', (t) => paintTiles(t, { x: 7, y: 6 }, 'dalle', 1, 0)],
      ['walls', (t) => setEdgeWall(t, 7, 10, 'N', 0, 'wall')],
      ['entities', (t) => moveEntityTo(t, 'tonneau-1', { x: 5, y: 10 })],
      ['flags', (t) => setTileCollapsed(t, 4, 7, 1)],
      ['metresPerTile', (t) => ({ ...t, metresPerTile: 4 })],
      ['reliefDefaults', (t) => ({ ...t, reliefDefaults: { ...t.reliefDefaults, deck: { id: 'terre' } } })],
    ];
    for (const [champ, retouche] of retouches) {
      const s = fort();
      volumeDuMonde(s);
      const apres = retouche(s);
      expect(volumeDuMonde(apres), champ).toEqual(entier(apres).volume);
    }
  });

  it('une retouche sans écriture de dataset reprend des morceaux du volume précédent', () => {
    const s = fort();
    const avant = new Set(volumeDuMonde(s).morceaux);
    const apres = paintTiles(s, { x: 2, y: 2 }, 'dalle', 1, 0);
    expect(volumeDuMonde(apres).morceaux.some((m) => avant.has(m)), 'des morceaux repris').toBe(true);
  });

  it('une écriture de dataset entre deux volumes : le volume de la retouche est son calcul entier, aucun morceau repris', () => {
    const s = fort();
    const avant = new Set(volumeDuMonde(s).morceaux);
    bumperDataset('materials');
    const apres = paintTiles(s, { x: 2, y: 2 }, 'dalle', 1, 0);
    const volume = volumeDuMonde(apres);
    expect(volume).toEqual(entier(apres).volume);
    for (const m of volume.morceaux) expect(avant.has(m), m.cle).toBe(false);
  });

  it('sur la scène à navire, une écriture non spatiale repassée par `poserLesNavires` rend les mêmes morceaux', () => {
    const s0 = bassin([nav('c1', 10, 2)]);
    const avant = entier(poserLesNavires(s0));
    const apres = volumeDepuis(poserLesNavires({ ...s0, weather: 'pluie' }), avant.etat).volume;
    expect(apres.morceaux.length).toBe(avant.volume.morceaux.length);
    apres.morceaux.forEach((m, k) => expect(m, m.cle).toBe(avant.volume.morceaux[k]));
  });
});
