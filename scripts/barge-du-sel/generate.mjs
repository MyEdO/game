#!/usr/bin/env -S npx tsx
/**
 * Génère `src/scenes/barge-du-sel/barge-du-sel-projet.json` (`projectDoc()` : paquet de projet au
 * schema courant, forme décidée par `documentDeProjet`).
 * Mini-campagne navale « La Barge du Sel » (issue #218, expérience auteur) — modelée sur
 * `scripts/loup-et-saumure/generate.mjs` : RÉUTILISE `scene()`/`hero()`/`P()`/`flowOf()`/`poste()`/
 * `resetIds()` de `scripts/campagne/lib.mjs` (IMPORT, zéro modification de ce fichier).
 *
 * 3 scènes : le quai de départ (le navire du groupe et l'objectif courant sont posés à l'entrée), une
 * embuscade de pirates ancrée à MI-ROUTE (coque type cogue, trait naval « Renforcé » du catalogue,
 * reddition à 40 % de Blessures), et l'îlot d'arrivée. Patron des entités-coque (`hull()`) et des rangées
 * ASCII de mer (`seaRows()`) repris À L'IDENTIQUE de `scripts/loup-et-saumure/generate.mjs` : ces deux
 * fabriques sont LOCALES à chaque générateur naval (`lib.mjs` ne les exporte pas), donc dupliquées ici À
 * L'IDENTIQUE plutôt que réinventées.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scene, hero, P, flowOf, poste, resetIds, projectDoc, flagWhen } from '../campagne/lib.mjs';
import { itemFromTrappingById } from '../../src/engine/items.ts';
import { emptyNarratif } from '../../src/state/campaignNarratif.ts';

/** Construction PURE du document de projet : la SOURCE possède 100 % de la donnée de l'artefact
 *  (`src/scenes/barge-du-sel/barge-du-sel-projet.json`), le CLI ci-dessous n'en est que la voie d'écriture.
 *  Rejouable à volonté dans un même process — garde `src/scenes/generateurs-byte-stables.test.ts`. */
export function build() {
let ammoSeq = 0;
/** Munition de bord (`ItemInstance` kind:'ammo') bâtie par la couture CANONIQUE `itemFromTrappingById`,
 *  uid STABLE + quantité — cohérence témoin avec `scripts/loup-et-saumure/generate.mjs`. */
function ammoStock(trappingId, qty) {
  const base = itemFromTrappingById(trappingId);
  if (!base) throw new Error(`munition inconnue au catalogue : ${trappingId}`);
  return { ...base, uid: `ammo-${trappingId}-${++ammoSeq}`, qty };
}
/** Poste ARMÉ (#241) : le `poste()` DOTÉ de son coffre à boulets de bord (`ShipPoste.ammo`) + la munition
 *  sélectionnée par défaut. Sans dotation, la pièce est muette (affordance « Pas de munitions »). */
function armedPoste(trappingId, side, stock) {
  const p = poste(trappingId, side);
  p.ammo = stock.map((s) => ammoStock(s.ref, s.qty));
  p.ammoUid = p.ammo[0].uid;
  return p;
}

/** Entité-COQUE brute (chemin `entities` du MapSpec, JAMAIS normalisée par `creatureId`) — une coque
 *  RICHE (crewIds/postes/upgrades) se pose ainsi puis s'enrôle via `encounters[].members` (doc
 *  `campagne-authoring.md` §7). */
function hull(id, ref, x, y, facing, label, crewIds, postes, upgrades) {
  return { id, kind: 'personnage', ref, pos: { x, y }, facing, label, crewIds, postes, ...(upgrades ? { upgrades } : {}) };
}

/** Rangées ASCII d'une scène MER : `w`×`h` cases d'eau ('.') avec des empreintes rectangulaires ('=')
 *  posées par coordonnées — construites par CODE (jamais comptées à la main), `parseAsciiRows` lève sinon
 *  une erreur explicite sur une ligne de largeur fautive. */
function seaRows(w, h, footprints) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const chars = new Array(w).fill('.');
    for (const f of footprints) if (y >= f.y && y < f.y + f.h) for (let x = f.x; x < f.x + f.w; x++) chars[x] = '=';
    rows.push(chars.join(''));
  }
  return rows;
}

/** Compétences NAVALES d'un marin représentant (MDG 14 l.39) — barreur (Voile) / canonnier (Poudre noire) : de
 *  quoi que la coque MANŒUVRE et FASSE FEU à la couche Mer. Témoin cohérent avec `loup-et-saumure`. */
const HELM_SKILLS = [{ id: 'voile', value: 55 }, { id: 'ramer', value: 45 }];
const GUN_SKILLS = [{ id: 'projectiles', spec: 'poudre-noire', value: 55 }];
/** Marin d'équipage COMPÉTENT (passager, hors rendu à la Mer) — CustomStatblock sourcé (règle stricte 7).
 *  `tenue` : id de garde-robe du rig (`src/gameIso/rig/parts/tenues/defs/`). Sans réf de bestiaire, une
 *  entité `personnage` n'a d'apparence à résoudre que par son Espèce — `entityRigProfileFor`
 *  (`src/gameIso/rig/enemyProfile.ts:270-274`) n'en dérive AUCUNE sans l'une des deux. */
function marine(id, x, y, label, skills, tenue) {
  return { id, kind: 'personnage', pos: { x, y }, label,
    appearance: { species: 'humains-reiklander', tenue },
    // Clés = `CharKey` (slugs pleins, #311/`src/engine/types.ts`) ∪ `M`/`B` (`CustomStatblock.char`).
    statblock: {
      type: 'statblock',
      label,
      char: {
        M: 4,
        'capacite-de-combat': 35,
        'capacite-de-tir': 40,
        force: 33,
        endurance: 35,
        agilite: 30,
        dexterite: 30,
        intelligence: 30,
        'force-mentale': 30,
        sociabilite: 30,
        B: 12,
      },
      ...(skills ? { skills } : {}),
    } };
}

/** Objectif courant (#238, doc §10) — id STABLE UNIQUE : re-poser met à jour le texte et le remonte en tête. */
const OBJ = (desc) => ({ type: 'setObjective', id: 'barge-du-sel-mission', desc });

/** Drapeaux de CHAPITRE (graphie kebab, comme les drapeaux narratifs des autres paquets) : le cap
 *  donné au quai RÉVÈLE l'îlot et sa route (`MapPlace.when`/`MapRoute.when`), l'accostage à l'îlot
 *  FERME le chapitre (`narratif.cloture.when`). Le drapeau nomme ce qui EST arrivé — la barge touche
 *  l'îlot, sa cale est encore pleine : le sel n'est pas livré, et rien dans la donnée ne le dit. */
const FLAG_CAP = 'sel-cap-donne';
const FLAG_ACCOSTE = 'sel-ilot-accoste';

const scenes = [];

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 0 — le quai de départ : la Louve grise est armée, l'objectif courant posé À L'ENTRÉE.
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
scenes.push(scene({
  id: 'barge-du-sel-quai',
  label: 'Le quai de la Barge du Sel',
  desc:
    "Un petit quai de chargement. La Louve grise attend, amarrée, la cale pleine de sel à livrer à l'îlot voisin.",
  base: 'sable',
  legend: { '~': 'eau', '=': 'planches' },
  rows: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '============',
    '~~~~~~~~~~~~',
    '~~~~~~~~~~~~',
  ],
  triggers: [
    {
      id: 'barge-du-sel-depart', rect: { x: 0, y: 0, w: 12, h: 8 }, once: true,
      flow: flowOf([
        {
          type: 'setVessel', vehicleId: 'loup-imperial', label: 'La Louve grise',
          morale: 70, hullCurrent: 120, hullMax: 120,
          crew: [{ roleId: 'mousse', count: 2 }],
        },
        OBJ("Convoyer le sel jusqu'à l'îlot, malgré les pirates qui infestent la route."),
        { type: 'journal', desc: "La Louve grise appareille, la cale pleine de sel, deux matelots à son bord — son canon servi, poudre et boulets en soute." },
      ]),
    },
    {
      // Le cap se prend SUR LES PLANCHES (rang 5) : le décor « Appareiller » est en (2,6) et
      // `interactEntity` exige une adjacence de Chebyshev ≤ 1 (`store.ts`), donc le groupe passe
      // forcément par ce rang pour embarquer — le drapeau est sur le chemin RÉEL, et jamais au
      // premier pas (le groupe naît en (2,3)).
      id: 'barge-du-sel-cap-donne', rect: { x: 0, y: 5, w: 12, h: 1 }, once: true,
      flow: flowOf([
        { type: 'setFlag', flag: FLAG_CAP },
        { type: 'journal', desc: "Sur les planches du quai, le maître de quai donne le cap : l'îlot du sel, plein nord." },
      ]),
    },
  ],
  entities: [
    hero(2, 3),
    P(2, 6, 'tonneau', {
      label: 'Appareiller vers l’îlot',
      usable: { actions: [{ id: 'fouiller', flow: flowOf([{ type: 'openWorldMap' }]), unique: true }] },
    }),
  ],
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 1 — l'embuscade de pirates, ancrée à MI-ROUTE (route.ambush.at = 0.5).
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
scenes.push(scene({
  id: 'barge-du-sel-embuscade',
  label: 'Voile noire à mi-route — une cogue pirate attaque',
  desc: "Une cogue pirate coupe la route de la Louve grise en pleine mer.",
  weather: 'brouillard',
  base: 'eau',
  legend: { '=': 'planches' },
  // COUCHE MER (10 m/case, MDG ch.13 : 1 point de Distance = 10 m → 1 case). Duel de coques NAVIRE-UNITÉ, témoin
  // du modèle : l'IA de coque (`runShipAI`) manœuvre la cogue pirate pour aligner sa bordée puis fait feu ; le
  // joueur joue le tour de la Louve grise. Coques ouvertes à ~150 m (15 cases) → l'approche se JOUE. Cf. loup-et-saumure.
  metresPerTile: 10,
  rows: seaRows(24, 14, []),
  entities: [
    hero(3, 7),
    hull('louve-grise', 'loup-imperial', 3, 7, 'E', 'La Louve grise', ['louve-helm', 'louve-gun'],
      [armedPoste('canon-moyen', 'tribord', [{ ref: 'boulet-et-poudre', qty: 12 }, { ref: 'mitraille-et-poudre', qty: 4 }]),
       armedPoste('canon-moyen', 'babord', [{ ref: 'boulet-et-poudre', qty: 12 }, { ref: 'mitraille-et-poudre', qty: 4 }]),
       armedPoste('pierrier', 'proue', [{ ref: 'balles-et-poudre-pierrier', qty: 16 }])]),
    marine('louve-helm', 3, 6, 'Timonier de la Louve grise', HELM_SKILLS, 'marin'),
    marine('louve-gun', 3, 8, 'Canonnier de la Louve grise', GUN_SKILLS, 'artilleur-de-navire'),
    // Trait naval du catalogue (`naval-traits.json`, kind:'trait') posé en amélioration d'INSTANCE sur la
    // coque pirate — « Renforcé » (MDG p.97, +10 Endurance/niveau), thématiquement une coque de pirates
    // renforcée pour l'abordage. Passagers : les pirates + le chef, + un barreur/canonnier compétents.
    hull('cogue-pirate', 'cogue', 18, 7, 'O', 'La cogue pirate', ['pirate-1', 'pirate-2', 'chef-pirate-1', 'cogue-helm', 'cogue-gun'],
      [armedPoste('canon-moyen', 'tribord', [{ ref: 'boulet-et-poudre', qty: 12 }]),
       armedPoste('canon-moyen', 'babord', [{ ref: 'boulet-et-poudre', qty: 12 }]),
       armedPoste('canon-moyen', 'proue', [{ ref: 'boulet-et-poudre', qty: 8 }])],
      [{ id: 'renforce', value: 1 }]),
    { id: 'pirate-1', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 18, y: 6 }, label: 'Pirate' },
    { id: 'pirate-2', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 18, y: 8 }, label: 'Pirate' },
    { id: 'chef-pirate-1', kind: 'personnage', ref: 'chef-pirate', pos: { x: 19, y: 7 }, label: 'Le chef des pirates' },
    marine('cogue-helm', 18, 5, 'Barreur de la cogue', HELM_SKILLS, 'marin'),
    marine('cogue-gun', 18, 9, 'Canonnier de la cogue', GUN_SKILLS, 'artilleur-de-navire'),
  ],
  encounters: [
    {
      id: 'enc-embuscade-sel',
      // Surprise navale = avantage de POSITION (couche Mer : pas d'État Surpris sur une coque) : Perception
      // ratée → la cogue surgit plus près, bordée alignée ; repérée → ~150 m sans avantage (`applyNavalSurprisePosition`).
      surprise: 'party',
      // Reddition à 40 % de Blessures (VictoryCondition.woundsThreshold, doc §8) : la cogue pirate amène
      // son pavillon avant le naufrage complet.
      victoryCondition: { type: 'woundsThreshold', targetId: 'cogue-pirate', belowPercent: 40 },
      members: [
        { entityId: 'louve-grise', side: 'ally' },
        { entityId: 'cogue-pirate', side: 'enemy' },
        { entityId: 'pirate-1', side: 'enemy' },
        { entityId: 'pirate-2', side: 'enemy' },
        { entityId: 'chef-pirate-1', side: 'enemy' },
        { entityId: 'cogue-helm', side: 'enemy' },
        { entityId: 'cogue-gun', side: 'enemy' },
      ],
      onVictory: flowOf([
        { type: 'setFlag', flag: 'sel-embuscade-vaincue' },
        { type: 'giveXp', amount: 100 },
        { type: 'giveMoney', montant: { gold: 10 } },
        OBJ("Rallier l'îlot avec le sel — la cogue pirate écartée."),
        { type: 'journal', desc: "La cogue pirate amène son pavillon à mi-coque et rompt le combat." },
        // Pas de transition en dur : l'embuscade n'est qu'une INTERRUPTION de la traversée (patron
        // loup-et-saumure) — le voyage REPREND vers l'îlot une fois le combat gagné.
      ]),
    },
  ],
  entryPoints: { arrivee: { x: 3, y: 7 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 2 — l'îlot d'arrivée.
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
scenes.push(scene({
  id: 'barge-du-sel-ilot',
  label: 'L’îlot du sel',
  desc: "Un petit îlot rocheux où la cargaison de sel doit être débarquée.",
  base: 'sable',
  legend: { '~': 'eau', '=': 'planches' },
  rows: [
    '............',
    '............',
    '............',
    '............',
    '============',
    '~~~~~~~~~~~~',
  ],
  triggers: [
    {
      id: 'barge-du-sel-arrivee', rect: { x: 0, y: 0, w: 12, h: 6 }, once: true,
      flow: flowOf([
        { type: 'clearObjective' },
        { type: 'journal', desc: "La Louve grise accoste à l'îlot, la cale toujours pleine de sel." },
        { type: 'setFlag', flag: FLAG_ACCOSTE },
      ]),
    },
  ],
  entities: [hero(2, 2)],
}));

// ── Carte du monde ──────────────────────────────────────────────────────────────────────────
const worldMap = {
  id: 'carte-barge-du-sel',
  label: 'La Barge du Sel',
  places: [
    { id: 'quai-du-sel', label: 'Le quai de départ', pos: { x: 20, y: 60 }, scene: 'barge-du-sel-quai', icon: 'scenario/port' },
    // GATING NARRATIF, les DEUX axes : tant que le cap n'est pas donné, l'îlot n'existe pas sur la
    // carte (nœud) et sa route n'est pas praticable (arête, avec sa raison JOUEUR).
    { id: 'ilot-du-sel', label: 'L’îlot du sel', pos: { x: 60, y: 40 }, scene: 'barge-du-sel-ilot', icon: 'scenario/port', when: flagWhen(FLAG_CAP) },
  ],
  routes: [
    {
      id: 'route-quai-ilot', a: 'quai-du-sel', b: 'ilot-du-sel', km: 30, modes: ['mer'], sea: true, seaHeading: 'nord',
      ambush: { scene: 'barge-du-sel-embuscade', encounter: 'enc-embuscade-sel', at: 0.5 },
      when: flagWhen(FLAG_CAP),
      refus: "Aucun cap n'est donné : la Louve grise ne sait pas encore où porter le sel.",
    },
  ],
};

// ── Garde-fous d'authoring (patron `scripts/arene/generate.mjs` / `scripts/loup-et-saumure/generate.mjs`) ──
const ids = new Set();
for (const s of scenes) {
  if (ids.has(s.id)) throw new Error(`id de scène dupliqué : ${s.id}`);
  ids.add(s.id);
  const starts = s.entities.filter((e) => e.kind === 'heroStart');
  if (starts.length !== 1) throw new Error(`${s.id} : ${starts.length} heroStart (1 attendu)`);
}
for (const p of worldMap.places) if (!ids.has(p.scene)) throw new Error(`carte : lieu ${p.id} → scène inconnue ${p.scene}`);

// ── Cadre de chapitre (#717) — ouverture cérémonielle et clôture ──────────────────────────
const narratif = {
  ...emptyNarratif(),
  ouverture: {
    titre: 'La Barge du Sel',
    sousTitre: 'Une traversée courte, une mer mal fréquentée',
    // Prose MAISON, comme le scénario qui la porte (`identite.maison`) : aucun livre ne la publie.
    pitch:
      "Trente kilomètres de mer grise séparent le quai de l'îlot du sel. Une traversée d'une journée, que les caboteurs faisaient sans y penser.\n\nDepuis trois lunes, des voiles noires y prélèvent leur part, et plus personne ne trouve d'équipage pour la faire. La Louve grise appareille quand même — la cale pleine, le canon servi.",
    ambiance: 'veillee',
  },
  cloture: {
    when: flagWhen(FLAG_ACCOSTE),
    titre: 'La Barge du Sel — la traversée est faite',
    sousTitre: 'Ce que la Louve grise ramène de la traversée',
  },
};

return projectDoc({
  identite: { id: 'barge-du-sel', label: 'La Barge du Sel', icon: 'scenario/naval', versionContenu: 1, maison: "scénario naval authoré pour le jeu — aucun livre ne le publie (mesuré : absent de `Source/`) ; il compose des règles de la Mer des Griffes, qui portent leur source à leur foyer" },
  scenes,
  worldMap,
  narratif,
});
}

/** Chemin de l'artefact écrit par le CLI — lu aussi par la garde byte-stable. */
export const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../src/scenes/barge-du-sel/barge-du-sel-projet.json');

if (import.meta.main) {
  const doc = build();
  writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
  console.log(`barge-du-sel-projet.json : ${doc.scenes.length} scènes, ${doc.worldMap.places.length} lieux, ${doc.worldMap.routes.length} routes.`);
}
