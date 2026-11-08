/**
 * Personnages pré-tirés — construits par `createHero` (`src/engine/character.ts`), le MÊME cœur
 * partagé que le créateur joueur : espèce/carrière/nom/motivation et les choix de création
 * (`ChoixDeCreation`) sont AUTHORÉS (#421) ; tout choix absent (Caractéristiques, Compétences, Talents
 * aléatoires, équipement de classe+carrière, Bénédictions du Talent Béni…) suit la recette RAW
 * normale, seedée pour la reproductibilité (zéro savescum). La Richesse initiale (LDB 05 l.578-583,
 * `rollInitialWealth`) n'est PAS produite par `createHero` (créditée au groupe par l'appelant) —
 * exposée séparément par `makePregensWithWealth`.
 *
 * `src/data` n'importe JAMAIS une couche qui la consomme (inversion de couche, #421 REDO) : ce module ne
 * consomme QUE des primitives `engine` (`createHero`, `rollInitialWealth`, `pettySpellQuotaFor`,
 * `fillPettySpellsToQuota`).
 *
 * Les DÉFINITIONS (espèce/carrière/seed/talent/sorts…) vivent dans `pregens.json` (éditable, comme
 * `creatures.json`) ; ce module = type + chargement + fabrique. Ajouter un pré-tiré = éditer le
 * JSON, jamais ce fichier.
 */
import { Combatant } from '../engine/types';
import { statutDeDonnee, type Money } from '../engine/money';
import { createHero, fluxDeCreation, type ChoixDeCreation } from '../engine/character';
import type { FabriqueDId } from '../engine/fabriqueDId';
import type { IdDeHerosDuRoster } from '../lib/idDeHerosDuRoster';
import type { ChoixDesPretires } from './schemas/defs/pregens';
import { rollInitialWealth, pettySpellQuotaFor, fillPettySpellsToQuota } from '../engine/creation';
import { levelsForCareer, pregens } from './index';
import type { Sexe } from './schemas/grammaire/valeurs';

export interface PregenDef extends Pick<ChoixDeCreation, ChoixDesPretires> {
  /** `id` STABLE app-owned (kebab-case) — identité de navigation/Codex, découplée du `label`. */
  id: string;
  type: 'pregens';
  label: string;
  /** Espèce (`SpeciesData.id`). */
  species: { id: string };
  /** Carrière (`CareerData.id`). */
  career: { id: string };
  motivation: string;
  /** Ambitions à court / long terme (LDB 05 l.730-736) — flavor APP-OWNED du pré-tiré, atterrit dans `details`. */
  ambitionShort?: string;
  ambitionLong?: string;
  /** Âge (LDB 05 étape 6) — sinon laissé indéfini (pas de tirage moteur côté pré-tiré). */
  age?: number;
  /** Sexe visuel (cosmétique ; aucune incidence de règles). Défaut 'M'. */
  sex?: Sexe;
}

/** L'id STABLE du héros du pré-tiré de seed `seed`. */
export const idDuPretire = (seed: number): IdDeHerosDuRoster => `pregen-${seed}` as IdDeHerosDuRoster;

/** Construit le héros d'un pré-tiré via `createHero` (identité authorée posée en `opts`), puis
 *  complète les Sorts de Magie mineure au quota BFM (`pettySpellQuotaFor`/`fillPettySpellsToQuota`,
 *  engine) — APPEND uniquement : les Bénédictions du Talent Béni, déjà octroyées par
 *  `applyTalentAcquisition` dans `createHero`, ne sont JAMAIS écrasées. */
function buildPregenHero(d: PregenDef, idNeuf: FabriqueDId): Combatant {
  const { id: _id, type: _type, label, species, career, motivation, ambitionShort, ambitionLong, age, sex, ...choix } = d;
  const authoredIds = choix.pettySpells ?? [];
  const hero = createHero({
    ...choix,
    speciesId: species.id,
    careerId: career.id,
    label,
    id: idDuPretire(d.seed),
    idNeuf,
    details: { age, ambitionShort, ambitionLong },
    motivation,
    apparence: { sex: sex ?? 'M' },
  });
  const quota = pettySpellQuotaFor(hero);
  if (!quota) {
    if (authoredIds.length) throw new Error(`Pré-tiré « ${d.label} » : sorts de Magie mineure listés sans le Talent (LDB 10 l.714).`);
    return hero;
  }
  if (authoredIds.length > quota) {
    throw new Error(`Pré-tiré « ${d.label} » : ${authoredIds.length} sorts mineurs excèdent le quota BFM (${quota}, LDB 10 l.714).`);
  }
  const complement = fillPettySpellsToQuota(authoredIds, quota).filter((id) => !(hero.spells ?? []).includes(id));
  hero.spells = [...(hero.spells ?? []), ...complement];
  return hero;
}

/** Le pré-tiré `d` et sa Richesse initiale (LDB 05 l.578, tirée par `rollInitialWealth` — même formule et même flux,
 *  `fluxDeCreation(seed, 'bourse')`, que le créateur). */
export function pretireAvecRichesse(d: PregenDef, idNeuf: FabriqueDId): { id: string; hero: Combatant; wealth: Money } {
  const hero = buildPregenHero(d, idNeuf);
  const level = levelsForCareer(d.career.id).find((l) => l.level === 1);
  if (!level) throw new Error(`Pré-tiré « ${d.label} » : aucun Niveau 1 pour la carrière « ${d.career.id} ».`);
  return { id: d.id, hero, wealth: rollInitialWealth(statutDeDonnee(level.status), fluxDeCreation(d.seed, 'bourse')).montant };
}

/** Fabrique tous les pré-tirés + leur Richesse initiale (`pretireAvecRichesse`). Résilient : un pré-tiré fautif est
 *  ignoré plutôt que de faire planter l'écran. */
export function makePregensWithWealth(idNeuf: FabriqueDId): { id: string; hero: Combatant; wealth: Money }[] {
  const out: { id: string; hero: Combatant; wealth: Money }[] = [];
  for (const d of pregens) {
    try {
      out.push(pretireAvecRichesse(d, idNeuf));
    } catch (e) {
      console.error(`Pré-tiré « ${d.label} » ignoré :`, e);
    }
  }
  return out;
}

/** Les pré-tirés SANS leur Richesse — la plupart des consommateurs (scénarios, tests de combat) ne
 *  s'en soucient pas ; `PartyScreen` (recrutement, créditant la bourse) utilise `makePregensWithWealth`. */
export function makePregens(idNeuf: FabriqueDId): Combatant[] {
  return makePregensWithWealth(idNeuf).map((e) => e.hero);
}

/**
 * Équipe « showcase » de l'Arène — DÉLIBÉRÉMENT choisie (PAS `slice(0, 4)`, qui donnerait
 * Soldat/Tueur/Sorcier/Prêtre : aucune arme à distance + deux soigneurs redondants). Les quatre
 * piliers couvrent un maximum de règles DISTINCTES, au Niveau de Carrière 1 :
 *  • Soldat (Reiklander) — mêlée Corps à corps (Base), tanke ; achète bouclier (Parade défensive)
 *    et mailles (PA / Encombrement / pénalité de port) chez le maître d'arène.
 *  • Tueur (Nain) — Frénésie + Sans peur (immunité Peur Troll/Ogre/mort-vivant) + Guérison en
 *    combat + Maniement de deux armes ; exerce toute la couche Psychologie + soin + Détermination.
 *  • Sorcier (Reiklander) — magie arcanique offensive (Fléchette/Choc) + Incident (miscast) ET
 *    Corps à corps (Armes d'hast) avec le Bâton de combat → PROUVE en jeu la Spécialisation d'arme
 *    (Jalon 2 : Armes d'hast ≠ Base).
 *  • Chasseur (Elfe sylvain) — Projectiles (Fronde) + munitions (Pierre ×10) → bandes de portée,
 *    rechargement, Spécialisation de tir. Seul porteur d'arme à distance du groupe.
 * Marchandage/Évaluation n'existent sur aucune carrière martiale de Niveau 1 : Marchandage (Base) se
 * tente sur la Sociabilité nue ; Évaluation (Avancée) ne se tente pas sans Augmentation (LDB 09 l.30,
 * `peutTenter`).
 */
/**
 * Sélection d'un groupe de scénario — API UNIQUE et intention-révélante. Remplace les patterns fragiles
 * accrétés (`makePregens().slice(0, n)` qui dépend de l'ordre du JSON et donne le groupe SANS arme à
 * distance dénoncé ci-dessus ; `find(p => p.name...)` par nom ; indexation ad hoc de `makePregens()`).
 * Les pré-tirés portent un seed STABLE (`id = pregen-<seed>`) ; on les nomme par les clés lisibles de
 * `PREGEN` (une par carrière du roster). `pregenParty(...)` ne bâtit que les pré-tirés demandés (#2907).
 */
export const PREGEN = {
  soldat: 101, tueur: 202, sorcier: 707, pretre: 808,
  chasseur: 303, apothicaire: 404, voleur: 505, repurgateur: 606,
} as const;

/** Groupe EXPLICITE par seeds (ordre = ordre des arguments) — la façon CANONIQUE de composer une équipe
 *  de scénario. Ex. `pregenParty(idNeuf, PREGEN.soldat, PREGEN.chasseur)`. Lève si un seed est inconnu (plutôt
 *  qu'un `undefined` silencieux d'un `find`/`slice` raté). */
export function pregenParty(idNeuf: FabriqueDId, ...seeds: number[]): Combatant[] {
  return seeds.map((s) => {
    const d = pregens.find((p) => p.seed === s);
    if (!d) throw new Error(`Pré-tiré ${idDuPretire(s)} introuvable (PREGEN/pregens.json)`);
    return buildPregenHero(d, idNeuf);
  });
}

/** UN pré-tiré par son seed (copie fraîche). Ex. `pregen(idNeuf, PREGEN.soldat)`. */
export function pregen(idNeuf: FabriqueDId, seed: number): Combatant {
  return pregenParty(idNeuf, seed)[0];
}

/** Équipe « showcase » de l'Arène — les 4 piliers (cf. ci-dessus) couvrant un max de règles distinctes. */
export function makeShowcaseParty(idNeuf: FabriqueDId): Combatant[] {
  return pregenParty(idNeuf, PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur);
}
