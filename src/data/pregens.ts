/**
 * Personnages pré-tirés — construits par `createHero` (`src/engine/character.ts`), le MÊME cœur
 * partagé que le créateur joueur : espèce/carrière/nom/motivation/talent de carrière/sorts mineurs/
 * arme au choix sont AUTHORÉS (#421) ; tout le reste (Caractéristiques, Compétences, Talents
 * aléatoires, équipement de classe+carrière, Bénédictions du Talent Béni…) suit la recette RAW
 * normale, seedée pour la reproductibilité (zéro savescum). La Richesse initiale (LDB 05 l.578-583,
 * `rollInitialWealth`) n'est PAS produite par `createHero` (créditée au groupe par l'appelant) —
 * exposée séparément par `makePregensWithWealth`.
 *
 * `src/data` ne doit JAMAIS importer `src/ui` (inversion de couche, #421 REDO) : ce module ne
 * consomme QUE des primitives `engine` (`createHero`, `rollInitialWealth`, `pettySpellQuotaFor`,
 * `fillPettySpellsToQuota`), jamais `ui/creator`. `Appearance` (`gameIso/rig/appearance`) n'est
 * importé qu'en TYPE (élidé à la compilation : la police de pureté d'`eslint.config.js` le laisse
 * passer ici comme elle laisse passer la même réf inline dans `engine/types.ts`) —
 * `rigSpeciesId` (résolveur d'id RIG) est lui une primitive DATA (`./index`), pas gameIso.
 *
 * Les DÉFINITIONS (espèce/carrière/seed/talent/sorts…) vivent dans `pregens.json` (éditable, comme
 * `creatures.json`) ; ce module = type + chargement + fabrique. Ajouter un pré-tiré = éditer le
 * JSON, jamais ce fichier.
 */
import { Combatant } from '../engine/types';
import { Money } from '../engine/money';
import { makeRNG } from '../engine/dice';
import { createHero, type ChoixDeCreation } from '../engine/character';
import { rollInitialWealth, parseStatus, pettySpellQuotaFor, fillPettySpellsToQuota } from '../engine/creation';
import { levelsForCareer, pregens, rigSpeciesId, trappingRefLabel } from './index';
import type { Appearance } from '../gameIso/rig/appearance';
import type { Sexe } from './schemas/grammaire/valeurs';

export interface PregenDef extends Pick<ChoixDeCreation, 'careerTalent' | 'pettySpells'> {
  /** `id` STABLE app-owned (kebab-case) — identité de navigation/Codex, découplée du `label`. */
  id: string;
  type: 'pregens';
  label: string;
  /** `id` STABLE de l'espèce (`SpeciesData.id`). */
  species: string;
  /** `id` STABLE de la carrière (`CareerData.id`). */
  career: string;
  seed: number;
  motivation: string;
  /** Ambitions à court / long terme (LDB 05 l.730-736) — flavor APP-OWNED du pré-tiré, atterrit dans `details`. */
  ambitionShort?: string;
  ambitionLong?: string;
  /** Âge (LDB 05 étape 6) — sinon laissé indéfini (pas de tirage moteur côté pré-tiré). */
  age?: number;
  // `pettySpells` : complétés jusqu'au quota (LDB 10 l.714) par `fillPettySpellsToQuota`.
  /** Id de trapping (catalogue) résolvant l'emplacement `{wildcard:'arme'}` de la carrière
   *  (construct de choix d'équipement, `resolveTrappingChoices`) — absent tant qu'aucun des 8
   *  pré-tirés n'a un tel slot au Niveau 1 (vérifié #421 : aucune entrée de `careerLevels.json` au
   *  Niveau 1 des carrières actuelles n'en porte). */
  weaponChoice?: string;
  /** Sexe visuel (cosmétique ; aucune incidence de règles). Défaut 'M'. */
  sex?: Sexe;
  /** Morphologie 0..1 (cosmétique). Défaut 0.5. */
  build?: number;
}

/** Construit le héros d'un pré-tiré via `createHero` (identité authorée posée en `opts`), puis
 *  complète les Sorts de Magie mineure au quota BFM (`pettySpellQuotaFor`/`fillPettySpellsToQuota`,
 *  engine) — APPEND uniquement : les Bénédictions du Talent Béni, déjà octroyées par
 *  `applyTalentAcquisition` dans `createHero`, ne sont JAMAIS écrasées. */
function buildPregenHero(d: PregenDef): Combatant {
  const authoredIds = d.pettySpells ?? [];
  const hero = createHero({
    speciesId: d.species,
    careerId: d.career,
    label: d.label,
    id: `pregen-${d.seed}`,
    careerTalent: d.careerTalent,
    pettySpells: authoredIds,
    trappingChoices: d.weaponChoice ? { [trappingRefLabel({ wildcard: 'arme' })]: d.weaponChoice } : undefined,
    details: {
      age: d.age,
      ambitionShort: d.ambitionShort,
      ambitionLong: d.ambitionLong,
    },
    motivation: d.motivation,
    rng: makeRNG(d.seed),
  });
  // appearance.species = id d'espèce RIG (slug, via rigSpeciesId — primitive DATA) ≠ Combatant.species
  // (id rules). sex/build AUTHORÉS (PregenDef, défauts M/0.5) ; seed = d.seed (le seed STABLE du
  // pré-tiré) pour un rendu reproductible.
  const appearance: Appearance = {
    species: rigSpeciesId(d.species),
    sex: d.sex ?? 'M',
    build: d.build ?? 0.5,
    seed: d.seed,
  };
  hero.appearance = appearance;
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

/** Fabrique tous les pré-tirés + leur Richesse initiale (LDB 05 l.578, tirée par
 *  `rollInitialWealth` — même formule que le créateur, seedée sur un dérivé du seed du pré-tiré,
 *  décorrélé de la consommation RNG de `createHero`). Résilient : un pré-tiré fautif est ignoré
 *  plutôt que de faire planter l'écran. */
export function makePregensWithWealth(): { hero: Combatant; wealth: Money }[] {
  const out: { hero: Combatant; wealth: Money }[] = [];
  for (const d of pregens) {
    try {
      const hero = buildPregenHero(d);
      const level = levelsForCareer(d.career).find((l) => l.level === 1);
      if (!level) throw new Error(`Pré-tiré « ${d.label} » : aucun Niveau 1 pour la carrière « ${d.career} ».`);
      const status = parseStatus(level.status);
      const wealth = rollInitialWealth(status, makeRNG(d.seed ^ 0x5eed));
      out.push({ hero, wealth });
    } catch (e) {
      console.error(`Pré-tiré « ${d.label} » ignoré :`, e);
    }
  }
  return out;
}

/** Les pré-tirés SANS leur Richesse — la plupart des consommateurs (scénarios, tests de combat) ne
 *  s'en soucient pas ; `PartyScreen` (recrutement, créditant la bourse) utilise `makePregensWithWealth`. */
export function makePregens(): Combatant[] {
  return makePregensWithWealth().map((e) => e.hero);
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
 * Marchandage/Évaluation n'existent sur aucune carrière martiale de Niveau 1 : `partyBest` retombe
 * sur la Caractéristique brute (Soc/Int) — le marchand reste pleinement jouable (le Sorcier, Int
 * élevée, évalue le butin magique).
 */
/**
 * Sélection d'un groupe de scénario — API UNIQUE et intention-révélante. Remplace les patterns fragiles
 * accrétés (`makePregens().slice(0, n)` qui dépend de l'ordre du JSON et donne le groupe SANS arme à
 * distance dénoncé ci-dessus ; `find(p => p.name...)` par nom ; indexation ad hoc de `makePregens()`).
 * Les pré-tirés portent un seed STABLE (`id = pregen-<seed>`) ; on les nomme par les clés lisibles de
 * `PREGEN` (une par carrière du roster). `pregenParty(...)` construit le roster UNE fois.
 */
export const PREGEN = {
  soldat: 101, tueur: 202, sorcier: 707, pretre: 808,
  chasseur: 303, apothicaire: 404, voleur: 505, repurgateur: 606,
} as const;

/** Groupe EXPLICITE par seeds (ordre = ordre des arguments) — la façon CANONIQUE de composer une équipe
 *  de scénario. Ex. `pregenParty(PREGEN.soldat, PREGEN.chasseur)`. Lève si un seed est inconnu (plutôt
 *  qu'un `undefined` silencieux d'un `find`/`slice` raté). */
export function pregenParty(...seeds: number[]): Combatant[] {
  const all = makePregens();
  return seeds.map((s) => {
    const h = all.find((p) => p.id === `pregen-${s}`);
    if (!h) throw new Error(`Pré-tiré pregen-${s} introuvable (PREGEN/pregens.json)`);
    return h;
  });
}

/** UN pré-tiré par son seed (copie fraîche). Ex. `pregen(PREGEN.soldat)`. */
export function pregen(seed: number): Combatant {
  return pregenParty(seed)[0];
}

/** Équipe « showcase » de l'Arène — les 4 piliers (cf. ci-dessus) couvrant un max de règles distinctes. */
export function makeShowcaseParty(): Combatant[] {
  return pregenParty(PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur);
}
