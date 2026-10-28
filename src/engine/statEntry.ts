/**
 * Parseur CANONIQUE et UNIQUE des chaînes de statbloc WFRP (traits, compétences, talents…).
 *
 * Le format des données est hétérogène (héritage des livres) : un même token peut être un
 * compte en tête (« 8 Tentacules »), un bonus signé (« +7 »), un Indice/valeur de fin
 * (« Vol 100 », « Démoniaque 8+ », « Chevaucher 58 »), une parenthèse de spécialisation/type/
 * cible (« (Cheval) », « (Feu) », « (Tiléens) ») ou de portée (« (50) »). Cette fonction les
 * démêle UNE fois pour TOUT le code (combat ET Codex) — fini les regex recopiées par consommateur.
 */
import type { CharKey, Difficulty, EffectSource } from './types';
import type { SizeCategory } from './size';
import type { TraitPose } from '../data/schemas/grammaire/reference';
import { hashSeed, makeRNG } from './dice';
import { lirePlage, type ParLocalisation, type Plage } from './classementDeTrait';
import type { FormuleSansTirage } from './ops';

export interface StatEntry {
  /** Nom canonique (base), sans compte/bonus/indice/parenthèse : « Tentacules », « Arme »,
   *  « À distance », « Chevaucher », « Magie des Arcanes ». Clé de lookup registre/données. */
  name: string;
  /** Parenthèse NON numérique : spécialisation (« Cheval »), type (« Feu »), cible (« Tiléens »). */
  arg?: string;
  /** Parenthèses NON numériques suivantes, dans l'ordre : « Arme (Crocs) +10 (Infecté) » → `['Infecté']`. */
  suites?: string[];
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

  // 2) Parenthèses de premier niveau (une parenthèse peut en contenir : « Venin (Complexe) ») : purement
  //    numérique → portée, sinon spec/type/cible, puis les suivantes. Elles PEUVENT coexister
  //    (« À distance (Arbalète) +9 (60) ») ; la 1re de chaque sorte l'emporte.
  const { groupes, reste } = parenthesesDePremierNiveau(s);
  for (const inside of groupes) {
    const plage = lirePlage(inside);
    if (/^\d+$/.test(inside)) { if (out.range == null) out.range = parseInt(inside, 10); }
    else if (plage) { if (out.plage == null) out.plage = plage; }
    else if (inside && out.arg == null) out.arg = inside;
    else if (inside) out.suites = [...(out.suites ?? []), inside];
  }
  s = reste;

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

/** Les parenthèses de PREMIER niveau d'un texte, rognées, et le texte sans elles. */
function parenthesesDePremierNiveau(texte: string): { groupes: string[]; reste: string } {
  const groupes: string[] = [];
  let reste = '';
  let profondeur = 0;
  let debut = 0;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === '(') {
      if (profondeur === 0) debut = i + 1;
      profondeur++;
    } else if (c === ')' && profondeur > 0) {
      profondeur--;
      if (profondeur === 0) {
        groupes.push(texte.slice(debut, i).trim());
        reste += ' ';
      }
    } else if (profondeur === 0) reste += c;
  }
  return { groupes, reste: reste.replace(/\s+/g, ' ').trim() };
}

/** Ce qui n'a plus de fourchette : la pose tirée (`PoseTiree`) et l'instance résolue (`TraitInstance`). */
interface SansFourchette {
  plage?: never;
}

/** Trait posé dont la fourchette est tirée et l'Indice évalué : ce que `resoudreTrait` résout. Une `TraitPose`
 *  n'y passe que par `traitsDuPorteur`, ou quand sa forme littérale n'a ni fourchette ni formule. */
export type PoseTiree = Omit<TraitPose, 'plage' | 'value' | 'confere'> & SansFourchette & { value?: number; confere?: readonly PoseTiree[] };

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
  /** Difficulté des Tests qui éliminent l'État que le Trait inflige. MDG 16 l.226 ; LDB 16 l.70 */
  difficulte?: Difficulty;
  /** Traits conférés aux touches de ce Trait d'attaque, lus par l'arme qui en naît. ZI 03 l.75, l.77 */
  confere?: TraitInstance[];
}

/**
 * Valeur d'une fourchette pour son porteur, tirée entre ses bornes incluses sur une graine stable (le porteur,
 * l'id du Trait, son rang parmi ses homonymes). LDB 76 l.45 ; LDB 77 l.108 ; ZI 13 l.31 ; ZI 04 l.228 ; #1463.
 */
function tirerLaFourchette(plage: Plage, graine: string): number {
  return makeRNG(hashSeed(`fourchette:${graine}`)).int(plage.min, plage.max);
}

/** Le porteur des Traits que `traitsDuPorteur` résout : son id (graine des fourchettes) et la lecture de
 *  ses Indices formulés sur leur référent (`indiceSurLeProfil`, `engine/formule.ts`). */
export interface PorteurDeTraits {
  id: string;
  indice: (f: FormuleSansTirage) => number;
}

/** Les poses tirées pour `porteur` : fourchette tirée sur la graine `graine:id#rang`, Indice formulé évalué,
 *  Traits conférés tirés à leur tour sous la graine de l'attaque qui les confère. */
function poserPour(poses: readonly TraitPose[], porteur: PorteurDeTraits, graine: string, dejaPortes: TraitsDesignes): PoseTiree[] {
  const rangs = new Map<string, number>();
  for (const t of dejaPortes) rangs.set(t.id, (rangs.get(t.id) ?? 0) + 1);
  return poses.map(({ plage, value, confere, ...pose }) => {
    const rang = rangs.get(pose.id) ?? 0;
    rangs.set(pose.id, rang + 1);
    const ici = `${graine}:${pose.id}#${rang}`;
    const indice = plage ? tirerLaFourchette(plage, ici) : value === undefined ? undefined : porteur.indice(value);
    return {
      ...pose,
      ...(indice === undefined ? {} : { value: indice }),
      ...(confere ? { confere: poserPour(confere, porteur, ici, []) } : {}),
    };
  });
}

/**
 * La SEULE entrée d'un Trait posé (`TraitPose`) vers l'instance de jeu : chaque fourchette est tirée pour
 * le porteur, chaque Indice formulé lu sur son référent, puis la pose est résolue. `dejaPortes` = les Traits
 * que le porteur a déjà : le rang d'un homonyme part d'eux, et un Trait accordé ne retire pas la fourchette
 * de celui qu'il a déjà. `src` = la provenance d'un Trait ACCORDÉ (`resoudreTrait`).
 */
export function traitsDuPorteur(poses: readonly TraitPose[], porteur: PorteurDeTraits, dejaPortes: TraitsDesignes = [], { src }: { src?: EffectSource } = {}): TraitInstance[] {
  return poserPour(poses, porteur, porteur.id, dejaPortes).map((pose) => resoudreTrait(pose, { src }));
}

/**
 * Résolution d'une pose tirée en instance de jeu : la provenance de livre (`source`, `alsoIn`, `maison`)
 * reste à la donnée, aux Traits conférés comme au Trait ; `src` est la provenance d'un Trait ACCORDÉ. PURE.
 */
export function resoudreTrait(pose: PoseTiree, { src }: { src?: EffectSource } = {}): TraitInstance {
  const { source: _source, alsoIn: _alsoIn, maison: _maison, confere, ...jeu } = pose;
  return {
    ...jeu,
    ...(confere ? { confere: confere.map((c) => resoudreTrait(c)) } : {}),
    ...(src ? { src } : {}),
  };
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
