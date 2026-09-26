/**
 * Construction de Combattants depuis le bestiaire (réf.) ou un statblock
 * personnalisé d'une scène. Sert au combat tactique.
 */
import { Combatant, Characteristics, CHAR_KEYS, BodyShape, SkillInstance, TalentInstance, type AuthoredShipPoste, type NavalTraitRef } from '../engine/types';
import { skillCharacteristicById } from '../engine/character';
import { isOptionalNote, type TraitInstance, type TraitList, type OptionalEntry, type OptionalSwap } from '../engine/statEntry';
import { findCreatureById, byId, findTalentById, findSpellById, findVehicleById, findTrappingById, refEntiteResolue, specPoolOf, CreatureData, type SkillData, type SkillRef, type TalentRef } from '../data';
import { vehicleCombatant } from '../engine/vehicle';
import { inanimateCombatant } from '../engine/inanimate';
import { hullArmourBonus, hullNavalTraits } from '../engine/navalTraits';
import { requiredTerrains } from '../engine/ops';
import { CustomStatblock, type Scene, type SceneEntity, heightAt, tileAt } from './scene';
import { footprintTiles, propFootTiles, sizeFootprint } from './footprint';
import type { Pt } from './path';
import { terrainAbsent } from './terrain';
import { randomizeChars, type PorteurDeFiche } from '../engine/statblock';
import type { EntityAppearance } from '../engine/authoringAppearance';
import { emptyArmour, buildWeapon, hydratePoste, loadWeapon } from '../engine/items';
import { maxWounds, bonus } from '../engine/characteristics';
import { parseSizeLabel, resizeBySteps, SIZE_ORDER, SizeCategory } from '../engine/size';
import { parsePsychTraits } from '../engine/psychology';
import { traitCharMods, traitBonusWoundsBE, isMindless, mutationsAtSpawn, markMutationsAtSpawn, isSwarm, findResolvedTrait } from '../engine/traits/dispatch';
import { rollMutation, mutationById } from '../data/mutations';
import { makeRNG } from '../engine/dice';
import { groupsFor } from '../engine/groups';
import { weaponsFromTraits, armourFromTraits, renderWeaponsFromTraits, weaponFromId } from '../engine/creatureEquip';
import { hashSeed } from '../engine/dice';
import { bodyShapeForSpecies } from '../engine/bodyForm';

/**
 * Pose la position d'un combattant en RAFRAÎCHISSANT sa hauteur métrique (`pos.h`) depuis le relief de
 * la scène — SOURCE UNIQUE de la cohérence position↔hauteur. À appeler au SPAWN et à CHAQUE déplacement
 * (combat, poussée/traction, course, téléport, chute, avance navale) : sans ce rafraîchissement, la
 * distance de combat verticale et le −10 « en contrebas » resteraient faux après le mouvement.
 * `z` omis quand nul et `h` omis quand la surface est à 0 m → byte-identique au plan sur une scène plate.
 */
export function placeCombatant(c: { pos?: { x: number; y: number; z?: number; h?: number }; traits?: Combatant['traits']; offTerrain?: boolean }, scene: Scene | null | undefined, p: { x: number; y: number; z?: number }): void {
  const z = p.z ?? 0;
  const h = scene ? heightAt(scene, p.x, p.y, z) : 0;
  c.pos = { x: p.x, y: p.y, ...(z ? { z } : {}), ...(h ? { h } : {}) };
  // Drapeau POSITIONNEL « hors de son terrain » (op passive `offTerrainMod` — Créature marine MDG 16 l.17 /
  // Aquatique MSRC 15 l.139) : re-dérivé à CHAQUE placement (chokepoint UNIQUE du positionnement). Un porteur
  // dont la case n'est pas de son terrain d'élection (`eau`) subit mSet/testDR ; sans passif, no-op.
  const req = c.traits ? requiredTerrains(c as Combatant) : [];
  if (req.length) c.offTerrain = !req.includes(tileAt2(scene ?? null, p.x, p.y, z));
  else if (c.offTerrain) delete c.offTerrain;
}

/** Terrain de la case, tolérant une scène absente : PAS de scène = pas de tuile, donc le terrain que le
 *  dataset déclare comme l'ABSENCE (`terrainAbsent`, `state/terrain`) — aucun porteur ne l'élit, le
 *  drapeau `offTerrain` tombe donc à VRAI, comme avec le repli d'id récité qui vivait ici (#1789). */
function tileAt2(scene: Scene | null, x: number, y: number, z: number): string {
  return scene ? tileAt(scene, x, y, z) : terrainAbsent();
}

/** Forme du corps d'un Combattant (Tableau de Localisation, LDB 76 l.15-29) : dérivée de l'ESPÈCE du record
 *  (donnée neutre `bodyShapeForSpecies`), plus du registre de rendu du rig (#187). Une Nuée retombe sur
 *  la table par défaut. Une créature sans espèce, un statbloc (nom hors bestiaire) → humanoïde. */
export function bodyShapeOf(id: string): BodyShape {
  const rec = findCreatureById(id);
  if (rec && isSwarm(rec.traits)) return 'humanoide';
  return bodyShapeForSpecies(rec?.appearance?.species);
}

function charsFrom(src: Partial<Record<string, number | null>>, fallback = 30): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const v = src[k];
    chars[k] = typeof v === 'number' ? v : fallback;
  }
  return chars;
}

// Dérivation traits → armes/armure : SOURCE UNIQUE dans `engine/creatureEquip` (pure), partagée avec
// le RENDU d'exploration sans cycle de couches. Re-exportée pour les importeurs.
export { weaponFromTrait } from '../engine/creatureEquip';

/** Catégorie de Taille depuis le trait « Taille (X) » (LDB 85) — lue par le REGISTRE des Traits
 *  (`findResolvedTrait` → arg), jamais par une regex propre. Une plage (« Taille (de Petite à Énorme) ») est
 *  résolue à sa borne haute par `parseSizeLabel`. null si absent ou argument non reconnu. */
export function sizeFromTraits(traits: TraitList): SizeCategory | null {
  const arg = findResolvedTrait(traits, 'taille')?.arg;
  return arg ? parseSizeLabel(arg) : null;
}

/** Catégorie de Taille d'une entité de scène (créature posée) : champ explicite du statbloc, sinon
 *  dérivée des Traits (statbloc ou créature du bestiaire via `ref`). `undefined` ⇒ Moyenne au rendu. */
export function entitySize(ent: { ref?: string; statblock?: CustomStatblock }): SizeCategory | undefined {
  if (ent.statblock?.size) return ent.statblock.size;
  const traits = ent.statblock?.traits ?? (ent.ref ? findCreatureById(ent.ref)?.traits : undefined); // tous TraitInstance[]
  return (traits && sizeFromTraits(traits)) || undefined;
}

/** Les cases d'une entité de scène : l'empreinte dérivée au cap pour un DÉCOR (`propFootTiles`, la
 *  couture unique de la marchabilité et de la ligne de vue), le carré de sa Taille pour une créature. */
export function entiteFootTiles(ent: SceneEntity, mpt: number): Pt[] {
  if (ent.kind === 'prop') return propFootTiles(ent.ref, ent.pos, ent.facing, mpt);
  return footprintTiles(ent.pos, sizeFootprint(entitySize(ent)));
}

/** Nuée au spawn (LDB 85 l.253) : ×5 PB (« cinq fois plus de PB qu'une créature type ») + 10 CC sur
 *  les PB/carac. déjà calculés. Le B mono-créature du bestiaire reste, c'est lui qu'on multiplie. */
function applySwarmBuild(chars: Characteristics, wounds: number): { chars: Characteristics; wounds: number } {
  chars['capacite-de-combat'] += 10;
  return { chars, wounds: wounds * 5 };
}

/** Mutation / Corruption mentale (LDB 85 l.92/245) : tirage sur les Tableaux des Corruptions au
 *  spawn — graine STABLE dérivée de l'id (déterministe, rejouable). */
function spawnMutations(traits: TraitList | undefined, id: string) {
  const specs = mutationsAtSpawn(traits);
  const mark = markMutationsAtSpawn(traits);
  if (!specs.length && !mark) return {};
  const rng = makeRNG(hashSeed(`mut:${id}`));
  // Mutation EXPLICITE (id, ex. « cornes-asymetriques » : tell figé en donnée) sinon tirage.
  const mutations = specs.map((s) => (s.mutationId ? mutationById(s.mutationId) : null) ?? rollMutation(s.kind, rng));
  // Marque du Chaos (EDOC 13 l.522-524) : ⌈1d`countDie`/`countDivide`⌉ tirages, alternant `first` puis
  // l'autre nature, sur les tables `mentalTable`/`physTable` — MÊME rng seedé (ordre de tirage stable).
  if (mark) {
    const count = Math.ceil(rng.int(1, mark.countDie) / mark.countDivide);
    const other = mark.first === 'mentale' ? 'physique' : 'mentale';
    for (let i = 0; i < count; i++) {
      const kind = i % 2 === 0 ? mark.first : other;
      mutations.push(rollMutation(kind === 'mentale' ? mark.mentalTable : mark.physTable, rng));
    }
  }
  return { mutations };
}

/** Compétences d'un statbloc au FORMAT LIVRE (« Langue (Magick) 63 », « Focalisation 65 ») : la
 *  valeur imprimée est la valeur de TEST FINALE (présentation des statblocs de PNJ — ex. Eusapia
 *  Balacañon, MSR Compagnon p.48) → avances = valeur − Caractéristique de la Compétence (inverse
 *  de LDB 09 : Test = Caractéristique + avances). Les avances se calculent sur le profil IMPRIMÉ —
 *  un profil retouché ensuite (carac. aléatoires LDB 77 l.108, Taille) garde les mêmes avances.
 *  Entrée sans valeur chiffrée : ignorée (rien d'inventé). Réf STRUCTURÉE `SkillRef` (id stable +
 *  valeur imprimée), jamais un parsing de chaînes. */
/** Une `SkillInstance` (id + spec) depuis l'`id` STABLE (pour la Caractéristique) + valeur de Test
 *  IMPRIMÉE. Carac résolue par id (`skillCharacteristicById`, ≠ re-lookup par libellé — multilangue-safe). */
function skillInstance(skillId: string, spec: string | undefined, value: number, printedChars: Characteristics): SkillInstance {
  const ch = skillCharacteristicById(skillId);
  return { id: skillId, spec, characteristic: ch, advances: Math.max(0, value - printedChars[ch]) };
}

/**
 * DÉSIGNATION au spawn de la spécialisation qu'un statbloc laisse à choisir (`SkillRef.choix`) :
 * tirage SEEDÉ (déterministe et rejouable, même idiome que `spawnMutations` ci-dessus) parmi les ids
 * que la donnée BORNE (`choix: [ids]`), sinon parmi le POOL de la Compétence (`specPoolOf`).
 * L'instance qui en sort est CONCRÈTE : aucun emplacement non désigné ne survit au spawn.
 * `LDB 09 l.40`, `LDB 09 l.44` ; CLAUDE.md règle 7 (le RAW confie ce choix au MJ, il n'y a pas de MJ).
 * Pool VIDE = arrêt : il n'y a rien à désigner, et rien à inventer.
 */
function designateSpec(sk: SkillData, choix: true | string[], seed: string): string {
  const pool = Array.isArray(choix) && choix.length ? choix : specPoolOf(sk);
  if (!pool.length) throw new Error(`spawn : la Compétence « ${sk.id} » n'offre aucune spécialisation à désigner (réf à choix).`);
  return pool[makeRNG(hashSeed(seed)).int(0, pool.length - 1)];
}

/** Compétences du BESTIAIRE — refs structurées `SkillRef` (id + valeur de Test imprimée). Réf. inconnue
 *  du catalogue ignorée (rien d'inventé). `seed` = graine STABLE du porteur : elle rend la désignation
 *  d'un `choix` déterministe par uid (deux projections du même pion désignent la même spécialisation). */
export function skillsFromBook(list: SkillRef[] | undefined, printedChars: Characteristics, seed: string): SkillInstance[] {
  const out: SkillInstance[] = [];
  (list ?? []).forEach((ref, i) => {
    const sk = byId('skill', ref.id);
    if (!sk) return;
    const spec = ref.choix != null ? designateSpec(sk, ref.choix, `${seed}:${sk.id}:${i}`) : ref.spec;
    out.push(skillInstance(sk.id, spec, ref.value, printedChars));
  });
  return out;
}

/** Talents d'une créature/statbloc → `TalentInstance[]` (libellés concrets : « Magie des Arcanes (Ghur) »,
 *  « Menaçant »). Refs STRUCTURÉES `TalentRef` (id stable + niveau/spec). Le nom RECONSTRUIT garde sa spec
 *  entre parenthèses : c'est la clé du registre combatFeatures (`featureKey`) et du grimoire. */
export function talentsFromBook(list: TalentRef[] | undefined): TalentInstance[] {
  const out: TalentInstance[] = [];
  for (const ref of list ?? []) {
    const t = findTalentById(ref.id);
    if (t) out.push({ talentId: t.id, spec: ref.spec, times: ref.times ?? 1 });
  }
  return out;
}

/** Personnalisations d'AUTEUR au spawn d'une créature (portées par SceneEntity.combat). */
export interface SpawnExtras {
  /** OPTIONNELS choisis (LDB 76 l.45) : `TraitInstance` ordinaires (fusionnés avant dérivation) OU
   *  NOTES composées (joker « tous les traits », variante « swap » qui RETIRE des Traits + octroie un bonus). */
  optionals?: OptionalEntry[];
  /** Sorts connus (la donnée bestiaire n'en liste pas — choix d'auteur). */
  spells?: string[];
  /** Caractéristiques aléatoires (LDB 77 l.108). */
  randomChars?: boolean;
  /** Override DIRECT des caractéristiques (tirage FIGÉ d'une Possession — `Possession.charsRolled`,
   *  LDB 77 l.108 seedé sur l'`uid` d'instance, jamais relancé) — PRIME sur `randomChars`/`sb.randomChars`. */
  charsRolled?: Characteristics;
  /** Traits APPRIS unis aux traits de base (dresse-* octroyés par un Test de Dressage réussi, LDB 23
   *  l.130 → LDB 85 l.100-118 — ex. « Dressé (Monture) » d'une bête possédée). Ids seuls (`TraitInstance`
   *  sans value/arg) : chaque `dresse-*` est déjà une entrée de trait à part entière. */
  learnedTraits?: string[];
  /** Coque/navire : `id`s des Combattants d'ÉQUIPAGE exposés (MDG 14) — posés sur le `Combatant`. */
  crewIds?: string[];
  /** Coque/navire : pièces d'artillerie MONTÉES (postes AUTHORÉS, MDG 12-13) — HYDRATÉES (`hydratePoste`)
   *  et posées sur le Combattant-coque au spawn. Réf catalogue → base résolue, jamais une base copiée (#222). */
  postes?: AuthoredShipPoste[];
  /** Coque/navire : Améliorations d'INSTANCE (MDG 12, réfs par id) — posées sur le Combattant ;
   *  Blindage est appliqué ici même (PA de coque). */
  upgrades?: NavalTraitRef[];
  /** Compétences d'AUTEUR ajoutées (réfs `SkillRef` : id + valeur de Test imprimée) — FUSIONNÉES par-dessus
   *  celles du bestiaire au spawn. Qualifie p.ex. un servant de pièce pour le Groupe de Projectiles APPROPRIÉ
   *  à son engin (AA 10 l.230 : sans cette Compétence, il n'est « pas un membre de l'équipe », AA 10 l.253). */
  skills?: SkillRef[];
}

/** Profil + modificateurs de PROFIL des traits `live` (Élite/Coriace/Brutal…) — pour les valeurs DÉRIVÉES
 *  au spawn (Blessures) qui doivent refléter les traits, alors que `characteristics` ne stocke que la base. */
function withTraitChars(chars: Characteristics, live: TraitList | undefined): Characteristics {
  const out = { ...chars };
  for (const [k, v] of Object.entries(traitCharMods(live))) out[k as keyof Characteristics] += v ?? 0;
  return out;
}

export function creatureToCombatant(creature: CreatureData, id: string, pos: { x: number; y: number; z?: number }, extras?: SpawnExtras): Combatant {
  const optEntries = extras?.optionals ?? [];
  // Les optionnels choisis (LDB 76 l.45) se répartissent : Traits FACULTATIFS ordinaires (fusionnés)
  // vs NOTES composées « swap » (Grand Loup/Griffon ZI). Le joker « all-traits » (Mutant) est une
  // indication au picker (« n'importe quel Trait peut être ajouté ») → aucun effet mécanique au spawn.
  const optTraits = optEntries.filter((e): e is TraitInstance => !isOptionalNote(e));
  const swaps = optEntries.filter((e): e is OptionalSwap => isOptionalNote(e) && e.note === 'swap');
  // Variante « swap » (ZI) : RETIRE les Traits qu'elle nomme (Bestial/Dressé/Territorial) — en échange
  // d'un bonus (appliqué plus bas). Traits FACULTATIFS (LDB 76 l.45) fusionnés AVANT toutes les
  // dérivations (armes, armure, psy, nuée…), puis les Traits retirés par les variantes sont ôtés.
  const removedBySwap = new Set(swaps.flatMap((s) => s.remove));
  // Traits APPRIS (dresse-* d'une Possession, LDB 23 l.130 → LDB 85) : ids seuls, unis aux traits de base.
  const learnedTraits: TraitInstance[] = (extras?.learnedTraits ?? []).map((traitId) => ({ id: traitId }));
  const traits = [...creature.traits, ...optTraits, ...learnedTraits].filter((t) => !removedBySwap.has(t.id));
  // « – » du Schéma des Profils (LDB 76) = caractéristique INEXISTANTE → 0 (Int/FM nulles = Fabriqué,
  // auto-réussite via isMindless ; CT nulle = pas d'arme à distance dans la donnée). Pas de 30 inventé.
  let chars = charsFrom(creature.char, 0);
  // Bonus de caractéristique octroyé par une variante « swap » (Grand Loup +15 Soc, Griffon +20 Soc,
  // ZI) — appliqué sur la base (une carac. « – » = 0 devient la valeur du bonus).
  const swapGrants = swaps.flatMap((s) => s.grant);
  for (const g of swapGrants) if ('char' in g) chars[g.char] += g.value;
  // Compétences/talents de la donnée (PNJ nommés : Eusapia, Horreurs…) — avances dérivées du profil IMPRIMÉ.
  // + compétences d'AUTEUR ajoutées (extras.skills : qualifier un servant de pièce pour le Groupe de
  // Projectiles de son engin, AA 10 l.142-146).
  const bookSkills = [...skillsFromBook(creature.skills, chars, `spec:${id}`), ...skillsFromBook(extras?.skills, chars, `spec:auteur:${id}`)];
  // Compétences octroyées par une variante « swap » (ZI, Vouivre : Discrétion (Rurale) 65) — dérivées
  // PLUS BAS, sur le profil FINAL (après Taille facultative éventuelle) : la valeur de Test IMPRIMÉE par
  // la variante doit tenir compte du ∓5 Ag qu'elle-même inflige (LDB 85 l.276-277), sinon la variante se
  // désaccorderait de son propre changement de Taille.
  const swapSkillRefs = swapGrants.flatMap((g) => ('id' in g ? [{ id: g.id, spec: g.spec, value: g.value }] : []));
  const talents = talentsFromBook(creature.talents);
  // Tirage FIGÉ d'une Possession (`charsRolled`, LDB 77 l.108 — seedé sur l'uid, jamais relancé) PRIME
  // sur le tirage à la volée `randomChars` (deux projections successives avec le MÊME `charsRolled` →
  // mêmes stats, aucun RNG ré-exécuté).
  if (extras?.charsRolled) chars = { ...extras.charsRolled };
  else if (extras?.randomChars) chars = randomizeChars(chars, id); // LDB 77 l.108 : −10 + 2d10 sur le profil rond
  // Traits facultatifs à modificateurs de PROFIL (Élite, Coriace, Brutal, Rapide… — LDB 85) : le profil
  // imprimé est FINAL pour ses traits fixes (déjà cuits) ; un facultatif AJOUTÉ s'applique en DIRECT via
  // `liveTraits` (collecteur passif) → `characteristics` reste la base bestiaire, sans double-compte.
  const baseSize = sizeFromTraits(creature.traits) ?? 'moyenne';
  // Taille FACULTATIVE : trait « Taille (X) » choisi, OU catégorie posée par une variante « swap »
  // (bidirectionnel : Grand Loup Moyenne→Grande, Vouivre Énorme→Grande). PRIME sur celle du bestiaire
  // et applique « Utiliser les Tailles » (LDB 85 l.276-277 : ±10 F/E, ∓5 Ag par catégorie d'écart).
  const swapSize = swaps.map((s) => s.size).find((x): x is SizeCategory => !!x);
  const optSize = sizeFromTraits(optTraits) ?? swapSize ?? null;
  const size = optSize ?? baseSize;
  if (optSize && optSize !== baseSize) chars = resizeBySteps(chars, SIZE_ORDER[optSize] - SIZE_ORDER[baseSize]);
  // char.B (bestiaire) = la valeur livre d'UNE créature (≈ formule × Taille) → base/surcharge ; la
  // FORMULE (LDB 85) reprend la main si le profil a bougé (carac. aléatoires, Taille facultative).
  const profileChanged = !!extras?.randomChars || !!extras?.charsRolled || (optSize != null && optSize !== baseSize);
  // Blessures dérivées de F/E/FM : computées sur le profil INCLUANT les facultatifs (Coriace +E, Élite +FM…),
  // même si `characteristics` ne stocke que la base — sinon une créature renforcée perdrait ses PB de trait.
  const charsEff = withTraitChars(chars, optTraits);
  // Blessures IMPOSÉES par une variante « swap » (Vouivre : « réduire ses B à 42 ») — remplace la valeur
  // livre ET la formule par Taille, aucune des deux ne reprend la main.
  const swapWounds = swaps.map((s) => s.wounds).find((w): w is number => w != null);
  let wounds = swapWounds ?? (typeof creature.char.B === 'number' && !profileChanged ? creature.char.B : maxWounds(charsEff, size, traits));
  if (swapWounds == null && traitBonusWoundsBE(optTraits)) wounds += bonus(charsEff.endurance); // Endurant facultatif : +BE Blessures (LDB 85)
  const skills = [...bookSkills, ...skillsFromBook(swapSkillRefs, chars, `spec:swap:${id}`)]; // swap : dérivée sur le profil FINAL (post-Taille)
  const swarm = isSwarm(traits);
  if (swarm) ({ chars, wounds } = applySwarmBuild(chars, wounds)); // ×5 PB + 10 CC (la nuée = 5 créatures, LDB 85 l.253)
  const movement = typeof creature.char.M === 'number' ? creature.char.M : 4; // facultatifs → liveTraits (effectiveMovement)
  return {
    id,
    label: creature.label,
    creatureId: creature.id, // identité bestiaire STABLE → le rig la résout par id (plus par `name`)
    kind: 'enemy',
    ...(optTraits.length ? { liveTraits: optTraits } : {}), // charMods/Mouvement des facultatifs appliqués en direct
    ...(creature.appearance?.species ? { species: creature.appearance.species } : {}), // espèce du record (P2) → le rig la lit ; le reste de l'apparence par défaut est lu par enemyRigProfile via findCreatureById(creatureId)
    characteristics: chars,
    wounds: { current: wounds, max: wounds, base: wounds },
    advantage: 0,
    conditions: [],
    weapons: weaponsFromTraits(traits),
    armour: armourFromTraits(traits),
    size,
    bodyShape: bodyShapeOf(creature.id), // Tableau de Localisation par forme du corps (LDB 76 l.15-29)
    ...(creature.followsCharacterRules ? { followsCharacterRules: true } : {}), // #152 : bestiaire HUMAIN rétro-flagué (CreatureData) — même prédicat unique que statblockToCombatant (#143)
    ...parsePsychTraits(traits), // Peur/Terreur/Immunité + traits ciblés depuis les traits (LDB 21+85)
    ...(swarm ? { swarm: true, psychImmune: true } : {}), // Nuée : ignore la Psychologie (LDB 85 l.253)
    ...(isMindless(traits) ? { psychImmune: true } : {}), // Fabriqué : Tests d'Int/FM/Soc auto-réussis (LDB 85 l.142)
    ...spawnMutations(traits, id), // Mutation / Corruption mentale : tirage au spawn (LDB 85)
    // Sorts : ceux de la DONNÉE (PNJ nommés — Eusapia en a 12), surchargés par le choix d'auteur.
    // Combatant.spells = IDS de sort (runtime) : créature = ids des refs ; choix d'auteur = ids (filtrés valides).
    ...(extras?.spells?.length
      ? { spells: extras.spells.filter((id) => !!findSpellById(id)) }
      : creature.spells.length ? { spells: creature.spells.map((s) => s.id) } : {}),
    groups: groupsFor({ extras: creature.grantGroups, traits, talents }), // Groupes DÉCLARÉS par l'entrée (`grantGroups` : catégorie + dieu du Chaos) + Traits (`capabilities.grantGroups`) + culte (Talent de Prière, P3)
    traits, // conservés (facultatifs inclus) → attaques gratuites de créature en combat
    skills,
    talents,
    movement,
    pos,
  };
}

export function statblockToCombatant(sb: CustomStatblock, id: string, pos: { x: number; y: number; z?: number }, appearance?: EntityAppearance, extras?: SpawnExtras): Combatant {
  // Traits du statbloc d'éditeur : déjà des `TraitInstance` structurés (édités par picker) — unis aux
  // traits APPRIS (dresse-* d'une Possession, LDB 23 l.130 → LDB 85) : ids seuls.
  const learnedTraits: TraitInstance[] = (extras?.learnedTraits ?? []).map((traitId) => ({ id: traitId }));
  const traits = [...(sb.traits ?? []), ...learnedTraits];
  let chars = charsFrom(sb.char);
  // Compétences (refs `SkillRef` structurées, avances dérivées du profil SAISI) + talents du statbloc.
  const skills = skillsFromBook(sb.skills, chars, `spec:${id}`);
  const talents = talentsFromBook(sb.talents);
  // Tirage FIGÉ d'une Possession (`charsRolled`, LDB 77 l.108 — seedé sur l'uid, jamais relancé) PRIME
  // sur `sb.randomChars` (deux projections successives avec le MÊME `charsRolled` → mêmes stats).
  const rolled = !!extras?.charsRolled || !!sb.randomChars;
  if (extras?.charsRolled) chars = { ...extras.charsRolled };
  // Caractéristiques aléatoires (LDB 77 l.108) : le statbloc saisi est le profil ROND → −10 + 2d10 au spawn.
  else if (sb.randomChars) chars = randomizeChars(chars, id);
  // Traits à modificateurs de PROFIL (Élite, Coriace, Brutal, Rapide… — LDB 85) : un statbloc d'ÉDITEUR
  // part d'un profil standard et AJOUTE les Traits (LDB 77) → tous appliqués en DIRECT via `liveTraits`
  // (collecteur passif). `characteristics` reste le profil de BASE saisi ; `effectiveChar` ajoute les traits.
  const size = sb.size ?? sizeFromTraits(traits) ?? 'moyenne';
  // Blessures : surcharge explicite `char.B` si fournie, sinon formule par Taille (vide ⇒ formule, LDB 85).
  // La formule reprend la main si les caractéristiques ont été tirées (le B saisi valait pour le profil rond).
  // Blessures sur le profil INCLUANT les traits (Coriace +E…) ; `characteristics` ne garde que la base saisie.
  const charsEff = withTraitChars(chars, traits);
  let wounds = typeof sb.char.B === 'number' && !rolled ? (sb.char.B as number) : maxWounds(charsEff, size, traits);
  // Endurant (LDB 85 l.130) : +Bonus d'Endurance Blessures (sur la formule — un B explicite du
  // statbloc est réputé final, comme au bestiaire).
  if ((typeof sb.char.B !== 'number' || rolled) && traitBonusWoundsBE(traits)) wounds += Math.floor(charsEff.endurance / 10);
  const swarm = isSwarm(traits);
  if (swarm) ({ chars, wounds } = applySwarmBuild(chars, wounds)); // Nuée : ×5 PB + 10 CC (LDB 85 l.253)
  const movement = typeof sb.char.M === 'number' ? (sb.char.M as number) : 4; // traits → liveTraits (effectiveMovement)
  return {
    id,
    label: sb.label,
    kind: 'enemy',
    ...(traits.length ? { liveTraits: [...traits] } : {}), // statbloc d'éditeur : tous les traits en direct
    characteristics: chars,
    wounds: { current: wounds, max: wounds, base: wounds },
    advantage: 0,
    conditions: [],
    // Armes : depuis les Traits si fournis (« Arme (Épée) +7 », « À distance (Arbalète) +9 (60) »),
    // sinon une arme générique au dégât indiqué.
    weapons: traits.length ? weaponsFromTraits(traits) : [buildWeapon({ label: 'Arme', damage: { literal: sb.weaponDamage ?? '+BF' } })], // uid universel
    armour: emptyArmour(sb.armour ?? 0),
    size,
    bodyShape: swarm ? 'humanoide' : bodyShapeForSpecies(appearance?.species), // Tableau de Localisation (LDB 76 l.15-29) — espèce AUTHORÉE (id, jamais sb.label), Nuée force 'humanoide' (#814 : divergence possible avec `bodyShapeOf` sur un preset de campagne fusionnant Nuée hors registre global)
    ...(sb.inert ? { inert: true } : {}), // affût inerte servi (AA/MDG 12) : ciblable, sans réaction de combat ni tour
    ...(sb.followsCharacterRules ? { followsCharacterRules: true } : {}), // #143 : PNJ humain hostile MODÉLISÉ (Corruption/composant/maladie de personnage)
    ...parsePsychTraits(traits), // Peur/Terreur/Immunité + traits ciblés depuis les traits (LDB 21+85)
    ...(swarm ? { swarm: true, psychImmune: true } : {}), // Nuée : ignore la Psychologie (LDB 85 l.253)
    ...(isMindless(traits) ? { psychImmune: true } : {}), // Fabriqué : Tests d'Int/FM/Soc auto-réussis (LDB 85 l.142)
    ...spawnMutations(traits, id), // Mutation / Corruption mentale : tirage au spawn (LDB 85)
    ...(sb.spells?.length ? { spells: sb.spells.filter((id) => !!findSpellById(id)) } : {}), // ids d'auteur (filtrés valides)
    groups: groupsFor({ extras: sb.groups, traits, talents }), // extras manuels (déjà des ids) + traits (Mort-vivant…) + religieux (Talent Béni) — espèce/carrière non portées par le statbloc (P3)
    traits, // structurés → attaques gratuites + lecture sans re-parsing
    skills,
    talents,
    movement,
    pos,
  };
}

/** Une réf hors du faisceau `refEntiteResolue` a franchi la porte (`sceneEntitySchema`, #1882) : bogue du jeu. */
export class RefIrresoluble extends Error {
  constructor(readonly ref: string, readonly entite: string) {
    super(`[spawn] réf. irrésoluble « ${ref} » (entité « ${entite} ») (#1882)`);
    this.name = 'RefIrresoluble';
  }
}

/** La fiche d'une `ref` du faisceau `refEntiteResolue` : créature, coque, affût ; lève `RefIrresoluble` hors faisceau. */
function ficheDeRef(ref: string, id: string, pos: { x: number; y: number; z?: number }, opts?: SpawnExtras): Combatant {
  let c: Combatant;
  if (!refEntiteResolue(ref)) throw new RefIrresoluble(ref, id);
  if (findCreatureById(ref)) c = creatureToCombatant(findCreatureById(ref)!, id, pos, opts);
  else if (findVehicleById(ref)?.hull) {
    // Coque/navire (`vehicles.json` → facette `hull`) comme Combattant à PV (MDG 13). 'enemy' pour être
    // une cible ; inerte (pas d'arme/Mouvement, Psychologie ignorée) — sa destruction passe par ses Blessures.
    c = vehicleCombatant(findVehicleById(ref)!, id)!;
    c.kind = 'enemy';
    c.pos = { ...pos };
  } else {
    // Engin de siège (AA 10 l.175-193) : affût INERTE non-destructible (RAW : pas de Blessures), servi par son
    // équipage. Neutralisé en tuant l'équipage, pas en le détruisant. Son espèce de rendu est DÉRIVÉE de la
    // `ref` (l'art d'affût `siegeRig` du trapping) → plus aucun `appearance.species` forcé à l'authoring.
    // Dernière branche du faisceau : `refEntiteResolue` a déjà écarté créature et coque au-dessus.
    const t = findTrappingById(ref)!;
    c = inanimateCombatant({ id, label: t.label, refId: ref, bodyShape: 'engin', inert: true, footprint: t.siegeFootprint });
    c.kind = 'enemy';
    c.pos = { ...pos };
    c.species = t.siegeRig; // espèce DÉRIVÉE de la ref → rig engin au combat (parité avec l'explo/éditeur)
  }
  return c;
}

export function spawnEnemy(
  porteur: PorteurDeFiche,
  id: string,
  pos: { x: number; y: number; z?: number }, // z (étage) conservé sur c.pos via les spreads/shorthands
  opts?: { appearance?: EntityAppearance; weapon?: string } & SpawnExtras,
): Combatant {
  const c = porteur.presetCreature ? creatureToCombatant(porteur.presetCreature, id, pos, opts)
    : porteur.statblock ? statblockToCombatant(porteur.statblock, id, pos, opts?.appearance)
    : ficheDeRef(porteur.ref, id, pos, opts);
  c.porteurDeFiche = porteur;
  if (opts?.crewIds) c.crewIds = opts.crewIds;
  if (opts?.postes) c.postes = opts.postes.map(hydratePoste); // #222 — réf catalogue → base HYDRATÉE (couture unique)
  if (opts?.upgrades) c.upgrades = opts.upgrades;
  // Blindage (MDG 12 l.234/236) : PA de coque depuis les Traits du TYPE (`ship.traits`) + les Améliorations
  // d'INSTANCE (`upgrades`). Self-contained → posé ici (pas de post-pass type `applyShipPostes`). Consommé par
  // les dégâts navals (`applyOps` op `wounds` déduit `armour.corps`).
  if (c.bodyShape === 'vehicule') {
    const navalTraits = hullNavalTraits(c);
    const ap = hullArmourBonus(navalTraits);
    if (ap) c.armour.corps = (c.armour.corps ?? 0) + ap;
  }

  // COSMÉTIQUE — identité visuelle traversant explo↔combat à l'identique : tout override d'auteur
  // (parts monstrueux, couleurs, coiffure, yeux, sexe/carrure, seed re-tiré) est porté BRUT par
  // `Combatant.appearanceOverride` (donnée d'authoring), puis figé PARESSEUSEMENT au rendu par
  // `enemyRigProfile` (#187 : ce figeage rig ne s'exécute plus dans `state`). Le seed reste DÉTERMINISTE
  // par combattant (dérivé de l'id, `Combatant.id === SceneEntity.id`). Sans override → champ absent,
  // rendu dérivé du nom inchangé.
  const a = opts?.appearance;
  if (a?.species) c.species = a.species; // espèce/race d'auteur → rig en combat comme en exploration
  if (a && (a.species || a.monster || a.features || a.colors || a.parts || a.eyes || a.sex || a.build !== undefined || a.seed !== undefined || a.armurePortee !== undefined)) {
    c.appearanceOverride = a;
  }
  // Tenue éditée (libellé) → portée par le rig (via Combatant.career, qui sert de tenue) en
  // combat comme en exploration.
  if (a?.tenue) c.career = a.tenue;
  // `opts.weapon` est l'arme d'AUTHORING (`trappingId` du catalogue — `SceneEntity.weapon`, doctrine
  // ids-only, MÊME résolution que le rendu d'exploration `enemyRigProfile`/`weaponFromId`, #258) : la
  // projection UNIQUE `weaponFromItem` en fait une arme de combat COMPLÈTE (Dégâts, Portée, Recharge,
  // Groupe, effets à la touche). Elle n'alimente le COMBAT que si les Traits n'ont PAS déjà produit une
  // arme explicite du MÊME type (melee/ranged) : les deux décriraient alors le MÊME armement, et celle
  // d'authoring passerait en tête de `c.weapons` en masquant celle du statbloc, qui porte l'Indice de
  // Dégâts IMPRIMÉ (#126/#145). Un `weapon:` d'un type ABSENT des Traits (ex. Garde du Village posté
  // « archer » : trait Arme mêlée générique + `weapon:'arc'`) reste additif, légitime (ne duplique rien).
  // `renderWeaponsFromTraits` = armes EXPLICITES sans repli générique.
  if (opts?.weapon) {
    const idWeapon = weaponFromId(opts.weapon); // null (+ console.error #223) si le trappingId ne résout pas
    if (idWeapon && !renderWeaponsFromTraits(c.traits ?? []).some((w) => w.type === idWeapon.type)) {
      c.weapons = [idWeapon, ...c.weapons];
    }
  }
  // Arme à distance CHARGÉE au spawn (miroir du héros dans startCombat) — LDB 62 l.335 : le `loaded` ne gate
  // que les armes à Recharge, un tireur fraîchement engagé peut donc tirer au 1er Round (pas de recharge à vide).
  // Couture UNIQUE : le coup porte SA munition dès le spawn (aucune capture posée ailleurs).
  const spawnRanged = c.weapons.find((w) => w.type === 'ranged');
  if (spawnRanged) loadWeapon(c, spawnRanged);
  return c;
}
