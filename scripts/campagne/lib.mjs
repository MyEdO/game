/**
 * Outillage d'AUTHORING de CAMPAGNE — helpers purs pour composer un projet (`ProjectDoc`, construit par
 * `documentDeProjet`, `src/state/worldMap.ts`, via `projectDoc()` ci-dessous)
 * partagé par TOUTES les campagnes (Arène, « Le Loup et la Saumure », …). Le JSON commité
 * (`src/scenes/<campagne>/<campagne>-projet.json`) reste la SOURCE CANONIQUE, 100 % éditable dans
 * l'éditeur : ce script n'est qu'un outil d'auteur (itération de layout), PAS un build — ne pas le
 * brancher dans package.json.
 *
 * Lancé via tsx : `scene()` construit un `MapSpec` (format déclaratif) puis appelle `buildScene`
 * (`src/state/mapSpec.ts`) — MÊME compilateur headless-editor que les scénarios `src/scenes/…`. L'ASCII,
 * l'architecture, les murs, les couches et les rencontres passent par ce contrat. L'auteur écrit des IDS ; ce fichier ne fait
 * que les VALIDER exactement (fail-fast, doctrine « labels interdits »).
 */
import { buildScene } from '../../src/state/mapSpec.ts';
import { documentDeProjet } from '../../src/state/worldMap.ts';
import { emptyNarratif } from '../../src/state/campaignNarratif.ts';
import { findCreatureById, byId, findSpellById, findTraitById, findTrappingById, findVehicleById, species as SPECIES_CATALOG } from '../../src/data/index.ts';
import { creatureSpeciesOptions } from '../../src/gameIso/rig/creatures/index.ts';
import { wardrobeKeyResolves } from '../../src/gameIso/rig/parts/career.ts';

// ── VALIDATION id-only, à l'AUTHORING ───────────────────────────────────────────────────────
// L'auteur écrit des IDS STABLES (`snotling`, `resistance`, `arc`, `mendiant`) — le libellé est de
// l'AFFICHAGE (multilangue), jamais une clé (CLAUDE.md, encadré id STABLE). Chaque résolveur VALIDE :
// un id valide passe tel quel, TOUT le reste → throw en pointant où trouver les ids (Compendium/
// catalogue). Les pickers de l'éditeur/Compendium aident à trouver l'id à la saisie.

/** `ref` d'entité : id STABLE de bestiaire OU de coque (`vehicles.json`, findVehicleById). Une coque est
 *  un ref d'entité LÉGITIME (naval, MDG ch.13) posé en `enemies[]` terse comme en `entities`. Valide →
 *  passe ; inconnu → throw (chercher au Compendium). */
function creatureId(ref) {
  if (findCreatureById(ref) || findVehicleById(ref)) return ref;
  throw new Error(`campagne : réf introuvable « ${ref} » — ni créature ni véhicule du catalogue (Compendium → Bestiaire / Véhicules).`);
}
/** Compétence : skillId STABLE. Valide → passe ; inconnu → throw. */
function skillId(id) {
  if (byId('skill', id)) return id;
  throw new Error(`campagne : compétence introuvable « ${id} » — attendu un id de skills.json (Compendium → Compétences).`);
}
/** Sort : id STABLE. Valide → passe ; inconnu → throw. */
function spellId(id) {
  if (findSpellById(id)) return id;
  throw new Error(`campagne : sort introuvable « ${id} » — attendu un id de spells.json (Compendium → Sorts).`);
}
// Vocabulaire d'`appearance.species` : ids STABLES de species.json (espèces jouables) ∪ ids de def rig
// (DEF_BY_ID, monstres/races non-jouables). Un LIBELLÉ n'est PAS un id — cf. `CLAUDE.md` § Pour TOUT agent.
const SPECIES_IDS = new Set(SPECIES_CATALOG.map((s) => s.id));
const RIG_DEF_IDS = new Set(creatureSpeciesOptions().map((o) => o.id));
/** `appearance.species` : id STABLE (species.json OU def rig). Valide → passe ; tout le reste → throw. */
function speciesId(id) {
  if (SPECIES_IDS.has(id) || RIG_DEF_IDS.has(id)) return id;
  throw new Error(
    `campagne : appearance.species introuvable « ${id} » — attendu un id de species.json ` +
      `(${[...SPECIES_IDS].join(', ')}) ou un id de def rig (ex. ${[...RIG_DEF_IDS].slice(0, 8).join(', ')}…).`,
  );
}
/** `appearance.tenue` : id STABLE de garde-robe (tenue ∪ carrière ∪ classe ∪ 'nu'). Valide → passe ;
 *  tout le reste → throw (chercher au Compendium → Carrières / au registre des tenues). */
function tenueId(id) {
  if (wardrobeKeyResolves(id)) return id;
  throw new Error(`campagne : appearance.tenue introuvable « ${id} » — attendu un id de tenue/carrière/classe (Compendium → Carrières).`);
}
/** `weapon` d'entité de scène : `trappingId` STABLE du catalogue d'armes. Valide → passe ; tout le reste
 *  → throw (chercher au Compendium → Objets). */
function weaponId(id) {
  if (findTrappingById(id)) return id;
  throw new Error(`campagne : weapon introuvable « ${id} » — attendu un trappingId du catalogue d'armes (Compendium → Objets).`);
}

function traitInstance(entry, field) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.id !== 'string') {
    throw new Error(`campagne : ${field} — attendu un TraitInstance à id structuré, jamais un libellé.`);
  }
  if (!findTraitById(entry.id)) {
    throw new Error(`campagne : ${field} — trait introuvable « ${entry.id} » (attendu un id de traits.json).`);
  }
  return { ...entry };
}

function optionalEntry(entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.note === 'string') {
    if (entry.note === 'swap') {
      for (const id of entry.remove ?? []) {
        if (!findTraitById(id)) throw new Error(`campagne : optionals.remove — trait introuvable « ${id} » (attendu un id de traits.json).`);
      }
    }
    return { ...entry };
  }
  return traitInstance(entry, 'optionals');
}

/** `presetId` d'entité/ennemi (#671) : id STABLE d'un preset de PNJ nommé du bloc `narratif.presetsPnj`.
 *  Ce module n'a PAS le narratif ; si l'ensemble des ids connus est fourni (`knownPresetIds`), on valide
 *  fail-fast ; sinon on accepte l'id comme chaîne (la garde de PARSE runtime `validateSceneNarratifRefs`
 *  tranche, coexistence scenes+narratif). Passe → id ; inconnu (si ensemble fourni) → throw. */
function presetRef(id, knownPresetIds) {
  if (!knownPresetIds || knownPresetIds.has(id)) return id;
  throw new Error(`campagne : presetId introuvable « ${id} » — attendu un id de narratif.presetsPnj (${[...knownPresetIds].join(', ') || 'aucun preset déclaré'}).`);
}

/** Un ennemi authored terse : VALIDE `ref`/`spells`/`weapon`/`appearance`/`presetId` (ids stables, throw
 *  sinon), ainsi que les ids structurés de `optionals`/`statblock.traits`. PUR (copie ; ne mute pas les statblocs
 *  partagés). `knownPresetIds` optionnel : fourni → `presetId` validé fail-fast, sinon accepté (parse runtime). */
function validateEnemy(e, knownPresetIds) {
  const out = { ...e };
  if (out.ref) out.ref = creatureId(out.ref);
  if (out.presetId) out.presetId = presetRef(out.presetId, knownPresetIds);
  if (out.weapon) out.weapon = weaponId(out.weapon);
  if (out.optionals) out.optionals = out.optionals.map(optionalEntry);
  if (out.spells) out.spells = out.spells.map(spellId);
  if (out.appearance?.species != null || out.appearance?.tenue != null) out.appearance = validateAppearance(out.appearance);
  if (out.statblock?.traits) out.statblock = { ...out.statblock, traits: out.statblock.traits.map((entry) => traitInstance(entry, 'statblock.traits')) };
  return out;
}

/** VALIDE `appearance.species`/`appearance.tenue` (ids stables) — copie, throw si un libellé s'y glisse. */
function validateAppearance(app) {
  const out = { ...app };
  if (out.species != null) out.species = speciesId(out.species);
  if (out.tenue != null) out.tenue = tenueId(out.tenue);
  return out;
}

/** Valide EN PLACE les ids nichés dans les flows d'une scène : `FlowTest.skill`
 *  (et l'`attackerSkill` d'un test opposé), `corruptionExposure.skill`, `learnSpell.spell`. Ne touche
 *  QUE les valeurs STRING (une réf déjà emboîtée `skill: {id}` reste intacte). Balayage récursif unique. */
function validateFlowRefs(node) {
  if (Array.isArray(node)) { node.forEach(validateFlowRefs); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.skill === 'string') node.skill = skillId(node.skill);
  if (typeof node.attackerSkill === 'string') node.attackerSkill = skillId(node.attackerSkill);
  if (node.type === 'learnSpell' && typeof node.spell === 'string') node.spell = spellId(node.spell);
  for (const v of Object.values(node)) validateFlowRefs(v);
}

/** Fabrique de scène : construit un `MapSpec` déclaratif puis délègue à `buildScene`. Les
 *  réfs par ids stables des rencontres et des flows sont validées SUR LE SPEC avant compilation.
 *  `hidden` (défaut false = VISIBLE, RAW : le groupe voit
 *  ses adversaires) pose `combat.hiddenUntilCombat` sur les entités enrôlées. */
export function scene({ id, label, desc, ambiance = 'exterieur', weather, music, startMessage, rows, base, legend, metresPerTile, rest, entities = [], architecture = [], walls = [], terrainRects = [], effectZones = [], dialogues = [], triggers = [], encounters = [], entryPoints, flags = {} }) {
  const spec = {
    id,
    label,
    ambiance,
    size: [rows[0].length, rows.length],
    terrain: base,
    levels: { z0: rows.join('\n') },
    entities, // BRUTS : ids CONSERVÉS (dont `id:'start'` du héros — pas de passage par heroStart).
    architecture,
    walls,
    terrainRects,
    effectZones,
    dialogues,
    triggers,
    // Rencontres terse (`enemies[]`) validées avant expansion par `buildEncounter`.
    encounters: encounters.map((enc) => ({
      ...enc,
      ...(enc.enemies ? { enemies: enc.enemies.map(validateEnemy) } : {}),
    })),
    flags,
  };
  if (desc) spec.desc = desc; // `desc` est `min(1).optional()` (defs-scenes/scene.ts) : vide ⇒ clé ABSENTE
  if (legend) spec.legend = legend;
  if (metresPerTile != null) spec.metresPerTile = metresPerTile; // échelle de la scène (MER = 4 m/case) — forwardée au MapSpec (sinon défaut 2 m/case)
  if (weather) spec.weather = weather;
  if (music) spec.music = music;
  if (rest !== undefined) spec.rest = rest; // offre de couchage de la scène (`Scene.rest`) — déclarée à l'AUTHORING, jamais par une table d'ids côté générateur
  if (startMessage) spec.startMessage = startMessage;
  // entryPoints d'auteur `{name:{x,y}}` → `{name:[x,y]}` (forme MapSpec).
  if (entryPoints) spec.entryPoints = Object.fromEntries(Object.entries(entryPoints).map(([k, p]) => [k, [p.x, p.y]]));
  // Compétences/sorts des flows (tests, corruption, learnSpell) → ids : dialogues, triggers, onVictory des
  // rencontres, ET les flows des actions authorées (`entities[].usable.actions[]` — décor piégé).
  validateFlowRefs({ dialogues, triggers, entities, encounters: spec.encounters });
  // Les uid de postes sont une séquence remise à zéro PAR SCÈNE (`resetIds`) : leur unicité n'est plus
  // portée par un compteur global. Sans ce fail-fast, un doublon serait SILENCIEUX (tout lecteur résout
  // un poste par `find` sur l'uid et prendrait le premier).
  const uids = new Set();
  for (const e of entities) {
    for (const p of e.postes ?? []) {
      if (uids.has(p.uid)) throw new Error(`campagne : scène « ${id} » — uid de poste dupliqué « ${p.uid} » (resetIds() appelé au MILIEU de la scène ?).`);
      uids.add(p.uid);
    }
  }
  return buildScene(spec);
}

/** Le document de projet d'un générateur : DÉLÈGUE au constructeur `documentDeProjet`
 *  (`src/state/worldMap.ts`), qui décide la forme et l'ordre des clés. Le `type` est POSÉ ICI : un
 *  document s'annonce, et son schéma l'exige — aucun générateur ne le retape. L'IDENTITÉ et la
 *  PROVENANCE (`source` ∨ `maison`) restent à l'appelant : elles nomment SA campagne et ne se devinent
 *  pas. `narratif` par défaut = bloc vide (`emptyNarratif()`, mêmes clés que `NarratifBlock`). */
export function projectDoc({ identite, scenes, worldMap, narratif = emptyNarratif() }) {
  return documentDeProjet({ ...identite, type: 'projet' }, scenes, { worldMap, narratif });
}

let propSeq = 0;
/** Décor. `extra` : interact / anim / label… L'empreinte vient du catalogue (`PropData.foot`), jamais de
 *  l'instance. L'id est auto (réinitialisé par scène via resetIds). */
export function P(x, y, ref, extra = {}) {
  return { id: `p${propSeq++}`, kind: 'prop', pos: { x, y }, ref, ...extra };
}
/** Remet à zéro TOUTES les séquences d'ids de scène (props ET postes) — à appeler au début de CHAQUE scène. */
export function resetIds() {
  propSeq = 0;
  posteSeq = 0;
}

/** Personnage (PNJ) : apparence/dialogue/marchand via opts. `weapon`/`appearance.species`/`appearance.tenue`
 *  sont VALIDÉS (ids stables, fail-fast). `species` absent n'est PAS un défaut : sans réf de créature, le
 *  rendu retombe sur la race par défaut de `speciesRace.json` EN DIAGNOSTIQUANT la donnée manquante
 *  (`resolveRender`, `src/gameIso/rig/bodyPlan.ts`) — l'espèce se pose au site d'authoring.
 *  FICHE (#1882) : sans `ref`/`statblock`/`presetId`, la `ref` est le profil standard de son espèce
 *  (`LDB 77 l.7`, `species.json › profilStandard`), posée en QUEUE ; une espèce sans profil → throw. */
export function NPC(id, x, y, label, opts = {}, knownPresetIds) {
  const e = { id, kind: 'personnage', pos: { x, y }, label, ...opts };
  if (e.weapon != null) e.weapon = weaponId(e.weapon);
  if (e.presetId != null) e.presetId = presetRef(e.presetId, knownPresetIds); // #671 : PNJ nommé instancié base+surcharges
  if (e.appearance != null) e.appearance = validateAppearance(e.appearance);
  if (e.ref == null && e.statblock == null && e.presetId == null) e.ref = profilStandardDe(id, e.appearance?.species);
  return e;
}

/** Profil standard (`LDB 77 l.7`) de l'espèce d'un PNJ sans fiche — throw si l'espèce n'en porte pas. */
function profilStandardDe(id, speciesId) {
  const profil = SPECIES_CATALOG.find((s) => s.id === speciesId)?.profilStandard?.id;
  if (profil) return profil;
  throw new Error(`campagne : PNJ « ${id} » sans fiche — ni ref, ni statblock, ni presetId, et l'espèce « ${speciesId} » ne porte aucun profil standard (species.json › profilStandard, LDB 77 l.7).`);
}

export function hero(x, y) {
  return { id: 'start', kind: 'heroStart', pos: { x, y } };
}

let posteSeq = 0;
/** Poste d'artillerie MONTÉ (#222) : émet la forme AUTHORÉE de référence `{ trappingId, uid, side, crewIds }`
 *  — la base (Dégâts/Qualités/Enc/Portée) N'est PAS matérialisée, elle est HYDRATÉE au spawn depuis
 *  `trappingId` (`hydratePoste`, `src/engine/items.ts`). VALIDE `trappingId` : doit être une pièce POSABLE
 *  (trapping à art d'affût `siegeRig`, cf. `siegeEngines`/`findVehicleById` du naval) — sinon throw. `crewIds`
 *  vide par défaut : aucun id de héros n'est connu à l'authoring, le poste est servable en jeu (`serveAtPoste`). */
export function poste(trappingId, side, crewIds = []) {
  const t = findTrappingById(trappingId);
  if (!t?.siegeRig) throw new Error(`campagne : poste « ${trappingId} » — attendu un trappingId de pièce POSABLE (art d'affût siegeRig ; Compendium → Objets, armes de siège).`);
  return { trappingId, uid: `poste-${++posteSeq}`, side, crewIds };
}

/** Flow PLAT (séquence de `do`) à partir d'une liste d'Effets — forme attendue par `Trigger.flow`. */
export function flowOf(effects) {
  return { kind: 'seq', steps: effects.map((effect) => ({ kind: 'do', effect })) };
}
/** Condition d'entrée de flag (`Trigger.when`) à partir d'une expr « flag,!flag ». */
export function flagWhen(expr) {
  return { kind: 'flag', expr };
}
/** Nœud Flow `test` (jet de compétence → RÉUSSITE/ÉCHEC) ; `success`/`fail` = listes d'Effets (→ flowOf). */
export function testNode(test, success = [], fail = []) {
  return { kind: 'test', test, success: flowOf(success), fail: flowOf(fail) };
}

/** Trigger de combat standard (une fois) : entrer dans le rect lance la rencontre. */
export function fightTrigger(encounter, rect, extra = {}) {
  return { id: `fight-${encounter}`, rect, once: true, flow: flowOf([{ type: 'startCombat', encounter }]), ...extra };
}

/** onVictory standard d'une zone de l'échelle : bourse + PX + flag de porte + retour au Bourg.
 *  ÉCONOMIE : la vie coûte des PISTOLES (repas 1 pa, nuit 10 sb/tête, ration 2 pa) et la plate
 *  complète ~31 CO ; les bourses montent donc de quelques pa (échauffement) à ~10 co (dragon) —
 *  l'équipement lourd se GAGNE sur toute l'échelle, pas au premier combat. XP : ~100 → 450 par
 *  zone (progression de carrière sentie à CHAQUE victoire, pas tous les 3 combats). */
export function zoneVictory(n, { money, xp, journal, extra = [] }) {
  return flowOf([
    { type: 'giveMoney', montant: { ...money } },
    { type: 'giveXp', amount: xp },
    { type: 'setFlag', flag: `zone${n}_clear` },
    { type: 'journal', desc: journal },
    ...extra,
    { type: 'transition', scene: 'arene-hub', entry: 'porte-arene' },
  ]);
}

/** Fouille authorée (décor) — l'action `fouiller` de l'enveloppe `usable` (#1687). Accepte une LISTE
 *  d'Effets (butin ramassable, → flowOf) OU un Flow déjà construit (fouille à risque :
 *  `testNode(...)`). `consume` retire le décor une fois pris ; sinon le geste ne se joue qu'UNE fois
 *  (`unique`, drapeau `__action_<ent>_fouiller`). */
export function fouille(effectsOrFlow, consume = false) {
  const flow = Array.isArray(effectsOrFlow) ? flowOf(effectsOrFlow) : effectsOrFlow;
  return { usable: { actions: [{ id: 'fouiller', flow, ...(consume ? { consume: true } : { unique: true }) }] } };
}

/** Statblocks d'AUTEUR (sourcés à leur création). Sans réf de bestiaire, une entité `personnage` n'a
 *  d'apparence à résoudre que par son Espèce — `entityRigProfileFor`
 *  (`src/gameIso/rig/enemyProfile.ts:270-274`) n'en dérive AUCUNE sans l'une des deux : chaque statbloc
 *  d'auteur voyage donc avec l'apparence à poser sur l'entité qui le porte. La nuée porte une VRAIE
 *  espèce (`rat-geant`), pas un id de forme : `swarmFormOf` (`src/gameIso/rig/swarm/forms.ts:51-64`)
 *  la route par le `plan` de sa def de créature (quadruped → forme « rats »). */
export const NUEE_DE_RATS = {
  type: 'statblock',
  label: 'Nuée de rats',
  char: { M: 4, 'capacite-de-combat': 30, force: 25, endurance: 30, agilite: 40, B: 5 },
  traits: [{ id: 'nuee' }, { id: 'taille', arg: 'petite' }],
};
export const NUEE_DE_RATS_APPEARANCE = { species: 'rat-geant' };
export const DRAGON_DES_TENEBRES = {
  type: 'statblock',
  label: 'Dragon des ténèbres',
  char: {
    M: 6,
    'capacite-de-combat': 55,
    'capacite-de-tir': 45,
    force: 55,
    endurance: 55,
    initiative: 50,
    agilite: 35,
    dexterite: 30,
    intelligence: 40,
    'force-mentale': 60,
    sociabilite: 40,
    B: 104,
  },
  traits: [
    { id: 'taille', arg: 'monstrueuse' },
    { id: 'souffle', value: 15, arg: 'Ténèbres' },
    { id: 'terreur', value: 2 },
    { id: 'armure', value: 5 },
    { id: 'arme', value: 10 },
    { id: 'morsure', value: 10 },
    { id: 'vol' },
  ],
  size: 'monstrueuse',
};
export const DRAGON_DES_TENEBRES_APPEARANCE = { species: 'dragon' };
