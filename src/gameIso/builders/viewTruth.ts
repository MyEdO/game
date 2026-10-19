/**
 * VÉRITÉ DE VUE ⟂ GÉOMÉTRIE (#808) — la couture prévue par `./types` (cf. `ElStates`) : un builder
 * dérive la GÉOMÉTRIE de la scène UNE fois (mémoïsée par l'identité de la scène, patron canonique
 * `memoByRef`) et n'y applique, au pas, que la VÉRITÉ DE VUE de chaque élément.
 *
 * Chaque entrée porte sa RÈGLE — les `visKeys` du ticket : les cases `"x,y,z"` dont dépend SA
 * visibilité, jamais l'ensemble `visible` entier. La résolution ne réalloue que les éléments dont la
 * vérité a CHANGÉ (les autres gardent leur IDENTITÉ), et rend le TABLEAU PRÉCÉDENT quand aucun n'a
 * bougé : `floorEls`/`wallEls`/`roofEls` survivent alors au pas, et les memos du stage qui en
 * dépendent avec eux (zéro re-projection, zéro re-tri, zéro réconciliation React).
 *
 * AUCUNE invalidation manuelle : les deux seules clés sont l'IDENTITÉ de la scène observée et une clé
 * de vue DÉRIVÉE de ses paramètres — une scène mutée (porte, décor, structure) arrive par une
 * nouvelle référence et re-dérive d'elle-même.
 */
import type { Scene } from '../../noyau/monde/scene';
import { memoByRef } from '../../noyau/monde/sceneMemo';

/** RÈGLE de vue d'un élément — d'où sa vérité (`states.visible`, `roofOccupied`…) est tirée.
 *  `enVue`/`horsVue` portent les `visKeys` : les seules cases qui la déterminent. */
export type ViewRule<C> =
  /** Vraie en toutes circonstances (enveloppe de bâtiment : une façade n'est pas un secret). */
  | { kind: 'toujours' }
  /** Fausse en toutes circonstances (sol ordinaire : le voile le grise, il ne passe jamais dessus). */
  | { kind: 'jamais' }
  /** Vraie dès qu'AU MOINS UNE des cases est en vue (mur perçu, bloc plein bordé par une case en vue). */
  | { kind: 'enVue'; keys: readonly string[] }
  /** Vraie quand la case n'est PAS en vue (surplomb PLEIN : rien à protéger dessous, on le dessine opaque). */
  | { kind: 'horsVue'; key: string }
  /** Vraie selon un CONTEXTE non tuilé, résolu une fois par appel (dégagement de toiture : pièces occupées). */
  | { kind: 'contexte'; truth: (ctx: C) => boolean };

/** Une entrée de géométrie mémoïsée : l'instance à vérité FAUSSE (défaut), sa règle, et l'instance à
 *  vérité VRAIE matérialisée à la demande puis CONSERVÉE — deux identités stables par élément, jamais
 *  une allocation par pas. */
export interface Viewed<E, C = never> {
  off: E;
  rule: ViewRule<C>;
  /** @internal variante à vérité VRAIE, mémoïsée à la première demande. */
  on?: E;
}

/** Cases en vue : `visible` absent ⇒ TOUT est en vue (éditeur/QC/POV), la sémantique historique. */
export function inViewOf(visible?: ReadonlySet<string>): (key: string) => boolean {
  return visible ? (key) => visible.has(key) : () => true;
}

function truthOf<E, C>(entry: Viewed<E, C>, inView: (key: string) => boolean, ctx: C): boolean {
  const rule = entry.rule;
  switch (rule.kind) {
    case 'toujours': return true;
    case 'jamais': return false;
    case 'enVue': return rule.keys.some(inView);
    case 'horsVue': return !inView(rule.key);
    default: return rule.truth(ctx);
  }
}

/** Un builder « géométrie mémoïsée + vérité de vue résolue au pas ».
 *  - `derive` : la géométrie PURE de la scène pour une vue donnée (appelée une fois par scène × clé) ;
 *  - `key` : la clé de VUE dont dépend la GÉOMÉTRIE (étage actif, isolement debug) — jamais le brouillard ;
 *  - `context` : le contexte non tuilé des règles `contexte`, résolu UNE fois par appel ;
 *  - `withTruth` : l'élément à vérité VRAIE, dérivé de l'élément à vérité fausse. */
export function viewedBuilder<E, V, C = never>(opts: {
  derive: (scene: Scene, view: V | undefined) => Viewed<E, C>[];
  key: (view: V | undefined) => string;
  withTruth: (off: E) => E;
  context?: (scene: Scene, view: V | undefined) => C;
}): (scene: Scene, visible?: ReadonlySet<string>, view?: V) => E[] {
  const bucketOf = memoByRef((_scene: Scene) => new Map<string, { geom: Viewed<E, C>[]; last?: E[] }>());
  return (scene, visible, view) => {
    const bucket = bucketOf(scene);
    const k = opts.key(view);
    let slot = bucket.get(k);
    if (!slot) {
      slot = { geom: opts.derive(scene, view) };
      bucket.set(k, slot);
    }
    const inView = inViewOf(visible);
    const ctx = opts.context ? opts.context(scene, view) : (undefined as C);
    const previous = slot.last;
    const out: E[] = new Array(slot.geom.length);
    let unchanged = !!previous && previous.length === out.length;
    for (let i = 0; i < slot.geom.length; i++) {
      const entry = slot.geom[i];
      const el = truthOf(entry, inView, ctx) ? (entry.on ??= opts.withTruth(entry.off)) : entry.off;
      out[i] = el;
      if (unchanged && previous![i] !== el) unchanged = false;
    }
    if (unchanged) return previous!;
    slot.last = out;
    return out;
  };
}
