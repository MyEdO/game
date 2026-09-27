/**
 * Profil de rendu RIG d'un combattant ennemi/PNJ humanoïde — COSMÉTIQUE (l'engine
 * n'en dépend jamais). Transforme un Combatant en (apparence, tenue, équipement,
 * calques de mutation) pour le rendre via le rig au lieu du sprite monolithique.
 *
 * Décisions : voir docs/superpowers/specs/2026-06-05-F1-ennemis-rig-design.md
 */
import type { Combatant, ItemInstance, ArmourPoints, HitLocation } from '../../engine/types';
import type { Appearance } from './appearance';
import type { EquipCtx } from './parts/equipment';
import { equipFromCombatant } from './parts/equipment';
import { emptyArmour } from '../../engine/items';
import { renderWeaponsFromTraits, armourFromTraits, weaponFromId } from '../../engine/creatureEquip';
import type { TraitList } from '../../engine/statEntry';
import { eyesArtFromKeys } from './parts/eyes';
import type { MonsterParts } from './parts/monstrous';
import { hashSeed } from '../../engine/dice';
import type { SceneEntity } from '../../state/scene';
import { bipedDef } from './creatures';
import { resolveRender, type RenderResolution } from './bodyPlan';
import { findCreatureById, isNamed, type CreatureData } from '../../data';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { raceById } from './races';
import { baseSpeciesOf } from './skeletons';
import { teintesTirees } from './parts/tirageIndividuel';
import { diagOnce, diagSubject } from './devDiag';
import { coiffureRetombee } from './parts/cosmetic';
import { sexeDeCoiffure } from '../../data/schemas/grammaire/art';
import { sexeSchema, type Sexe } from '../../data/schemas/grammaire/valeurs';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';

export interface EnemyRigProfile {
  appearance: Appearance;
  tenue: string;
  equip: EquipCtx;
}

/** Classe de rendu d'un ID de créature — délègue au résolveur unique `resolveRender` (espèce du
 *  record). 'rig' (humanoïde → rig bipède) ou 'creature' (gabarit quad/ailé/… / nuée). */
export function classifyEnemy(creatureId: string): 'rig' | 'creature' {
  return resolveRender(undefined, findCreatureById(creatureId)?.traits, creatureId).kind === 'plan' ? 'creature' : 'rig';
}

/** Classe de rendu DATA-DRIVEN (de-POC P5) — délègue au résolveur unique `resolveRender` : trait
 *  Nuée ou espèce EXPLICITE (arg/record, lookup exact) ; sans espèce → bipède (rig). */
export function classifyBy(species: string | undefined, traits: import('../../engine/statEntry').TraitList | undefined, id: string | undefined): 'rig' | 'creature' {
  return resolveRender(species, traits, id).kind === 'plan' ? 'creature' : 'rig';
}


// Les défauts d'apparence (tenue / monster / sex / parts / colors / scale) d'un bipède viennent
// désormais de sa RACE (canonique, partagée — cf. `raceById(baseSpeciesOf(species))`), surchargés
// par les éventuelles surcharges propres à la créature (`def.perso`, pour les espèces
// non-canoniques repliées sur une race partagée : Fimir/Géant/Liche/Démonette).

/** Apparence d'AUTHORING (`EntityAppearance` : entité de scène, `Combatant.appearanceOverride`) →
 *  `Partial<Appearance>`, UNE fois pour le combat et l'exploration : seuls les champs fournis sortent,
 *  les yeux passent de clés à arts (`eyesArtFromKeys`). Les défauts restent au constructeur `rigAppearance`.
 *  L'espèce n'en sort pas : elle entre par `resolveRender`, seule porte des espèces d'auteur. */
type ApparenceDAuteur = Pick<EntityAppearance, 'sex' | 'build' | 'features' | 'colors' | 'parts' | 'hairstyle' | 'eyes'> & { monster?: MonsterParts };
function apparenceDAuteur(a: ApparenceDAuteur | undefined): Omit<Partial<Appearance>, 'species'> | undefined {
  if (!a) return undefined;
  return {
    sex: a.sex, build: a.build, monster: a.monster,
    features: a.features, colors: a.colors, parts: a.parts, hairstyle: a.hairstyle, eyes: eyesArtFromKeys(a.eyes),
  };
}

/** Synthèse d'items d'armure depuis les PA par localisation (matériau via palier) — UNIQUEMENT si
 *  l'apparence de la créature DÉCLARE son armure de statblock PORTÉE (`armurePortee`) [entériné
 *  2026-07-22, #774 : « Les PA ne devrait pas impacté l'apparence, sauf si on le décide »]. Par défaut,
 *  les PA restent mécaniques PURS (PA/zoneBadges/enc lisent `c.armour`/de vrais items) : aucun item
 *  d'art n'est fabriqué. Curation par créature dans `creatures.json` (`appearance.armurePortee`). */
function synthArmour(ap: ArmourPoints, armurePortee: boolean | undefined): ItemInstance[] {
  if (!armurePortee) return [];
  const items: ItemInstance[] = [];
  const piece = (uid: string, name: string, pa: number, locs: HitLocation[]) => {
    items.push({ uid, label: name, kind: 'armor', qualities: [], pa, locs, enc: 0, equipped: true });
  };
  if (ap.corps > 0) piece('syn-corps', 'Protection (corps)', ap.corps, ['corps']);
  if (ap.tete > 0) piece('syn-tete', 'Protection (tête)', ap.tete, ['tete']);
  const bras = Math.max(ap.brasG, ap.brasD);
  if (bras > 0) piece('syn-bras', 'Protection (bras)', bras, ['brasG', 'brasD']);
  const jambes = Math.max(ap.jambeG, ap.jambeD);
  if (jambes > 0) piece('syn-jambes', 'Protection (jambes)', jambes, ['jambeG', 'jambeD']);
  return items;
}

/** Résolution PARTAGÉE (combat ET exploration, IDENTIQUE) : espèce → def bipède canonique + race
 *  (défauts d'apparence partagés) + perso (surcharges d'espèce non-canonique). L'espèce vient
 *  TOUJOURS de `resolveRender` (résolveur unique), `repli` dit qu'elle est la race de REPLI d'une espèce
 *  non résolue — aucun repli d'espèce ici. */
function bipedBase(r: Extract<RenderResolution, { kind: 'rig' }>) {
  const d = bipedDef(r.species);
  return { species: r.species, repli: !!r.repli, d, race: raceById(d?.race ?? baseSpeciesOf(r.species)), perso: d?.perso };
}
type BipedBase = ReturnType<typeof bipedBase>;

/** Garde-robe PARTAGÉE (id STABLE) : surcharge (carrière / opts) → record créature → perso/race → 'nu'
 *  (l'auteur l'habille). Toutes ces sources portent des IDS de garde-robe (tenue ∪ carrière), jamais un libellé. */
function bipedTenue(override: string | undefined, cd: EntityAppearance | undefined, perso: { tenue?: string } | undefined, race: { tenue?: string }): string {
  return override ?? cd?.tenue ?? perso?.tenue ?? race.tenue ?? 'nu';
}

/** Tirage INDIVIDUEL (#223), règle UNIQUE du combat, de l'exploration et du portrait : ce qu'un individu
 *  tire de sa graine dans les plages `tirageIndividuel` de sa race (`raceAppearance.json`) — une teinte par
 *  emplacement listé (la coiffure a UNE source : le resolver, par la même graine). Rien pour une race sans plages, ni pour la
 *  race de REPLI d'une espèce non résolue. C'est la couche la plus BASSE de `rigAppearance`. */
function tirageIndividuel(graine: number, base: BipedBase): Appearance['colors'] {
  const plages = base.repli ? undefined : base.race.tirageIndividuel;
  return plages ? teintesTirees(graine, plages) : undefined;
}

/** Graine UNIQUE d'un individu, d'où `rigAppearance` tire tout ce qui n'est pas posé (sexe, carrure,
 *  teintes, coiffure, visage). Ce qu'on fixe l'emporte : la graine posée sur l'ENTITÉ (`posee`), puis,
 *  pour un individu NOMMÉ (`isNamed`), celle de son RECORD (sinon son id) ; un profil générique varie
 *  par instance (`instance`). */
function graineDeTirage(posee: number | undefined, instance: number, rec: CreatureData | undefined): number {
  return posee ?? (rec && isNamed(rec) ? rec.appearance?.seed ?? hashSeed(rec.id) : instance);
}

/** Champs TIRÉS recouverts, un par un, par les champs POSÉS par l'auteur (un champ absent ne recouvre rien). */
function sousAuteur<T extends object>(tire: T | undefined, auteur: T | undefined): T | undefined {
  if (!tire) return auteur;
  const out: Record<string, unknown> = { ...(tire as Record<string, unknown>) };
  for (const [k, v] of Object.entries(auteur ?? {})) if (v !== undefined) out[k] = v;
  return out as T;
}

/** Sexe et coiffure des couches d'AUTEUR, de la plus basse à la plus haute : une couche qui pose un sexe
 *  sans coiffure est le geste d'édition du sexe (`coiffureRetombee`) sur la coiffure des couches du
 *  dessous, dont l'id retiré est rendu en `retombee` ; une couche qui pose sa coiffure la garde, même
 *  contre son propre sexe (faute de donnée, nommée par le schéma, vue au rendu). PURE. */
function sexeEtCoiffure(couches: readonly (Pick<Appearance, 'hairstyle'> & { sex?: Sexe } | undefined)[]): { sex?: Sexe; hairstyle?: string; retombee?: string } {
  return couches.reduce<{ sex?: Sexe; hairstyle?: string; retombee?: string }>((bas, haut) => {
    if (!haut) return bas;
    if (haut.hairstyle != null) return { sex: haut.sex ?? bas.sex, hairstyle: haut.hairstyle };
    if (haut.sex == null) return bas;
    const r = coiffureRetombee({ sex: haut.sex, hairstyle: bas.hairstyle });
    return { ...r, retombee: r.hairstyle === bas.hairstyle ? bas.retombee : bas.hairstyle };
  }, {});
}

/** Diagnostic d'une coiffure d'auteur RETIRÉE au rendu par `sexeEtCoiffure` — même canal que la coiffure
 *  hors du pool (`hairIndexById`) : console du DEV, une fois par sujet. */
function direCoiffureRetombee(retombee: string, sex: Sexe): void {
  // `?.` : le rig est importé par les scripts tsx (galeries QC), où `import.meta.env` n'existe pas.
  if (!import.meta.env?.DEV) return;
  const sujet = diagSubject();
  const sexe = sexeDeCoiffure(retombee);
  diagOnce(`rig:coiffure-retombee:${sujet}:${retombee}:${sex}`, () => console.warn(`[rig] « ${sujet || '(sans réf)'} » : coiffure « ${retombee} »${sexe ? ` (sexe : ${libelleDeValeur(sexeSchema, sexe)})` : ''} retirée au rendu — une couche d'apparence plus haute pose le sexe ${libelleDeValeur(sexeSchema, sex)}.`));
}

/** Carrure par défaut dérivée du seed (0.35..0.75) — formule UNIQUE. */
const buildFromSeed = (seed: number): number => +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2);

/**
 * CONSTRUCTEUR UNIQUE de l'apparence rig — combat ET exploration. Une seule précédence par champ :
 * override d'instance → record créature (`cd`) → perso/race → tirage par la `graine` de l'individu
 * (`graineDeTirage`) ; les teintes posent en dessous le tirage individuel de la race, que chaque
 * teinte posée par l'auteur recouvre (`sousAuteur`). `override` porte ses YEUX en art (`apparenceDAuteur`).
 * Sexe et coiffure d'auteur se résolvent ENSEMBLE (`sexeEtCoiffure`).
 */
function rigAppearance(graine: number, base: BipedBase, cd: EntityAppearance | undefined, override: Omit<Partial<Appearance>, 'species'> | undefined): Appearance {
  const { species, d, race, perso } = base;
  const o = override ?? {};
  const tirage = tirageIndividuel(graine, base);
  const auteur = sexeEtCoiffure([cd, o]);
  if (auteur.retombee !== undefined && auteur.sex !== undefined) direCoiffureRetombee(auteur.retombee, auteur.sex);
  return {
    species,
    sex: auteur.sex ?? perso?.sex ?? race.sex ?? (graine % 7 < 2 ? 'F' : 'M'),
    build: o.build ?? cd?.build ?? buildFromSeed(graine),
    seed: graine,
    monster: o.monster ?? cd?.monster ?? perso?.monster,
    features: o.features ?? cd?.features,
    colors: sousAuteur(tirage, o.colors ?? cd?.colors ?? perso?.colors ?? race.colors),
    parts: o.parts ?? cd?.parts ?? perso?.parts ?? race.parts,
    hairstyle: auteur.hairstyle,
    gabarit: o.gabarit ?? perso?.gabarit ?? d?.gabarit,
    eyes: o.eyes ?? eyesArtFromKeys(cd?.eyes) ?? eyesArtFromKeys(perso?.eyes),
  };
}

/**
 * Un combattant rendu depuis SON PROPRE inventaire (personnage-joueur du groupe : apparence dans
 * `c.appearance`, tenue du `career`, armure en `ItemInstance`) — vs par PROFIL SYNTHÉTISÉ du bestiaire/
 * statbloc (`enemyRigProfile` : armure des PA/Traits, tenue du record). Un allié PNJ passe `side:'ally'`
 * → `kind:'hero'` (camp) au combat, mais reste une instance de bestiaire (`creatureId`) ou de statbloc
 * pilotée par l'IA (`aiControlled`) : son armure vit en PA/Traits, jamais en items → il DOIT passer par
 * `enemyRigProfile` pour rendre IDENTIQUEMENT au hors-combat (`entityRigProfile`). Router le rendu sur le
 * camp (`kind`) au lieu de l'ORIGINE écraserait la couche armure des alliés de bestiaire (#181/#182). */
export function rendersFromOwnInventory(c: Combatant): boolean {
  return c.kind === 'hero' && !c.aiControlled && !c.creatureId;
}

/**
 * Profil rig d'un combattant, ou null si non-humanoïde (→ rendu par son gabarit corporel
 * via AnimatedPlanToken, plus aucun sprite monolithique). PURE et déterministe (seed dérivé de l'id).
 */
export function enemyRigProfile(c: Combatant): EnemyRigProfile | null {
  // Résolution de rendu par le résolveur UNIQUE, sur les MÊMES entrées qu'en exploration
  // (`entityRigProfile`) : espèce explicite → espèce du record (par id). Son `species` alimente
  // ensuite `bipedBase` → aucune 2ᵉ précédence d'espèce côté combat.
  const r = resolveRender(c.species, c.traits, c.creatureId);
  if (r.kind === 'plan') return null;

  const seed = hashSeed(c.id);
  const rec = findCreatureById(c.creatureId);
  const cd = rec?.appearance; // apparence par défaut UNIFIÉE du record créature (par id)
  const bb = bipedBase(r); // résolution PARTAGÉE espèce→def/race/perso
  // Apparence d'authoring (`c.appearanceOverride`, #187) résolue au rendu par `apparenceDAuteur`, comme
  // en exploration ; `id === SceneEntity.id` donne la même graine d'instance (`graineDeTirage`).
  const ov = c.appearanceOverride;
  const appearance = rigAppearance(graineDeTirage(ov?.seed, seed, rec), bb, cd, apparenceDAuteur(ov));
  // Tenue DATA-DRIVEN : carrière du Combatant → record → défaut de la def (perso/race) → Nu (l'auteur l'habille).
  const tenue = bipedTenue(c.career, cd, bb.perso, bb.race);

  // Équipement : l'inventaire du combattant prime ; sinon armure synthétisée des PA (visible SEULEMENT
  // si l'apparence la déclare portée — override d'authoring (`c.appearanceOverride.armurePortee`) PRIME
  // sur le record (`cd?.armurePortee`), symétrique de `entityRigProfile` (`opts.armurePortee ?? cd?.armurePortee`,
  // parité #181/#182 : une entité à statbloc SANS record honore SON armurePortee en combat comme en explo).
  const base = equipFromCombatant(c);
  const armour = base.armour.length ? base.armour : synthArmour(c.armour, ov?.armurePortee ?? cd?.armurePortee);
  const equip: EquipCtx = { weapons: base.weapons, armour, shield: base.shield };

  // Calques de mutation = donnée (`combatantOverlays(c.mutations)`, appliqués par AnimatedRigToken),
  // jamais le nom : un mutant déclare son tell via un trait « Mutation (X) » → c.mutations au spawn.
  return { appearance, tenue, equip };
}

/**
 * Profil rig pour une ENTITÉ de scène humanoïde (hors combat) : pas d'équipement de
 * combat (mains libres, pour les poses d'ambiance), apparence dérivée de la réf + seed.
 * null si la réf désigne une créature non-humanoïde.
 */
export function entityRigProfile(
  name: string | undefined,
  seed: number,
  /** L'apparence d'AUTEUR ENTIÈRE (`EntityAppearance`) — sa graine POSÉE l'emporte sur `seed` (instance)
   *  et sur le record ; `armurePortee` pour une entité SANS record, repli sur `cd?.armurePortee` sinon. */
  opts?: EntityAppearance & {
    /** Arme d'authoring (`trappingId`, `SceneEntity.weapon`). */
    weapon?: string;
    /** Profil de combat de l'entité (statbloc d'éditeur) → équipement affiché en explo, comme au combat. */
    traits?: TraitList; armour?: number;
    /** L'entité est ENRÔLÉE dans une rencontre (membre d'un `EncounterDef`) : elle porte les ARMES que
     *  les traits de son record déclarent (parité avec le spawn `creatureToCombatant`). Non enrôlée (défaut
     *  `false`) : mains libres. */
    enrolled?: boolean },
): EnemyRigProfile | null {
  const rec = findCreatureById(name);
  // Résolution d'espèce par la DONNÉE (espèce explicite de l'entité → espèce du record) — IDENTIQUE à
  // resolveById/resolveRender : un record porte son `appearance.species` (ex. « Peau-de-Loup ») qui
  // résout vers son def (sinon repli Humain → perso.head/race du def perdus). `r.species` porte ce résultat.
  const r = resolveRender(opts?.species ?? rec?.appearance?.species, rec?.traits, name);
  if (r.kind === 'plan') return null; // non-humanoïde → gabarit corporel
  const cd = rec?.appearance; // apparence par défaut UNIFIÉE du record créature
  const base = bipedBase(r); // espèce RÉSOLUE → def/race/perso corrects
  // Une entité d'ambiance « mutée » déclare ses parts/overlays dans son apparence (monster), pas via le nom.
  const override = apparenceDAuteur(opts);
  // Équipement : MÊME dérivation qu'au combat (parité explo↔combat). Traits de l'entité : statbloc
  // d'éditeur (`opts.traits`), sinon ceux du record. L'ARMURE fait partie de l'apparence : elle se dérive
  // toujours de ces traits. Les ARMES n'en sortent que pour une entité enrôlée (`enrolled`). Armes
  // EXPLICITES seulement (`renderWeaponsFromTraits`, pas de repli « Arme » générique dessiné en épée).
  const traits = opts?.traits ?? rec?.traits ?? [];
  const traitsArmes = opts?.traits || opts?.enrolled ? traits : [];
  // `opts.weapon` (trappingId d'authoring) ne s'ajoute QUE si les Traits n'ont PAS déjà produit une arme du
  // MÊME type (melee/ranged) — même règle que le spawn de combat (`spawn.ts` spawnEnemy), sinon
  // DUPLICATION du rendu (#126/#145). Un type ABSENT des Traits reste additif (Garde du Village posté
  // « archer » : trait Arme mêlée générique + `weapon:'arc'`).
  const traitWeapons = renderWeaponsFromTraits(traitsArmes);
  const idWeaponInst = opts?.weapon ? weaponFromId(opts.weapon) : undefined;
  const idWeapon = idWeaponInst && !traitWeapons.some((w) => w.type === idWeaponInst.type) ? [idWeaponInst] : [];
  const armourPA: ArmourPoints = opts?.armour != null ? emptyArmour(opts.armour) : armourFromTraits(traits);
  return {
    appearance: rigAppearance(graineDeTirage(opts?.seed, seed, rec), base, cd, override),
    tenue: bipedTenue(opts?.tenue, cd, base.perso, base.race),
    equip: { weapons: [...idWeapon, ...traitWeapons], armour: synthArmour(armourPA, opts?.armurePortee ?? cd?.armurePortee) },
  };
}

/** Réf de rendu d'une entité de scène = sa `ref` (id de créature / trapping d'affût / véhicule), et
 *  RIEN d'autre : le label est de l'affichage, jamais une identité. Une entité sans `ref` n'a pas
 *  d'apparence à résoudre — elle ne reçoit pas le record d'un tiers (`resolveRender` le signale). */
export function refOf(ent: Pick<SceneEntity, 'ref'>): string | undefined {
  return ent.ref;
}

/** Profil rig d'une ENTITÉ de scène (perso), dérivation UNIQUE partagée par `tokenBodyKind` (iso) et
 *  `buildPovBillboards` (POV) : mêmes seed / refName / apparence / équipement (dont `enrolled`). Une
 *  entité sans réf NI Espèce n'a aucune apparence à résoudre : signalée en dev, nommée par son id. */
export function entityRigProfileFor(ent: SceneEntity, enrolled?: boolean): EnemyRigProfile | null {
  const refName = refOf(ent);
  if (import.meta.env?.DEV && !refName && !ent.appearance?.species)
    diagOnce(`rig:entite:${diagSubject() || ent.id}`, () => console.error(`[rig] entité « ${ent.id} » (${ent.label ?? 'sans libellé'}) : ni réf de créature ni Espèce — donnée de scène à corriger.`));
  return entityRigProfile(refName, hashSeed(ent.id), {
    ...ent.appearance, weapon: ent.weapon, traits: ent.statblock?.traits, armour: ent.statblock?.armour, enrolled,
  });
}
