/**
 * COUPLE MONTÉ dans le monde VOLUMIQUE (#1176, P3-0h) : un cavalier en selle est UN sujet de
 * billboard COMPOSITE — cavalier assis sur les os réels de la monture (`seatRiderOnMount`), un seul
 * fragment SVG, jamais deux quads superposés. La chaîne mesurée est celle de l'écran : les ÉLÉMENTS
 * du builder (`buildTokens`) → les poses d'acteur (`actorPoses`, ce que `MondeDeCampagne` appelle) → les
 * sujets (`actorBillboards`).
 *
 * ORACLE RE-DÉRIVÉ (C5a) : la parité géométrique se jugeait contre le corps AFFINE (`MountedToken`),
 * mort avec sa voie. Son rôle — un second appelant INDÉPENDANT de la loi de selle — est repris ici :
 * le banc re-dérive le couple attendu à partir des fonctions PURES du rig (`resolveRender`/`planById`
 * → os de la monture, `actorDrawInputs` + `mountedRest` → os du cavalier, `seatRiderOnMount` → le
 * composite), exactement comme le composant le faisait sans ses hooks. Ce qu'il mesure reste la
 * CHAÎNE : que le pipeline volumique porte au couple la bonne monture, le bon cavalier, la bonne vue,
 * la bonne échelle et les bonnes options de gabarit.
 */
import { describe, expect, it, vi } from 'vitest';
import { resetDiagOnce } from '../../rig/devDiag';
import { actorBillboards, actorPoses, actorPoseKey, actorDrawInputs } from './sceneMeshes';
import { buildTokens } from '../../builders/tokens';
import { combatantTokenScale, sizeTokenScale } from '../../sizeScale';
import { planById, resolveRender } from '../../rig/bodyPlan';
import { mountedPlanOpts, mountedRest, seatRiderOnMount } from '../../rig/mountedRig';
import { resolveRig } from '../../rig/composeRig';
import { bonesToSvg } from '../../rig/renderBones';
import { isShield } from '../../rig/parts/equipment';
import type { View } from '../../rig/facing';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../../state/scene';
import type { BattleState } from '../../../state/store';
import type { Combatant, Weapon } from '../../../engine/types';
import { BB_W, BB_H } from '../../pov/billboardCore';
import { subjectQuad } from './billboardMath';
import { MISSING_TONE } from '../../rig/viewArt';

const scene = emptyScene(6, 6);
const mpt = sceneMetresPerTile(scene);
const VIEW = { activeZ: 0, viewZ: null, top: false };
const allVisible = (s: Scene) => {
  const v = new Set<string>();
  for (let y = 0; y < s.dimensions.h; y++) for (let x = 0; x < s.dimensions.w; x++) v.add(`${x},${y},0`);
  return v;
};

/** Monture réelle du bestiaire (id STABLE) : gabarit QUADRUPÈDE, donc os `tronc`. */
const monture = (patch: Partial<Combatant> = {}): Combatant => ({
  id: 'm1', label: 'Cheval', kind: 'enemy', creatureId: 'cheval', pos: { x: 1, y: 1 }, size: 'grande',
  conditions: [], wounds: { current: 10, max: 10 }, riderId: 'h1', ...patch,
} as unknown as Combatant);

/** Cavalier rendu depuis son propre inventaire (rig humanoïde) : os `torse`/`tete`. */
const cavalier = (patch: Partial<Combatant> = {}): Combatant => ({
  id: 'h1', label: 'Cavalier', kind: 'hero', pos: { x: 1, y: 1 }, size: 'moyenne',
  wounds: { current: 12, max: 12 }, weapons: [], characteristics: {}, advantage: 0,
  conditions: [], armour: {}, skills: [], talents: [], movement: 4, career: 'soldat',
  species: 'humain', appearance: { species: 'humain', sex: 'M', build: 0.5 }, mountId: 'm1', ...patch,
} as unknown as Combatant);

const battleOf = (combatants: Combatant[]): BattleState => ({ combatants } as unknown as BattleState);

/** Sujets du monde volumique pour un couple donné — la chaîne EXACTE de l'écran. */
function sujets(mount: Combatant, rider: Combatant) {
  const els = buildTokens(scene, allVisible(scene), battleOf([rider, mount]), VIEW);
  return { poses: actorPoses(els, {}), subjects: actorBillboards(actorPoses(els, {}), scene, mpt) };
}

const osDe = (svg: string) => new Set([...svg.matchAll(/data-bone="([^"]+)"/g)].map((m) => m[1]));
/** Os RENDUS avec leur matrice d'écran : la géométrie, pas seulement la présence. */
const posesDe = (svg: string) => new Map([...svg.matchAll(/data-bone="([^"]+)" transform="([^"]*)"/g)].map((m) => [m[1], m[2]] as const));

/** LE COUPLE ATTENDU, re-dérivé des fonctions PURES du rig — le second appelant indépendant de la loi
 *  de selle, à la place du corps affine mort (cf. l'en-tête). Aucune animation : la pose de repos du
 *  gabarit et la pose montée, ce que le fragment volumique compose lui aussi. */
function coupleAttendu(mount: Combatant, rider: Combatant, view: View): string {
  const mr = resolveRender(mount.species, mount.traits, mount.creatureId ?? mount.label);
  const plan = planById(mr.plan);
  const { appearance, equip, tenue, overlays } = actorDrawInputs(rider).rig!;
  const osMonture = plan.resolve(mr.species, view, plan.restPose(), mountedPlanOpts(mount.creatureId, mount.appearanceOverride));
  const arme = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  const osCavalier = resolveRig(appearance, equip, mountedRest(view, arme), tenue, view, overlays, false);
  // k : échelle du cavalier DANS la boîte de la monture — chaîne d'échelles monde (art × Taille).
  const k = resolveRender(rider.species, rider.traits, rider.creatureId ?? rider.label).scale / (mr.scale * sizeTokenScale(mount.size));
  return bonesToSvg(seatRiderOnMount(osMonture, osCavalier, { view, mountScale: 1, riderScale: k }));
}

// ── bbox d'un fragment SVG dans SA boîte ────────────────────────────────────────────────────────
// Pile de `<g transform>` appliquée aux nombres des attributs géométriques (`d`, cercle, rect).
// Approximation par EXCÈS (les points de contrôle des courbes y entrent) : elle ne peut pas manquer
// un débord, seulement en signaler un plus large que le tracé réel.
type M = [number, number, number, number, number, number];
const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
function parseT(t: string): M {
  let m: M = [1, 0, 0, 1, 0, 0];
  for (const g of t.matchAll(/(matrix|translate|scale|rotate)\(([^)]*)\)/g)) {
    const n = g[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (g[1] === 'matrix') m = mul(m, n as M);
    else if (g[1] === 'translate') m = mul(m, [1, 0, 0, 1, n[0], n[1] ?? 0]);
    else if (g[1] === 'scale') m = mul(m, [n[0], 0, 0, n[1] ?? n[0], 0, 0]);
    else {
      const r = (n[0] * Math.PI) / 180;
      m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
    }
  }
  return m;
}
function bbox(svg: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/, '');
  const pile: M[] = [[1, 0, 0, 1, 0, 0]];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const pt = (x: number, y: number, m: M) => {
    const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
    if (X < minX) minX = X;
    if (X > maxX) maxX = X;
    if (Y < minY) minY = Y;
    if (Y > maxY) maxY = Y;
  };
  for (const g of body.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, self] = g;
    const cur = pile[pile.length - 1];
    if (close) {
      if (tag === 'g') pile.pop();
      continue;
    }
    const tm = /transform="([^"]*)"/.exec(attrs);
    const ici: M = tm ? mul(cur, parseT(tm[1])) : cur;
    if (tag === 'g' && !self) pile.push(ici);
    const d = /\sd="([^"]*)"/.exec(attrs);
    if (d) {
      const nums = d[1].match(/-?\d*\.?\d+(e-?\d+)?/g)?.map(Number) ?? [];
      for (let i = 0; i + 1 < nums.length; i += 2) pt(nums[i], nums[i + 1], ici);
    }
    const cx = /\scx="(-?[\d.]+)"/.exec(attrs), cy = /\scy="(-?[\d.]+)"/.exec(attrs), r = /\sr="(-?[\d.]+)"/.exec(attrs);
    if (cx && cy) {
      const rr = r ? Number(r[1]) : 0;
      pt(Number(cx[1]) - rr, Number(cy[1]) - rr, ici);
      pt(Number(cx[1]) + rr, Number(cy[1]) + rr, ici);
    }
    const x = /\sx="(-?[\d.]+)"/.exec(attrs), y = /\sy="(-?[\d.]+)"/.exec(attrs), w = /\swidth="(-?[\d.]+)"/.exec(attrs), h = /\sheight="(-?[\d.]+)"/.exec(attrs);
    if (x && y && w && h) {
      pt(Number(x[1]), Number(y[1]), ici);
      pt(Number(x[1]) + Number(w[1]), Number(y[1]) + Number(h[1]), ici);
    }
  }
  return { minX: +minX.toFixed(1), minY: +minY.toFixed(1), maxX: +maxX.toFixed(1), maxY: +maxY.toFixed(1) };
}

const LANCE = { label: 'Lance de cavalerie', type: 'melee', group: 'cavalerie', damage: 5, shape: 'lance' } as unknown as Weapon;

describe('Couple monté — UN billboard composite (monture + cavalier)', () => {
  it('le couple entre comme UN acteur (la monture porte la case, le cavalier voyage avec) et sort en UN sujet', () => {
    const { poses, subjects } = sujets(monture(), cavalier());
    expect(poses).toHaveLength(1);
    expect(poses[0].c.id).toBe('m1');
    expect(poses[0].rider?.id).toBe('h1');
    expect(subjects).toHaveLength(1); // jamais deux quads superposés
    expect(subjects[0].scaleK).toBe(combatantTokenScale(monture())); // échelle de la MONTURE, comme l'affine
  });

  it('le fragment porte les DEUX corps : monture ET cavalier', () => {
    const { subjects } = sujets(monture(), cavalier());
    const os = osDe(subjects[0].svg('profile', false, 0));
    expect(os.has('tronc'), 'la monture (barillet quadrupède) manque au composite').toBe(true);
    expect(os.has('torse'), 'le cavalier manque au composite').toBe(true);
    expect(os.has('tete')).toBe(true);
    // Témoin : le MÊME acteur sans cavalier ne rend que la monture.
    const seule = actorBillboards([{ c: monture(), x: 1, y: 1, z: 0 }], scene, mpt);
    expect(osDe(seule[0].svg('profile', false, 0)).has('torse')).toBe(false);
  });

  it('le couple est ASSIS PAR LA LOI : chaque os porte la matrice de l’oracle re-dérivé', () => {
    const mount = monture(), rider = cavalier();
    // Sans orientation au store, le sujet se rend de FACE : c'est la vue comparée.
    const attendu = posesDe(coupleAttendu(mount, rider, 'front'));
    const volumique = posesDe(sujets(mount, rider).subjects[0].svg('front', false, 0));
    expect(attendu.size).toBeGreaterThan(20); // la sonde mord : l'oracle porte bien les deux corps
    expect([...attendu.keys()].filter((b) => !volumique.has(b)), 'os manquants au fragment volumique').toEqual([]);
    expect([...volumique.keys()].filter((b) => !attendu.has(b)), 'os en trop dans le fragment volumique').toEqual([]);
    // Une selle déplacée, une jambe inversée, une échelle de cavalier fausse tombent ICI.
    const différents = [...attendu].filter(([b, t]) => volumique.get(b) !== t).map(([b, t]) => `${b} att=${t} vol=${volumique.get(b)}`);
    expect(différents).toEqual([]);
  });

  it('la BOÎTE du couple contient tout le corps : le crâne du cavalier ne sort plus par le haut', () => {
    const s = sujets(monture(), cavalier()).subjects[0];
    expect(s.box.w).toBe(BB_W);
    expect(s.box.h).toBeGreaterThan(BB_H); // le composite a demandé du ciel au-dessus des 150 px
    for (const v of ['front', 'profile', 'back'] as const) {
      const b = bbox(s.svg(v, false, 0));
      expect(b.minY, `vue ${v} : le haut du couple sort de sa boîte (minY ${b.minY})`).toBeGreaterThanOrEqual(0);
      expect(b.maxY, `vue ${v} : le bas du couple sort de sa boîte (maxY ${b.maxY} / ${s.box.h})`).toBeLessThanOrEqual(s.box.h);
      expect(b.maxY, `vue ${v} : les pieds de la monture ont quitté le bas de la boîte`).toBeGreaterThan(s.box.h - 10);
    }
    // Témoin : un corps SIMPLE garde la boîte canonique (rien n'a bougé pour lui).
    const seule = actorBillboards([{ c: monture({ riderId: undefined }), x: 1, y: 1, z: 0 }], scene, mpt);
    expect(seule[0].box).toEqual({ w: BB_W, h: BB_H });
    expect(bbox(seule[0].svg('front', false, 0)).minY).toBeGreaterThanOrEqual(0);
  });

  it('le QUAD suit la boîte : le couple grandit d’autant, il n’est pas écrasé dans la boîte canonique', () => {
    const couple = sujets(monture(), cavalier()).subjects[0];
    const seule = actorBillboards([{ c: monture({ riderId: undefined }), x: 1, y: 1, z: 0 }], scene, mpt)[0];
    const qc = subjectQuad('jeu', couple), qs = subjectQuad('jeu', seule);
    expect(qc.heightM / couple.box.h).toBeCloseTo(qs.heightM / seule.box.h, 10); // MÊME échelle art → monde
    expect(qc.heightM).toBeGreaterThan(qs.heightM);
    expect(qc.widthM).toBeCloseTo(qs.widthM, 10); // la boîte n'a gagné que du ciel : largeur inchangée
  });

  it('les 3 vues et le miroir suivent le couple comme un corps simple', () => {
    const { subjects } = sujets(monture(), cavalier());
    const s = subjects[0];
    const vues = ['front', 'profile', 'back'] as const;
    const rendus = vues.map((v) => s.svg(v, false, 0));
    expect(new Set(rendus).size).toBe(3); // trois vues distinctes
    for (const r of rendus) expect(osDe(r).has('torse')).toBe(true); // le cavalier est là dans les 3
    expect(s.svg('profile', true, 0)).toContain('scale(-1,1)'); // miroir du COMPOSITE entier
  });

  it('le couple a SA clé de cache : l’équipement du CAVALIER périme le sujet et la clé de mémo', () => {
    const nu = sujets(monture(), cavalier());
    const armé = sujets(monture(), cavalier({ weapons: [LANCE] }));
    expect(armé.subjects[0].svg('profile', false, 0)).not.toBe(nu.subjects[0].svg('profile', false, 0)); // la sonde mord
    expect(armé.subjects[0].identity).not.toBe(nu.subjects[0].identity);
    expect(actorPoseKey(armé.poses[0])).not.toBe(actorPoseKey(nu.poses[0]));
    expect(nu.subjects[0].identity.startsWith('acteur:m1+h1|')).toBe(true);
  });

  it('cavalier SANS rig humanoïde : le couple retombe sur la monture seule et le DIT une fois (dev)', () => {
    resetDiagOnce();
    const cri = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Un cavalier dont le corps est un GABARIT de créature (pas un rig) : `mountedSvg` ne peut pas
    // l'asseoir — 150 des 490 records du bestiaire sont dans ce cas.
    const bête = cavalier({ id: 'h1', creatureId: 'loup', species: undefined, appearance: undefined } as Partial<Combatant>);
    const { subjects } = sujets(monture(), bête);
    expect(subjects).toHaveLength(1);
    expect(osDe(subjects[0].svg('profile', false, 0)).has('tronc')).toBe(true); // la monture est là
    expect(subjects[0].identity.startsWith('acteur:m1|')).toBe(true); // et SEULE (aucun composite)
    expect(cri).toHaveBeenCalledTimes(1);
    expect(cri.mock.calls[0][0]).toContain('couple monté');
    sujets(monture(), bête); // le même défaut ne se redit pas
    expect(cri).toHaveBeenCalledTimes(1);
    cri.mockRestore();
  });
});

/**
 * CÂBLAGE DU CANAL DONNÉE (#1128 L4) : la monture est rendue PORTÉE — ses opts de gabarit passent par
 * `mountedPlanOpts`, donc son harnachement vient de la DONNÉE. Mesuré sur le fragment RENDU du couple,
 * pas sur la fonction seule : un call-site retombé sur `planOptsForRecord` rendrait la bête à cru sans
 * qu'aucun test de la couture ne bronche. (Ce banc vivait sur le corps affine `MountedToken`, mort à
 * C5a — il mesure désormais le MÊME canal sur le sujet volumique, seul rendu du couple.)
 *
 * Le témoin est le REFUS VISIBLE (#223) d'un set non cuit pour l'espèce portée (blaireau, ADE I 07
 * l.48) : sa caisse d'alarme est posée sur le `tronc` en clé NUE, donc lisible dans les 3 vues.
 */
const blaireau = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'm1', label: 'Blaireau', kind: 'enemy', creatureId: 'blaireau', species: 'blaireau',
  size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 }, pos: { x: 1, y: 1 }, riderId: 'h1', ...over,
} as unknown as Combatant);

/** Le CORPS du fragment, rendu de face — sans les `<defs>` que `actorBillboards` préfixe : la palette
 *  partagée y porte le dégradé d'alarme du repli visible, présent sur TOUT fragment (il ne dit donc
 *  rien du corps rendu, cf. `sprites.defsGlobaux()`). */
const corps = (mount: Combatant, avecCavalier = true): string =>
  actorBillboards([{ c: mount, ...(avecCavalier ? { rider: cavalier() } : {}), x: 1, y: 1, z: 0 }], scene, mpt)[0]
    .svg('front', false, 0)
    .replace(/<defs>[\s\S]*?<\/defs>/, '');

describe('Couple monté — la monture portée reçoit son set par la DONNÉE', () => {
  it('le set par défaut atteint le gabarit de la monture ; le nu explicite d’instance le retire', () => {
    const bruit = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(corps(blaireau()), 'le set n’atteint pas le rendu monté : la bête porterait le cavalier À CRU').toContain(MISSING_TONE);
    expect(corps(blaireau({ appearanceOverride: { harnais: '' } })), 'nu explicite d’instance').not.toContain(MISSING_TONE);
    // Témoin du CANAL : la même bête SANS cavalier passe par `planOptsForRecord` — aucun set, aucune alarme.
    expect(corps(blaireau({ riderId: undefined }), false), 'une monture non portée ne reçoit pas le set').not.toContain(MISSING_TONE);
    bruit.mockRestore();
  });

  it('le gabarit de la monture vient du `creatureId`, jamais du label libre', () => {
    // Une monture nommée librement doit rester un QUADRUPÈDE. Empreinte mesurée : l'os `tronc`
    // (barillet quad) — le gabarit bipède du repli rend `torse` et n'a aucun `tronc`.
    const roussine = blaireau({ label: 'Roussine du sergent', creatureId: 'cheval', species: undefined });
    expect(corps(roussine), 'label libre suivi : la monture est rendue avec le gabarit de repli').toContain('data-bone="tronc"');
  });
});
