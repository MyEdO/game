/**
 * FIXTURE DE TEST (hors production) — fuzz des axes de gabarit pour le contrat « axes DÉCLARÉS =
 * axes CONSOMMÉS » des part-defs quadrupèdes (#1082 P2, design v2 §1).
 *
 * Le détecteur d'origine mesurait les lectures d'axes sur UN témoin (la première espèce portant la
 * clé) et à la SEULE valeur d'axe que ce témoin porte. Un art qui ne lit un axe que SOUS CONDITION
 * d'une valeur absente du témoin échappait donc à la mesure — contournement mesuré : une def qui
 * déclare `markings` et lit `p.tailLen` uniquement quand `markings === 'balzanes'` passait au vert
 * sur les quatre têtes éprouvées.
 *
 * Deux élargissements ferment ce trou :
 *   - TOUS les témoins (chaque espèce portant la clé), jamais le premier seul ;
 *   - le PRODUIT des valeurs des axes DÉCLARÉS (`AXIS_FUZZ`) — toute branche gardée par un axe
 *     déclaré finit prise, donc les lectures qu'elle abrite sont mesurées.
 *
 * Reste hors de portée : une branche gardée par un axe NON déclaré. Lire cet axe est lui-même une
 * lecture non déclarée, que le détecteur voit dès le premier témoin — la garde mord donc là aussi,
 * sur la condition à défaut du corps.
 *
 * FAIL-CLOSED : un axe déclaré sans domaine dans `AXIS_FUZZ` sort dans `missingDomain` et échoue la
 * garde — il ne passe pas silencieusement non fuzzé.
 */
import type { QuadProps } from './quadSkeleton';
import { quadArt, type QuadArt } from './partArt';
import { QUAD_HEAD_DEFS } from './heads/_registry.generated';
import { QUAD_TAIL_DEFS } from './tails/_registry.generated';

/**
 * Domaine d'échantillonnage par axe de `QuadProps`. Les axes ÉNUMÉRÉS portent leur union complète
 * (+ `undefined` quand l'axe est optionnel : l'absence est une valeur qui branche). Les axes
 * SCALAIRES portent trois valeurs (sous 1, 1, au-dessus) : ils mettent l'art à l'échelle, ils ne
 * l'aiguillent pas — trois points suffisent à faire apparaître une lecture conditionnelle de seuil.
 */
export const AXIS_FUZZ: Partial<Record<keyof QuadProps, readonly unknown[]>> = {
  build: ['equine', 'canine', 'suid', 'rodent', 'ursine', 'feline', 'draconic', 'batracien', 'bovin'],
  head: QUAD_HEAD_DEFS.map((d) => d.key),
  tail: QUAD_TAIL_DEFS.map((d) => d.key),
  ears: ['courtes', 'pointues', 'rondes'],
  foot: ['sabot', 'patte', 'serre'],
  frontFoot: ['sabot', 'patte', 'serre', undefined],
  mane: ['crin', 'hirsute', 'sans'],
  ridge: ['epines', 'epines-continues', 'crete', 'plaques', 'sans', undefined],
  markings: ['taches', 'rayures', 'balzanes', 'sans', undefined],
  headgear: ['bois', 'cornes', undefined],
  foreCoat: ['plumes', undefined],
  tailCrest: [true, undefined],
  wings: ['plumes', 'membrane', undefined],
  wingPose: ['dressees', 'deployees', undefined],
  sl: [0.7, 1, 1.4],
  girth: [0.8, 1, 1.3],
  bodyLen: [0.8, 1, 1.25],
  neckLen: [0.6, 1, 1.5],
  neckAngle: [-30, 0, 20],
  legLen: [0.7, 1, 1.2],
  headScale: [0.8, 1, 1.4],
  headPitch: [-20, 0, 15],
  tailLen: [0.7, 1, 1.4],
  wingSpan: [0.8, 1, 1.3],
  wingLift: [-12, 0, 20],
};

/** Garde-fou de coût : au-delà, le produit d'axes déclarés se refuse (jamais un test qui rampe). */
const MAX_COMBOS = 4096;

/** Espèces qui PORTENT cette clé — l'art se juge sur la donnée réelle qui l'appelle. */
export function witnessesOf(species: Record<string, QuadProps>, axis: 'head' | 'tail', key: string): QuadProps[] {
  const w = Object.values(species).filter((p) => p[axis] === key);
  if (!w.length) throw new Error(`aucune espèce ne porte ${axis} « ${key} » — témoin introuvable`);
  return w;
}

/** Produit des domaines des axes déclarés, appliqué aux props d'un témoin. */
export function fuzzProps(base: QuadProps, declared: readonly string[]): { props: QuadProps[]; missingDomain: string[] } {
  const missingDomain = declared.filter((a) => AXIS_FUZZ[a as keyof QuadProps] == null);
  let props: QuadProps[] = [base];
  for (const axis of declared) {
    const dom = AXIS_FUZZ[axis as keyof QuadProps];
    if (!dom) continue;
    props = props.flatMap((p) => dom.map((v) => ({ ...p, [axis]: v }) as QuadProps));
    if (props.length > MAX_COMBOS)
      throw new Error(`fuzz d'axes : ${props.length} combinaisons > ${MAX_COMBOS} (déclarés : ${declared.join(', ')})`);
  }
  return { props, missingDomain };
}

/** Axes de `QuadProps` réellement LUS par ces arts, sur tous les témoins × tout le produit d'axes. */
export function consumedAxes(
  arts: readonly (QuadArt | undefined)[],
  witnesses: readonly QuadProps[],
  declared: readonly string[],
): { used: string[]; missingDomain: string[] } {
  const used = new Set<string>();
  const missing = new Set<string>();
  for (const w of witnesses) {
    const { props, missingDomain } = fuzzProps(w, declared);
    for (const a of missingDomain) missing.add(a);
    for (const p of props) {
      const spy = new Proxy(p, {
        get: (t, k) => { if (typeof k === 'string') used.add(k); return t[k as keyof QuadProps]; },
      });
      for (const a of arts) quadArt(a, spy as QuadProps);
    }
  }
  return { used: [...used].sort(), missingDomain: [...missing].sort() };
}
