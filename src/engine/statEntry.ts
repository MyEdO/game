/**
 * Parseur CANONIQUE et UNIQUE des chaînes de statbloc WFRP (traits, compétences, talents…).
 *
 * Le format des données est hétérogène (héritage des livres) : un même token peut être un
 * compte en tête (« 8 Tentacules »), un bonus signé (« +7 »), un Indice/valeur de fin
 * (« Vol 100 », « Démoniaque 8+ », « Chevaucher 58 »), une parenthèse de spécialisation/type/
 * cible (« (Cheval) », « (Feu) », « (Tiléens) ») ou de portée (« (50) »). Cette fonction les
 * démêle UNE fois pour TOUT le code (combat ET Codex) — fini les regex recopiées par consommateur.
 */
import type { CharKey, EffectSource } from './types';
import type { SizeCategory } from './size';
import type { TraitPose } from '../data/schemas/grammaire/reference';
import { hashSeed, makeRNG } from './dice';
import { lirePlage, type ParLocalisation, type Plage } from './classementDeTrait';

export interface StatEntry {
  /** Nom canonique (base), sans compte/bonus/indice/parenthèse : « Tentacules », « Arme »,
   *  « À distance », « Chevaucher », « Magie des Arcanes ». Clé de lookup registre/données. */
  name: string;
  /** Parenthèse NON numérique : spécialisation (« Cheval »), type (« Feu »), cible (« Tiléens »). */
  arg?: string;
  /** Compte en tête : « 8 Tentacules +9 » → 8 (nombre d'attaques). */
  count?: number;
  /** Bonus SIGNÉ : « Arme +7 » → 7, « Vomissement -2 » → -2 (Dégâts d'une attaque). */
  bonus?: number;
  /** Indice/valeur NON signé de fin : « Vol 100 » → 100, « Démoniaque 8+ » → 8, compétence « 58 ». */
  indice?: number;
  /** Parenthèse NUMÉRIQUE : « À distance +8 (50) » → 50 (portée en mètres). */
  range?: number;
  /** Fourchette, en fin ou en parenthèse : « Peur 1-2 » (ZI 13 l.31), « Protection (7-9) » (ZI 04 l.228). */
  plage?: Plage;
  /** Chaîne d'origine, telle qu'affichée. */
  raw: string;
}

/** Démêle une chaîne de statbloc en ses composantes canoniques. */
export function parseStatEntry(raw: string): StatEntry {
  const out: StatEntry = { name: '', raw: raw.trim() };
  let s = out.raw;

  // 1) Compte en tête (« 8 Tentacules ») — seulement si suivi d'un mot (pas « 8 » seul/valeur).
  const cm = s.match(/^(\d+)\s+(\D.*)$/);
  if (cm) {
    out.count = parseInt(cm[1], 10);
    s = cm[2];
  }

  // 2) Parenthèses : purement numérique → portée, sinon spec/type/cible. Les deux PEUVENT coexister
  //    (« À distance (Arbalète) +9 (60) ») ; la 1re de chaque sorte l'emporte.
  for (const pm of s.matchAll(/\(([^)]*)\)/g)) {
    const inside = pm[1].trim();
    const plage = lirePlage(inside);
    if (/^\d+$/.test(inside)) { if (out.range == null) out.range = parseInt(inside, 10); }
    else if (plage) { if (out.plage == null) out.plage = plage; }
    else if (inside && out.arg == null) out.arg = inside;
  }
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

  // 2b) Fourchette de fin (« Armure 1-3 ») — avant le bonus signé, qui y lirait « -3 ».
  const pf = s.match(/\s(\d+\s*-\s*\d+)\s*$/);
  const plageDeFin = pf ? lirePlage(pf[1]) : undefined;
  if (pf && plageDeFin && out.plage == null) {
    out.plage = plageDeFin;
    s = s.slice(0, pf.index).trim();
  }

  // 3) Bonus SIGNÉ (« +7 », « -2 ») n'importe où.
  const bm = s.match(/([+-]\d+)/);
  if (bm) {
    out.bonus = parseInt(bm[1], 10);
    s = s.replace(/\s*[+-]\d+\s*/, ' ').trim();
  }

  // 4) Indice/valeur NON signé en fin (« 100 », « 8+ », « 58 ») — précédé d'un espace.
  const im = s.match(/\s(\d+)\s*\+?\s*$/);
  if (im) {
    out.indice = parseInt(im[1], 10);
    s = s.replace(/\s\d+\s*\+?\s*$/, '').trim();
  }

  out.name = s.replace(/\s+/g, ' ').trim();
  return out;
}

/** Ce qui n'a plus de fourchette : la pose tirée (`PoseTiree`) et l'instance résolue (`TraitInstance`). */
interface SansFourchette {
  plage?: never;
}

/** Trait posé dont la fourchette est tirée : ce que `resoudreTrait` résout. Une `TraitPose` n'y passe que
 *  par `traitsDuPorteur`, ou quand sa forme littérale n'en porte aucune. */
export type PoseTiree = Omit<TraitPose, 'plage'> & SansFourchette;

/**
 * Trait RÉSOLU, l'instance que le jeu lit (`Combatant.traits`) : rendu d'un Trait posé (`TraitPose`,
 * `data/schemas/grammaire/reference.ts`) par `resoudreTrait`, sans sa provenance de livre. `id` = identifiant
 * STABLE (slug du libellé canonique), indépendant de la langue — clé de lookup registre/données ; `value` =
 * numérique (Indice ou bonus signé) ; `arg` = parenthèse non-numérique ; `count` = compte en tête ; `range` = portée.
 */
export interface TraitInstance extends SansFourchette {
  id: string;
  value?: number;
  arg?: string;
  count?: number;
  range?: number;
  /** Le trait d'arme est une attaque NATURELLE de corps (morsure/griffes/cornes…) → aucune arme tenue
   *  n'est dessinée (le membre fait foi). Flag DONNÉE posé à la migration (depuis l'ancienne heuristique
   *  de libellé), lu au spawn par `weaponFromTrait` → `Weapon.natural`. Absent = arme manufacturée
   *  (ou trait « Arme » générique SANS objet de catalogue résolu → `Weapon.sizeless`, rendu inchangé). */
  natural?: boolean;
  /** Dissimulation d'INSTANCE — arbitrage `maison` (MDG 07 l.250, condition « si la Marque de Khorne
   *  est visible » sans mécanique de dissimulation nulle part ailleurs dans MDG 07) : champ d'instance
   *  ÉDITABLE, défaut `false` = visible. Gate `targetedTrigger` (psychology.ts) pour la RÉCIPROQUE d'un
   *  Trait psy porté PAR CAPACITÉ (`capabilities.grantGroups`) — un Trait dissimulé n'expose plus le
   *  porteur au Groupe qu'il confère. */
  hidden?: boolean;
  /** PROVENANCE de l'instance ACCORDÉE (op `grantTrait`, passif de mutation) — jamais authorée :
   *  l'entité qui a posé CETTE instance (`EffectSource`, id STABLE). C'est le registre d'instance que
   *  l'op `removeTrait` interroge pour ne retirer QUE ce que sa propre source a accordé — un même Trait
   *  porté nativement ou accordé par un tiers (Haine d'une prière, LDB 226) n'est pas touché.
   *  Absent = instance NATIVE (statbloc/authoring). */
  src?: EffectSource;
  /** Indice par Localisation (AA 09 l.184), lu par `armourFromTraits`. */
  parLocalisation?: ParLocalisation;
}

/**
 * Valeur d'une fourchette pour son porteur — arbitrage `maison` : faute d'une valeur fixée par l'auteur de
 * la version (LDB 76 l.45), elle se tire à l'apparition, uniformément entre ses bornes incluses, sur une
 * graine stable (le porteur, l'id du Trait, son rang parmi ses homonymes), comme les Caractéristiques
 * aléatoires (LDB 77 l.108). Proposition en cérémonie (#1463). ZI 13 l.31 ; ZI 04 l.228.
 */
function tirerLaFourchette(plage: Plage, graine: string): number {
  return makeRNG(hashSeed(`fourchette:${graine}`)).int(plage.min, plage.max);
}

/**
 * La SEULE entrée d'un Trait posé (`TraitPose`) vers l'instance de jeu : chaque fourchette est tirée pour
 * le porteur `porteur`, puis la pose est résolue. `dejaPortes` = les Traits que le porteur a déjà : le rang
 * d'un homonyme part d'eux, et un Trait accordé ne retire pas la fourchette de celui qu'il a déjà.
 */
export function traitsDuPorteur(poses: readonly TraitPose[], porteur: string, dejaPortes: TraitsDesignes = []): TraitInstance[] {
  const rangs = new Map<string, number>();
  for (const t of dejaPortes) rangs.set(t.id, (rangs.get(t.id) ?? 0) + 1);
  return poses.map(({ plage, ...pose }) => {
    const rang = rangs.get(pose.id) ?? 0;
    rangs.set(pose.id, rang + 1);
    return resoudreTrait(plage ? { ...pose, value: tirerLaFourchette(plage, `${porteur}:${pose.id}#${rang}`) } : pose);
  });
}

/**
 * Résolution d'une pose tirée en instance de jeu : la provenance de livre (`source`, `alsoIn`, `maison`)
 * reste à la donnée ; `src` est la provenance d'un Trait ACCORDÉ. PURE.
 */
export function resoudreTrait(pose: PoseTiree, { src }: { src?: EffectSource } = {}): TraitInstance {
  const { source: _source, alsoIn: _alsoIn, maison: _maison, ...jeu } = pose;
  return src ? { ...jeu, src } : jeu;
}

/**
 * Liste de traits portée par une créature/combattant : `TraitInstance[]` STRUCTURÉS (id + valeur/arg),
 * jamais de chaîne. Le parsing label→`TraitInstance` n'a lieu QU'À l'authoring (saisie éditeur de
 * `SceneEntity.traits`, résolue au spawn) et à la migration de données — plus jamais au runtime.
 */
export type TraitList = TraitInstance[];

/** Traits lus par leur seule DÉSIGNATION (id et Aspect), posés ou résolus : ces lecteurs n'en lisent
 *  jamais la valeur, qu'une fourchette laisse à la résolution. */
export type TraitsDesignes = readonly Pick<TraitInstance, 'id' | 'arg'>[];

/**
 * OPTIONNEL COMPOSÉ (LDB 76) — élément de la liste `optionals` d'une créature IRRÉDUCTIBLE à un
 * `TraitInstance` : une NOTE de variante d'auteur. Deux formes (discriminées par `note`) :
 *  - `all-traits` : joker « n'importe quel Trait peut être ajouté » (Mutant, LDB 83 l.91) ;
 *  - `swap` : variante « remplacer des Traits par un bonus » (Grand Loup ZI 1 l.229, Griffon ZI).
 * `label` = texte source VERBATIM (Markdown), affiché tel quel (JAMAIS reformulé) ; les autres champs
 * pilotent l'APPLICATION au spawn. Distinguée d'un `TraitInstance` par la présence de `note` (jamais d'`id`).
 */
/** Un octroi ÉLÉMENTAIRE d'une variante « swap » : bonus signé sur UNE caractéristique, OU une
 *  compétence à valeur de Test IMPRIMÉE (verbatim, pas une avance calculée). Une variante composite
 *  (Vouivre ZI : « +20 en I, Int et Soc » + « Discrétion (Rurale) 65 ») en cumule PLUSIEURS. */
export type SwapGrant = { char: CharKey; value: number } | { id: string; spec?: string; value: number };
export interface OptionalWildcard {
  note: 'all-traits';
  /** Texte source VERBATIM (« Tous les traits »). */
  label: string;
}
export interface OptionalSwap {
  note: 'swap';
  /** Texte source VERBATIM (« Remplacer Bestial par un bonus de +20 en Soc »). */
  label: string;
  /** `id`s STABLES des Traits RETIRÉS du profil quand la variante est choisie. */
  remove: string[];
  /** Bonus(-ent) octroyé(s) en échange : une ou plusieurs caractéristiques/compétences, + leur valeur
   *  (Vouivre ZI : +20 en I, Int et Soc + Discrétion (Rurale) 65 → 4 octrois). */
  grant: SwapGrant[];
  /** Catégorie de Taille APPLIQUÉE par la même variante (posée dans les deux sens : Grand Loup
   *  Moyenne→Grande, Vouivre Énorme→Grande) — remplace celle du bestiaire, aucune formule d'écart. */
  size?: SizeCategory;
  /** Blessures FINALES imposées par la variante (Vouivre : « réduire ses B à 42 ») — remplace la
   *  valeur imprimée ET la formule par Taille (LDB 85), aucune des deux ne s'applique plus. */
  wounds?: number;
}
export type OptionalNote = OptionalWildcard | OptionalSwap;
/** Élément de la liste `optionals` (LDB 76) : Trait facultatif ordinaire posé OU note composée. */
export type OptionalEntry = TraitPose | OptionalNote;

/** Une entrée d'`optionals` est-elle une NOTE composée (vs un Trait posé ordinaire) ? */
export const isOptionalNote = (e: OptionalEntry): e is OptionalNote =>
  typeof (e as OptionalNote).note === 'string';

/** Nom canonique seul (raccourci pour les lookups Codex/registre). */
export const statName = (raw: string): string => parseStatEntry(raw).name;

/** Décompose un libellé concret « Nom (Spec) » → { name, spec } via le parseur unifié (compte/
 *  bonus/indice/portée éventuels écartés). Source UNIQUE du split nom↔spécialisation (carrières,
 *  compétences/talents de statbloc). */
export function splitLabel(raw: string): { name: string; spec?: string } {
  const p = parseStatEntry(raw);
  return p.arg ? { name: p.name, spec: p.arg } : { name: p.name };
}
