import { describe, it, expect } from 'vitest';
import { tilesBetween, lineOfSightCover, couvertDArete, smokeZone } from './lineOfSight';
import { coverModifier } from '../engine/cover';
import { Scene, SceneEntity, WallSeg, wallBetween, doorKey, setStructureDown } from './scene';

function scene(w: number, h: number, tiles?: Record<string, string>, entities: SceneEntity[] = []): Scene {
  const grid = new Array(w * h).fill('herbe');
  if (tiles)
    for (const [k, v] of Object.entries(tiles)) {
      const [x, y] = k.split(',').map(Number);
      grid[y * w + x] = v;
    }
  return {
    id: 's',
    name: 's',
    dimensions: { w, h },
    ambiance: 'jour',
    layers: [{ z: 0, tiles: grid }],
    entities,
   
    dialogues: [],
    triggers: [],
    encounters: [],
  } as unknown as Scene;
}

const prop = (id: string, x: number, y: number): SceneEntity =>
  ({ id, kind: 'prop', pos: { x, y }, ref: id }) as SceneEntity;

describe('tilesBetween — cases strictement entre deux points', () => {
  it('horizontal', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });
  it('diagonal', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([{ x: 1, y: 1 }]);
  });
  it('adjacent → aucune case intermédiaire', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });
});

describe('coverModifier — valeurs canon (LDB 14 l.72/81/86)', () => {
  it('imparfaite -10, moyenne -20, totale -30, none 0', () => {
    expect(coverModifier('none')).toBe(0);
    expect(coverModifier('imparfaite')).toBe(-10);
    expect(coverModifier('moyenne')).toBe(-20);
    expect(coverModifier('totale')).toBe(-30);
  });
});

describe('lineOfSightCover', () => {
  it('ligne dégagée → aucun couvert, non bloquée', () => {
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
  it('sous-bois (bois) sur la ligne → imparfaite', () => {
    const s = scene(5, 1, { '2,0': 'bois' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'imparfaite' });
  });
  it('mur à distance de la cible → pas de Ligne de Vue (bloqué)', () => {
    const s = scene(6, 1, { '2,0': 'mur' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, []).blocked).toBe(true);
  });
  it('mur ADJACENT à la cible → couverture totale -30, non bloqué', () => {
    const s = scene(5, 1, { '3,0': 'mur' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'totale' });
  });
  it('clôture à claire-voie sur la ligne → imparfaite -10 (étalon de la haie, LDB 14 l.72)', () => {
    const s = scene(5, 1, {}, [prop('cloture', 2, 0)]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'imparfaite' });
  });
  it('empreinte de charrette (2×1) → couvre ses deux cases', () => {
    const s = scene(6, 1, {}, [prop('charrette', 3, 0)]); // empreinte 2×1 DÉRIVÉE de sa recette volumique (`props.json`), cap par défaut
    // la case 4,0 fait partie de l'empreinte → couvert moyen sur la ligne 0,0 → 5,0
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, [])).toEqual({ blocked: false, cover: 'moyenne' });
  });
  it('créature intercalée → couvert imparfait (extrapolation 14 l.75)', () => {
    const occ = [{ x: 2, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, occ)).toEqual({ blocked: false, cover: 'imparfaite' });
  });
  it('retient la PIRE classe de couvert sur la ligne', () => {
    const s = scene(6, 1, { '1,0': 'bois' }, [prop('tonneau', 3, 0)]);
    // bois (imparfaite) + tonneau (moyenne) → pire = moyenne
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, [])).toEqual({ blocked: false, cover: 'moyenne' });
  });
});

describe('portes dynamiques (ouvert / fermé) — vue ET passage', () => {
  const doorScene = (closed?: boolean, flagOpen?: boolean): Scene => {
    const s = scene(3, 1) as Scene & { walls: WallSeg[]; flags: Record<string, boolean> };
    s.walls = [{ x: 1, y: 0, side: 'E', door: true, ...(closed ? { closed: true } : {}) }];
    s.flags = flagOpen === undefined ? {} : { [doorKey(1, 0, 'E', 0)]: flagOpen };
    return s;
  };
  it('porte OUVERTE (défaut) → ne bloque NI la vue NI le passage', () => {
    const s = doorScene();
    expect(wallBetween(s, 1, 0, 2, 0)).toBe(false);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 2, y: 0 }, []).blocked).toBe(false);
  });
  it('porte FERMÉE (authored) → bloque la vue ET le passage', () => {
    const s = doorScene(true);
    expect(wallBetween(s, 1, 0, 2, 0)).toBe(true);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 2, y: 0 }, []).blocked).toBe(true);
  });
  it('flag runtime ouvre une porte fermée / ferme une porte ouverte', () => {
    expect(wallBetween(doorScene(true, true), 1, 0, 2, 0)).toBe(false); // fermée+flag ouvert → ouverte
    expect(wallBetween(doorScene(false, false), 1, 0, 2, 0)).toBe(true); // ouverte+flag fermé → fermée
  });
});

describe('lineOfSightCover — Fumée (Souffle (Fumée)) bloque la vue', () => {
  it('fumée INTERCALÉE sur la ligne → bloquée (totale)', () => {
    const smoke = [{ x: 2, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [], smoke)).toEqual({ blocked: true, cover: 'totale' });
  });
  it('cible DANS la fumée (extrémité) → bloquée', () => {
    const smoke = [{ x: 4, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [], smoke).blocked).toBe(true);
  });
  it('tireur DANS la fumée (extrémité source) → bloqué (aveuglé)', () => {
    const smoke = [{ x: 0, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [], smoke).blocked).toBe(true);
  });
  it('fumée HORS de la ligne → aucun effet', () => {
    const smoke = [{ x: 2, y: 3 }];
    expect(lineOfSightCover(scene(5, 5), { x: 0, y: 0 }, { x: 4, y: 0 }, [], smoke)).toEqual({ blocked: false, cover: 'none' });
  });
  it('sans argument fumée → comportement inchangé (rétro-compatible)', () => {
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
});

describe('lineOfSightCover — murs d\'arête (Scene.walls) bloquent la vue', () => {
  const withWalls = (s: Scene, walls: WallSeg[]): Scene => ({ ...s, walls });

  it('mur d\'arête sur le trajet → vue bloquée (on ne voit pas à travers les murs)', () => {
    const s = withWalls(scene(5, 1), [{ x: 2, y: 0, side: 'E' }]); // arête entre (2,0) et (3,0)
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, []).blocked).toBe(true);
  });
  it('mur d\'arête entre deux cases ADJACENTES → vue bloquée', () => {
    const s = withWalls(scene(2, 1), [{ x: 0, y: 0, side: 'E' }]); // arête entre (0,0) et (1,0)
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 1, y: 0 }, []).blocked).toBe(true);
  });
  it('porte (door) sur le trajet → vue NON bloquée (ouverture, V1)', () => {
    const s = withWalls(scene(5, 1), [{ x: 2, y: 0, side: 'E', door: true }]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, []).blocked).toBe(false);
  });
  it('mur d\'arête HORS du trajet → aucun effet', () => {
    const s = withWalls(scene(5, 2), [{ x: 2, y: 1, side: 'E' }]); // sur la ligne y=1, pas y=0
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
  it('mur d\'arête sur un AUTRE étage (z) → aucun effet sur z=0', () => {
    const s = withWalls(scene(5, 1), [{ x: 2, y: 0, side: 'E', z: 1 }]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, []).blocked).toBe(false);
  });
  it('un mur droit bloque AUSSI une ligne de vue DIAGONALE (pas de coin qui fuit)', () => {
    // mur horizontal sur l'arête N de (1,1) et (2,1) → sépare la rangée 0 de la rangée 1
    const s = withWalls(scene(4, 4), [{ x: 1, y: 1, side: 'N' }, { x: 2, y: 1, side: 'N' }]);
    expect(lineOfSightCover(s, { x: 1, y: 0 }, { x: 2, y: 2 }, []).blocked).toBe(true);
  });
  it('une diagonale SANS mur reste dégagée (pas de sur-blocage)', () => {
    const s = withWalls(scene(4, 4), [{ x: 0, y: 1, side: 'N' }]); // mur ailleurs, hors du trajet
    expect(lineOfSightCover(s, { x: 1, y: 0 }, { x: 2, y: 2 }, []).blocked).toBe(false);
  });
});

describe('smokeZone — emprise d\'un nuage de Souffle (Fumée)', () => {
  it('disque de Chebyshev `radius` autour du centre', () => {
    const z = smokeZone({ x: 0, y: 5 }, { x: 5, y: 5 }, 1);
    // 3×3 autour de (5,5) = 9 cases ; le trajet 0,5→5,5 (cases 1..4) en ajoute 4 hors disque
    expect(z).toContainEqual({ x: 5, y: 5 });
    expect(z).toContainEqual({ x: 4, y: 4 });
    expect(z).toContainEqual({ x: 6, y: 6 });
    expect(z.filter((t) => t.y === 5 && t.x >= 4 && t.x <= 6).length).toBe(3); // ligne centrale du disque
  });
  it('inclut le trajet tireur→centre mais PAS la case source', () => {
    const z = smokeZone({ x: 0, y: 0 }, { x: 5, y: 0 }, 0);
    expect(z).toContainEqual({ x: 3, y: 0 }); // trajet
    expect(z).toContainEqual({ x: 5, y: 0 }); // centre (radius 0)
    expect(z).not.toContainEqual({ x: 0, y: 0 }); // la créature souffle DEPUIS sa case (non enfumée)
  });
  it('souffle à bout portant : la case source reste hors fumée même DANS le disque (immunité)', () => {
    // attaquant en (4,5) adjacent à la cible (5,5), rayon 2 → la source est dans le disque
    const z = smokeZone({ x: 4, y: 5 }, { x: 5, y: 5 }, 2);
    expect(z).toContainEqual({ x: 5, y: 5 }); // cible enfumée
    expect(z).not.toContainEqual({ x: 4, y: 5 }); // la créature ne s'aveugle pas (immunisée à son propre Souffle)
  });
  it('souffle sur un étage → cases stampées `z` (#805)', () => {
    const z = smokeZone({ x: 0, y: 5, z: 1 } as never, { x: 5, y: 5, z: 1 } as never, 1);
    expect(z).toContainEqual({ x: 5, y: 5, z: 1 });
  });
});

describe('lineOfSightCover — fumée Z-AWARE (#805)', () => {
  it('une fumée à l’étage 1 ne bloque PAS un tir au sol (étage 0)', () => {
    const s = scene(6, 6);
    const smoke = smokeZone({ x: 3, y: 0, z: 1 } as never, { x: 3, y: 5, z: 1 } as never, 0); // étage 1, sur le trajet
    expect(lineOfSightCover(s, { x: 0, y: 5 }, { x: 5, y: 5 }, [], smoke).blocked).toBe(false);
  });
  it('une fumée au sol (étage 0) bloque bien un tir au sol (non-régression)', () => {
    const s = scene(6, 6);
    const smoke = smokeZone({ x: 3, y: 0 }, { x: 3, y: 5 }, 0); // sur le trajet du tir, même étage
    expect(lineOfSightCover(s, { x: 0, y: 5 }, { x: 5, y: 5 }, [], smoke).blocked).toBe(true);
  });
});

/**
 * COUVERT D'ARÊTE (`AA 10 l.23`) — la Pénalité de Couvert d'une Structure EST la Difficulté par défaut
 * d'un assaillant qui tire sur qui s'y abrite. La situation où le tir atteint une cible qu'une arête
 * INTACTE abrite est le contournement d'EXTRÉMITÉ (« jeter un œil au-delà de l'extrémité d'un mur »,
 * `wallOnSight`) — MÊME ÉTAGE. Le tir INTER-ÉTAGES n'en reçoit aucun : `couvertDArete` le refuse, et
 * son JSDoc dit pourquoi (aucune donnée ne porte le défenseur posté SUR une Structure).
 */
describe('lineOfSightCover — couvert des STRUCTURES d’arête (AA 10 l.23)', () => {
  /** Tireur en (0,0), cible en (2,2) : le dernier pas est DIAGONAL et un seul de ses deux
   *  contournements est muré → la vue passe par l'extrémité, et l'arête N de la cible l'abrite. */
  const from = { x: 0, y: 0 };
  const to = { x: 2, y: 2 };
  const abriteePar = (seg: Partial<WallSeg>, s: Scene = scene(4, 4)): Scene =>
    ({ ...s, walls: [{ x: 2, y: 2, side: 'N', ...seg } as WallSeg] });

  it('la vue PASSE par l’extrémité (sinon il n’y aurait pas de couvert à donner)', () => {
    expect(lineOfSightCover(abriteePar({ structure: 'mur-de-chateau' }), from, to, []).blocked).toBe(false);
  });

  it('mur de château (Très Difficile) → couverture TOTALE, −30', () => {
    const r = lineOfSightCover(abriteePar({ structure: 'mur-de-chateau' }), from, to, []);
    expect(r).toEqual({ blocked: false, cover: 'totale' });
    expect(coverModifier(r.cover)).toBe(-30);
  });

  it('clôture en clayonnage (Intermédiaire) → AUCUN couvert : le canon lui donne +0', () => {
    expect(lineOfSightCover(abriteePar({ structure: 'cloture-en-clayonnage' }), from, to, []).cover).toBe('none');
  });

  it('Structure ADE II (table sans colonne de Couvert, ADE II 8 l.282-288) → aucun couvert supposé', () => {
    expect(lineOfSightCover(abriteePar({ structure: 'mur-en-pierre' }), from, to, []).cover).toBe('none');
  });

  it('Structure dont la colonne d’AA est N/A (Solide porte en bois, l.50) → aucun couvert', () => {
    expect(lineOfSightCover(abriteePar({ structure: 'solide-porte-en-bois' }), from, to, []).cover).toBe('none');
  });

  it('arête SANS structure → aucun couvert : le couvert est une propriété de la Structure', () => {
    expect(lineOfSightCover(abriteePar({}), from, to, []).cover).toBe('none');
  });

  it('arête ABATTUE → 0 couvert (AA 10 l.127, Effondrement)', () => {
    const s = abriteePar({ structure: 'mur-de-chateau' });
    const down = setStructureDown(s, 2, 2, 'N', 0, true);
    expect(lineOfSightCover(down, from, to, []).cover).toBe('none');
  });

  it('FENÊTRE : un cran de moins — mur à ossature en bois (Complexe, imparfaite) descend à aucun couvert', () => {
    const nue = abriteePar({ structure: 'mur-a-ossature-en-bois' });
    expect(lineOfSightCover(nue, from, to, []).cover).toBe('imparfaite');
    const fenetree = abriteePar({ structure: 'mur-a-ossature-en-bois', window: true });
    expect(lineOfSightCover(fenetree, from, to, []).cover).toBe('none');
  });

  it('FENÊTRE sur un mur de château : totale → moyenne, la croisée ne l’efface pas', () => {
    expect(lineOfSightCover(abriteePar({ structure: 'mur-de-chateau', window: true }), from, to, []).cover).toBe('moyenne');
  });

  it('tir INTER-ÉTAGES → AUCUN couvert d’arête, même contre un mur de château', () => {
    const s = scene(4, 4);
    const perchee = { ...s, layers: [...s.layers, { z: 1, tiles: s.layers[0].tiles }], walls: [{ x: 2, y: 2, side: 'N', z: 1, structure: 'mur-de-chateau' } as WallSeg] } as Scene;
    const haut = { x: 2, y: 2, z: 1 };
    // La LdV inter-étages ignore DÉJÀ les arêtes : couvrir la cible ici la protégerait derrière des
    // murs que le tir traverse. Le couvert du défenseur perché attend la donnée qui le porte.
    expect(couvertDArete(perchee, from, haut)).toBe('none');
    expect(lineOfSightCover(perchee, from, haut, [])).toEqual({ blocked: false, cover: 'none' });
  });

  it('l’arête qui abrite est celle du côté du TIREUR : la même arête ne couvre pas un tir venu d’en face', () => {
    const s = abriteePar({ structure: 'mur-de-chateau' });
    // Depuis le SUD-est, l'arête N de (2,2) ne regarde plus le tireur → elle n'abrite pas.
    expect(lineOfSightCover(s, { x: 0, y: 3 }, to, []).cover).toBe('none');
  });

  it('même étage, les DEUX arêtes du coin intactes → il n’y a plus d’extrémité à contourner : vue BLOQUÉE', () => {
    const s: Scene = { ...scene(4, 4), walls: [
      { x: 2, y: 2, side: 'N', structure: 'mur-de-chateau' } as WallSeg,
      { x: 1, y: 2, side: 'E', structure: 'mur-de-chateau' } as WallSeg,
    ] };
    expect(lineOfSightCover(s, from, to, []).blocked).toBe(true);
  });

  /** Deux arêtes abritantes ne se rencontrent PAS via `lineOfSightCover` (l'`it` ci-dessus le montre :
   *  intactes toutes deux, elles bloquent le coin). La fusion se contracte donc sur `couvertDArete`
   *  lui-même, seule porte de la règle. */
  it('deux arêtes abritantes : le plus protecteur des deux l’emporte (fusion `couvertLePlusProtecteur`)', () => {
    const s: Scene = { ...scene(4, 4), walls: [
      { x: 2, y: 2, side: 'N', structure: 'cloture-en-clayonnage' } as WallSeg,
      { x: 1, y: 2, side: 'E', structure: 'mur-a-ossature-en-bois' } as WallSeg,
    ] };
    expect(couvertDArete(s, from, to)).toBe('imparfaite');
  });
});
