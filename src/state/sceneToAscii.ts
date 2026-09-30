/**
 * `Scene` → grilles ASCII du format `MapSpec` (`state/mapSpec.ts`) — le sens INVERSE de `buildScene` :
 * l'utilisateur édite au clic dans l'éditeur (`ui/editor`), puis exporte le résultat en ASCII copiable
 * dans un fichier source (`*.ascii.ts`, cf. `scenes/opera/floorplan.ascii.ts`). PUR, aucun import UI.
 *
 * PORTÉE (round-trip GARANTI, cf. `sceneToAscii.test.ts`) : tuiles (`walled`/`legend`), murs/portes/
 * fenêtres/matériaux ET apparences (`walled`/`wallLegend`), hauteurs (`relief`, une entrée par case ≠ 0 — capture
 * BRUTE, fidèle même sous une volée d'escalier), zones DESCRIPTIVES de pièce (`zoneMap`/`zoneLegend`).
 *
 * PORTÉE HORS ATTEINTE (le format `walled`/`zoneMap` ne les représente pas) — listée dans `notRestored`,
 * répétée en tête du texte exporté : `bind`, `cells` (recettes — dont la VOLÉE `cells.stair` elle-même :
 * seule la RAMPE de hauteurs qui en résulte survit, via `relief`), `entities` (PNJ/décor/habillage),
 * `seatAssignments` (qui est attablé à quel meuble),
 * `triggers`, `dialogues`, `encounters`, `architecture`, `stations`, `restZones`, zones d'effet
 * MÉCANIQUES (pièges/auras — seules les zones DESCRIPTIVES le sont), `heroStart`, `entryPoints`,
 * crénelure de rendu (`Layer.crenellated`), et les clés d'arête de `CLES_HORS_ASCII` (`climb`, `closed`,
 * `secret`, `shuttered`, `crossable`, `suspendu`). Réimporter ce texte SANS reporter le reste du `MapSpec` source ÉCRASERAIT
 * ce contenu — d'où l'avertissement explicite en tête de `text` et l'exigence de ne coller QUE les
 * grilles/legend/wallLegend/zoneLegend/relief dans le fichier `*.ascii.ts` + `*.ts` d'origine.
 */
import { tableTotale } from '../lib/tableTotale';
import type { Scene, SceneEffectZone, Terrain, WallOverlay, WallSeg } from './scene';
import { DEFAULT_TERRAIN, heightAt, isDescriptiveZone, porteAuteur, tileAt, wallOverlayOf, WALL_OVERLAY_KEYS } from './scene';
import { sceneZoneTiles } from './zones';
import { glypheDe, terrainAbsent, terrainsAvecGlyphe } from './terrain';
import { FOND_ECRIT, GLYPHES_RESERVES, GRAMMAIRE_ASCII } from '../data/schemas/grammaire/carte-ascii';

/** Alphabet BRUT de l'allocateur, moins les mots de la grammaire du plan (`carte-ascii.ts`). Les
 *  glyphes DÉCLARÉS par la donnée (`terrains.json › ascii`) en sont retirés à chaque export : ils
 *  désignent DÉJÀ un terrain, et un `D` réattribué à une zone rendrait le texte illisible pour qui le
 *  relit avec la légende de base. */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  .split('')
  .filter((c) => !GLYPHES_RESERVES.has(c));

/** Les ESPACES DE NOMMAGE d'un export : cases, arêtes, zones. Chacun a sa table clé→char (un terrain
 *  et une zone ne se confondent pas), mais TOUS consomment le MÊME curseur sur le MÊME pool : un char
 *  servi à l'un n'est jamais re-servi à un autre dans le même texte. Un curseur par espace ferait
 *  lire `a` comme « vide » en légende de cases ET « mur-en-bois » en légende d'arêtes. */
const ESPACES_ALLOUES = ['legend', 'wallLegend', 'zoneLegend'] as const;
type EspaceAlloue = (typeof ESPACES_ALLOUES)[number];

function makeAllocators(pool: readonly string[]): Record<EspaceAlloue, (key: string) => string> {
  let i = 0;
  const espace = (poolLabel: EspaceAlloue) => {
    const assigned = new Map<string, string>();
    return (key: string) => {
      const existing = assigned.get(key);
      if (existing) return existing;
      if (i >= pool.length) throw new Error(`sceneToAscii: pool de caractères « ${poolLabel} » épuisé (${key})`);
      const ch = pool[i++];
      assigned.set(key, ch);
      return ch;
    };
  };
  return tableTotale(ESPACES_ALLOUES, (e) => espace(e));
}

/** Terrain le plus FRÉQUENT de la couche `z` (base par défaut du char `.`/espace du grillage `walled`). */
function mostFrequentTerrain(scene: Scene, z: number): Terrain | null {
  const layer = scene.layers.find((l) => l.z === z);
  if (!layer) return null;
  const counts = new Map<Terrain, number>();
  for (const t of layer.tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best: Terrain | null = null;
  let bestN = -1;
  for (const [t, n] of counts) if (n > bestN) { best = t; bestN = n; }
  return best;
}

const edgeKey = (x: number, y: number, side: 'N' | 'E', z: number) => `${x},${y},${side},z${z}`;
const diagKey = (x: number, y: number, z: number) => `${x},${y},z${z}`;
/** Séparateur des clés de catégorie (US, U+001F) : un char qu'aucune valeur d'overlay ne peut porter,
 *  et surtout aucun mot de la grammaire du plan — une clé interne ne s'écrit pas dans le vocabulaire
 *  du texte exporté. */
const SEP_CLE = '\u001f';
/** Catégorie d'arête = ce qu'un char de grille peut porter : porte, fenêtre, et TOUT l'overlay
 *  (`WALL_OVERLAY_KEYS` — jamais une liste énumérée ici : N+1 propriété entre dans la clé toute seule). */
const wallCatKey = (door: boolean, window: boolean, overlay: WallOverlay) =>
  [door ? 1 : 0, window ? 1 : 0, ...WALL_OVERLAY_KEYS.map((k) => overlay[k] ?? '')].join(SEP_CLE);
/** Clés d'un `WallSeg` que le format walled ne REPRÉSENTE pas → libellé de l'avertissement d'export.
 *  N+1 clé = UNE ligne ici (patron `WALL_OVERLAY_KEYS`, `state/scene.ts`). */
const CLES_HORS_ASCII = {
  climb: 'arête(s) escaladable(s)',
  closed: 'porte(s) FERMÉE(S) par défaut',
  secret: 'porte(s) secrète(s)',
  shuttered: 'croisée(s) aux volets clos',
  crossable: 'croisée(s) franchissable(s)',
  suspendu: 'hauteur(s) de suspension de croisée',
} as const satisfies Partial<Record<keyof WallSeg, string>>;
type CleHorsAscii = keyof typeof CLES_HORS_ASCII;
const CLES_HORS_ASCII_LISTE = Object.keys(CLES_HORS_ASCII) as CleHorsAscii[];

/** L'overlay porte-t-il quoi que ce soit ? (un mur nu `-`/`|` n'en porte aucun). */
const hasOverlay = (overlay: WallOverlay) => WALL_OVERLAY_KEYS.some((k) => overlay[k] !== undefined);
/** Overlay lisible dans un avertissement d'outil d'édition (`structure=herse, appearance=mur-en-bois`). */
const overlayLabel = (overlay: WallOverlay) => WALL_OVERLAY_KEYS.filter((k) => overlay[k] !== undefined).map((k) => `${k}=${overlay[k]}`).join(', ');

export interface SceneAsciiExport {
  /** Grilles BOX-DRAWING par étage (`z0`/`z1`/…) — à coller dans `MapSpec.walled`. */
  walled: Record<string, string>;
  /** Légende de terrain (char → terrain) partagée par toutes les grilles — à coller dans `MapSpec.legend`. */
  legend: Record<string, Terrain>;
  /** Terrain de FOND de CHAQUE couche (`z0`/`z1`/…) — ce que vaut le char de fond de sa grille. Une
   *  couche au-dessus du rez a pour fond l'ABSENCE de tuile : lire la légende d'une couche sans cette
   *  table forcerait chaque appelant (devtools, éditeur) à recopier la règle de `baseOf`. */
  fondParZ: Record<string, Terrain>;
  /** Terrain de FOND du rez — ce que vaut le char `.` de `walled.z0`, à coller dans `MapSpec.terrain`.
   *  Sans lui, toutes les cases de ce terrain se relisent au défaut de `buildScene` (perte SILENCIEUSE :
   *  382 cases `plancher` sur La Diligence). */
  terrain: Terrain;
  /** Char d'arête → overlay (structure destructible et/ou apparence de rendu) — à coller dans
   *  `MapSpec.wallLegend`. */
  wallLegend: Record<string, WallOverlay>;
  /** Grilles de ZONES DESCRIPTIVES par étage — à coller dans `MapSpec.zoneMap`. */
  zoneMap: Record<string, string[]>;
  /** Légende des zones (char → libellé/id/présentation) — à coller dans `MapSpec.zoneLegend`. */
  zoneLegend: Record<string, { id?: string; label: string; presentation?: 'interior' | 'exterior' }>;
  /** Hauteurs par case (capture BRUTE, une entrée par case de hauteur ≠ 0) — à coller dans `MapSpec.relief`. */
  relief: { cell: [number, number]; height: number; z?: number }[];
  /** CE QUI N'EST PAS RESTITUÉ par cet export — à lire AVANT d'écraser le fichier source. */
  notRestored: string[];
  /** Anomalies rencontrées PENDANT l'export (pertes ponctuelles : diagonale abandonnée, matériau de
   *  porte non représentable…) — sous-ensemble détaillé de `notRestored`. */
  warnings: string[];
  /** Texte complet, formaté, COPIABLE tel quel (en-tête d'avertissement + grilles + tables). */
  text: string;
}

/** Exporte une `Scene` compilée (`buildScene`) vers les grilles ASCII du format `MapSpec` — l'inverse
 *  de `buildScene`. Voir le commentaire d'en-tête du fichier pour la portée exacte du round-trip. */
export function sceneToAscii(scene: Scene): SceneAsciiExport {
  const { w, h } = scene.dimensions;
  const zs = [...new Set(scene.layers.map((l) => l.z))].sort((a, b) => a - b);
  const warnings: string[] = [];
  // Indirection délibérée (jamais `warnings.push(\`littéral\`)` en direct) : ce sont des messages
  // d'OUTIL d'édition (modale d'export), pas du journal de combat — hors du périmètre visé par
  // `i18n-narration-guard.test.ts`, dont la forme `.push(\`…\`)` reste un signal utile ailleurs.
  const warn = (msg: string) => warnings.push(msg);

  // ── Légende de terrain (partagée par toutes les couches) ─────────────────────────────────────────
  // Le pool est celui de l'alphabet MOINS les glyphes que la donnée a déjà attribués : terrains, murs
  // et zones tirent tous du même pool réduit, aucun ne peut réclamer un `#`/`~`/`D` déclaré.
  const declares = terrainsAvecGlyphe();
  const pool = ALPHABET.filter((c) => !(c in declares));
  const alloc = makeAllocators(pool);
  const legend: Record<string, Terrain> = {};
  const base0 = mostFrequentTerrain(scene, 0) ?? DEFAULT_TERRAIN;
  const baseOf = (z: number) => (z === 0 ? base0 : terrainAbsent());
  const fondParZ: Record<string, Terrain> = Object.fromEntries(zs.map((z) => [`z${z}`, baseOf(z)]));
  const tileGlyph = (t: Terrain, base: Terrain): string => {
    if (t === base) return FOND_ECRIT;
    // Un terrain à glyphe DÉCLARÉ sort sous SON glyphe — le texte exporté s'écrit dans le vocabulaire
    // d'authoring, pas dans un alphabet d'allocation. `legend` le porte quand même : le round-trip par
    // `MapSpec.legend` ne dépend alors d'aucune donnée chez celui qui relit.
    const ch = glypheDe(t) ?? alloc.legend(t);
    legend[ch] = t;
    return ch;
  };

  // ── Arêtes (murs orthogonaux N/E + diagonales) indexées par case ─────────────────────────────────
  const edgeAt = new Map<string, WallSeg>();
  const diagAt = new Map<string, WallSeg>();
  const perdues = new Map<CleHorsAscii, number>();
  for (const seg of scene.walls ?? []) {
    const z = seg.z ?? 0;
    if (seg.side === '\\' || seg.side === '/') diagAt.set(diagKey(seg.x, seg.y, z), seg);
    else edgeAt.set(edgeKey(seg.x, seg.y, seg.side, z), seg);
    for (const k of CLES_HORS_ASCII_LISTE) if (seg[k]) perdues.set(k, (perdues.get(k) ?? 0) + 1);
  }
  for (const [k, n] of perdues) warn(`${n} ${CLES_HORS_ASCII[k]} (\`WallSeg.${k}\`) — non représentable en ASCII, à reporter à la main.`);

  // ── Glyphe par arête : catégorie (door, window, overlay) → char (cf. commentaire d'en-tête) ──────
  const catCount = new Map<string, { door: boolean; window: boolean; overlay: WallOverlay; count: number }>();
  for (const seg of edgeAt.values()) {
    const overlay = wallOverlayOf(seg);
    const k = wallCatKey(porteAuteur(seg), !!seg.window, overlay);
    const cur = catCount.get(k);
    if (cur) cur.count++;
    else catCount.set(k, { door: porteAuteur(seg), window: !!seg.window, overlay, count: 1 });
  }
  const wallLegend: Record<string, WallOverlay> = {};
  const catToGlyph = new Map<string, string>();
  const doorCats = [...catCount.values()].filter((c) => c.door).sort((a, b) => b.count - a.count);
  const windowCats = [...catCount.values()].filter((c) => !c.door && c.window).sort((a, b) => b.count - a.count);
  const plainCats = [...catCount.values()].filter((c) => !c.door && !c.window).sort((a, b) => b.count - a.count);
  if (doorCats.length) {
    for (const c of doorCats) catToGlyph.set(wallCatKey(c.door, c.window, c.overlay), GRAMMAIRE_ASCII.porte);
    const overlaid = doorCats.filter((c) => hasOverlay(c.overlay));
    if (overlaid.length) {
      wallLegend[GRAMMAIRE_ASCII.porte] = overlaid[0].overlay;
      const lostN = overlaid.slice(1).reduce((n, c) => n + c.count, 0);
      if (lostN) warn(`${lostN} porte(s) avec un matériau/une apparence distincts de « ${overlayLabel(overlaid[0].overlay)} » — un seul overlay par glyphe « ${GRAMMAIRE_ASCII.porte} », les autres perdent leur \`structure\`/\`appearance\`.`);
    }
    const lostWindow = doorCats.filter((c) => c.window).reduce((n, c) => n + c.count, 0);
    if (lostWindow) warn(`${lostWindow} arête(s) à la fois porte ET fenêtre — le glyphe « ${GRAMMAIRE_ASCII.porte} » ne porte que la porte, la fenêtre est perdue.`);
  }
  if (windowCats.length) {
    for (const c of windowCats) catToGlyph.set(wallCatKey(c.door, c.window, c.overlay), GRAMMAIRE_ASCII.fenetre);
    const overlaid = windowCats.filter((c) => hasOverlay(c.overlay));
    if (overlaid.length) {
      wallLegend[GRAMMAIRE_ASCII.fenetre] = overlaid[0].overlay;
      const lostN = overlaid.slice(1).reduce((n, c) => n + c.count, 0);
      if (lostN) warn(`${lostN} fenêtre(s) avec un matériau/une apparence distincts de « ${overlayLabel(overlaid[0].overlay)} » — un seul overlay par glyphe « ${GRAMMAIRE_ASCII.fenetre} », les autres perdent leur \`structure\`/\`appearance\`.`);
    }
  }
  const nuPlain = plainCats.find((c) => !hasOverlay(c.overlay));
  if (nuPlain) {
    catToGlyph.set(wallCatKey(false, false, {}), GRAMMAIRE_ASCII.murHorizontal);
    // Les murs NUS (aucun overlay) sortent sous les mots `murHorizontal`/`murVertical` de la
    // grammaire — jamais enregistrés dans `wallLegend`, qui ne porte que des overlays.
  }
  for (const c of plainCats) {
    if (!hasOverlay(c.overlay)) continue; // déjà couvert par le mur NU ci-dessus
    const k = wallCatKey(false, false, c.overlay);
    if (!nuPlain && plainCats.indexOf(c) === 0) {
      catToGlyph.set(k, GRAMMAIRE_ASCII.murHorizontal);
      wallLegend[GRAMMAIRE_ASCII.murHorizontal] = c.overlay;
      wallLegend[GRAMMAIRE_ASCII.murVertical] = c.overlay;
      continue;
    }
    const ch = alloc.wallLegend(`plain:${overlayLabel(c.overlay)}`);
    catToGlyph.set(k, ch);
    wallLegend[ch] = c.overlay;
  }
  const wallGlyph = (seg: WallSeg, orientation: 'N' | 'E'): string => {
    const k = wallCatKey(porteAuteur(seg), !!seg.window, wallOverlayOf(seg));
    const g = catToGlyph.get(k);
    if (g === GRAMMAIRE_ASCII.murHorizontal || g === undefined)
      return orientation === 'N' ? GRAMMAIRE_ASCII.murHorizontal : GRAMMAIRE_ASCII.murVertical;
    return g;
  };

  // ── Grille box-drawing par étage ──────────────────────────────────────────────────────────────────
  const walled: Record<string, string> = {};
  for (const z of zs) {
    const base = baseOf(z);
    const rows: string[] = [];
    for (let ry = 0; ry <= 2 * h; ry++) {
      let row = '';
      for (let rx = 0; rx <= 2 * w; rx++) {
        if (ry % 2 === 0 && rx % 2 === 0) { row += GRAMMAIRE_ASCII.jonction; continue; }
        if (ry % 2 === 0) {
          const x = (rx - 1) / 2, ye = ry / 2;
          const seg = edgeAt.get(edgeKey(x, ye, 'N', z));
          row += seg ? wallGlyph(seg, 'N') : ' ';
          continue;
        }
        if (rx % 2 === 0) {
          const y = (ry - 1) / 2, xe = rx / 2 - 1;
          const seg = edgeAt.get(edgeKey(xe, y, 'E', z));
          row += seg ? wallGlyph(seg, 'E') : ' ';
          continue;
        }
        const x = (rx - 1) / 2, y = (ry - 1) / 2;
        const diag = diagAt.get(diagKey(x, y, z));
        const t = tileAt(scene, x, y, z);
        if (diag) {
          // Une DIAGONALE n'a pas de char de légende : `parseWalledAscii` ne lit `wallLegend` que sur les
          // arêtes N/E, un `/`/`\` réimporté revient donc TOUJOURS nu. Perte nommée, jamais silencieuse.
          if (hasOverlay(diag)) warn(`cloison diagonale (${x},${y},z${z}) : ${overlayLabel(diag)} — le glyphe '${diag.side}' ne porte ni structure ni apparence, perdu(e) au réimport.`);
          if (t === base) { row += diag.side; continue; }
          warn(`diagonale (${x},${y},z${z}) abandonnée : terrain « ${t} » ≠ base « ${base} » de l'étage (le glyphe diagonal force la base sous la cloison).`);
        }
        row += tileGlyph(t, base);
      }
      rows.push(row);
    }
    walled[`z${z}`] = `\n${rows.join('\n')}\n`;
  }

  // ── Zones DESCRIPTIVES (pièces) — une couleur par zone id, char recyclé nulle part (legende globale) ──
  const zoneLegend: SceneAsciiExport['zoneLegend'] = {};
  const zoneMap: Record<string, string[]> = {};
  const zonesByZ = new Map<number, { x: number; y: number; ch: string }[]>();
  const allZones = scene.effectZones ?? [];
  const descriptive = allZones.filter(isDescriptiveZone);
  const mechanical = allZones.filter((z) => !isDescriptiveZone(z));
  if (mechanical.length) {
    warn(`${mechanical.length} zone(s) d'effet MÉCANIQUE (piège/aura, non descriptive) ignorée(s) : ${mechanical.map((z) => z.id).join(', ')} — non représentables en \`zoneMap\`.`);
  }
  for (const zone of descriptive as SceneEffectZone[]) {
    const z = zone.z ?? 0;
    const ch = alloc.zoneLegend(zone.id);
    zoneLegend[ch] = { id: zone.id, label: zone.label, ...(zone.presentation ? { presentation: zone.presentation } : {}) };
    const list = zonesByZ.get(z) ?? [];
    for (const t of sceneZoneTiles(zone)) list.push({ x: t.x, y: t.y, ch });
    zonesByZ.set(z, list);
  }
  for (const z of zs) {
    const cells = zonesByZ.get(z);
    if (!cells) continue;
    const grid: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => ' '));
    for (const c of cells) if (c.y >= 0 && c.y < h && c.x >= 0 && c.x < w) grid[c.y][c.x] = c.ch;
    // Tableau de lignes EXACTES (pas un `String.raw` blob) : `rowsOf` (mapSpec.ts) trimme TOUTE ligne
    // vide de tête/queue en boucle — une rangée de zoneMap légitimement vide (aucune pièce sur cette
    // rangée) serait alors confondue avec la ligne vide artificielle du gabarit et perdrait sa case,
    // décalant tout le reste de la grille (#mesuré sur La Diligence, rangée 0 nue au rez). Un TABLEAU
    // de lignes (`MapSpec.zoneMap` accepte `string | string[]`) court-circuite ce trim (`rowsOf` renvoie
    // les tableaux tels quels) — jamais de perte, quel que soit le contenu des rangées.
    zoneMap[`z${z}`] = grid.map((row) => row.join(''));
  }

  // ── Hauteurs (relief) — capture BRUTE case par case, fidèle même sous une rampe/volée ─────────────
  const relief: SceneAsciiExport['relief'] = [];
  for (const z of zs)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const height = heightAt(scene, x, y, z);
        if (height !== 0) relief.push({ cell: [x, y], height, ...(z ? { z } : {}) });
      }

  // ── Crénelure de rendu (non restituable ici) ──────────────────────────────────────────────────────
  const hasCrenellated = scene.layers.some((l) => l.crenellated?.some((c) => c != null));
  if (hasCrenellated) warn('crénelure de rendu (`Layer.crenellated`) présente — décorative, non réémise (nécessiterait `elevate {height,parapet}` ou `cells.wall`, à reporter à la main).');

  const notRestored: string[] = [
    "`cells.stair` (recette de VOLÉE d'escalier + habillage posé par case) — la RAMPE de hauteurs qui en résulte EST capturée (via `relief` ci-dessous), mais pas la recette : pour ré-éditer la volée elle-même (pas seulement ses hauteurs), reportez `cells.stair` à la main dans le fichier `*.ts` source, jamais dans les grilles ASCII.",
    '`bind` (marqueurs → poses), `entities` (PNJ, décor, props — y compris l’habillage posé par un escalier), `seatAssignments` (occupation des places assises du mobilier), `triggers`, `dialogues`, `encounters` — RIEN de narratif/logique n’est réémis.',
    '`architecture` (masses/façades/toits authorés), `stations`, `restZones`, `heroStart`, `entryPoints` — non réémis.',
    ...warnings,
  ];

  const header =
    `// ATTENTION — EXPORT PARTIEL (state/sceneToAscii.ts) — grilles walled/zoneMap + legend/wallLegend/zoneLegend/relief SEULEMENT.\n` +
    `// Ne PAS écraser le fichier *.ts source avec ceci : ce texte ne restitue PAS ${notRestored.length} catégorie(s) de contenu\n` +
    `// (liste ci-dessous). Ne remplacez QUE les constantes de grilles (*_ASCII/*_ZONES) et les tables\n` +
    `// (legend/wallLegend/zoneLegend/relief) dans le fichier source, en gardant intact tout le reste du MapSpec.\n` +
    notRestored.map((n) => `// - ${n}`).join('\n') +
    '\n';

  const gridConsts = zs
    .map((z) => `export const Z${z}_ASCII = String.raw\`${walled[`z${z}`] ?? ''}\`;` + (zoneMap[`z${z}`] ? `\nexport const Z${z}_ZONES = ${JSON.stringify(zoneMap[`z${z}`], null, 2)};` : ''))
    .join('\n\n');

  const text =
    `${header}\n${gridConsts}\n\n` +
    `export const LEGEND = ${JSON.stringify(legend, null, 2)};\n\n` +
    `export const WALL_LEGEND = ${JSON.stringify(wallLegend, null, 2)};\n\n` +
    `export const ZONE_LEGEND = ${JSON.stringify(zoneLegend, null, 2)};\n\n` +
    `export const RELIEF = ${JSON.stringify(relief, null, 2)};\n\n` +
    `export const TERRAIN = ${JSON.stringify(base0)};\n`;

  return { walled, legend, fondParZ, terrain: base0, wallLegend, zoneMap, zoneLegend, relief, notRestored, warnings, text };
}
