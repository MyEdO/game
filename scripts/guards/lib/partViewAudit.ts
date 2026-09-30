/**
 * AUDIT du FORMAT DE PART du rig (#551) — définition UNIQUE, partagée par :
 *   - la garde  `src/gameIso/rig/parts/tenues/part-view-format.test.ts` (cliquet) ;
 *   - la régénération de `rigPartViewStock.mjs` et de `rigViewStock.mjs` (`regenerations`).
 *
 * Les deux DOIVENT mesurer la même chose : une régénération qui aurait sa propre lecture du pipeline
 * écrirait un stock que la garde ne reconnaît pas. D'où l'audit ici, et non dans le test.
 *
 * L'audit exerce le CHEMIN RÉEL (`resolveParts` pour le rendu servi + la vue DESSINÉE, `isDrawnView`
 * de ce module, sur le def brut) : il ne réplique jamais l'empilage. Périmètre et mécanismes : `rig/PART-CONTRACT.md`.
 */
import { TENUE_DEFS } from '../../../src/gameIso/rig/parts/tenues/_registry.generated';
import { ARMOUR_DEFS } from '../../../src/gameIso/rig/parts/armour/_registry.generated';
import { resolveParts } from '../../../src/gameIso/rig/parts/resolve';
import { viewOrFront, type PartArt } from '../../../src/gameIso/rig/parts/types';
import { declaredView } from '../../../src/gameIso/rig/viewArt';
import { MONSTER_PARTS } from '../../../src/gameIso/rig/parts/monster/_registry.generated';
import { ELEMENT_DEFS } from '../../../src/gameIso/rig/parts/elements/_registry.generated';
import type { ElementOverlay } from '../../../src/gameIso/rig/parts/elements/types';
import { appendageArt } from '../../../src/gameIso/rig/parts/appendages';
import type { View } from '../../../src/gameIso/rig/facing';
import { equipDe } from '../../../src/gameIso/rig/parts/equipment';
import type { EquipCtx } from '../../../src/gameIso/rig/parts/equipment';
import type { Site } from './stock.mjs';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';
import type { ItemInstance, HitLocation } from '../../../src/engine/types';
import { slugId } from '../../../src/data/slug';
import { fichierDeDef, REGISTRE_TENUES, REGISTRE_ARMURES, REGISTRE_PARTS_MONSTRUEUSES, REGISTRE_ELEMENTS } from './registreDeDefs';

export const SLOTS = ['tete', 'bras', 'torse', 'jambes', 'pied', 'main', 'cou'] as const;
export type BodySlot = (typeof SLOTS)[number];
/** Porteur d'art de corps : une tenue ou une armure (même `set`, même passage par `resolveParts`). */
export interface Bearer { set: Partial<Record<BodySlot, PartArt>> }

const NO_EQUIP: EquipCtx = equipDe([], []);

/** Vue DÉCLARÉE (`declaredView`, `viewArt.ts`) dont l'art n'est pas vide : ce que mesure le format. */
export const isDrawnView = (art: PartArt | null | undefined, view: View): boolean => !!declaredView(art, view);

/**
 * Signature GÉOMÉTRIQUE d'un fragment SVG : la suite des éléments et de leurs attributs de forme.
 * Ce que le format vise est un DESSIN identique — pas une chaîne identique. Comparer les chaînes
 * laisse passer toute mutation cosmétique inerte (espace, commentaire, `<g>` enveloppant) et le
 * front simplement RECOLORÉ, qui rendent au pixel près ce que l'anti-alias veut tuer.
 *
 * Une signature `d=`-seule serait aveugle : le pipeline émet des `<ellipse>`/`<rect>` sans `d`
 * (HAND, genericPart) — d'où le relevé de TOUS les attributs porteurs de forme, `transform` compris
 * (un `<g transform>` déplace son contenu : il est géométrique, contrairement au `<g>` de style).
 *
 * L'art du dépôt mélange les deux quotages (`d="…"` ET `d='…'`, cf. `tenues/defs/Marchand.ts`) :
 * un relevé mono-quote rend `''` sur une partie du corpus, et deux `''` se comparent ÉGAUX — l'audit
 * crierait à l'alias sur des dessins distincts. `geometryOrThrow` verrouille cette classe.
 */
const GEOM_ATTRS = [
  'd', 'points', 'cx', 'cy', 'r', 'rx', 'ry',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'transform',
] as const;
export function geometry(svg: string): string {
  const out: string[] = [];
  for (const m of svg.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*?)\/?>/g)) {
    const [, tag, attrs] = m;
    const geom = GEOM_ATTRS.flatMap((a) => {
      const v = new RegExp(`\\b${a}=("([^"]*)"|'([^']*)')`).exec(attrs);
      const raw = v ? (v[2] ?? v[3]) : undefined;
      return raw != null ? [`${a}=${raw.replace(/\s+/g, ' ').trim()}`] : [];
    });
    if (geom.length === 0) continue; // conteneur de style (`<g stroke=…>`), balise sans forme
    out.push(`${tag}[${geom.join(',')}]`);
  }
  return out.join('|');
}
/** Un fragment SERVI non vide qui ne rend AUCUNE géométrie = le relevé est aveugle sur cet art,
 *  et l'audit comparerait deux `''`. On échoue au lieu de verdir à tort. */
function geometryOrThrow(svg: string, where: string): string {
  const g = geometry(svg);
  if (svg.trim() !== '' && g === '')
    throw new Error(`geometry() n'a relevé aucune forme sur un fragment SERVI non vide (${where}) — ` +
      `le relevé est aveugle sur cet art, la comparaison d'alias serait ''==='' . Fragment :\n${svg.slice(0, 300)}`);
  return g;
}

export interface Audit {
  /** Slots fournis en `string` front-only, réf `<porteur>:<slot>`. */
  format: Site[];
  /** Vues déclarées dont le DESSIN servi est celui du front, réf `<porteur>:<slot>:<vue>`. */
  alias: Site[];
}

function auditBearer(
  file: string,
  key: string,
  bearer: Bearer,
  serve: (view: View) => Record<string, { svg: string } | null>,
  acc: Audit,
) {
  const front = serve('front');
  const views = { profile: serve('profile'), back: serve('back') } as const;
  for (const slot of SLOTS) {
    const art = bearer.set[slot];
    if (art == null) continue;
    if (!isDrawnView(art, 'profile') || !isDrawnView(art, 'back')) { acc.format.push({ file, ref: `${key}:${slot}` }); continue; }
    // Vues DÉCLARÉES : le pipeline sert l'art du def — vérifier que le DESSIN diffère du front.
    const ref = geometryOrThrow(front[slot]?.svg ?? '', `${key}:${slot}:front`);
    for (const view of ['profile', 'back'] as const)
      if (geometryOrThrow(views[view][slot]?.svg ?? '', `${key}:${slot}:${view}`) === ref)
        acc.alias.push({ file, ref: `${key}:${slot}:${view}` });
  }
}

/** Item d'armure de test couvrant les 4 slots de corps — `armourMaterial` infère le matériau du nom,
 *  et `name` du def EST le matériau (cf. `parts/armour/types.ts`). */
const ALL_LOCS: HitLocation[] = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];
const armourItem = (mat: string): ItemInstance =>
  ({ uid: `audit_${mat}`, label: mat, kind: 'armor', qualities: [], enc: 0, equipped: true, locs: ALL_LOCS });

/** Mesure les violations de format sur les DEUX registres de slots de corps (tenues + armures). */
export function auditPartViews(): Audit {
  const acc: Audit = { format: [], alias: [] };
  for (const def of TENUE_DEFS) {
    const id = slugId(def.label);
    auditBearer(fichierDeDef(REGISTRE_TENUES, def), id, def,
      (view) => resolveParts('Humain', 'M', id, NO_EQUIP, {}, 1, view), acc);
  }
  for (const def of ARMOUR_DEFS) {
    const key = `armure:${def.id}`;
    const equip: EquipCtx = equipDe([], [armourItem(def.id)]);
    // Sans tenue : l'armure couvre les 4 slots et PRIME de toute façon (`armed ?? tenuePart`).
    auditBearer(fichierDeDef(REGISTRE_ARMURES, def), key, def,
      (view) => resolveParts('Humain', 'M', undefined, equip, {}, 1, view), acc);
  }
  return acc;
}

/* ------------------------------------------------------------------------------------------------
 * MESURE SŒUR (#1082) — les familles hors slots de corps : parts MONSTRUEUSES (`parts/monster/defs/`)
 * et ÉLÉMENTS d'apparence (`parts/elements/defs/`). Elles ne passent pas par `resolveParts` : leur
 * repli est celui de `viewOrFront` (`parts/types.ts`, front servi tel quel) côté monstre, et celui du
 * filtre `if (ov.view && ov.view !== view) continue` (`composeRig.tsx`) côté éléments — un overlay
 * sans `view` est émis à l'identique dans les trois vues.
 *
 * TROIS dimensions par (def, vue) :
 *   - `format`    : la vue n'est DÉCLARÉE nulle part, ou l'est avec un art vide (repli silencieux
 *                   sur le front) ;
 *   - `alias`     : la vue est déclarée et rend la MÊME géométrie que le front ;
 *   - `transform` : la vue est déclarée, sa géométrie diffère, mais son contenu est celui du front
 *                   réutilisé sous une enveloppe (`<g transform=…>`) ou inclus tel quel — la
 *                   silhouette tournée ne redessine pas l'occlusion.
 * ---------------------------------------------------------------------------------------------- */

const norm = (svg: string): string => svg.replace(/\s+/g, ' ').trim();

/** Retire les enveloppes `<g … transform=…>` EXTÉRIEURES : ce qui reste est le contenu dessiné. */
export function stripOuterTransform(svg: string): string {
  let s = norm(svg);
  for (;;) {
    const m = /^<g\b[^>]*\btransform=[^>]*>([\s\S]*)<\/g>$/.exec(s);
    if (!m) return s;
    s = norm(m[1]);
  }
}

/** Retire les attributs `transform` portés par les FORMES elles-mêmes (`<path transform=… d=…/>`).
 *  Sans enveloppe `<g>` à défaire, c'est le seul moyen de ramener deux dessins au même repère. */
export function stripShapeTransforms(svg: string): string {
  return svg.replace(/\s+transform=("[^"]*"|'[^']*')/g, '');
}

/** La vue réutilise-t-elle le contenu du front sous un simple transform (rotate/scale/translate) ?
 *  Trois signatures : le front présent en SOUS-CHAÎNE de la vue ; les deux contenus identiques une
 *  fois leurs enveloppes `<g transform=…>` défaites ; les deux GÉOMÉTRIES identiques une fois le
 *  `transform` de chaque forme neutralisé (`<path transform="scale(-1,1)" d="…"/>` — un miroir sans
 *  enveloppe). `front === vue` relève de l'alias, pas d'ici.
 *
 *  PÉRIMÈTRE de la détection, mesuré sur le chemin réel (#1082) : deux façons de reprendre le front
 *  restent DEHORS, car elles altèrent les coordonnées elles-mêmes et produisent donc une géométrie
 *  qu'aucune neutralisation de `transform` ne ramène à celle du front —
 *    (b) la recopie décalée numériquement (chaque nombre translaté de +0.1) ;
 *    (c) le miroir réécrit à la main (coordonnées opposées, aucun attribut `transform`).
 *  Les séparer d'un vrai dessin de vue demande une comparaison de FORME à la tolérance près
 *  (appariement de tracés), là où cette fonction compare des signatures textuelles. La dimension
 *  `transform` mesure donc la reprise PAR TRANSFORM DÉCLARÉ, pas la ressemblance de silhouette. */
export function isTransformDerived(front: string, view: string): boolean {
  const f = norm(front);
  const v = norm(view);
  if (f === '' || v === '' || f === v) return false;
  if (v.includes(f)) return true;
  const gf = geometry(stripShapeTransforms(stripOuterTransform(f)));
  return gf !== '' && gf === geometry(stripShapeTransforms(stripOuterTransform(v)));
}

export interface RigViewAudit {
  /** Vue déclarée nulle part, réf `<famille>:<clé>:<vue>`. */
  format: Site[];
  /** Vue déclarée dont la géométrie est celle du front. */
  alias: Site[];
  /** Vue déclarée dont le contenu est le front sous un transform. */
  transform: Site[];
}

const OTHER_VIEWS = ['profile', 'back'] as const;

/** Classe une vue d'un def : déclarée ou non, puis alias / dérivée-par-transform.
 *  Une déclaration dont l'art SERVI est vide compte comme FORMAT : la vue est annoncée, le rendu de
 *  cette vue ne montre rien du def — le joueur voit exactement ce qu'il verrait sans déclaration. */
function classifyView(
  file: string,
  key: string,
  view: 'profile' | 'back',
  declared: boolean,
  front: string,
  served: string,
  acc: RigViewAudit,
) {
  const site = { file, ref: `${key}:${view}` };
  if (!declared || norm(served) === '') { acc.format.push(site); return; }
  if (geometry(served) === geometry(front)) { acc.alias.push(site); return; }
  if (isTransformDerived(front, served)) acc.transform.push(site);
}

/** Mesure les trois dimensions sur MONSTER_PARTS et ELEMENT_DEFS. */
export function auditRigPartViews(): RigViewAudit {
  const acc: RigViewAudit = { format: [], alias: [], transform: [] };

  for (const part of MONSTER_PARTS) {
    const key = `monstre:${part.slot}:${part.key}`;
    const file = fichierDeDef(REGISTRE_PARTS_MONSTRUEUSES, part);
    const front = viewOrFront(part.art, 'front');
    for (const view of OTHER_VIEWS)
      classifyView(file, key, view, isDrawnView(part.art, view), front, viewOrFront(part.art, view), acc);
  }

  // GRANULARITÉ de la mesure des éléments — le runtime décide par OVERLAY : `composeRig.tsx:267`
  // (calques cosmétiques) et `composeRig.tsx:303` (features d'instance) filtrent CHAQUE calque sur
  // son propre `view`. La CLÉ de mesure, elle, nomme le DEF : un def dont un seul calque retombe sur
  // l'art de face est rapporté ENTIER, et une vue rapportée déclarée peut porter un calque déclaré
  // vide à côté d'un calque déclaré plein. Descendre la clé à l'overlay (`element:<clé>#<rang>:<vue>`)
  // réécrit les 115 entrées du stock : geste séparé.
  // Ce que `declaredIn` exige, en revanche, est bien par overlay : un calque qui FUIT vers la vue
  // (art de face émis à l'identique dans les trois vues) suffit à retirer la déclaration au def.
  for (const el of ELEMENT_DEFS) {
    const overlays = el.overlays ?? [];
    if (overlays.length === 0) continue; // élément purement morpho (build/legs/skin/faceFlip) : aucun art
    const key = `element:${el.key}`;
    const file = fichierDeDef(REGISTRE_ELEMENTS, el);
    const artOf = (view: View) => overlays
      .filter((o) => !o.view || o.view === view)
      .map((o) => (o.appendage ? viewOrFront(appendageArt(o.appendage), view) : o.svg))
      .join('');
    /** Ce calque envoie-t-il l'art de FACE dans cette vue ? (`view` absent, et rien qui le résolve
     *  par vue : un `svg` brut est émis tel quel, un appendice sans art de la vue replie sur le front.) */
    const fuiteVersVue = (o: ElementOverlay, view: 'profile' | 'back') => {
      if (o.view) return false;
      if (o.appendage != null) return !isDrawnView(appendageArt(o.appendage), view);
      return (o.svg ?? '').trim() !== '';
    };
    const declaredIn = (view: 'profile' | 'back') =>
      overlays.some((o) => o.view === view || (o.appendage != null && isDrawnView(appendageArt(o.appendage), view)))
      && !overlays.some((o) => fuiteVersVue(o, view));
    const front = artOf('front');
    for (const view of OTHER_VIEWS)
      classifyView(file, key, view, declaredIn(view), front, artOf(view), acc);
  }
  return acc;
}

const MOTIF_RIG_VIEW = 'Dessine ces vues ; une vue neuve non dessinée ne s’entérine pas ici.';

/** La RÉGÉNÉRATION des deux stocks que ce module mesure, `rigPartViewStock.mjs` puis `rigViewStock.mjs`
 *  (par défaut, sur les mesures du dépôt). Commande :
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/partViewAudit.ts [--check]`. */
export const regenerations = (parts: Audit = auditPartViews(), rig: RigViewAudit = auditRigPartViews()): RegenerationDeStock[] => [
  {
    chemin: fileURLToPath(new URL('./rigPartViewStock.mjs', import.meta.url)).split(sep).join('/'),
    politique: DECROISSANT,
    collections: [
      { nom: 'PART_VIEW_RATCHET', sites: parts.format, motif: 'Dessine les 3 vues de ces slots (cf. src/gameIso/rig/PART-CONTRACT.md) ; un slot neuf ne s’entérine pas ici.' },
      { nom: 'PART_VIEW_ALIAS_RATCHET', sites: parts.alias, motif: 'Une vue déclarée qui redessine le front se corrige (dessiner la vue), elle ne s’entérine pas ici.' },
    ],
  },
  {
    chemin: fileURLToPath(new URL('./rigViewStock.mjs', import.meta.url)).split(sep).join('/'),
    politique: DECROISSANT,
    collections: [
      { nom: 'RIG_VIEW_FORMAT_RATCHET', sites: rig.format, motif: MOTIF_RIG_VIEW },
      { nom: 'RIG_VIEW_ALIAS_RATCHET', sites: rig.alias, motif: MOTIF_RIG_VIEW },
      { nom: 'RIG_VIEW_TRANSFORM_RATCHET', sites: rig.transform, motif: MOTIF_RIG_VIEW },
    ],
  },
];
