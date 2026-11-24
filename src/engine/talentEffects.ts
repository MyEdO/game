/**
 * Effets des Talents qui influencent la création / les attributs — PILOTÉS PAR LES DONNÉES :
 * chaque talent de talents.json porte `passive: OpPassive[]` (charMod/moveMod/attrMod/grantCareerSkill/
 * grantCareerTalent…), posés par l'extraction des livres ; un supplément qui ajoute un talent étiqueté
 * pareil est couvert sans code. Plus AUCUN champ bespoke (`addCharacteristic`/`addSkill`/`addTalent`
 * ont été éliminés au profit du vocabulaire `GameOp` unifié).
 *
 * Sémantique des passifs de Caractéristique (clés STABLES, ≠ libellés — multilangue ; descriptions LDB 10) :
 *  - `charMod{characteristic,mod:5}` : « Vous gagnez un bonus permanent de +5 à votre Caractéristique X de
 *    départ (ne compte pas comme des Augmentations) » — Guerrier né, Tireur de précision, Très fort,
 *    Très résistant, Vivacité, Réflexes foudroyants, Doigts de fée, Perspicace, Imperturbable, Affable ;
 *  - `attrMod{attr:'wounds',mod:{bonusOf:'endurance'}}` (Dur à cuire) : « autant de Points de Blessure
 *    supplémentaires que votre Bonus d'Endurance » — recalculé si le BE augmente, par acquisition ;
 *  - `attrMod{attr:'fortune',mod:1}` (Chanceux) : « maximum de Points de Chance = Points de Destin + niveaux » ;
 *  - `attrMod{attr:'resolve',mod:1}` (Obstiné) : « Ajoutez votre niveau au maximum de votre réserve » ;
 *  - `moveMod{mod:1}` (Véloce) : « Vous gagnez +1 à votre Attribut de Mouvement » ;
 *  - Âme pure (seuil de Corruption +niveau) : via `combat.corruptionThreshold` (combatFeatures/talents,
 *    `talentCorruptionThreshold`), PAS un `addCharacteristic`. → plus AUCUN talent ne porte `addCharacteristic`.
 *
 * `grantCareerSkill` (op) : « Ajoutez la Compétence X à n'importe quelle Carrière que vous entamez.
 * Si la Compétence est déjà incluse dans votre Carrière, vous pouvez à la place acheter la Compétence
 * pour 5 PX de moins par Augmentation » — Maître artisan (Métier), Oreille absolue
 * (Divertissement (Chant)), Sorcier ! (Langue (Magick)), Voyageur aguerri (Savoir (Région)),
 * Artiste (Art). Son analogue `grantCareerTalent` ajoute un TALENT à toute carrière (Flagellant → Frénésie).
 *
 * Costaud (Encombrement) est déjà appliqué par items.maxEncumbrance ; Petit/Massif (Taille)
 * par l'espèce. Les autres talents (combat, social…) sont hors périmètre.
 */
import type { Combatant, CharKey, TalentInstance } from './types';
import { findTalentById, findTraitById, blessingsOf } from '../data';
import { modeleDe } from './modeleDeProgression';
import { wildcardSpecs, inCareerStatus, type CareerSlot, type InCareerStatus } from './careerSlots';
import type { RefASpecialisation, RefDesignee } from '../data/schemas/grammaire/ref';
import { passiveMods, sommeAttrMods } from './trauma';
import { memeSpecialisation } from '../data/schemas/grammaire/ref';

export {
  baseWithTalents,
  effectiveTalents,
  talentPassiveMods,
  traitGrantedTalents,
  traitsConferes,
  type PorteurDeTalents,
} from './talentsPossedes';

/**
 * Caractéristique « +5 de départ » conférée par un talent (clé courte), sinon null, par `id`.
 * Lit le premier `charMod{characteristic, mod}` dont `characteristic` est une CharKey dans `passive` du talent.
 */
export function talentCharBonusById(talentId: string): CharKey | null {
  for (const op of findTalentById(talentId)?.passive ?? []) {
    if (op.op === 'charMod') return op.characteristic;
  }
  return null;
}

/**
 * Applique l'effet d'acquisition d'un Talent (création OU achat PX) — mute le héros. Référence
 * STRUCTURÉE : `talentId` STABLE + `spec` concret (cult de « Béni » : « Sigmar »…).
 * Le +5 Caractéristique et le +1 Mouvement sont des PASSIFS CONTINUS de `passive: OpPassive[]` (charMod/moveMod),
 * lus par le collecteur `passiveMods`.
 * Les Blessures suivent le Talent à la réconciliation (`blessuresReconciliees`) ; Chance et Détermination
 * sont recalculées par l'appelant (fortuneMax / resolveMax).
 */
export function applyTalentAcquisition(hero: Combatant, talentId: string, spec?: string): void {
  // LDB 10 l.105-109 ; LDB 41 l.5
  if (findTalentById(talentId)?.specsSource === 'cultBlessings' && spec) {
    const six = blessingsOf(spec).filter((b) => !(hero.spells ?? []).includes(b));
    if (six.length) hero.spells = [...(hero.spells ?? []), ...six];
  }
}

/** `applyTalentAcquisition` de chaque Talent du porteur, une fois par acquisition (`times`) : assemblage
 *  d'un héros (`assemblerLeHeros`) comme spawn d'une créature ou d'un statbloc (`noyau/monde/spawn.ts`). */
export function appliquerAcquisitions(porteur: Combatant): void {
  for (const t of porteur.talents ?? []) for (let i = 0; i < (t.times ?? 1); i++) applyTalentAcquisition(porteur, t.talentId, t.spec);
}

/** Σ des `attrMods{attr}` d'effets ACTIFS (op `attrMod` exécutée — buff temporaire, ext. consommables) —
 *  s'ajoute aux `attrMod` passifs dans les maxima dérivés, expire avec l'effet porteur. */
function activeAttrSum(hero: Combatant, attr: 'fortune' | 'resolve'): number {
  return (hero.activeEffects ?? []).reduce((s, e) => s + (e.attrMods?.[attr] ?? 0), 0);
}

type Reserve = 'fortune' | 'resolve';

/** Champ de la réserve que gonfle un `attrMod{attr}` de `hero` (CRB 116 l.36). */
const champDeLaReserve = (hero: Combatant, attr: Reserve): Reserve => (attr === 'fortune' ? 'fortune' : modeleDe(hero).reserves.determination);

/** Maximum de la réserve `champ` : sa base (Fortune : `baseDeLaFortune` ; Détermination : la Résilience), plus les
 *  `attrMod` passifs de tout porteur (Chanceux, Obstiné, LDB 10) et les effets actifs qui la gonflent. */
function maxDeLaReserve(hero: Combatant, champ: Reserve): number {
  const base = champ === 'fortune' ? (hero[modeleDe(hero).reserves.baseDeLaFortune] ?? 0) : resilienceDe(hero);
  return (['fortune', 'resolve'] as const)
    .filter((attr) => champDeLaReserve(hero, attr) === champ)
    .reduce((s, attr) => s + sommeAttrMods(passiveMods(hero), attr, hero) + activeAttrSum(hero, attr), base);
}

/** Maximum de Points de Chance (de Fortune). LDB 17 l.41 ; LDB 10 l.160 ; CRB 116 l.36 */
export function fortuneMax(hero: Combatant): number {
  return maxDeLaReserve(hero, 'fortune');
}

/** Maximum de Détermination. LDB 17 l.53 ; CRB 116 l.36 */
export function resolveMax(hero: Combatant): number {
  return maxDeLaReserve(hero, modeleDe(hero).reserves.determination);
}

/** Résilience de `hero`. LDB 17 l.49-53 ; CRB 116 l.36 */
export function resilienceDe(hero: Combatant): number {
  return hero[modeleDe(hero).reserves.resilience] ?? 0;
}

/** Détermination de `hero`. LDB 17 l.53 ; CRB 116 l.36 */
export function determinationDe(hero: Combatant): number {
  return hero[modeleDe(hero).reserves.determination] ?? 0;
}

/** Pose la Détermination de `hero` à `points`. LDB 17 l.55-61, l.81 ; CRB 116 l.36 */
export function poserLaDetermination(hero: Combatant, points: number): void {
  hero[modeleDe(hero).reserves.determination] = points;
}

/** Perte permanente d'un Point de Résilience. LDB 17 l.7, l.63-68 ; CRB 116 l.36 */
export function perdreUnPointDeResilience(hero: Combatant): void {
  const champ = modeleDe(hero).reserves.perteDeResilience;
  hero[champ] = (hero[champ] ?? 0) - 1;
}

/** La Résilience et la Détermination PROPRES de `hero` à afficher, `null` pour celle qui se lit sur le Destin ou la
 *  Fortune. CRB 116 l.36 */
export function reservesPropres(hero: Combatant): { resilience: number | null; determination: number | null } {
  const { resilience, determination } = modeleDe(hero).reserves;
  return {
    resilience: resilience === 'resilience' ? (hero.resilience ?? null) : null,
    determination: determination === 'resolve' ? (hero.resolve ?? null) : null,
  };
}

/** Maximum de chaque réserve de `hero`, par champ. */
export function maximaDesReserves(hero: Combatant): Partial<Record<Reserve, number>> {
  return { fortune: fortuneMax(hero), [modeleDe(hero).reserves.determination]: resolveMax(hero) };
}

/** Reporte sur chaque réserve de `hero` la hausse de son maximum depuis `avant` (`maximaDesReserves` pris avant
 *  l'achat) : Chanceux, Obstiné, LDB 10 l.160. */
export function reporterLaHausseDesMaxima(hero: Combatant, avant: Partial<Record<Reserve, number>>): void {
  for (const [champ, max] of Object.entries(maximaDesReserves(hero)) as [Reserve, number][]) {
    hero[champ] = (hero[champ] ?? 0) + max - (avant[champ] ?? 0);
  }
}


/**
 * Compétences que le Talent `t` ajoute aux listes de carrière (« Ajoutez X à n'importe quelle Carrière que vous
 * entamez », LDB 10 l.70, l.745, l.891). La spec choisie à l'acquisition du talent (« Maître artisan (Forgeron) »)
 * se reporte sur la compétence ajoutée (« Métier (Forgeron) ») ; sans spec à reporter, l'emplacement `choix` de l'op
 * reste ouvert (joker de groupe).
 */
export function competencesAjouteesPar(t: Pick<TalentInstance, 'talentId' | 'spec'>): RefASpecialisation[] {
  const out: RefASpecialisation[] = [];
  for (const op of findTalentById(t.talentId)?.passive ?? []) {
    if (op.op !== 'grantCareerSkill') continue;
    // Emplacement `choix` de l'op DÉSIGNÉ par la spec concrète du talent (Maître artisan (Forgeron)).
    if (t.spec && op.skill.choix != null) out.push({ id: op.skill.id, spec: t.spec });
    else if (op.skill.choix != null) out.push({ id: op.skill.id, choix: op.skill.choix });
    else out.push({ id: op.skill.id, spec: op.skill.spec });
  }
  return out;
}

/** Compétences ajoutées aux listes de carrière par les talents possédés (`competencesAjouteesPar`). */
export function careerSkillAdditions(hero: Combatant): RefASpecialisation[] {
  return hero.talents.flatMap(competencesAjouteesPar);
}

/** Talents que le Talent `talentId` ajoute aux listes de carrière (« Le Talent X est ajouté à la liste des Talents
 *  de n'importe laquelle de vos Carrière », LDB 10 l.467 — Flagellant → Frénésie). */
export function talentsAjoutesPar(talentId: string): RefASpecialisation[] {
  const out: RefASpecialisation[] = [];
  for (const op of findTalentById(talentId)?.passive ?? []) if (op.op === 'grantCareerTalent') out.push(op.talent);
  return out;
}

/**
 * Talents ajoutés aux listes de carrière par les talents possédés (`talentsAjoutesPar`) OU par un Trait porté
 * (« peut acheter les Talents suivants comme s'ils étaient des Augmentations de Carrière au coût en PX normal »,
 * MDG 07 l.252 — Marque de Khorne) : l'op `grantCareerTalent` (data-driven, par id) sur les deux sources.
 */
export function careerTalentAdditions(hero: Combatant): RefASpecialisation[] {
  const out = hero.talents.flatMap((t) => talentsAjoutesPar(t.talentId));
  for (const tr of hero.traits ?? []) {
    for (const op of findTraitById(tr.id)?.passive ?? []) if (op.op === 'grantCareerTalent') out.push(op.talent);
  }
  return out;
}

/** Ajouts de carrière DÉPLIÉS en références désignées : un ajout à `choix` couvre son pool (LDB 10 l.467/745 ;
 *  EDOC 13 l.524). Lecture UNIQUE des ajouts, Compétences (`competenceEnCarriere`) comme Talents
 *  (`talentsAjoutesALaCarriere`). */
export function deplierAjouts(ajouts: readonly RefASpecialisation[], kind: 'skill' | 'talent'): RefDesignee[] {
  return ajouts.flatMap((a): RefDesignee[] =>
    a.choix == null
      ? [{ id: a.id, ...(a.spec != null ? { spec: a.spec } : {}) }]
      : wildcardSpecs({ optionId: a.id, ...(Array.isArray(a.choix) ? { specOptions: a.choix } : {}) }, kind).map((spec) => ({ id: a.id, spec })),
  );
}

/** L'ajout désigne-t-il exactement (id, spec) ? */
function ajoutCouvre(ajouts: RefDesignee[], id: string, spec: string | undefined): boolean {
  return ajouts.some((a) => a.id === id && memeSpecialisation(a.spec, spec));
}

/** Statut « en carrière » d'une Compétence (LDB 07 l.76 ; LDB 10 l.745) : un emplacement cumulé la couvre
 *  (`inCareerStatus`), sinon un ajout de carrière déplié (`deplierAjouts`) → `'ajout'`. `remise` : LDB 10 l.745. */
export function competenceEnCarriere(
  hero: Combatant,
  slots: CareerSlot[],
  designations: Record<string, string>,
  skillId: string,
  spec: string | undefined,
): { statut: InCareerStatus | 'ajout'; remise: number } {
  const statut = inCareerStatus(slots, designations, skillId, spec);
  const ajoutee = ajoutCouvre(deplierAjouts(careerSkillAdditions(hero), 'skill'), skillId, spec);
  return { statut: statut ?? (ajoutee ? 'ajout' : null), remise: ajoutee && statut != null ? 5 : 0 };
}

/** Talents AJOUTÉS à la carrière, dépliés (`deplierAjouts`). Source UNIQUE des rangées d'avancement et de
 *  l'achat (`talentEnCarriere`). */
export function talentsAjoutesALaCarriere(hero: Combatant): RefDesignee[] {
  return deplierAjouts(careerTalentAdditions(hero), 'talent');
}

/** Statut « en carrière » d'un Talent (LDB 07 l.103) : un emplacement du niveau courant le couvre
 *  (`inCareerStatus`), sinon un ajout de carrière (`talentsAjoutesALaCarriere`) → `'ajout'`. */
export function talentEnCarriere(
  hero: Combatant,
  slots: CareerSlot[],
  designations: Record<string, string>,
  talentId: string,
  spec: string | undefined,
  allSlotsForUniqueness: CareerSlot[] = slots,
): InCareerStatus | 'ajout' {
  const statut = inCareerStatus(slots, designations, talentId, spec, allSlotsForUniqueness);
  if (statut) return statut;
  return ajoutCouvre(talentsAjoutesALaCarriere(hero), talentId, spec) ? 'ajout' : null;
}
