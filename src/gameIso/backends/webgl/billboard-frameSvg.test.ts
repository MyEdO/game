/**
 * COUTURE DE DESSIN PAR FRAME (#1176, L3/L4) : `BillboardSubject.frameSvg` est la MÊME chaîne que
 * `svg`, au rang de frame d'un geste — ce qu'un flipbook cuit cellule par cellule. Ce que la garde
 * mesure : la PARITÉ (frame 0 d'un geste au repos = le fragment figé du build), l'EFFET (deux rangs
 * donnent deux fragments — un gabarit qui ne lit pas sa phase rendrait N statues), la PRISE D'ARME
 * (perdue, le corps cuit a lâché sa garde), et l'AMBIANCE authorée d'un figurant (`SceneEntity.anim`),
 * qui n'existait pas du tout en volumique.
 *
 * Le couple MONTÉ, composite à deux corps, ne porte pas la couture.
 */
import { describe, expect, it } from 'vitest';
import { actorBillboards, collectBillboards, rigGroundTilt, type ActorPose } from './sceneMeshes';
import { BB_H, BB_W } from '../../pov/billboardCore';
import { subjectQuad } from './billboardMath';
import { RIG_GROUND_PIVOT, rigGroundTiltDeg } from '../../groundPose';
import { emptyScene, sceneMetresPerTile, type SceneEntity } from '../../../state/scene';
import { combatantRender } from '../../sizeScale';
import { atlasFrames } from '../../stage/boardPose';
import {
  planAmbientDef,
  planAttackDef,
  planDyingDef,
  planWalkDef,
  rigAmbientDef,
  rigIdleDef,
  rigWalkDef,
} from '../../rig/anim/actorAnimSelect';
import type { TokenEl } from '../../builders/types';
import type { Combatant, Weapon } from '../../../engine/types';

const scene = emptyScene(6, 6);
const mpt = sceneMetresPerTile(scene);

function acteur(patch: Partial<Combatant> = {}): Combatant {
  return {
    id: 'a1', label: 'Acteur', kind: 'hero', pos: { x: 1, y: 1 }, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [], characteristics: {}, advantage: 0,
    conditions: [], armour: {}, skills: [], talents: [], movement: 4, career: 'soldat', species: 'humain',
    ...patch,
  } as unknown as Combatant;
}

/** Arme à forme DESSINÉE : sa classe de maniement (`hampe`) porte une prise à deux mains non vide
 *  (`weaponRest`) — c'est cette prise que la parité frame 0 doit voir. */
const HALLEBARDE: Weapon = { id: 'hallebarde', label: 'Hallebarde', damage: 5, group: 'hast', shape: 'hallebarde' } as unknown as Weapon;

const pose = (c: Combatant): ActorPose => ({ c, x: 1, y: 1, z: 0, facing: 'S' });
const sujet = (c: Combatant) => actorBillboards([pose(c)], scene, mpt)[0];

/** Les fragments des `n` frames d'un geste, dans l'ordre — ce que le cuiseur rasteriserait. */
function frames(s: ReturnType<typeof sujet>, def: Parameters<NonNullable<typeof s.frameSvg>>[2], n: number): string[] {
  return Array.from({ length: n }, (_, k) => s.frameSvg!('front', false, def, k, n));
}

describe('BillboardSubject.frameSvg — rig bipède', () => {
  it('PARITÉ frame 0 : le repos d’un corps à MAINS NUES rend exactement le fragment du build', () => {
    const s = sujet(acteur());
    expect(s.frameSvg).toBeTypeOf('function');
    expect(s.frameSvg!('front', false, rigIdleDef(), 0, 8)).toBe(s.svg('front', false, 0));
  });

  it('PRISE D’ARME : le corps ARMÉ ne rend PAS le fragment du build — il tient sa garde', () => {
    // Le fragment statique (`svg`) est dessiné à la pose VIDE : sans `weaponRest` composée à chaque
    // frame, la première cellule d’une planche redonnerait ce même fragment, arme lâchée.
    const armé = sujet(acteur({ weapons: [HALLEBARDE] } as Partial<Combatant>));
    expect(armé.frameSvg!('front', false, rigIdleDef(), 0, 8)).not.toBe(armé.svg('front', false, 0));
  });

  it('EFFET : les frames d’une MARCHE diffèrent l’une de l’autre', () => {
    const s = sujet(acteur());
    const marche = rigWalkDef({})!;
    const f = frames(s, marche, atlasFrames(marche));
    expect(new Set(f).size, 'un marcheur dont toutes les cellules sont identiques est une statue').toBeGreaterThan(2);
  });

  it('EFFONDREMENT : la chute part du DEBOUT et n’y reste pas', () => {
    const s = sujet(acteur());
    const n = 8;
    const début = s.frameSvg!('front', false, rigIdleDef(), 0, n, { ground: 'corpse' });
    const fin = s.frameSvg!('front', false, rigIdleDef(), n - 1, n, { ground: 'corpse' });
    expect(début).toBe(s.svg('front', false, 0)); // pose vide = le corps debout du build
    expect(fin).not.toBe(début);
  });

  it('couple MONTÉ : composite à deux corps → aucune couture de frame', () => {
    const monture = { id: 'm1', label: 'Cheval', kind: 'enemy', creatureId: 'cheval', pos: { x: 1, y: 1 }, size: 'grande', conditions: [], wounds: { current: 10, max: 10 }, riderId: 'a1' } as unknown as Combatant;
    const couple = actorBillboards([{ c: monture, rider: acteur(), x: 1, y: 1, z: 0 }], scene, mpt)[0];
    expect(couple.svg('front', false, 0).length).toBeGreaterThan(0);
    expect(couple.frameSvg).toBeUndefined();
  });

  it('un def de l’AUTRE voie ne se joue pas sur ce corps : il rend son repos', () => {
    const s = sujet(acteur());
    expect(s.frameSvg!('front', false, planWalkDef(), 3, 8)).toBe(s.svg('front', false, 0));
  });
});

// ————————————————————————————————————————————————————————————————
// UN HORS DE COMBAT EST À TERRE — la BASCULE du corps en billboard (#1334)
// ————————————————————————————————————————————————————————————————
//
// La pose d'os d'un corps au sol (`CORPSE_POSE`) n'est qu'un affaissement de membres : sans la
// rotation de tout le rig autour de ses pieds, le mort reste DEBOUT à l'écran (défaut mesuré : un
// Gobelin mis hors de combat, planté sur ses jambes, capture utilisateur). Le monde volumique ne l'a
// JAMAIS portée (elle vivait au seul jeton affine, `RigToken`) — c'est ce que ces gardes ferment.

describe('Bascule au sol — la géométrie de la boîte (#1334)', () => {
  /** Les quatre coins de la boîte de rig, passés par la transformation que le fragment porte. La
   *  mesure est INDÉPENDANTE de l'implémentation : elle relit la chaîne SVG émise et applique
   *  elle-même la rotation. */
  function coins(transform: string): { x: number; y: number }[] {
    const m = /^translate\(([-\d.]+),([-\d.]+)\) rotate\(([-\d.]+),([\d.]+),([\d.]+)\)$/.exec(transform);
    expect(m, `transformation illisible : ${transform}`).not.toBeNull();
    const [dx, dy, deg, cx, cy] = m!.slice(1).map(Number);
    const a = (deg * Math.PI) / 180;
    return ([[0, 0], [BB_W, 0], [0, BB_H], [BB_W, BB_H]] as const).map(([x, y]) => ({
      x: dx + cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
      y: dy + cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
    }));
  }

  for (const ground of ['corpse', 'prone'] as const) {
    it(`\`${ground}\` : le corps basculé TIENT dans sa boîte, posé au sol et centré sur la case`, () => {
      const t = rigGroundTilt(ground);
      expect(t.boxW, 'une boîte inchangée trancherait le corps couché (tête à x≈208 à 82°)').toBeGreaterThan(BB_W);
      for (const mirror of [false, true]) {
        for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
          const c = coins(t.at(frac, mirror));
          const xs = c.map((p) => p.x);
          const ys = c.map((p) => p.y);
          const dit = `${ground} frac=${frac} mirror=${mirror}`;
          expect(Math.min(...xs), `${dit} : corps tranché à gauche`).toBeGreaterThanOrEqual(-0.01);
          expect(Math.max(...xs), `${dit} : corps tranché à droite`).toBeLessThanOrEqual(t.boxW + 0.01);
          expect(Math.min(...ys), `${dit} : corps tranché en haut`).toBeGreaterThanOrEqual(-0.01);
          // POSÉ AU SOL : le bas du corps EST le bas de la boîte, donc l'ancre du quad — jamais
          // flottant, jamais enterré.
          expect(Math.max(...ys), `${dit} : le corps ne repose pas sur le sol`).toBeCloseTo(t.boxH, 2);
          // CENTRÉ sur la case : l'ancre du quad est au milieu de la boîte.
          expect((Math.min(...xs) + Math.max(...xs)) / 2, `${dit} : corps décentré de sa case`).toBeCloseTo(t.boxW / 2, 2);
        }
      }
    });
  }

  it('la bascule PART de zéro et VA jusqu’à l’angle du stage — et le miroir tombe de l’autre côté', () => {
    const t = rigGroundTilt('corpse');
    expect(t.at(0, false)).toContain(`rotate(0,${RIG_GROUND_PIVOT.x},${RIG_GROUND_PIVOT.y})`);
    expect(t.at(1, false)).toContain(`rotate(${rigGroundTiltDeg('corpse')},`);
    expect(t.at(1, true)).toContain(`rotate(${-rigGroundTiltDeg('corpse')},`);
    // À TERRE (conscient) se relève à demi : sa bascule est PLUS FAIBLE que celle du cadavre.
    expect(rigGroundTiltDeg('prone')).toBeLessThan(rigGroundTiltDeg('corpse'));
  });
});

describe('Un corps HORS DE COMBAT est COUCHÉ en volumique (#1334)', () => {
  /** Un ennemi mis hors de combat — l'état RÉEL du store (`isOutOfAction` : `dead`) tel que
   *  `groundStateOf` le lit. */
  const mortAuSol = () => acteur({ id: 'e1', kind: 'enemy', dead: true, wounds: { current: 0, max: 12 } } as Partial<Combatant>);

  it('le SUJET déclare son état au sol, et sa boîte porte la bascule', () => {
    const s = sujet(mortAuSol());
    expect(s.anim?.ground, 'PRÉMISSE : le sujet doit se savoir au sol').toBe('corpse');
    expect(s.box.w, 'boîte canonique = corps couché tranché').toBe(rigGroundTilt('corpse').boxW);
    expect(s.box.h, 'la boîte doit couvrir le balayage entier de la chute').toBe(rigGroundTilt('corpse').boxH);
    // Le corps ne GRANDIT pas pour autant : l'échelle art→monde du quad se prend sur la boîte, donc
    // un pixel de boîte garde sa taille monde (`subjectQuad`) — la boîte gagne du ciel, pas du corps.
    expect(subjectQuad('jeu', s).heightM / s.box.h).toBeCloseTo(subjectQuad('jeu', sujet(acteur())).heightM / BB_H, 6);
  });

  it('le corps du BUILD est BASCULÉ — un mort planté sur ses jambes ne l’est plus', () => {
    const s = sujet(mortAuSol());
    // MUTATION : sans l'enveloppe de bascule, le fragment est le corps debout à pose affaissée.
    expect(s.svg('front', false, 0)).toContain(rigGroundTilt('corpse').at(1, false));
  });

  it('la CHUTE bascule au fil des cellules : debout à la première, posé à la dernière', () => {
    const s = sujet(mortAuSol());
    const n = 10;
    const t = rigGroundTilt('corpse');
    const chute = (k: number) => s.frameSvg!('front', false, rigIdleDef(), k, n, { ground: 'corpse' });
    expect(chute(0), 'la chute doit PARTIR du debout').toContain(t.at(0, false));
    const angles = Array.from({ length: n }, (_, k) => Number(/rotate\(([-\d.]+),/.exec(chute(k))![1]));
    expect(angles[0]).toBe(0);
    // La dernière cellule échantillonne (n−1)/n de la chute (convention `frameSampleMs`, commune à
    // tous les gestes) : le corps y est POSÉ à un pouième près, jamais encore debout.
    expect(angles[n - 1]).toBeGreaterThan(rigGroundTiltDeg('corpse') * 0.99);
    expect(angles[n - 1]).toBeLessThanOrEqual(rigGroundTiltDeg('corpse'));
    // MONOTONE : un corps qui se relèverait en route se lirait ici, et nulle part ailleurs.
    expect(angles.every((a, k) => k === 0 || a >= angles[k - 1]), `angles ${angles}`).toBe(true);
  });

  it('un corps DEBOUT ne porte AUCUNE bascule — la boîte canonique lui reste', () => {
    const s = sujet(acteur());
    expect(s.box.w).toBe(BB_W);
    expect(s.svg('front', false, 0)).not.toContain('rotate(');
  });
});

describe('BillboardSubject.frameSvg — GABARIT de créature (la moitié du bestiaire)', () => {
  const bête = () => acteur({ id: 'b1', creatureId: 'loup', kind: 'enemy', species: undefined } as Partial<Combatant>);

  it('le sujet DÉCLARE sa voie de corps — l’écran n’a jamais à connaître `BodyPlan`', () => {
    const s = sujet(bête());
    expect(combatantRender(bête()).kind).toBe('plan');
    expect(s.anim?.voie).toBe('plan');
    expect(s.frameSvg).toBeTypeOf('function');
  });

  it('EFFET : les frames d’une MARCHE de gabarit diffèrent — plus de statue qui glisse', () => {
    const s = sujet(bête());
    const marche = planWalkDef();
    const f = frames(s, marche, atlasFrames(marche));
    // MUTATION : un `frameSvg` de gabarit qui ignore le rang `k` (phase) rendrait N fois le repos.
    expect(new Set(f).size, 'toutes les cellules identiques = le gabarit ne lit pas sa phase').toBeGreaterThan(2);
  });

  it('EFFET : les frames d’une ATTAQUE de gabarit diffèrent, et l’extension n’est pas le repos', () => {
    const s = sujet(bête());
    const atk = planAttackDef();
    const n = atlasFrames(atk);
    const f = frames(s, atk, n);
    expect(new Set(f).size).toBeGreaterThan(2);
    // L'enveloppe d'une morsure est une CLOCHE (`quadBitePose` : `sin(phase·π)`) — ses deux bouts
    // SONT le repos ; c'est au milieu que la gueule est sortie.
    expect(f[Math.floor(n / 2)], 'la mi-enveloppe est l’extension, jamais le corps du build').not.toBe(s.svg('front', false, 0));
  });

  it('PARITÉ frame 0 : la première cellule d’un effondrement est le corps DEBOUT du build', () => {
    const s = sujet(bête());
    expect(s.frameSvg!('front', false, planDyingDef('corpse'), 0, 8)).toBe(s.svg('front', false, 0));
  });
});

// ————————————————————————————————————————————————————————————————
// AMBIANCE AUTHORÉE d'une entité de scène (`SceneEntity.anim`)
// ————————————————————————————————————————————————————————————————

function figurant(anim?: string, id = 'f1'): SceneEntity {
  return { id, kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 }, facing: 'S', appearance: { species: 'humain' }, ...(anim ? { anim } : {}) } as unknown as SceneEntity;
}

function tokenEl(ent: SceneEntity): TokenEl {
  return {
    kind: 'token', key: `fig:${ent.id}`, id: ent.id, cell: { x: ent.pos.x, y: ent.pos.y, z: 0 },
    subject: { kind: 'figurant', ent, enrolled: false, inBattle: false },
  } as unknown as TokenEl;
}

const figurantSujet = (ent: SceneEntity) =>
  collectBillboards(scene, mpt, { tokens: [tokenEl(ent)], props: [] })[0];

describe('Figurant à ambiance authorée — la donnée éditable JOUE en volumique', () => {
  it('avec `anim` : identité de piste, couture de frame, et ambiance déclarée', () => {
    const s = figurantSujet(figurant('feed'));
    expect(s.eid).toBe('f1');
    expect(s.frameSvg).toBeTypeOf('function');
    expect(s.anim?.ambient).toBe('feed');
    // MUTATION : une identité qui ne porte pas l'ambiance laisserait deux figurants d'anims
    // différentes partager la texture ET la planche du premier arrivé.
    expect(s.identity).toContain('feed');
    expect(s.identity).not.toBe(figurantSujet(figurant('howl')).identity);
  });

  it('sans `anim` : STATIQUE — aucune piste, aucune couture, aucun coût nouveau', () => {
    const s = figurantSujet(figurant());
    expect(s.eid).toBeUndefined();
    expect(s.frameSvg).toBeUndefined();
    expect(s.anim).toBeUndefined();
    expect(s.identity).toBe('perso:f1');
  });

  it('la BOUCLE vit : les cellules du clip d’ambiance diffèrent', () => {
    const s = figurantSujet(figurant('feed'));
    const def = rigAmbientDef('feed')!;
    const f = frames(s, def, atlasFrames(def));
    expect(new Set(f).size, 'un figurant dont toutes les cellules sont identiques est mort').toBeGreaterThan(2);
  });

  it('la CLÉ DE GESTE porte l’ambiance — deux ambiances ne partagent pas de planche', () => {
    expect(rigAmbientDef('feed')!.key).not.toBe(rigAmbientDef('howl')!.key);
    expect(planAmbientDef('feed').key).not.toBe(planAmbientDef('howl').key);
    // Une clé d'ambiance inconnue du catalogue de clips rig ne fabrique aucun geste : corps statique.
    expect(rigAmbientDef('inconnue')).toBeNull();
  });
});
