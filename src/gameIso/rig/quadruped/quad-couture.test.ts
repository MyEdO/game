import { describe, it, expect } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { QUAD_SPECIES, WINGED_SPECIES } from '../creatures';
import { DEFS } from '../../sprites';
import { toSvg, worldTransformsG, type Matrix } from '../kinematics';
import type { ResolvedBone } from '../composeRig';
import { resolveQuadFromProps, quadBoneScale } from './composeQuad';
import { QUAD_REST, QUAD_DEATH, quadWalkPose, quadBitePose, quadFlinchPose, quadLeapPose } from './quadPose';
import { buildQuadSkeleton, groundQuad, quadSkeletonForView } from './quadSkeleton';
import { quadInterfaces, type QuadInterface, type QuadInterfaceId } from './quadInterfaces';
import { quadHeadBone, quadHeadDef } from './heads';
import type { QuadBoneId, QuadPose, QuadProps } from './quadSkeleton';

/**
 * GARDE DE COUTURE du gabarit quadrupède — deux parts voisines se RECOUVRENT à leur ligne
 * d'interface, sinon l'assemblage laisse voir le joint (une part qui « pose » sur l'autre au lieu
 * d'y entrer). Mesure de PIXELS, pas de géométrie déclarée :
 *  · masques SOLO : chaque os est rendu SEUL (4 px/u, alpha ≥ 200) ; le recouvrement est
 *    l'intersection des deux masques — l'ordre du peintre et l'occlusion par un TIERS n'entrent
 *    pas dans la mesure (angle mort VOULU : on mesure l'emboîtement, pas ce que l'œil voit) ;
 *  · l'assertion porte sur la CORDE : la longueur de recouvrement mesurée SUR la ligne
 *    d'interface (`quadInterfaces`), pas sur l'aire — une aire large mais décalée ne prouve rien ;
 *  · DIRECTION de la corde — la ligne est TRANSVERSE à l'os (son axe local x porté au monde), donc
 *    OBLIQUE dès que l'os est tourné. C'est la section par laquelle l'os voisin entre ; une corde
 *    prise à l'HORIZONTALE du monde mesure une sécante quelconque des deux masques, qui dépend de
 *    la rotation de la pose et non de l'emboîtement. Le choix pèse : `rat-loup repos gorge` vaut
 *    3,75 u en transverse (OUVERTE, seuil 5,6) et 6,5 u à l'horizontale (fermée) ; `dragon mort
 *    gorge` 3,5 contre 26,25. La définition transverse est la seule qui reste comparable d'une
 *    pose à l'autre ;
 *  · la ligne est portée au monde par le SQUELETTE (pivot réel × `quadBoneScale`, la source unique
 *    d'échelle d'os) : elle existe même là où l'os propriétaire ne porte aucun art ;
 *  · seuil RELATIF : ≥ 40 % de l'épaisseur de l'os COUVERT — un cou de 14 u et une cuisse de 9 u
 *    n'exigent pas la même corde ;
 *  · balayage des 8 POSES : une couture peut tenir au repos et s'ouvrir au galop ou à la mort.
 * ANGLE MORT NOMMÉ : l'alpha ne voit pas la couture de VALEUR (deux parts qui se recouvrent
 * franchement peuvent afficher la même luminance de part et d'autre du joint — c'est la platitude
 * locale du harnais `scripts/qc/mesure-volume.mts` qui la mesure).
 * EXEMPTION STRUCTURELLE : les clusters multi-cous dessinent leur profil d'un bloc sur l'os
 * `encolure` (`QuadHeadDef.bone.profile === 'encolure'`) — la couture tête↔encolure n'y existe
 * pas, `quadInterfaces` rend `gorge` nulle. Jamais une liste d'espèces.
 * DEUX CAUSES, DEUX STOCKS : une couture OUVERTE est un défaut d'ART (soldable au pinceau) ; une
 * INTERFACE HORS CADRE (le pivot se projette hors de la boîte 120×150) ne l'est pas — elle se
 * solde par la boîte ou par la pose. Les mélanger ferait payer à l'artiste une dette qui n'est
 * pas la sienne.
 * COÛT : 25 espèces × 8 poses × jusqu'à 5 masques ≈ 1000 rendus (~3 min). C'est le prix d'une
 * mesure au pixel sur tout le parc ; les pixels bruts de resvg sont lus sans passer par un PNG.
 * Le balayage est PARESSEUX (`toutes()`) : au niveau du module, il se payait à la COLLECTE de
 * vitest, donc sur tout run filtré ailleurs dans le dépôt.
 */

const PX_PER_U = 4;
const VB_W = 120, VB_H = 150;
const RENDER_W = VB_W * PX_PER_U, RENDER_H = VB_H * PX_PER_U;
const ALPHA_MIN = 200;
/** Part de l'épaisseur de l'os COUVERT que la corde de recouvrement doit atteindre. */
const CORDE_MIN_RELATIVE = 0.4;
/** Demi-longueur de sondage de la ligne d'interface, en u (au-delà, on est hors du corps). */
const SONDE_DEMI_U = 40;

const POSES: [string, QuadPose][] = [
  ['repos', QUAD_REST],
  ['marche0', quadWalkPose(0)],
  ['marche33', quadWalkPose(0.33)],
  ['marche66', quadWalkPose(0.66)],
  ['morsure', quadBitePose(0.5)],
  ['bond', quadLeapPose(0.5)],
  ['recul', quadFlinchPose(1)],
  ['mort', QUAD_DEATH],
];

/**
 * Les 4 coutures mesurées : ligne d'interface → couple d'os (PORTEUR de l'art, os COUVERT).
 * `hanche` : la ligne est celle de la CROUPE (c'est elle qui déclare l'attache du postérieur), mais
 * l'art de l'arrière-main est peint par `tronc` (`barrel`, quadParts) — la croupe est un os
 * d'attache sans art propre en profil. Le couple de masques est donc tronc↔postérieur.
 */
const COUTURES: { cle: QuadInterfaceId; a: QuadBoneId; b: QuadBoneId }[] = [
  { cle: 'gorge', a: 'tete', b: 'encolure' },
  { cle: 'garrot', a: 'encolure', b: 'tronc' },
  { cle: 'epaule', a: 'tronc', b: 'hautAvD' },
  { cle: 'hanche', a: 'tronc', b: 'hautArD' },
];

const ESPECES: [string, QuadProps][] = [...Object.entries(QUAD_SPECIES), ...Object.entries(WINGED_SPECIES)];

/**
 * POPULATION GELÉE — par NOM, jamais par compte : un compte reste vert si une espèce en remplace
 * une autre, et le parc mesuré change alors sans que rien ne rougisse.
 */
const ESPECES_GELEES = [
  'basilic', 'blaireau', 'boeuf', 'chat-sauvage', 'cheval', 'chien', 'chimere', 'crapaud', 'dragon',
  'grand-cerf', 'griffon', 'hippogriffe', 'hydre', 'le-dechiqueteur-de-cadavres',
  'lion-de-guerre-de-chrace', 'loup', 'manticore', 'ours', 'pegase', 'preyton', 'rat-geant',
  'rat-loup', 'sanglier', 'stegadon', 'varghulf',
];
const POSES_GELEES = ['repos', 'marche0', 'marche33', 'marche66', 'morsure', 'bond', 'recul', 'mort'];

/**
 * Stock GELÉ des coutures OUVERTES (mesuré le 2026-08-05, réglages ci-dessus) : `<espèce> <pose>
 * <couture>`. Ce sont des défauts d'assemblage RÉELS, nommés pour que la garde soit verte sur ce
 * qu'elle protège et ROUGE sur toute NOUVELLE ouverture. Le plafond ne peut que décroître, et
 * aucune entrée ne peut être PÉRIMÉE (une couture refermée SORT de la liste).
 * Familles lisibles dans le stock : le rat-loup et le varghulf n'ont AUCUNE corde au garrot ni à
 * la gorge (leur encolure ne rejoint ni la tête ni le tronc) ; la pose de MORT ouvre l'épaule ou
 * la hanche d'une dizaine d'espèces (le corps bascule, les membres décrochent) ; le loup et le
 * lion de Chrace n'ont aucune corde de hanche, dans TOUTES les poses.
 */
const COUTURES_OUVERTES_GELEES = [
  'dragon marche33 gorge',
  'dragon morsure gorge',
  'dragon mort gorge',
  'griffon morsure gorge',
  'griffon mort gorge',
  'hippogriffe mort gorge',
  'lion-de-guerre-de-chrace bond hanche',
  'lion-de-guerre-de-chrace marche0 hanche',
  'lion-de-guerre-de-chrace marche33 epaule',
  'lion-de-guerre-de-chrace marche33 hanche',
  'lion-de-guerre-de-chrace marche66 hanche',
  'lion-de-guerre-de-chrace morsure hanche',
  'lion-de-guerre-de-chrace mort epaule',
  'lion-de-guerre-de-chrace mort hanche',
  'lion-de-guerre-de-chrace recul gorge',
  'lion-de-guerre-de-chrace recul hanche',
  'lion-de-guerre-de-chrace repos hanche',
  'loup bond hanche',
  'loup marche0 hanche',
  'loup marche33 hanche',
  'loup marche66 hanche',
  'loup morsure hanche',
  'loup mort hanche',
  'loup recul hanche',
  'loup repos hanche',
  'pegase mort gorge',
  'preyton mort gorge',
  'rat-geant recul garrot',
  'rat-loup bond garrot',
  'rat-loup bond gorge',
  'rat-loup marche0 garrot',
  'rat-loup marche0 gorge',
  'rat-loup marche33 garrot',
  'rat-loup marche33 gorge',
  'rat-loup marche66 garrot',
  'rat-loup morsure garrot',
  'rat-loup morsure gorge',
  'rat-loup mort garrot',
  'rat-loup mort gorge',
  'rat-loup recul garrot',
  'rat-loup repos garrot',
  'rat-loup repos gorge',
  'stegadon morsure gorge',
  'stegadon mort gorge',
  'varghulf bond garrot',
  'varghulf bond gorge',
  'varghulf marche0 garrot',
  'varghulf marche0 gorge',
  'varghulf marche33 garrot',
  'varghulf marche33 gorge',
  'varghulf marche66 garrot',
  'varghulf marche66 gorge',
  'varghulf morsure garrot',
  'varghulf morsure gorge',
  'varghulf mort garrot',
  'varghulf mort gorge',
  'varghulf recul garrot',
  'varghulf recul gorge',
  'varghulf repos garrot',
  'varghulf repos gorge',
];

/**
 * Stock GELÉ à cause SÉPARÉE — INTERFACE HORS CADRE. Ces neuf couples ne sont pas des défauts
 * d'assemblage : en pose de MORT, l'articulation elle-même se projette AU SOL ou plus bas
 * (y ≥ 150 mesuré, boîte de rendu 120×150), là où les masques sont coupés par le cadre. La corde
 * y vaut 0 par construction — aucune retouche d'ART ne peut la rouvrir. Ce stock se solde le jour
 * où la BOÎTE ou la POSE de mort change, jamais par un coup de pinceau.
 * Points mesurés (profil, pose `mort`) : blaireau épaule (81,2 · 151,1) · chien épaule
 * (78,1 · 152,9) et hanche (24,7 · 150,9) · crapaud épaule (78,8 · 153,0) et hanche (23,7 · 151,0)
 * · rat géant épaule (80,5 · 152,4) et hanche (21,3 · 150,4) · sanglier épaule (78,1 · 151,1) ·
 * varghulf épaule (80,5 · 150,0).
 */
const INTERFACES_HORS_CADRE_GELEES = [
  'blaireau mort epaule',
  'chien mort epaule',
  'chien mort hanche',
  'crapaud mort epaule',
  'crapaud mort hanche',
  'rat-geant mort epaule',
  'rat-geant mort hanche',
  'sanglier mort epaule',
  'varghulf mort epaule',
];

// ── rendu + masque ────────────────────────────────────────────────────────────────────────
const boneGroup = (b: ResolvedBone) =>
  `<g transform="${toSvg(b.matrix)}"><g transform="scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})">` +
  b.parts.map((p) => `<g>${p.svg}</g>`).join('') + '</g></g>';

/** Masque SOLO d'un os : ses seuls calques rendus, pixels à alpha ≥ 200 (pixels RGBA bruts). */
function masqueSolo(bones: ResolvedBone[], os: QuadBoneId): Uint8Array {
  const body = bones.filter((b) => b.id === os).map(boneGroup).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" width="${VB_W}" height="${VB_H}"><defs>${DEFS}</defs>${body}</svg>`;
  const px = new Resvg(svg, { fitTo: { mode: 'width', value: RENDER_W }, font: { loadSystemFonts: true } }).render().pixels;
  const m = new Uint8Array(RENDER_W * RENDER_H);
  for (let i = 0; i < m.length; i++) if (px[i * 4 + 3] >= ALPHA_MIN) m[i] = 1;
  return m;
}

interface Ligne { x: number; y: number; dx: number; dy: number }

/** Point + direction MONDE d'une interface : pivot réel du squelette × échelle d'OS. */
function ligneMonde(p: QuadProps, pose: QuadPose, i: QuadInterface): Ligne {
  const sk = groundQuad(quadSkeletonForView(buildQuadSkeleton(p), 'profile'), pose);
  const [a, b, c, d, e, f] = (worldTransformsG(sk, pose) as Record<string, Matrix>)[i.os];
  const [sx, sy] = quadBoneScale(p, sk[i.os], i.os, 'profile');
  const proj = (x: number, y: number) => ({ x: a * (x * sx) + c * (y * sy) + e, y: b * (x * sx) + d * (y * sy) + f });
  const o = proj(i.x, i.y);
  // La ligne d'interface est TRANSVERSE à l'os : son axe local x, porté au monde.
  const t = proj(i.x + 1, i.y);
  const n = Math.hypot(t.x - o.x, t.y - o.y) || 1;
  return { x: o.x, y: o.y, dx: (t.x - o.x) / n, dy: (t.y - o.y) / n };
}

/** Corde de recouvrement (u) : longueur d'intersection des deux masques SUR la ligne d'interface. */
function corde(mA: Uint8Array, mB: Uint8Array, l: Ligne): number {
  let n = 0;
  const pas = 1 / PX_PER_U; // un pixel
  for (let s = -SONDE_DEMI_U; s <= SONDE_DEMI_U; s += pas) {
    const px = Math.round((l.x + l.dx * s) * PX_PER_U), py = Math.round((l.y + l.dy * s) * PX_PER_U);
    if (px < 0 || px >= RENDER_W || py < 0 || py >= RENDER_H) continue;
    const i = py * RENDER_W + px;
    if (mA[i] && mB[i]) n++;
  }
  return +(n * pas).toFixed(2);
}

interface Mesure { cle: string; corde: number; seuil: number; horsBoite: boolean }

/** Toutes les mesures de couture — détecteur UNIQUE du fichier (`retrecir` = cas planté). */
function mesures(retrecir?: { os: QuadBoneId; facteur: number }, especes: [string, QuadProps][] = ESPECES): Mesure[] {
  const out: Mesure[] = [];
  for (const [espece, p] of especes) {
    const inter = quadInterfaces(p, 'profile');
    for (const [pose, delta] of POSES) {
      let bones = resolveQuadFromProps(p, 'profile', delta);
      // Cas PLANTÉ (TDD) : une part rétrécie autour de son pivot — la couture doit s'ouvrir.
      if (retrecir) bones = bones.map((b) => (b.id === retrecir.os
        ? { ...b, scale: [b.scale[0] * retrecir.facteur, b.scale[1] * retrecir.facteur] as [number, number] }
        : b));
      const cache = new Map<QuadBoneId, Uint8Array>();
      const masque = (os: QuadBoneId) => cache.get(os) ?? cache.set(os, masqueSolo(bones, os)).get(os)!;
      for (const c of COUTURES) {
        const i = inter[c.cle];
        if (!i) continue; // exemption STRUCTURELLE (cluster multi-cous : pas de couture de gorge)
        const l = ligneMonde(p, delta, i);
        out.push({
          cle: `${espece} ${pose} ${c.cle}`,
          corde: corde(masque(c.a), masque(c.b), l),
          seuil: +(i.epaisseurVoisin * CORDE_MIN_RELATIVE).toFixed(2),
          horsBoite: !(l.x >= 0 && l.x <= VB_W && l.y >= 0 && l.y <= VB_H),
        });
      }
    }
  }
  return out;
}

/** Mesures du parc INTACT, calculées à la PREMIÈRE demande. Au niveau du module, ce balayage
 *  (~1000 rendus) se payait à la COLLECTE de vitest, donc sur TOUT run filtré, même sur un autre
 *  fichier. Jamais d'échantillonnage de poses en échange : 40 des 69 ouvertures vivent dans les
 *  poses `mort` et `marche*`. */
let _toutes: Mesure[] | null = null;
const toutes = (): Mesure[] => (_toutes ??= mesures());
const ouvertes = (ms: Mesure[]) => ms.filter((m) => m.corde < m.seuil);

describe('couture du gabarit quadrupède : deux parts voisines se recouvrent à leur interface', () => {
  it('population GELÉE : les 25 espèces et les 8 poses, par NOM', () => {
    expect(ESPECES.map(([id]) => id).sort()).toEqual([...ESPECES_GELEES].sort());
    expect(POSES.map(([nom]) => nom)).toEqual(POSES_GELEES);
  });

  it('couvre 25 espèces × 8 poses × 4 coutures (moins les gorges structurellement absentes)', () => {
    const clusters = ESPECES.filter(([, p]) => quadHeadBone(quadHeadDef(p.head), 'profile') === 'encolure').length;
    expect(clusters).toBeGreaterThanOrEqual(3);
    expect(toutes().length).toBe((ESPECES.length * COUTURES.length - clusters) * POSES.length);
  });

  it('aucune couture OUVERTE hors des stocks gelés (corde ≥ 40 % de l’épaisseur de l’os couvert)', () => {
    const gele = (m: Mesure) => COUTURES_OUVERTES_GELEES.includes(m.cle) || INTERFACES_HORS_CADRE_GELEES.includes(m.cle);
    const neuves = ouvertes(toutes())
      .filter((m) => !gele(m))
      .map((m) => `${m.cle} : corde ${m.corde} u < seuil ${m.seuil} u`);
    expect(neuves).toEqual([]);
    // Le stock ne peut que RÉTRÉCIR : une couture refermée se retire de la liste…
    expect(ouvertes(toutes()).length).toBeLessThanOrEqual(COUTURES_OUVERTES_GELEES.length + INTERFACES_HORS_CADRE_GELEES.length);
    // … et il ne contient AUCUNE entrée périmée : une couture refermée qui resterait gelée
    // maintiendrait un plafond menteur, et une régression ultérieure y passerait inaperçue.
    const ouvertesCles = new Set(ouvertes(toutes()).map((m) => m.cle));
    expect([...COUTURES_OUVERTES_GELEES, ...INTERFACES_HORS_CADRE_GELEES].filter((c) => !ouvertesCles.has(c)),
      'entrée gelée qui n’est plus ouverte — à retirer du stock').toEqual([]);
  });

  it('le stock HORS CADRE est MESURÉ hors cadre, et lui seul', () => {
    const horsCadre = toutes().filter((m) => m.horsBoite).map((m) => m.cle).sort();
    expect(horsCadre).toEqual([...INTERFACES_HORS_CADRE_GELEES].sort());
    // Une entrée hors cadre n'appartient pas au stock des coutures ouvertes : sa cause est autre.
    expect(INTERFACES_HORS_CADRE_GELEES.filter((c) => COUTURES_OUVERTES_GELEES.includes(c))).toEqual([]);
  });

  /** Baseline FIGÉE : l'étalon bovin, épaule au repos (le parc va de 0 à 41 u). */
  it('baseline bœuf tronc↔hautAvD (épaule, repos) = 21,75 u', () => {
    const m = toutes().find((x) => x.cle === 'boeuf repos epaule');
    expect(m, 'mesure bœuf/repos/épaule absente').toBeTruthy();
    expect(m!.corde).toBeCloseTo(21.75, 2);
  });

  /**
   * Cas PLANTÉ (TDD) : l'encolure rétrécie de 30 % autour de son pivot. La garde DOIT voir des
   * ouvertures NEUVES (hors stock gelé) — sans ce cas, rien ne prouve qu'elle mesure
   * l'emboîtement plutôt qu'une constante. Rejoué sur trois espèces témoins (8 poses chacune) ;
   * la couverture du parc est le travail de l'assertion ci-dessus.
   */
  it('cas PLANTÉ : une part rétrécie de 30 % ouvre des coutures NEUVES', () => {
    const temoins = ESPECES.filter(([id]) => ['boeuf', 'cheval', 'loup'].includes(id));
    expect(temoins.length).toBe(3);
    const plante = mesures({ os: 'encolure', facteur: 0.7 }, temoins);
    const neuves = ouvertes(plante).filter((m) => !COUTURES_OUVERTES_GELEES.includes(m.cle));
    expect(neuves.length).toBeGreaterThan(0);
    // La gorge du bœuf, tenue dans le parc intact, s'ouvre franchement une fois la part rétrécie.
    expect(toutes().find((x) => x.cle === 'boeuf repos gorge')!.corde).toBeGreaterThanOrEqual(5.6);
    expect(plante.find((x) => x.cle === 'boeuf repos gorge')!.corde).toBeLessThan(5.6);
  });
});
