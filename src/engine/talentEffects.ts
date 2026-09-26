/**
 * Effets des Talents qui influencent la création / les attributs — PILOTÉS PAR LES DONNÉES :
 * chaque talent de talents.json porte `passive: GameOp[]` (charMod/moveMod/attrMod/grantCareerSkill/
 * grantCareerTalent…), posés par l'extraction des livres ; un supplément qui ajoute un talent étiqueté
 * pareil est couvert sans code. Plus AUCUN champ bespoke (`addCharacteristic`/`addSkill`/`addTalent`
 * ont été éliminés au profit du vocabulaire `GameOp` unifié).
 *
 * Sémantique des passifs de Caractéristique (clés STABLES, ≠ libellés — multilangue ; descriptions LDB 10) :
 *  - `charMod{char,mod:5}` : « Vous gagnez un bonus permanent de +5 à votre Caractéristique X de
 *    départ (ne compte pas comme des Augmentations) » — Guerrier né, Tireur de précision, Très fort,
 *    Très résistant, Vivacité, Réflexes foudroyants, Doigts de fée, Perspicace, Imperturbable, Affable ;
 *  - `attrMod{attr:'wounds',mod:{bonusOf:'E'}}` (Dur à cuire) : « autant de Points de Blessure
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
import { Combatant, CHAR_KEYS, CharKey, TalentInstance } from './types';
import { bonus, maxWounds } from './characteristics';
import { talentIdByLabel, findTalentById, findTraitById, blessingsOf, refLabel } from '../data';
import { splitLabel, wildcardSpecs, inCareerStatus, memeRef, type CareerSlot, type InCareerStatus } from './careerSlots';
import type { RefASpecialisation, RefDesignee, TypeEntite } from '../data/schemas/grammaire/ref';
import type { GameOp, PassiveMod } from './ops';

/**
 * Valeur « base + bonus permanents de talents » pour une CharKey, SANS les modificateurs
 * de mutations/traumas/sorts/maladies. Utilisé par les lecteurs BRUTS hors-combat
 * (affichage de fiche, calcul PX, Blessures max initiales) qui ont besoin du « vrai départ »
 * incluant les +5 de talent (désormais passifs, plus cuits dans `characteristics`).
 * On ne peut PAS importer `passiveCharSum`/`characteristics` ici (cycle) → lecture LOCALE.
 */
export function baseWithTalents(c: Combatant, key: CharKey): number {
  let val = c.characteristics[key] ?? 0;
  for (const t of c.talents ?? []) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op === 'charMod' && op.char === key) val += op.mod * (t.times ?? 1);
    }
  }
  return val;
}

/** Σ des `attrMod{attr}` (mod NUMÉRIQUE) portés par les talents du héros, × `times` — Chance (Chanceux),
 *  Détermination (Obstiné). DATA-DRIVEN : lit `TalentData.passive`, jamais un libellé. (Les mod-FORMULE,
 *  ex. Dur à cuire +BE, sont résolus par leur lecteur dédié — pas ici.) */
function talentAttrSum(hero: Combatant, attr: 'fortune' | 'resolve'): number {
  let n = 0;
  for (const t of hero.talents ?? []) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op === 'attrMod' && op.attr === attr && typeof op.mod === 'number') n += op.mod * (t.times ?? 1);
    }
  }
  return n;
}

/**
 * Caractéristique « +5 de départ » conférée par un talent (clé courte), sinon null, par `id`.
 * Lit le premier `charMod{char, mod}` dont `char` est une CharKey dans `passive` du talent.
 */
export function talentCharBonusById(talentId: string): CharKey | null {
  for (const op of findTalentById(talentId)?.passive ?? []) {
    if (op.op === 'charMod' && (CHAR_KEYS as readonly string[]).includes(op.char)) return op.char as CharKey;
  }
  return null;
}

/** Idem par LIBELLÉ — bord UI (créateur) / tests ; résout l'id puis délègue. */
export function talentCharBonus(talentLabel: string): CharKey | null {
  return talentCharBonusById(talentIdByLabel(splitLabel(talentLabel).name));
}

/**
 * Applique l'effet d'acquisition d'un Talent (création OU achat PX) — mute le héros. Référence
 * STRUCTURÉE : `talentId` STABLE + `spec` concret (cult de « Béni » : « Sigmar »…).
 * Le +5 Caractéristique et le +1 Mouvement sont désormais des PASSIFS CONTINUS dans `passive: GameOp[]`
 * (charMod/moveMod), lus par le collecteur `passiveMods` — plus cuits dans `characteristics`/`movement`.
 * Les effets dérivés (Blessures, Chance, Détermination) sont des helpers recalculés par
 * l'appelant (heroMaxWounds / fortuneMax / resolveMax).
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

/** Points de Blessure supplémentaires : BE par acquisition d'un talent « Blessure » (Dur à cuire).
 *  Le BE utilisé est `baseWithTalents(hero,'endurance')` pour inclure un éventuel +5 E de « Très résistant ». */
export function extraWounds(hero: Combatant): number {
  let n = 0;
  for (const t of hero.talents ?? []) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op === 'attrMod' && op.attr === 'wounds') {
        // Dur à cuire = +Bonus d'Endurance par acquisition : mod-formule `{bonusOf:'endurance'}` résolu sur
        // baseWithTalents (inclut le +5 E de Très résistant si possédé), pas sur la valeur brute.
        const per = typeof op.mod === 'number' ? op.mod : 'bonusOf' in op.mod ? bonus(baseWithTalents(hero, op.mod.bonusOf)) : 0;
        n += per * (t.times ?? 1);
      }
    }
  }
  return n;
}

/** Blessures max d'un héros = formule des Attributs (BF+2×BE+BFM × Taille) + talents « Blessure ».
 *  Les +5 de talents (Très fort → F, Très résistant → E, Imperturbable → FM) sont des PASSIFS :
 *  on passe `baseWithTalents` pour chaque carac impliquée afin de ne pas les perdre. */
export function heroMaxWounds(hero: Combatant): number {
  const chars = {
    ...hero.characteristics,
    force: baseWithTalents(hero, 'force'),
    endurance: baseWithTalents(hero, 'endurance'),
    'force-mentale': baseWithTalents(hero, 'force-mentale'),
  };
  return maxWounds(chars, hero.size ?? 'moyenne') + extraWounds(hero);
}

/** Σ des `attrMods{attr}` d'effets ACTIFS (op `attrMod` exécutée — buff temporaire, ext. consommables) —
 *  s'ajoute aux passifs de talent dans les maxima dérivés, expire avec l'effet porteur. */
function activeAttrSum(hero: Combatant, attr: 'fortune' | 'resolve'): number {
  return (hero.activeEffects ?? []).reduce((s, e) => s + (e.attrMods?.[attr] ?? 0), 0);
}

/** Maximum de Points de Chance : Destin + niveaux des talents « Chance » (Chanceux, LDB 10) + effets actifs. */
export function fortuneMax(hero: Combatant): number {
  return (hero.fate ?? 0) + talentAttrSum(hero, 'fortune') + activeAttrSum(hero, 'fortune');
}

/** Maximum de Détermination : Résilience + niveaux des talents « Détermination » (Obstiné) + effets actifs. */
export function resolveMax(hero: Combatant): number {
  return (hero.resilience ?? 0) + talentAttrSum(hero, 'resolve') + activeAttrSum(hero, 'resolve');
}


/**
 * Compétences ajoutées aux listes de carrière par les talents possédés (« Ajoutez X à n'importe
 * quelle Carrière que vous entamez », LDB 10). La spec choisie à l'acquisition du talent
 * (« Maître artisan (Forgeron) ») se reporte sur la compétence ajoutée (« Métier (Forgeron) ») ;
 * sans spec à reporter, l'emplacement `choix` de l'op reste ouvert (joker de groupe).
 */
export function careerSkillAdditions(hero: Combatant): AjoutDeCarriere[] {
  const out: AjoutDeCarriere[] = [];
  for (const t of hero.talents) {
    const provenance: ProvenanceDAjout = { type: 'talent', id: t.talentId, ...(t.spec != null ? { spec: t.spec } : {}) };
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op !== 'grantCareerSkill') continue;
      // Emplacement `choix` de l'op DÉSIGNÉ par la spec concrète du talent (Maître artisan (Forgeron)).
      if (t.spec && op.skill.choix != null) out.push({ id: op.skill.id, spec: t.spec, provenance });
      else if (op.skill.choix != null) out.push({ id: op.skill.id, choix: op.skill.choix, provenance });
      else out.push({ id: op.skill.id, spec: op.skill.spec, provenance });
    }
  }
  return out;
}

/** Talents ajoutés à la carrière par les Talents possédés et les Traits portés (op `grantCareerTalent`) :
 *  LDB 10 l.467 ; `commeEnCarriere` : EDOC 13 l.524, MDG 07 l.252. Analogue Talent de `careerSkillAdditions`. */
export function careerTalentAdditions(hero: Combatant): AjoutDeTalent[] {
  const porteurs: [ProvenanceDAjout, readonly GameOp[]][] = [
    ...hero.talents.map((t): [ProvenanceDAjout, readonly GameOp[]] => [{ type: 'talent', id: t.talentId, ...(t.spec != null ? { spec: t.spec } : {}) }, findTalentById(t.talentId)?.passive ?? []]),
    ...(hero.traits ?? []).map((tr): [ProvenanceDAjout, readonly GameOp[]] => [{ type: 'trait', id: tr.id }, findTraitById(tr.id)?.passive ?? []]),
  ];
  return porteurs.flatMap(([provenance, passifs]) => passifs.flatMap((op): AjoutDeTalent[] =>
    op.op === 'grantCareerTalent' ? [{ ...op.talent, provenance, ...(op.commeEnCarriere ? { commeEnCarriere: true as const } : {}) }] : []));
}

/** Talent ou Trait porteur de l'op qui accorde un ajout de carrière : référence d'entité (`TypeEntite`). */
export type ProvenanceDAjout = RefDesignee & { type: Extract<TypeEntite, 'talent' | 'trait'> };

/** Ajout de carrière : la référence ajoutée et son porteur (LDB 10 l.467, l.745). */
export type AjoutDeCarriere = RefASpecialisation & { provenance: ProvenanceDAjout };

/** Ajout de Talent : `commeEnCarriere` quand l'ajout n'entre pas dans la liste de la carrière (EDOC 13 l.524,
 *  MDG 07 l.252). */
export type AjoutDeTalent = AjoutDeCarriere & { commeEnCarriere?: true };

/** Ajout de carrière déplié : une référence désignée, avec ce que l'ajout porte hors de sa référence. */
export type AjoutDeplie<A extends AjoutDeCarriere = AjoutDeCarriere> = RefDesignee & Omit<A, keyof RefASpecialisation>;

/** UN ajout déplié en références désignées : son pool quand il est à `choix` (LDB 10 l.467/745 ; EDOC 13
 *  l.524). Lecture UNIQUE des ajouts, Compétences (`competencesAjouteesALaCarriere`) comme Talents
 *  (`talentsAjoutesALaCarriere`). */
function deplierAjout<A extends AjoutDeCarriere>(a: A, kind: 'skill' | 'talent'): AjoutDeplie<A>[] {
  const { id, spec, choix, ...porte } = a;
  return choix == null
    ? [{ id, ...(spec != null ? { spec } : {}), ...porte }]
    : wildcardSpecs({ label: refLabel(kind === 'skill' ? 'skills' : 'talents', a), optionId: id, wildcard: true, ...(Array.isArray(choix) ? { specOptions: choix } : {}) }, kind).map((s) => ({ id, spec: s, ...porte }));
}

/** Ajouts qui ENTRENT dans la liste de la carrière (LDB 10 l.467, l.745), un emplacement chacun, déplié :
 *  un ajout `commeEnCarriere` n'y entre pas (EDOC 13 l.524). Lu par `isCareerLevelComplete` (LDB 07 l.124). */
export function ajoutsDansLaCarriere(hero: Combatant, kind: 'skill' | 'talent'): RefDesignee[][] {
  return kind === 'skill'
    ? careerSkillAdditions(hero).map((a) => deplierAjout(a, kind))
    : careerTalentAdditions(hero).filter((a) => !a.commeEnCarriere).map((a) => deplierAjout(a, kind));
}

/** Compétences AJOUTÉES à la carrière, dépliées (`deplierAjout`). Source UNIQUE des rangées d'avancement et
 *  de l'achat (`competenceEnCarriere`). */
export function competencesAjouteesALaCarriere(hero: Combatant): AjoutDeplie[] {
  return careerSkillAdditions(hero).flatMap((a) => deplierAjout(a, 'skill'));
}

/** Statut « en carrière » d'une Compétence (LDB 07 l.76 ; LDB 10 l.745) : un emplacement cumulé la couvre
 *  (`inCareerStatus`), sinon un ajout de carrière déplié (`competencesAjouteesALaCarriere`) → `'ajout'`.
 *  `remise` : LDB 10 l.745. `ajout` : l'ajout déplié qui la couvre, avec son porteur. */
export function competenceEnCarriere(
  hero: Combatant,
  slots: CareerSlot[],
  designations: Record<string, string>,
  skillId: string,
  spec: string | undefined,
): { statut: InCareerStatus | 'ajout'; remise: number; ajout?: AjoutDeplie } {
  const statut = inCareerStatus(slots, designations, skillId, spec);
  const ajout = competencesAjouteesALaCarriere(hero).find((a) => memeRef(a, { id: skillId, spec }));
  return { statut: statut ?? (ajout ? 'ajout' : null), remise: ajout && statut != null ? 5 : 0, ...(ajout ? { ajout } : {}) };
}

/** Talents AJOUTÉS à la carrière, dépliés (`deplierAjout`). Source UNIQUE des rangées d'avancement et de
 *  l'achat (`talentEnCarriere`). */
export function talentsAjoutesALaCarriere(hero: Combatant): AjoutDeplie<AjoutDeTalent>[] {
  return careerTalentAdditions(hero).flatMap((a) => deplierAjout(a, 'talent'));
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
  return talentsAjoutesALaCarriere(hero).some((a) => memeRef(a, { id: talentId, spec })) ? 'ajout' : null;
}

/** Talents STRUCTURELLEMENT possédés via un Trait porté (`TraitData.passive` `grantTalent`, ≠
 *  `grantCareerTalent`, ajout de carrière) — Marque de Khorne « bénéficie du Talent
 *  Frénésie [et] gagne le Talent Savoir-vivre (Suivants de Khorne) » (MDG 07 l.250). Lu DIRECT sur
 *  `c.traits` (marche pour un PJ ou une créature, indépendant de `liveTraits`/spawn) — même lecture
 *  ciblée que `passiveCastPenalties` (magic.ts) pour un op STRUCTUREL, jamais un modificateur numérique
 *  foldé par `traitPassiveMods`/`passiveMods`. */
export function traitGrantedTalents(c: Combatant): RefDesignee[] {
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
export function effectGrantedTalents(c: Combatant): RefDesignee[] {
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
 *  octroyés par un effet ACTIF (`effectGrantedTalents`) —
 *  COLLECTEUR UNIQUE pour la POSSESSION effective (fiche, chips, `hasTalent`), distinct de `c.talents`
 *  brut (qui reste la source d'ACQUISITION/achat PX, cf. `advancement.ts`). Dédoublonne par
 *  `(talentId, spec)` — un porteur qui possède AUSSI le talent en propre n'est compté qu'une fois
 *  (l'entrée structurelle, `times` réel, prime sur l'octroi). */
export function effectiveTalents(c: Combatant): TalentInstance[] {
  const own = c.talents ?? [];
  const granted: RefDesignee[] = [];
  for (const g of [...traitGrantedTalents(c), ...effectGrantedTalents(c)]) {
    const already = own.some((t) => memeRef({ id: t.talentId, spec: t.spec }, g)) || granted.some((k) => memeRef(k, g));
    if (!already) granted.push(g);
  }
  return [...own, ...granted.map((g) => ({ talentId: g.id, spec: g.spec, times: 1 }))];
}

/** Modificateurs PASSIFS continus des talents POSSÉDÉS (`TalentData.passive` : Coup puissant, Dur à cuire…,
 *  ou Frénésie → `grantFreeAttack`) en `GameOp[]`, émis kind `intrinseque` et RÉPÉTÉS par niveau (`t.times`).
 *  Lus par le collecteur `passiveMods` (trauma) EXACTEMENT comme `traitPassiveMods` pour les traits — le
 *  talent (instance = id seul) est résolu par `findTalentById`. Disjoint des traits → zéro double-comptage. */
export function talentPassiveMods(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const t of c.talents ?? []) {
    const ops = findTalentById(t.talentId)?.passive;
    // `src` = LE talent émetteur : il NOMME la composante d'un détail de jet et ouvre sa fiche
    // (patron des traits/mutations) — jamais le repli de famille (`passivePartLine`).
    if (ops) for (let i = 0; i < (t.times ?? 1); i++) for (const op of ops) out.push({ op, kind: 'intrinseque', src: { category: 'talents', id: t.talentId } });
  }
  return out;
}

