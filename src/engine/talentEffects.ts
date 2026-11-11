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
 *  - Âme pure (seuil de Corruption +niveau) : via `combat.corruptionThreshold` (combatFeatures/dispatch,
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
import { Combatant, CHAR_KEYS, CharKey, TalentInstance, type ActiveEffect } from './types';
import { findTalentById, findTraitById, blessingsOf } from '../data';
import { wildcardSpecs, inCareerStatus, type CareerSlot, type InCareerStatus } from './careerSlots';
import type { RefASpecialisation, RefDesignee } from '../data/schemas/grammaire/ref';
import type { PassiveMod } from './ops';
import { passiveMods, sommeAttrMods } from './trauma';
import { memeSpecialisation } from '../data/schemas/grammaire/ref';
import { sourceSuspended } from './suspension';
import type { TraitInstance } from './statEntry';

/**
 * Valeur « base + bonus permanents de talents » pour une CharKey, SANS les modificateurs
 * de mutations/traumas/sorts/maladies. Utilisé par les lecteurs BRUTS hors-combat
 * (affichage de fiche, calcul PX) qui ont besoin du « vrai départ »
 * incluant les +5 de talent (désormais passifs, plus cuits dans `characteristics`).
 * Lecture LOCALE des seuls passifs de talents : `passiveCharSum` (trauma.ts) somme les `charMod` additifs
 * de tous les porteurs.
 */
export function baseWithTalents(c: Pick<Combatant, 'characteristics'> & Partial<Pick<Combatant, 'talents'>>, key: CharKey): number {
  let val = c.characteristics[key] ?? 0;
  for (const t of c.talents ?? []) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op === 'charMod' && op.characteristic === key) val += op.mod * (t.times ?? 1);
    }
  }
  return val;
}

/**
 * Caractéristique « +5 de départ » conférée par un talent (clé courte), sinon null, par `id`.
 * Lit le premier `charMod{characteristic, mod}` dont `characteristic` est une CharKey dans `passive` du talent.
 */
export function talentCharBonusById(talentId: string): CharKey | null {
  for (const op of findTalentById(talentId)?.passive ?? []) {
    if (op.op === 'charMod' && (CHAR_KEYS as readonly string[]).includes(op.characteristic)) return op.characteristic as CharKey;
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
  // Béni (Culte) — LDB 10/41 : « reçoit les SIX Bénédictions de son culte » → octroi AUTOMATIQUE
  // à l'acquisition (création + achat PX), pas un achat à 0 PX par clic. Un « Béni » au culte non
  // résolu (« Au choix ») n'octroie rien. Le signal = `specsSource:'cultBlessings'` (MÊME source que son
  // pool de cultes), jamais un drapeau `grantsCultBlessings` ni un name-match.
  if (findTalentById(talentId)?.specsSource === 'cultBlessings' && spec && !/au choix/i.test(spec)) {
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

/** Maximum de Points de Chance : Destin + `attrMod{fortune}` passifs de tout porteur (Chanceux, LDB 10) + effets actifs. */
export function fortuneMax(hero: Combatant): number {
  return (hero.fate ?? 0) + sommeAttrMods(passiveMods(hero), 'fortune', hero) + activeAttrSum(hero, 'fortune');
}

/** Maximum de Détermination : Résilience + `attrMod{resolve}` passifs de tout porteur (Obstiné) + effets actifs. */
export function resolveMax(hero: Combatant): number {
  return (hero.resilience ?? 0) + sommeAttrMods(passiveMods(hero), 'resolve', hero) + activeAttrSum(hero, 'resolve');
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

/** Ce que lit la porte de possession `effectiveTalents` : les Talents acquis, les Traits portés (octrois)
 *  et les effets actifs (octrois, suspensions). `T` = la forme des Talents acquis du porteur. */
export interface PorteurDeTalents<T extends Pick<TalentInstance, 'talentId' | 'spec'> = TalentInstance> {
  talents?: readonly T[];
  traits?: readonly Pick<TraitInstance, 'id'>[];
  activeEffects?: readonly ActiveEffect[];
}

/** Talents STRUCTURELLEMENT possédés via un Trait porté (`TraitData.passive` `grantTalent`, ≠
 *  `grantCareerTalent` qui n'ajoute qu'un DROIT D'ACHAT) — Marque de Khorne « bénéficie du Talent
 *  Frénésie [et] gagne le Talent Savoir-vivre (Suivants de Khorne) » (MDG 07 l.250). Lu DIRECT sur
 *  `c.traits` (marche pour un PJ ou une créature, indépendant de `liveTraits`/spawn) — même lecture
 *  ciblée que `passiveCastPenalties` (magic.ts) pour un op STRUCTUREL, jamais un modificateur numérique
 *  foldé par `traitPassiveMods`/`passiveMods`. */
export function traitGrantedTalents(c: Pick<PorteurDeTalents, 'traits'>): RefDesignee[] {
  const out: RefDesignee[] = [];
  for (const tr of c.traits ?? []) {
    for (const op of findTraitById(tr.id)?.passive ?? []) {
      if (op.op !== 'grantTalent') continue;
      out.push({ id: op.talent.id, ...(op.talent.spec ? { spec: op.talent.spec } : {}) });
    }
  }
  return out;
}

/** Talents octroyés par un effet ACTIF porté (`ActiveEffect.grantedTalent`, op `grantTalent` à durée —
 *  Flambeau de Vertu : Sans peur ; Cœurs ardents : Cœur vaillant ; Chanceux d'un événement de bord).
 *  TEMPORAIRES par construction : ils vivent sur l'effet porteur et s'éteignent avec lui, sans jamais
 *  entrer dans `c.talents` (aucune acquisition, aucun coût en PX, rien à l'avancement). Un effet dont
 *  le compte de Rounds est épuisé ne compte plus (le retrait matériel se fait à la frontière de Round) ;
 *  les échelles `clock`/`adventure` sont purgées par leur horloge respective. */
export function effectGrantedTalents(c: Pick<PorteurDeTalents, 'activeEffects'>): RefDesignee[] {
  const out: RefDesignee[] = [];
  for (const e of c.activeEffects ?? []) {
    if (!e.grantedTalent) continue;
    if (e.duration.scale === 'rounds' && e.duration.left <= 0) continue;
    out.push({ id: e.grantedTalent.talentId, ...(e.grantedTalent.spec ? { spec: e.grantedTalent.spec } : {}) });
  }
  return out;
}

/** Talents EFFECTIFS d'un combattant : `c.talents` (structurel) + ceux OCTROYÉS par un Trait porté
 *  (`traitGrantedTalents`, ex. Marque de Khorne → Savoir-vivre (Suivants de Khorne), MDG 07 l.250) + ceux
 *  octroyés par un effet ACTIF (`effectGrantedTalents`), MOINS ceux qu'un effet actif SUSPEND (op
 *  `suppressTalents`, source `talents` suspendue : `sourceSuspended`, LDB 40 l.80, l.82) —
 *  PORTE UNIQUE de la POSSESSION effective : tout lecteur qui demande « le porteur a-t-il ce Talent, à
 *  quel niveau ? » (capacités de combat, +DR, passifs, Groupes, Conditions `has`, fiche) passe par elle.
 *  `c.talents` brut reste la source d'ACQUISITION (achat PX, Maxi, avancement, création) : une
 *  suspension n'y touche pas, le Talent revient sans PX à l'échéance de l'effet. Dédoublonne par
 *  `(talentId, spec)` — un porteur qui possède AUSSI le talent en propre n'est compté qu'une fois
 *  (l'entrée structurelle, `times` réel, prime sur l'octroi). */
export function effectiveTalents<T extends Pick<TalentInstance, 'talentId' | 'spec'> = TalentInstance>(c: PorteurDeTalents<T>): (T | TalentInstance)[] {
  const own = c.talents ?? [];
  const granted: RefDesignee[] = [];
  for (const g of [...traitGrantedTalents(c), ...effectGrantedTalents(c)]) {
    const already = own.some((t) => t.talentId === g.id && memeSpecialisation(t.spec, g.spec))
      || granted.some((k) => k.id === g.id && memeSpecialisation(k.spec, g.spec));
    if (!already) granted.push(g);
  }
  return [...own, ...granted.map((g) => ({ talentId: g.id, spec: g.spec, times: 1 }))]
    .filter((t) => !sourceSuspended(c, { category: 'talents', id: t.talentId }));
}

/** Traits de créature que confèrent les Talents possédés de `c` (`TalentData.confereTrait`), la
 *  spécialisation de l'instance en argument : dérivés à la lecture, jamais posés. LDB 10 l.506, l.548 */
export function traitsConferes(c: Combatant): TraitInstance[] {
  return effectiveTalents(c).flatMap((t) => {
    const id = findTalentById(t.talentId)?.confereTrait?.id;
    if (!id) return [];
    return [t.spec ? { id, arg: t.spec } : { id }];
  });
}

/** Modificateurs PASSIFS continus des talents POSSÉDÉS (`TalentData.passive` : Coup puissant, Dur à cuire…)
 *  en `OpPassive[]`, émis kind `intrinseque` et RÉPÉTÉS par niveau (`t.times`).
 *  Lus par le collecteur `passiveMods` (trauma) EXACTEMENT comme `traitPassiveMods` pour les traits — le
 *  talent (instance = id seul) est résolu par `findTalentById`. Disjoint des traits → zéro double-comptage. */
export function talentPassiveMods(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const t of effectiveTalents(c)) {
    const ops = findTalentById(t.talentId)?.passive;
    // `src` = LE talent émetteur : il NOMME la composante d'un détail de jet et ouvre sa fiche
    // (patron des traits/mutations) — jamais le repli de famille (`passivePartLine`).
    if (ops) for (let i = 0; i < (t.times ?? 1); i++) for (const op of ops) out.push({ op, kind: 'intrinseque', src: { category: 'talents', id: t.talentId } });
  }
  return out;
}

