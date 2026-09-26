import { describe, expect, it } from 'vitest';
import { propSvg } from './decor';
import { scenarioEntities } from '../../scenes/opera/furnished';
import { buildOperaFloorplan } from '../../scenes/opera/floorplan';
import { findPropById, props } from '../../data';
import { aretesNonAppariees, CAP_IDENTITE_PROP, empreinteDeriveeDuProp, empriseLocaleM, placeAssiseDe, placesLocalesDuProp, PROP_CYLINDER_AXES, REPERE_D_AXE, rotatePropLocal, type PropCylinderSides, type PropData, type PropPrimitive } from '../../data/props.types';
import { decorFootGeometry } from '../../state/footprint';
import { buildProps } from '../builders/props';
import { buildPropVolumes } from '../builders/propVolumes';
import { estPropVolumique, type Face } from '../builders/types';
import { bakeWorldGeometry, collectBillboards, wholeSceneBillboardEls } from '../backends/webgl/sceneMeshes';
import { facePoly, fanTriangles, polyNormal, type Vec3 } from '../backends/webgl/worldTris';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';
import { sceneEntitySchema } from '../../data/schemas/defs-scenes/scene';
import { validateScene } from '../../state/validateScene';
import { DIR4_ORDER, type Dir4 } from '../../state/dir8';
import { memoByRef } from '../../state/sceneMemo';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * LE DÉCOR VOLUMIQUE — les refs de `props.json` dont le corps MONDE est leur recette, et dont le SVG
 * de catalogue est la vignette de palette. Ce fichier tient les deux moitiés du contrat : l'identité
 * (vignette + recette + places) et l'EXCLUSIVITÉ de la voie monde (une ref volumique n'a aucun sujet
 * de billboard).
 *
 * La liste est DÉRIVÉE du catalogue : une recette de plus entre sous contrat par sa seule déclaration
 * en donnée — une liste manuscrite laisserait les suivantes hors garde en silence.
 */
const IDS = props.filter((p) => p.volume).map((p) => p.id);
/** La seule scène écrite en TS — le second gisement d'instances authorées, invisible au corpus. */
const SOURCE_TS = 'opera/furnished.ts';
/** NON-VACUITÉ PAR GISEMENT des deux contrats de POPULATION ci-dessous : ils jugent la MÊME
 *  population, et ce qui les rendrait muets n'est pas un CARDINAL — une carte s'édite, un décor se
 *  retire — mais la disparition d'une SOURCE : le corpus `.json` de `src/scenes`, ou la scène TS. */
const gisementsDe = (instances: readonly DecorAuthore[]): string[] =>
  [...new Set(instances.map((e) => (e.source === SOURCE_TS ? 'ts' : 'json')))].sort();
const GISEMENTS = ['json', 'ts'];
const SANS_GISEMENT = 'une SOURCE d’instances volumiques a disparu du scan (corpus `.json` de `src/scenes`, scène TS de l’Opéra)';

const propEntity = ({ id, ref, pos, facing }: { id: string; ref: string; pos: { x: number; y: number }; facing: 'N' | 'E' | 'S' | 'O' }): SceneEntity =>
  ({ id, kind: 'prop', pos, ref, facing }) as SceneEntity;
const sceneWith = (...entities: SceneEntity[]): Scene => ({ ...emptyScene(8, 8), entities });
/** L'échelle des scènes de ce fichier — LUE sur la scène, jamais redite : `emptyScene` ne pose pas de
 *  `metresPerTile`, donc c'est le défaut du monde (`LDB 15 l.12`) qui s'applique. */
const METRES_PAR_CASE = sceneMetresPerTile(sceneWith());

/** Les faces MONDE d'une recette à l'échelle de ces scènes. */
const cuire = (prop: PropData, ancrage: Parameters<typeof buildPropVolumes>[1]) =>
  buildPropVolumes(prop, ancrage, METRES_PAR_CASE);

/** Un décor authoré quelque part dans `src/scenes` : sa provenance, son id, sa ref et son cap. */
interface DecorAuthore { source: string; id: string; kind?: string; ref?: string; facing?: string; mpt: number }

/**
 * TOUTES les instances de décor AUTHORÉES : les documents `.json` de `src/scenes` (récursif, toute
 * liste `entities` à n'importe quelle profondeur) ET le seul jeu de scènes écrit en TS (l'Opéra).
 * ANGLE MORT NOMMÉ : une scène TS de plus devrait être branchée ici — `src/data/prop-foot-migration.test.ts`
 * a exactement la même frontière, pour la même raison.
 */
const CORPUS_SCENES = () => readCorpus(['src/scenes'], { exts: ['.json'], tests: true });
/** Le dépouillement d'un corpus donné, retenu par l'IDENTITÉ de ce corpus (`memoByRef`) : `readCorpus`
 *  rend le MÊME tableau gelé à chaque appel de la même clé, donc la moisson ne se refait pas d'un `it`
 *  à l'autre — et une relecture disque (`viderCorpus`) rend un tableau neuf, donc une moisson neuve. */
const moisson = memoByRef((corpus: ReturnType<typeof CORPUS_SCENES>): DecorAuthore[] => {
  const out: DecorAuthore[] = [];
  const recolte = (o: unknown, fichier: string): void => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) recolte(x, fichier); return; }
    const noeud = o as Record<string, unknown>;
    if (Array.isArray(noeud.entities))
      // L'ÉCHELLE de la scène PORTEUSE voyage avec l'instance : l'empreinte d'un décor à recette en
      // dépend (#1509), la juger à une autre échelle que la sienne ne mesurerait rien de réel.
      // Lue par la MÊME règle que le monde (`sceneMetresPerTile`), jamais par un littéral.
      for (const e of noeud.entities as DecorAuthore[]) out.push({ ...e, source: fichier, mpt: sceneMetresPerTile(noeud as { metresPerTile?: number }) });
    for (const v of Object.values(noeud)) recolte(v, fichier);
  };
  for (const f of corpus) recolte(JSON.parse(f.text), f.rel.replace(/^src\/scenes\//, ''));
  const mptOpera = sceneMetresPerTile(buildOperaFloorplan());
  for (const e of scenarioEntities as unknown as DecorAuthore[]) out.push({ ...e, source: SOURCE_TS, mpt: mptOpera });
  return out;
});
function entitesAuthorees(): DecorAuthore[] {
  return moisson(CORPUS_SCENES());
}

/** Emprise d'une primitive (`empriseLocaleM`, la seule) : sa boîte englobante au sol ramenée en CASES
 *  (la recette est en mètres, #1507 — c'est l'échelle de la scène qui la ramène à la grille) et ses
 *  deux hauteurs, en mètres. */
function emprise(p: PropPrimitive): { x0: number; x1: number; y0: number; y1: number; bas: number; haut: number } {
  const e = empriseLocaleM(p);
  return { ...e, x0: e.x0 / METRES_PAR_CASE, x1: e.x1 / METRES_PAR_CASE, y0: e.y0 / METRES_PAR_CASE, y1: e.y1 / METRES_PAR_CASE };
}
type Emprise = ReturnType<typeof emprise>;
const seChevauchent = (a: Emprise, b: Emprise): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Distance HORIZONTALE d'un point à un segment, en cases — le bord d'une face, pas ses seuls sommets. */
function distanceAuSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe('décor volumique — chaque recette du catalogue, sa vignette et son corps monde', () => {
  // PLANCHER de la dérivation : `IDS` vient du catalogue, le comparer à sa propre définition ne
  // rougirait jamais. Ce qui peut vraiment casser, c'est une jointure VIDE (dataset non chargé,
  // `volume` renommé) : les `it.each` ci-dessous passeraient alors sans rien mesurer. L'existence de
  // la def d'ART de chaque id, elle, est gardée par `src/data/props-label-parite.test.ts`
  // (`labelDArt` est FAIL-FAST sur une def absente, sur TOUTES les entrées de `props.json`).
  it('la dérivation ne rend pas une liste VIDE (les contrats ci-dessous mesureraient du néant)', () => {
    expect(IDS.length).toBeGreaterThanOrEqual(11);
  });

  it.each(IDS)('%s possède vignette et volume monde, jamais billboard monde', (id) => {
    expect(propSvg(id).length).toBeGreaterThan(120);
    const prop = findPropById(id)!;
    expect(prop.volume!.primitives.length).toBeGreaterThan(0);
    const scene = sceneWith(propEntity({ id: `e-${id}`, ref: id, pos: { x: 2, y: 2 }, facing: 'S' }));
    expect(buildProps(scene)[0]).toMatchObject({ entId: `e-${id}`, faces: expect.any(Array) });
    const els = wholeSceneBillboardEls(scene);
    expect(collectBillboards(scene, sceneMetresPerTile(scene), els).some((b) => b.identity.includes(`e-${id}`))).toBe(false);
  });

  /**
   * QUESTION OUVERTE, volontairement NON verrouillée ici : l'assise des sièges AUTONOMES (chaise,
   * banc, tabouret — #1644) attend son design. Le patron canonique ci-dessous est celui des meubles
   * ENSEMBLES, qui portent l'assise ET le plan de travail dont les contrats géométriques mesurent
   * l'écart ; un siège seul n'a rien au-dessus de son assise. Ce contrat dit donc ce que les
   * ensembles DÉCLARENT, jamais que les autres n'ont pas le droit d'en déclarer — toute recette qui
   * pose des `seatSlots` tombe d'office sous les contrats géométriques `propsAvecPlaces` plus bas.
   */
  it('la table ronde offre quatre places, la table murale deux', () => {
    expect(findPropById('table-ronde-4-tabourets')!.seatSlots).toEqual([
      { id: 'place-1', anchor: { xM: 0, yM: 0.96, hM: 0.46 }, facing: 'N', approach: { x: 0, y: 1 } },
      { id: 'place-2', anchor: { xM: -0.96, yM: 0, hM: 0.46 }, facing: 'E', approach: { x: -1, y: 0 } },
      { id: 'place-3', anchor: { xM: 0, yM: -0.96, hM: 0.46 }, facing: 'S', approach: { x: 0, y: -1 } },
      { id: 'place-4', anchor: { xM: 0.96, yM: 0, hM: 0.46 }, facing: 'O', approach: { x: 1, y: 0 } },
    ]);
    expect(findPropById('table-murale-2-tabourets')!.seatSlots?.map((s) => s.id)).toEqual(['place-1', 'place-2']);
  });

  /** Ancres FIGÉES de la table murale : la sonde d'implantation de la salle les attend au millimètre.
   *  Ses deux places sont à ±1 m, soit le CENTRE de chacune des deux cases de son empreinte à 2 m/case
   *  (#1509 L9′) : une place par case, et donc un abord DROIT (0,−1) — depuis la salle, en face de son
   *  siège. La diagonale d'avant tenait à l'empreinte 1×1, où les deux sièges tombaient dans la MÊME
   *  case et où deux abords droits n'en auraient fait qu'un. */
  it('la table murale porte ses deux ancres canoniques, caps S et abords droits, une place par case', () => {
    expect(findPropById('table-murale-2-tabourets')!.seatSlots).toEqual([
      { id: 'place-1', anchor: { xM: 1, yM: -0.4, hM: 0.46 }, facing: 'S', approach: { x: 0, y: -1 } },
      { id: 'place-2', anchor: { xM: -1, yM: -0.4, hM: 0.46 }, facing: 'S', approach: { x: 0, y: -1 } },
    ]);
    // Une place PAR CASE : deux sièges distincts, donc deux abords distincts, hors de l'empreinte 2×1.
    expect(placesLocalesDuProp(findPropById('table-murale-2-tabourets'), CAP_IDENTITE_PROP, METRES_PAR_CASE)
      .map((p) => `${p.slot.id}: siège ${p.siege.x},${p.siege.y} abord ${p.abord.x},${p.abord.y}`))
      .toEqual(['place-1: siège 1,0 abord 1,-1', 'place-2: siège 0,0 abord 0,-1']);
  });

  /**
   * ASSISE SERVIE PAR SON MEUBLE — deux mesures sur les `Face[]` réelles, pour TOUT décor du catalogue
   * qui offre une place : le corps porte au SOL (aucun meuble suspendu à un mur qui n'est pas dans sa
   * case) et le plan de travail est à portée de bras de l'ancre du bassin. Sans elles, une recette peut
   * déclarer des places qu'aucun corps assis n'atteint.
   */
  const propsAvecPlaces = props.filter((p) => (p.seatSlots?.length ?? 0) > 0);

  it.each(propsAvecPlaces.map((p) => p.id))('%s : chaque volume porte, au sol ou sur un appui', (id) => {
    const primitives = findPropById(id)!.volume!.primitives.map(emprise);
    // Un volume PORTE s'il touche terre, ou s'il repose sur un volume déjà porté qui monte jusqu'à lui.
    const portes = primitives.map((p) => p.bas <= 1e-6);
    for (let passe = 0; passe < primitives.length; passe++)
      primitives.forEach((p, i) => {
        if (portes[i]) return;
        portes[i] = primitives.some((q, k) => portes[k] && k !== i && q.haut >= p.bas - 1e-6 && q.bas <= p.bas && seChevauchent(p, q));
      });
    const suspendus = primitives.filter((_, i) => !portes[i]).map((p) => `bas à ${p.bas} m`);
    expect(suspendus, `${id} : volumes suspendus dans le vide`).toEqual([]);
  });

  it.each(propsAvecPlaces.map((p) => p.id))('%s : chaque ancre est à portée du plan de travail', (id) => {
    // Au CAP D'IDENTITÉ, et à lui seul, l'ancre AUTHORÉE d'une place et la géométrie monde sont dans
    // le même repère : c'est ce qui rend la comparaison ci-dessous licite sans re-tourner l'ancre.
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: CAP_IDENTITE_PROP }));
    const el = buildProps(scene)[0] as { faces: { poly: { x: number; y: number; h: number }[] }[] };
    // L'ancre MONDE d'une place vient de la règle UNIQUE (`placesLocalesDuProp`), jamais d'un
    // `pos + anchor/mpt` recalculé ici : la géométrie est posée sur le CENTRE de l'empreinte
    // (`decorAncre`), et une empreinte de plus d'une case décale ce centre d'une demi-case — la place
    // se mesurait alors contre un plan de travail qui n'est pas là où le monde le cuit.
    const placesMonde = new Map(placesLocalesDuProp(findPropById(id), CAP_IDENTITE_PROP, METRES_PAR_CASE)
      .map((p) => [p.slot.id, { x: 3 + p.ancre.x, y: 4 + p.ancre.y }]));
    for (const slot of findPropById(id)!.seatSlots!) {
      const ancre = placesMonde.get(slot.id)!;
      let ecart = Number.POSITIVE_INFINITY;
      for (const face of el.faces)
        for (let i = 0; i < face.poly.length; i++) {
          const a = face.poly[i], b = face.poly[(i + 1) % face.poly.length];
          if (a.h <= slot.anchor.hM || b.h <= slot.anchor.hM) continue; // sous l'assise : ce n'est pas le plan de travail
          ecart = Math.min(ecart, distanceAuSegment(ancre, a, b) * METRES_PAR_CASE);
        }
      expect(ecart, `${id}/${slot.id} : écart ancre → bord du plan (m)`).toBeLessThanOrEqual(0.3);
    }
  });

  /**
   * EMPREINTE — les cases d'un décor à recette sont celles de son CORPS TOURNÉ, sièges exclus
   * (`empreinteDeriveeDuProp`, #1509) ; le `foot` déclaré est la vérité d'un BILLBOARD seul. Ces
   * contrats mesurent donc la DÉRIVÉE, en positif.
   *
   * L'exclusion des sièges EST le prédicat : un tabouret n'est pas un obstacle, c'est par lui qu'on
   * s'assoit — sans elle, la table ronde passerait de 1×1 à 2×2 solide et ses quatre abords
   * sauteraient. Le discriminant est STRUCTUREL, jamais un nom de ref (`placeAssiseDe`,
   * `data/props.types.ts`) : la primitive dont l'emprise au plan CONTIENT l'ancre d'une place ET qui
   * ne monte pas plus haut que cette assise ; un plateau qui survole l'ancre reste du corps.
   */
  /** Le CORPS d'une recette (sièges exclus) et ses SIÈGES, chacun avec la place qu'il porte. */
  const corpsEtSieges = (id: string) => {
    const prop = findPropById(id)!;
    const parts = prop.volume!.primitives.map((p) => ({ e: emprise(p), slot: placeAssiseDe(prop, p) }));
    return { corps: parts.filter((v) => !v.slot), sieges: parts.filter((v) => v.slot) };
  };
  /** Demi-empreinte DÉRIVÉE du type à ce cap, en cases — la borne du repère local (1×1 ⇒ 0,5 × 0,5). */
  const demiAuCap = (id: string, facing: Dir4) => {
    const { w, h } = empreinteDeriveeDuProp(findPropById(id)!, facing, METRES_PAR_CASE);
    return { x: w / 2, y: h / 2 };
  };

  /**
   * LE CONTRAT DU SOCLE, en ATTENDUS NOMINAUX : l'empreinte de chaque recette, à chacun de ses quatre
   * caps. C'est un GOLDEN voulu : l'intention de l'auteur, écrite une fois, contre laquelle se mesure
   * ce que la dérivation rend — aucune recette ne porte de `foot` (refine `defs/props.ts`), et se
   * comparer à ce que le code dérive lui-même ne rougirait jamais. La liste est CLOSE, et c'est la
   * COUVERTURE qui la ferme (ses clés sont EXACTEMENT le catalogue).
   *
   * COÛT D'UN MEUBLE N+1 : sa recette + sa vignette + sa pose en scène + UNE ligne d'attendu ici. Aucune
   * ligne de CODE : `meuble-multicase-neuf.test.ts` le prouve sur une recette de fixture.
   */
  const EMPREINTES_ATTENDUES: Readonly<Record<string, { ns: [number, number]; eo: [number, number] }>> = {
    // Les deux recettes MULTI-CASE du catalogue : leur plateau (3,80 m pour la table longue, 3,00 m
    // pour la murale) tient sur deux cases en x, une en y — et les échange au quart de tour. C'est
    // TOUT le socle #1509, sur deux lignes. La murale les a rejointes par ré-authoring de ses cotes
    // (migration `2026-09-03-1509-murale-1x2.mjs`, fait utilisateur du 2026-08-31 : une table contre
    // un mur fait 1×2), jamais par un `foot` déclaré — qui ne tournerait pas avec le cap.
    'table-2x1': { ns: [2, 1], eo: [1, 2] },
    'table-murale-2-tabourets': { ns: [2, 1], eo: [1, 2] },
    // Lot B (#1343) : trois recettes qui REPRODUISENT en corps dérivé le `foot` que leur def
    // d'entrée déclarait — un bureau et un établi longs de 3,40 m, un manteau de scène de 5,60 m.
    // Le `foot` authoré est mort avec la conversion (#1509) ; ce sont ces cotes-là qui le tiennent.
    'bureau-2x1': { ns: [2, 1], eo: [1, 2] },
    'etabli-2x1': { ns: [2, 1], eo: [1, 2] },
    'rideau-scene': { ns: [3, 1], eo: [1, 3] },
    // La rangée de fauteuils du parterre : trois assises sous une même ménuiserie de 5,40 m, séparées
    // par quatre accoudoirs — son 3×1 vient de ce corps, là où elle le DÉCLARAIT en billboard.
    'rangee-sieges': { ns: [3, 1], eo: [1, 3] },
    // Lot C (#1343) : la charrette à bras, plateau et brancards de 3,30 m — son 2×1 vient de ce corps,
    // là où elle le DÉCLARAIT en billboard.
    'charrette': { ns: [2, 1], eo: [1, 2] },
    // Toutes les autres tiennent sur UNE case, à tous les caps. La table ronde n'y tient que parce
    // que ses quatre tabourets sont exclus du corps (sans eux elle mesurerait 2×2 — cf. le contrat de
    // cache de `data/props-integrity.test.ts`).
    ...Object.fromEntries(([
      'tonneau', 'tonneaux-pile', 'caisse', 'coffre', 'urne', 'table', 'chaise', 'banc', 'tabouret',
      'armoire', 'etagere', 'etal-marche', 'cheminee-interieure', 'comptoir-droit', 'comptoir-angle',
      'table-ronde-4-tabourets', 'cheminee', 'enseigne', 'clocheton',
      'applique-murale',
      // Lot B (#1343) — le mobilier de l'opéra/théâtre : chacun tient sur sa case à tous ses caps.
      'siege', 'fauteuil-loge', 'canape', 'coiffeuse', 'pupitre-chef', 'miroir', 'paravent',
      'portant-costumes', 'rack-armes', 'scie-chevalet', 'decor-flat',
      // … et les deux BASES courtes, converties avec leurs variantes longues : une demi-migration
      // aurait laissé le même meuble en volume ici et en billboard là, selon sa longueur.
      'bureau', 'etabli',
      // Lot C (#1343) — les décors organiques en volume sobre, chacun sur sa case à tous ses caps.
      'plante-pot', 'statue', 'colonne-brisee', 'lustre-opera', 'mannequin', 'mannequin-couturier',
    ]).map((id) => [id, { ns: [1, 1], eo: [1, 1] }])),
  };

  it('la liste des empreintes attendues couvre EXACTEMENT le catalogue des recettes', () => {
    expect(Object.keys(EMPREINTES_ATTENDUES).sort()).toEqual([...IDS].sort());
    // Au moins une recette MULTI-CASE, sans quoi la rotation d'empreinte ne serait mesurée sur rien.
    expect(Object.values(EMPREINTES_ATTENDUES).filter((a) => a.ns[0] > 1 || a.ns[1] > 1).length).toBeGreaterThan(0);
  });

  it.each(IDS)('%s : son empreinte DÉRIVÉE, à chacun de ses quatre caps, est celle que le catalogue MESURE', (id) => {
    const attendu = EMPREINTES_ATTENDUES[id];
    for (const facing of DIR4_ORDER) {
      const [w, h] = facing === 'E' || facing === 'O' ? attendu.eo : attendu.ns;
      expect(empreinteDeriveeDuProp(findPropById(id)!, facing, METRES_PAR_CASE), `${id} cap ${facing}`).toEqual({ w, h });
    }
  });

  it('AUCUNE recette ne déclare de `foot` — c’est la vérité d’un BILLBOARD, et de lui seul (#1509)', () => {
    expect(IDS.filter((id) => findPropById(id)!.foot !== undefined)).toEqual([]);
    // Et le champ vit toujours, chez ceux à qui il appartient : sans cette moitié, le contrat
    // ci-dessus passerait aussi sur un `foot` disparu du schéma.
    expect(props.filter((p) => !p.volume && p.foot).length).toBeGreaterThan(0);
  });

  it.each(IDS)('%s : son CORPS (sièges exclus) tient dans son empreinte dérivée, à chacun de ses caps', (id) => {
    for (const facing of DIR4_ORDER) {
      const demi = demiAuCap(id, facing);
      const bornes = facing === 'E' || facing === 'O' ? { x: demi.y, y: demi.x } : demi;
      const debordants = corpsEtSieges(id).corps.filter(({ e }) =>
        Math.max(Math.abs(e.x0), Math.abs(e.x1)) - bornes.x > 1e-9
        || Math.max(Math.abs(e.y0), Math.abs(e.y1)) - bornes.y > 1e-9);
      expect(debordants.map((v) => v.e), `${id} cap ${facing}`).toEqual([]);
    }
  });

  it.each(IDS)('%s : chaque siège déborde vers l’abord de SA place, jamais du côté opposé', (id) => {
    const demi = demiAuCap(id, CAP_IDENTITE_PROP);
    for (const { e, slot } of corpsEtSieges(id).sieges) {
      // Le débord suit l'abord : jamais un tabouret jeté du côté opposé à la case d'où l'on s'assoit.
      if (e.x1 > demi.x) expect(Math.sign(slot!.approach.x), `${id}/${slot!.id} débord est`).toBe(1);
      if (e.x0 < -demi.x) expect(Math.sign(slot!.approach.x), `${id}/${slot!.id} débord ouest`).toBe(-1);
      if (e.y1 > demi.y) expect(Math.sign(slot!.approach.y), `${id}/${slot!.id} débord sud`).toBe(1);
      if (e.y0 < -demi.y) expect(Math.sign(slot!.approach.y), `${id}/${slot!.id} débord nord`).toBe(-1);
    }
  });

  /**
   * CAPS MESURÉS : les QUATRE cardinaux, pour TOUTE recette. Les diagonales n'ont pas à être mesurées —
   * elles sont refusées À LA DONNÉE par le schéma de scène (`src/data/schemas/defs-scenes/scene.ts`,
   * `superRefine` de `sceneEntitySchema` sur `PROPS_VOLUMIQUES`), et le chargement d'un projet en
   * meurt (`parseProject`).
   *
   * Ce que cette mesure suit, c'est la POSE dans le monde : le corps cuit part de l'ANCRE de
   * l'empreinte DÉRIVÉE au cap (`decorAncre`), pas du coin NO ni d'une empreinte figée. Un builder qui
   * calerait la recette sur un autre point la décalerait de la demi-case d'un 2×1 tourné.
   */
  it.each(IDS)('%s, cuit à chacun de ses caps, part de l’ancre de son empreinte dérivée et ne descend jamais sous le sol', (id) => {
    for (const facing of DIR4_ORDER) {
      const { offX, offY } = decorFootGeometry(empreinteDeriveeDuProp(findPropById(id)!, facing, METRES_PAR_CASE));
      // La borne, sans constante magique : l'emprise du corps ENTIER (sièges compris) tourné au cap.
      const parts = [...corpsEtSieges(id).corps, ...corpsEtSieges(id).sieges];
      let borneX = 0, borneY = 0;
      for (const { e } of parts)
        for (const [lx, ly] of [[e.x0, e.y0], [e.x1, e.y0], [e.x0, e.y1], [e.x1, e.y1]]) {
          const [rx, ry] = rotatePropLocal(lx, ly, facing);
          borneX = Math.max(borneX, Math.abs(rx));
          borneY = Math.max(borneY, Math.abs(ry));
        }
      const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing }));
      const el = buildProps(scene)[0] as { faces: { poly: { x: number; y: number; h: number }[] }[] };
      for (const face of el.faces)
        for (const p of face.poly) {
          expect(Math.abs(p.x - (3 + offX)), `${id} cap ${facing} x`).toBeLessThanOrEqual(borneX + 1e-9);
          expect(Math.abs(p.y - (4 + offY)), `${id} cap ${facing} y`).toBeLessThanOrEqual(borneY + 1e-9);
          expect(p.h, `${id} cap ${facing} h`).toBeGreaterThanOrEqual(0);
        }
    }
  });

  /**
   * POPULATION — l'empreinte tourne avec le cap (#1509) : tout cap cardinal est licite pour un meuble
   * multi-case. Ce que ce contrat mesure, c'est que le catalogue est authoré
   * POUR l'échelle de ses scènes : à l'échelle RÉELLE de la scène qui la porte, chaque instance
   * volumique couvre exactement les cases que le catalogue mesure à la grille terrestre (2 m/case,
   * `LDB 15 l.12`). Une scène à une AUTRE échelle — le monde naval est à 4 m/case et plus — y ferait
   * fondre ses meubles, ou les ferait enfler sur une grille plus fine ; ce contrat le NOMME au lieu
   * de le laisser sortir en pixels.
   */
  it('chaque instance authorée d’un décor volumique couvre, à l’échelle RÉELLE de sa scène, les cases du catalogue', () => {
    const volumiques = new Set(IDS);
    const instances = entitesAuthorees().filter((e) => e.kind === 'prop' && e.ref !== undefined && volumiques.has(e.ref));
    expect(gisementsDe(instances), SANS_GISEMENT).toEqual(GISEMENTS);
    const ecarts = instances.filter((e) => {
      const prop = findPropById(e.ref)!;
      const cap = (e.facing ?? CAP_IDENTITE_PROP) as Dir4;
      const chezElle = empreinteDeriveeDuProp(prop, cap, e.mpt);
      const auCatalogue = empreinteDeriveeDuProp(prop, cap, METRES_PAR_CASE);
      return chezElle.w !== auCatalogue.w || chezElle.h !== auCatalogue.h;
    });
    expect(ecarts.map((e) => `${e.source}/${e.id} (${e.ref}, cap ${e.facing ?? CAP_IDENTITE_PROP}, ${e.mpt} m/case)`)).toEqual([]);
  });

  /**
   * POPULATION, second volet — le contrat POSITIF du cap CARDINAL (#1680 ligne 3) sur TOUTE la donnée
   * authorée, y compris la seule scène écrite en TS (l'Opéra). Le schéma refuse déjà la diagonale au
   * parse d'un projet ; ce contrat couvre ce que le parse ne voit pas : une scène TS n'est pas un
   * document chargé. Contrairement au contrat ci-dessus, celui-ci NE TOMBE PAS avec #1509 — un décor
   * volumique ne prendra jamais de cap diagonal.
   */
  it('aucune instance authorée d’un décor VOLUMIQUE ne porte un cap DIAGONAL', () => {
    const volumiques = new Set(IDS);
    const instances = entitesAuthorees().filter((e) => e.kind === 'prop' && e.ref !== undefined && volumiques.has(e.ref));
    expect(gisementsDe(instances), SANS_GISEMENT).toEqual(GISEMENTS);
    expect(instances.filter((e) => e.facing && !DIR4_ORDER.includes(e.facing as Dir4))
      .map((e) => `${e.source}/${e.id} (${e.ref}, cap ${e.facing})`)).toEqual([]);
  });

  /**
   * POPULATION, troisième volet (#877) — TOUTE instance authorée NOMME son type, et ce type RÉSOUT au
   * catalogue. Un décor se DIT ou se REFUSE : aucun n'est remplacé par un id en dur, et aucun ne
   * s'appuie sur un défaut du rendu. Le schéma tient les documents CHARGÉS (`defs-scenes/scene.ts`) ;
   * ce contrat couvre le gisement que le parse ne voit pas — la scène écrite en TS — et le même geste
   * juge les deux gisements d'un coup.
   */
  it('chaque décor authoré NOMME un type que le catalogue RÉSOUT — aucun défaut, aucun repli', () => {
    const decors = entitesAuthorees().filter((e) => e.kind === 'prop');
    expect(gisementsDe(decors), SANS_GISEMENT).toEqual(GISEMENTS);
    expect(decors.filter((e) => !findPropById(e.ref))
      .map((e) => `${e.source}/${e.id} (${e.ref ?? 'aucun type nommé'})`)).toEqual([]);
  });
});

/**
 * CAP CARDINAL — LA CHAÎNE ENTIÈRE, sur une seule donnée fautive (#1680 ligne 3). Un décor dont le
 * TYPE porte une recette ne prend qu'un cap cardinal : `data/props.types.ts` `capVolumique`. Quatre
 * verrous, du plus AMONT au dernier filet, et ce test les tient ENSEMBLE — la règle est celle du
 * CATALOGUE (`refEstVolumique`), donc un BILLBOARD au même cap reste licite à chaque étage :
 *   1. SCHÉMA (bloquant) : `sceneEntitySchema` refuse au parse, `parseProject` lève ;
 *   2. VALIDATEUR (signalant) : `validateScene` nomme l'entité à l'éditeur — il n'interdit rien, il
 *      montre (le panneau d'avertissements d'`Editor.tsx` est son seul consommateur) ;
 *   3. ÉDITEUR : le sélecteur d'orientation n'offre pas la diagonale (`Inspector.tsx`, testé chez lui) ;
 *   4. ÉMETTEUR : `buildProps` lève, invariant interne — si une donnée fautive arrivait quand même,
 *      le monde ne se cuit pas en silence.
 */
describe('décor volumique — le cap DIAGONAL est refusé de bout en bout', () => {
  const entiteBrute = (ref: string, facing: string) =>
    ({ id: 'e-1', kind: 'prop', pos: { x: 2, y: 2 }, ref, facing });

  it('1. SCHÉMA : le parse refuse un décor volumique en diagonale, et l’accepte au cardinal', () => {
    expect(sceneEntitySchema.safeParse(entiteBrute('table-ronde-4-tabourets', 'NE')).success).toBe(false);
    expect(sceneEntitySchema.safeParse(entiteBrute('table-ronde-4-tabourets', 'E')).success).toBe(true);
    // Le message NOMME la recette et le cap — un refus muet n'apprendrait rien à l'auteur.
    const echec = sceneEntitySchema.safeParse(entiteBrute('table-ronde-4-tabourets', 'NE'));
    expect(echec.success ? [] : echec.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([
      "facing: décor volumique « table-ronde-4-tabourets » au cap NE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
    ]);
    // Un BILLBOARD au même cap passe : la règle vient du catalogue, pas du `kind`.
    expect(sceneEntitySchema.safeParse(entiteBrute('brasero', 'NE')).success).toBe(true);
  });

  it('2. VALIDATEUR : `validateScene` signale l’entité, sans rien interdire', () => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: 'table-ronde-4-tabourets', pos: { x: 2, y: 2 }, facing: 'N' }));
    const diagonale = { ...scene, entities: [{ ...scene.entities[0], facing: 'NE' as const }] };
    expect(validateScene([diagonale]).filter((w) => w.level === 'error').map((w) => w.message)).toEqual([
      "e-1 : décor volumique « table-ronde-4-tabourets » au cap NE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
    ]);
    expect(validateScene([scene])).toEqual([]);
  });

  it('4. ÉMETTEUR : `buildProps` lève sur un volumique en diagonale, et cuit un billboard au même cap', () => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: 'table-ronde-4-tabourets', pos: { x: 2, y: 2 }, facing: 'N' }));
    const diagonale = { ...scene, entities: [{ ...scene.entities[0], facing: 'NE' as const }] };
    expect(() => buildProps(diagonale)).toThrow(
      "décor volumique « table-ronde-4-tabourets » (e-1) : cap NE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
    );
    const billboard = sceneWith({ ...propEntity({ id: 'e-2', ref: 'brasero', pos: { x: 2, y: 2 }, facing: 'N' }), facing: 'NE' } as SceneEntity);
    expect(() => buildProps(billboard)).not.toThrow();
  });
});

/**
 * LE DEHORS — un décor volumique est une COQUILLE FERMÉE : chacune de ses faces regarde le dehors de la
 * primitive qui la porte, et ce sens survit à la cuisson du monde. Mesuré dans la convention du RENDU
 * (`gpToWorld` : `(x, y, h) → three (X, Y, Z) = (x, h, y)`, `worldTris.ts:49`), la seule qui décide de
 * la frontalité au GPU et de la carte d'ombre — une normale retournée pousse sa face dans sa propre
 * ombre (`sceneMeshes.ts:449`), ce qui se lit à l'écran comme un TROU dans le meuble.
 *
 * La liste est DÉRIVÉE du catalogue : une recette de plus entre sous contrat par sa seule déclaration.
 */
describe('décor volumique — chaque face regarde le DEHORS, de la recette au monde cuit', () => {
  const centroide = (poly: readonly { x: number; y: number; z: number }[]) =>
    poly.reduce((s, q) => ({ x: s.x + q.x / poly.length, y: s.y + q.y / poly.length, z: s.z + q.z / poly.length }), { x: 0, y: 0, z: 0 });

  it.each(IDS)('%s : chaque face de chaque primitive est FRONT-visible depuis l’extérieur, le long de sa normale', (id) => {
    const prop = findPropById(id)!;
    const ancre = { x: 0, y: 0 };
    const àRebours: string[] = [];
    prop.volume!.primitives.forEach((primitive, ip) => {
      const faces = cuire({ ...prop, volume: { ...prop.volume!, primitives: [primitive] } }, { ancre, facing: 'N', baseHeightM: 0 });
      // Le DEDANS de référence est le barycentre des sommets de la primitive : un point strictement
      // intérieur pour une boîte comme pour un coin de prisme, que le sens de parcours n'influence pas.
      const centre = centroide(faces.flatMap((f) => facePoly(f, METRES_PAR_CASE)));
      faces.forEach((face, k) => {
        const poly = facePoly(face, METRES_PAR_CASE);
        const n = polyNormal(poly);
        expect(n, `${id} primitive ${ip} face ${k} : aire nulle`).not.toBeNull();
        const g = centroide(poly);
        if (n!.x * (g.x - centre.x) + n!.y * (g.y - centre.y) + n!.z * (g.z - centre.z) <= 0)
          àRebours.push(`primitive ${ip} (${primitive.kind}) face ${k}`);
      });
    });
    expect(àRebours, `${id} : faces tournées vers le DEDANS`).toEqual([]);
  });

  /**
   * FERMETURE sur les FACES MONDE — indépendant de l'instrument « barycentre » du contrat ci-dessus :
   * une coquille close porte chaque arête par exactement DEUX faces, parcourues en sens OPPOSÉS. C'est
   * le même prédicat que le validateur de catalogue applique à la géométrie LOCALE
   * (`validatePropCatalog` → `aretesNonAppariees`) ; ici il tombe sur ce que le builder a réellement
   * produit, cap et ancre compris — la transformation rigide doit préserver la fermeture.
   */
  it.each(IDS)('%s : chaque primitive sort du builder en COQUILLE CLOSE (arêtes appariées à contre-sens)', (id) => {
    const prop = findPropById(id)!;
    const défauts: string[] = [];
    prop.volume!.primitives.forEach((primitive, ip) => {
      const faces = cuire({ ...prop, volume: { ...prop.volume!, primitives: [primitive] } }, { ancre: { x: 3, y: 4 }, facing: 'E', baseHeightM: 1.5 });
      // Les faces MONDE réduites à leurs triplets : la fermeture est TOPOLOGIQUE, et un point monde
      // (cases dans le plan, mètres en hauteur) ne porte plus les noms d'un point de recette (#1507).
      for (const { arete, sens, contreSens } of aretesNonAppariees(faces.map((f) => f.poly.map((p) => [p.x, p.y, p.h] as const))))
        défauts.push(`primitive ${ip} (${primitive.kind}, ${primitive.material}) : arête ${arete} — ${sens} dans le sens, ${contreSens} à contre-sens`);
    });
    expect(défauts, `${id} : arêtes non appariées`).toEqual([]);
  });

  /**
   * ARÊTE DE COUTEAU du modelé de forme : `shadeFamily` (`backends/webgl/worldTris.ts:127-130`)
   * départage une normale par sa plus grande composante, et une égalité des DEUX plus grandes est
   * indécidable — un fût y prend des tons de familles voisines sur des faces symétriques. C'est ce qui
   * exclut `sides: 12` du type (`PropCylinderSides`). Une face LATÉRALE est une face dont la normale
   * est orthogonale à l'AXE, lu dans `REPERE_D_AXE` comme la géométrie : le critère ne suppose aucun
   * axe. Mesuré sur la géométrie CUITE, à chaque (côtés × axe), 12 compris.
   */
  const COUTEAU_ATTENDU: Readonly<Record<number, number>> = { 8: 0, 12: 4, 16: 0 };
  // Les cas ci-dessous ITÈRENT la table : un axe retiré y disparaîtrait sans rougir. L'énumération se fixe ici.
  it('les axes mesurés sont exactement les trois de la table', () => {
    expect(PROP_CYLINDER_AXES).toEqual(['h', 'x', 'y']);
  });
  it.each(Object.keys(COUTEAU_ATTENDU).flatMap((s) => PROP_CYLINDER_AXES.map((axis) => [Number(s), axis] as const)))(
    'cylindre à %i côtés, axe %s : ses `sides` faces latérales, et le compte attendu sur l’arête de couteau',
    (sides, axis) => {
      const primitive: PropPrimitive = { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.3 }, axis, radiusM: 0.3, longueurM: 0.5, sides: sides as PropCylinderSides, material: 'fer-noirci' };
      const prop: PropData = { id: 'cylindre-epreuve', type: 'props', label: 'Cylindre d’épreuve', volume: { capIdentite: CAP_IDENTITE_PROP, primitives: [primitive] } };
      // L'axe en convention three (X = est, Y = haut, Z = sud), tiré de la MÊME table que la géométrie.
      const d = REPERE_D_AXE[axis](0, 0, 1);
      const axe = { x: d.xM, y: d.hM, z: d.yM };
      let laterales = 0, couteau = 0;
      for (const face of cuire(prop, { ancre: { x: 0, y: 0 }, facing: CAP_IDENTITE_PROP, baseHeightM: 0 })) {
        const brute = polyNormal(facePoly(face, METRES_PAR_CASE))!;
        const l = Math.hypot(brute.x, brute.y, brute.z);
        const n = { x: brute.x / l, y: brute.y / l, z: brute.z / l };
        if (Math.abs(n.x * axe.x + n.y * axe.y + n.z * axe.z) > 1e-6) continue; // un bout : pas une face latérale
        laterales++;
        const [g1, g2] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)].sort((u, v) => v - u);
        if (g1 - g2 < 1e-6) couteau++;
      }
      expect(laterales, 'faces latérales mesurées').toBe(sides);
      expect(couteau, 'faces latérales sur l’arête de couteau').toBe(COUTEAU_ATTENDU[sides]);
    },
  );

  it.each(IDS)('%s : la cuisson du monde ne RETOURNE aucune de ses faces', (id) => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: 'N' }));
    const el = buildProps(scene).find((e) => e.kind === 'prop' && estPropVolumique(e)) as { faces: Face[] } | undefined;
    expect(el, `${id} : aucun décor volumique cuit dans la scène`).toBeDefined();
    // Les triangles se comparent par AMAS de position, formés sur la géométrie du pivot, et ce qui est
    // mesuré est le MULTI-ENSEMBLE des normales de chaque amas. Deux faces peuvent coïncider (le dessous
    // d'un couvercle sur le dessus du coffre qui le porte) : seul le multi-ensemble distingue alors un
    // retournement. Le biais coplanaire déplace un triangle cuit de 1,5 mm — il rejoint donc toujours
    // l'amas dont il vient.
    const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const dir = (n: Vec3) => [n.x, n.y, n.z].map((v) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3)).join(',');
    const amas: { g: Vec3; attendu: string[]; cuit: string[] }[] = [];
    for (const face of el!.faces)
      for (const tri of fanTriangles(facePoly(face, METRES_PAR_CASE)) as [Vec3, Vec3, Vec3][]) {
        const g = centroide(tri);
        const a = amas.find((c) => dist(c.g, g) < 0.01) ?? (amas.push({ g, attendu: [], cuit: [] }), amas[amas.length - 1]);
        a.attendu.push(dir(polyNormal(tri)!));
      }
    const { geometry } = bakeWorldGeometry(scene, METRES_PAR_CASE);
    const pos = geometry.getAttribute('position');
    const sommet = (i: number) => ({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) });
    let cuits = 0;
    for (const plage of geometry.userData.propVertexRanges.filter((p) => p.entId === 'e-1'))
      for (let i = plage.vertexStart; i + 2 < plage.vertexStart + plage.vertexCount; i += 3) {
        cuits++;
        const tri: [Vec3, Vec3, Vec3] = [sommet(i), sommet(i + 1), sommet(i + 2)];
        const g = centroide(tri);
        amas.reduce((meilleur, c) => (dist(c.g, g) < dist(meilleur.g, g) ? c : meilleur)).cuit.push(dir(polyNormal(tri)!));
      }
    expect(cuits, `${id} : triangles cuits`).toBe(amas.reduce((s, c) => s + c.attendu.length, 0));
    const écarts = amas
      .filter((c) => [...c.cuit].sort().join(' ') !== [...c.attendu].sort().join(' '))
      .map((c) => `amas (${c.g.x.toFixed(2)}, ${c.g.y.toFixed(2)}, ${c.g.z.toFixed(2)}) : attendu [${[...c.attendu].sort().join(' | ')}], cuit [${[...c.cuit].sort().join(' | ')}]`);
    expect(écarts, `${id} : normales retournées à la cuisson`).toEqual([]);
  });
});
