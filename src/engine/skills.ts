/**
 * Valeur d'une Compétence/Caractéristique pour les Tests « dans le monde »
 * (hors combat) : Caractéristique + Augmentations de la compétence.
 */
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { Combatant, CharKey, Difficulty } from './types';
import { byId, psychologies } from '../data';
import { itemCapability } from './capabilities';
import { groupMatch } from './groups';
import { effectiveChar, bonus } from './characteristics';
import { assistBonus } from './tests';
import { testStatePenalty, testStatePenaltyParts, activeCharTestMod, activeCharTestModParts, passivePartLine, isMovementSkill } from './conditions';
import { agilityTestPenalty } from './encumbrance';
import { traumaSkillPenalty, traumaSkillPenaltyParts, passiveSkillSum, passiveSkillParts, passiveTestMod, passiveTestModParts } from './trauma';
import type { GameOp, PairedSense } from './ops';
import type { ModLine } from './combat';
import { RULE_REF } from './ruleRefs';
import { rule } from './policy';
import { rollTest } from './tests';
import { RNG, defaultRNG } from './dice';
import { effectivePsychTraits, isPsychImmune } from './psychology';
import { maxBy } from './pick';

/** Règles optionnelles « caractéristique alternative » (POINT UNIQUE de la famille) : la liaison
 *  règle ↔ compétence ↔ Caractéristique vit ENTIÈREMENT sur l'entrée de `skills.json`
 *  (`SkillData.altChar` : `gatedByRule` + `from` + `chars` par valeur de règle) — Métier comme Savoir
 *  (LDB 09 l.358), Intimidation (LDB 09 l.294). Une compétence de plus = une entrée de donnée, zéro
 *  ligne ici. Renvoie la CharKey à utiliser (inchangée si aucune règle ne s'applique).
 *  (Les carac alternatives PAR ENTITÉ — ex. lanceur ogre : Langue (Magick) sur Endurance, ADE II 2 l.728 —
 *  sont portées par la DONNÉE — `SkillInstance.characteristic` — lue par effectiveSkillCharKey en amont,
 *  pas ici : aucun sniff d'espèce dans le moteur.) */
function altCharKey(c: Combatant, skillId: string, ck: CharKey): CharKey {
  const alt = byId('skill', skillId)?.altChar;
  if (!alt || (alt.from && ck !== alt.from)) return ck;
  const pick = alt.chars[String(rule(alt.gatedByRule))];
  if (!pick) return ck;
  // Liste = la MEILLEURE des Caractéristiques citées chez ce porteur (argmax UNIQUE du moteur).
  return Array.isArray(pick) ? (maxBy(pick, (k) => effectiveChar(c, k))?.item ?? ck) : pick;
}

/** Caractéristique (CharKey STABLE) d'une compétence par son `id`. `SkillData.characteristic` EST
 *  une CharKey ('Dex'…), multilangue-safe — jamais une conversion par libellé. */
export function skillCharKeyById(skillId: string): CharKey | undefined {
  return byId('skill', skillId)?.characteristic;
}

/** Caractéristique EFFECTIVE d'un Test de compétence — POINT UNIQUE (consommé par `testValue` ET
 *  `castingValue`) : explicite > carac de l'INSTANCE possédée (défaut DATA-DRIVEN : un statbloc peut
 *  porter une carac alternative) > carac de la Compétence (JSON, par id) > repli ; PUIS surcharge par
 *  règle optionnelle « caractéristique alternative » (`altCharKey` : Métier/Intimidation/Magie ogre). */
export function effectiveSkillCharKey(
  c: Combatant,
  skillId: string | undefined,
  opts: { explicit?: CharKey; spec?: string; fallback?: CharKey } = {},
): CharKey {
  const { explicit, spec, fallback = 'dexterite' } = opts;
  if (explicit) return explicit;
  const sk = skillId ? c.skills.find((s) => s.id === skillId && (spec == null || s.spec === spec)) : undefined;
  let ck: CharKey = sk?.characteristic ?? (skillId ? skillCharKeyById(skillId) : undefined) ?? fallback;
  if (skillId) ck = altCharKey(c, skillId, ck);
  return ck;
}

/** Valeur de test d'un personnage pour une compétence ou une caractéristique. Mêmes modulations qu'en
 *  combat (le canon ne distingue pas) : Caractéristique EFFECTIVE (buffs magiques + pénalités de
 *  Traumatisme, LDB 18, via `effectiveChar`), pénalités d'États (LDB 16, `testStatePenalty`), pénalité
 *  d'Encombrement sur l'Agilité (LDB 61), port d'armure (LDB 63) et objet Laid sur la Sociabilité (LDB 60).
 *  `sense` (optionnel) : sens NARRATIVEMENT sollicité par CE Test de Perception (vue/ouïe — déterminé par
 *  l'appelant/la scène, cf. Talent Sens aiguisé `manual:true`) ; restreint les `skillMod` sense-scopés
 *  (Surdité, LDB 18 — `traumaSkillPenalty`). Absent = comportement historique (le RAW n'est pas levé
 *  faute d'info sur le Test précis). */
export function testValue(c: Combatant, skill?: string, characteristic?: CharKey, spec?: string, sense?: PairedSense): number {
  if (!skill && !characteristic) return 0;
  // `skill` = skillId STABLE (multilingue : jamais un libellé). La compétence possédée est trouvée par id ;
  // `spec` cible une spécialisation précise (Savoir (Magie), Métier (Forgeron)…) quand le héros en possède
  // plusieurs avec des avances différentes — sinon (spec absent) la première instance de l'id suffit.
  const sk = skill ? c.skills.find((s) => s.id === skill && (spec == null || s.spec === spec)) : undefined;
  // Caractéristique : POINT UNIQUE partagé avec castingValue (carac d'instance data-driven + carac alternative).
  const ck = effectiveSkillCharKey(c, skill, { explicit: characteristic, spec });
  const base = effectiveChar(c, ck);
  const states = testStatePenalty(c, skill);
  const enc = ck === 'agilite' ? agilityTestPenalty(c) : 0; // charge : couche d'ÉTAT orthogonale (≠ passif d'élément)
  const traumaSkill = traumaSkillPenalty(c, skill, sense); // séquelle permanente (fracture Langue l.300 ; Surdité l.363)
  // Passifs INTRINSÈQUES d'élément (Σ), tous via le collecteur unifié : compétence nommée + port d'armure
  // (`passiveSkillSum` : Groin poilu +10 Pistage, −N% en X du port d'armure) + mods de Test char-qualifiés
  // (`passiveTestMod` : mutation Visage inversé −20 Soc, objet Laid −Soc).
  const passive = passiveSkillSum(c, skill) + passiveTestMod(c, ck);
  // Mods de Test char-QUALIFIÉS d'effets ACTIFS (op `testMod{char}` exécutée — Mystracine « +10 aux
  // Tests d'E et de FM, −10 Ag/I/Int », LDB 71 l.33) : sommés pour la seule carac testée ; les mods
  // GLOBAUX (sans char) sont déjà comptés via `testStatePenalty`. `movementOnly`
  // (#193, Genou démis « Tests impliquant cette jambe ») restreint aux Tests classés « déplacement ».
  const fxChar = activeCharTestMod(c, ck, { movement: isMovementSkill(skill) });
  return base + (sk?.advances ?? 0) + states + enc + traumaSkill + passive + fxChar + skillToolMod(c, skill);
}

/**
 * DÉCOMPOSITION EXHAUSTIVE de `testValue` en composantes NOMMÉES — LE socle d'affichage de tout Test
 * hors combat, et la garantie que l'écran annonce ce que le moteur calcule. INVARIANT vérifié par la
 * garde `test-value-parts.test.ts` :
 *
 *     testValue(c, skill, char, spec, sense) === skillBaseValue(c, skill, spec, char) + Σ testValueParts(…)
 *
 * Un poste AJOUTÉ à `testValue` sans son producteur de parts casse cette garde — c'est ELLE qui
 * interdit la dérive, pas ce commentaire. Chaque part tire son libellé de la DONNÉE (le `src` du
 * collecteur `passiveMods`, via `passivePartLine`/`refLabel`) : aucun branchement par id d'entité.
 * L'ORDRE des postes suit celui de `testValue`, poste pour poste.
 */
export function testValueParts(c: Combatant, skill?: string, characteristic?: CharKey, spec?: string, sense?: PairedSense): ModLine[] {
  if (!skill && !characteristic) return []; // ni compétence ni caractéristique : `testValue` rend 0
  const ck = effectiveSkillCharKey(c, skill, { explicit: characteristic, spec });
  const out: ModLine[] = [];
  out.push(...testStatePenaltyParts(c, skill)); // États + Sort global + symptôme global (LDB 16 / MSRC 16)
  // Encombrement (LDB 61 « Surchargé ») : ne pèse QUE sur un Test d'Agilité — aucune source d'entité à
  // nommer (la charge est un état du sac, pas un élément), d'où la règle elle-même en renvoi Codex.
  const enc = ck === 'agilite' ? agilityTestPenalty(c) : 0;
  if (enc) out.push({ label: 'Encombrement', value: enc, famille: 'jet', ref: RULE_REF.encombrement });
  for (const m of traumaSkillPenaltyParts(c, skill, sense)) out.push(passivePartLine(m, (m.op as Extract<GameOp, { op: 'skillMod' }>).mod));
  for (const m of passiveSkillParts(c, skill)) out.push(passivePartLine(m, (m.op as Extract<GameOp, { op: 'skillMod' }>).mod));
  for (const m of passiveTestModParts(c, ck)) out.push(passivePartLine(m, (m.op as Extract<GameOp, { op: 'testMod' }>).amount));
  out.push(...activeCharTestModParts(c, ck, { movement: isMovementSkill(skill) }));
  // Outil manquant (LDB 09 l.168) : c'est la DONNÉE de la Compétence qui déclare l'outil requis
  // (`SkillData.tool` — `capability`/`withoutMod`, sans libellé d'affichage), donc le renvoi Codex est
  // la fiche de la Compétence elle-même, qui porte la règle.
  const tool = skillToolMod(c, skill);
  if (tool && skill) out.push({ label: 'Sans outil', value: tool, famille: 'jet', ref: { category: 'skills', id: skill } });
  return out.filter((l) => l.value !== 0);
}

/** Malus « sans l'outil de la compétence » (LDB 09 l.168 : les Difficultés de Crochetage « supposent
 *  l'utilisation d'outils de crochetage ; des crochets improvisés… peuvent être utilisés avec une
 *  pénalité de -10 ») : si la donnée de la compétence déclare `tool` et que l'acteur ne POSSÈDE aucun
 *  objet non détruit portant la capability requise, `withoutMod` s'applique. Possession NON gatée sur
 *  le port (`itemCapability`) : avoir les outils dans le sac suffit — on les sort pour s'en servir. */
export function skillToolMod(c: Combatant, skill?: string): number {
  const tool = skill ? byId('skill', skill)?.tool : undefined;
  if (!tool) return 0;
  const has = (c.items ?? []).some((it) => !it.destroyed && itemCapability(it, tool.capability));
  return has ? 0 : tool.withoutMod;
}

/** NIVEAU DE COMPÉTENCE, au sens de `LDB 09 l.17` (« la Caractéristique associée [+] le nombre
 *  d'Augmentations prises ») : Caractéristique EFFECTIVE (buffs magiques + Traumatisme via
 *  `effectiveChar`) + avances, SANS les pénalités d'État/Encombrement/passifs qu'applique `testValue`.
 *  FORMULE UNIQUE de la valeur NUE d'un Test — base des Tests de Psychologie (Calme, généralisant
 *  `calmeValue` à toute compétence déclarée en donnée) ET grandeur du départage à DR égal
 *  (`LDB 12 l.160`, `resolveOpposed`). `explicitChar` : Caractéristique IMPOSÉE par l'appelant quand
 *  elle ne se déduit pas de la Compétence (surcharge de Domaine pour Langue (Magick) —
 *  `magic.castingBaseValue`), jamais un recalcul parallèle de la formule. `skill` absent = Test de
 *  PURE Caractéristique (`explicitChar` seule, aucune Augmentation) — même porte que `testValue`,
 *  qui accepte la même forme ; ni compétence ni caractéristique ⇒ 0 (rien à tester). */
export function skillBaseValue(c: Combatant, skill?: string, spec?: string, explicitChar?: CharKey): number {
  if (!skill && !explicitChar) return 0;
  const ck = effectiveSkillCharKey(c, skill, { spec, explicit: explicitChar });
  const adv = skill ? c.skills.find((s) => s.id === skill && (spec == null || s.spec === spec))?.advances ?? 0 : 0;
  return effectiveChar(c, ck) + adv;
}

/** Valeur de Test « brute » pour un Test de COMBAT : `testValue` PRIVÉE de la pénalité d'États HORS combat
 *  (`testStatePenalty`, qu'elle inclut déjà) — pour que l'appelant ajoute la pénalité de COMBAT
 *  (`combatTestPenalty`) UNE SEULE fois, sans double-compte. = Caractéristique effective + avances + passifs
 *  intrinsèques + Encombrement/Traumatisme, SANS la pénalité d'État (réappliquée en version combat par
 *  l'appelant). Utilisée par les Tests de RÉCUPÉRATION d'États (Empoisonné… : −10 d'État compté une fois). */
export function rawCombatTestBase(c: Combatant, skill?: string, characteristic?: CharKey, spec?: string): number {
  return testValue(c, skill, characteristic, spec) - testStatePenalty(c, skill);
}

/** Le personnage possède-t-il la compétence `skillId` (et, si `spec` fourni, cette spécialisation —
 *  ex. Projectiles (Poudre noire)) ? Par id STABLE. Sert aux modulateurs (ex. `easierIf`). */
export function actorHasSkill(c: Combatant, skillId: string, spec?: string): boolean {
  return c.skills.some((s) => s.id === skillId && (spec == null || s.spec === spec));
}

/** Le personnage a-t-il AU MOINS UNE Augmentation dans `skillId` (spécialisation ciblée si `spec`) ?
 *  Prédicat d'éligibilité au SOUTIEN — LDB 12 l.195. Plus strict que `actorHasSkill` (simple présence). */
function hasSkillAdvance(c: Combatant, skillId: string, spec?: string): boolean {
  return c.skills.some((s) => s.id === skillId && (spec == null || s.spec === spec) && (s.advances ?? 0) >= 1);
}

/** Le malus social « contenu » de `type` s'applique-t-il envers `targetGroups` ? (LDB 21) Vrai si le
 *  tester POSSÈDE le trait visant ce groupe ET n'est PAS en état ACTIF pour lui. Le modificateur est en
 *  effet l'issue du Test de Psychologie RÉUSSI (Animosité l.19 / Préjugé l.48) — ou, hors combat (pas de
 *  Test modélisé), la manifestation par défaut du trait possédé. En état ACTIF (Test ÉCHOUÉ) ce malus
 *  DISPARAÎT : le personnage est sous compulsion (attaquer l.24 / insulter l.52), pas socialement « contenu ».
 *  SIÈGE UNIQUE de la lecture des Traits psy CIBLÉS pour un Test social : `socialPsychMod` (valeur) et
 *  `socialPsychLabel` (affichage) en dépendent tous deux, donc l'immunité à la Psychologie (LDB 17 l.59,
 *  Détermination) s'y lit UNE fois, par le MÊME prédicat que la Peur/Terreur (`isPsychImmune`) : tant
 *  qu'elle dure, aucun de ces malus ne se manifeste, et l'étiquette disparaît avec lui. */
function containedSocialPenalty(tester: Combatant, type: string, targetGroups: string[]): boolean {
  if (isPsychImmune(tester)) return false;
  const possede = effectivePsychTraits(tester).some((t) => t.type === type && t.cible && groupMatch(t.cible, targetGroups));
  if (!possede) return false;
  const actif = (tester.psychState ?? []).some((p) => p.type === type && p.active && p.cible && groupMatch(p.cible, targetGroups));
  return !actif;
}

/** Les entrées de `psychology.json` qui DÉCLARENT un `containedSocialMod` et dont le malus « contenu »
 *  s'applique à `tester` envers `targetGroups` — SOURCE UNIQUE de la valeur et de l'étiquette : ni −20/−10
 *  ni `animosite`/`prejuge` ne sont écrits dans le moteur (un nouveau Trait le déclare en donnée). */
function containedSocialEntries(tester: Combatant, targetGroups: string[]): { id: string; label: string; mod: number }[] {
  return psychologies
    .filter((p) => p.containedSocialMod != null && containedSocialPenalty(tester, p.id, targetGroups))
    .map((p) => ({ id: p.id, label: p.label, mod: p.containedSocialMod! }));
}

/** Pénalité de Sociabilité des Traits psy ciblés de `tester` envers les groupes `targetGroups` (LDB 21,
 *  `containedSocialMod`) — cumulable. À consommer sur un Test de Sociabilité ciblé (dialogue/interaction). */
export function socialPsychMod(tester: Combatant, targetGroups: string[]): number {
  return containedSocialEntries(tester, targetGroups).reduce((sum, e) => sum + e.mod, 0);
}

/** UNE ligne de mod PAR Trait psy « contenu » qui pèse (LDB 21) — la forme que consomme le monteur de
 *  jet (`dansLaValeur`) quand ce malus a été FONDU dans une valeur. Chaque ligne porte la fiche Codex
 *  de SA psychologie — catégorie `psychologies`, celle qui indexe `psychology.json` par id (la
 *  catégorie `psychologie` liste des TRAITS, elle ne résoudrait que par homonymie) — jamais une somme
 *  anonyme : c'est la même donnée que `socialPsychMod` (Σ) et `socialPsychLabel` (texte), par source. */
export function socialPsychLines(tester: Combatant, targetGroups: string[]): ModLine[] {
  return containedSocialEntries(tester, targetGroups)
    .map((e) => ({ label: e.label, value: e.mod, famille: 'jet' as const, ref: { category: 'psychologies', id: e.id } }));
}

/** Libellé lisible du malus psy social (pour la modale de Test), ou undefined si aucun. Ex. « Animosité −20 ». */
export function socialPsychLabel(tester: Combatant, targetGroups: string[]): string | undefined {
  const parts = containedSocialEntries(tester, targetGroups).map((e) => `${e.label} ${e.mod < 0 ? '−' : '+'}${Math.abs(e.mod)}`);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Un Test (compétence ou caractéristique) relève-t-il de la **Sociabilité** (LDB 21 : malus psy −20/−10) ?
 *  Vrai si la caractéristique sous-jacente est `Soc` (Charme, Marchandage, Intimidation, Commérage…). */
export function isSocialTest(skill?: string, characteristic?: CharKey): boolean {
  if (characteristic) return characteristic === 'sociabilite';
  if (skill) return skillCharKeyById(skill) === 'sociabilite';
  return false;
}

/** Descripteur NEUTRE d'un Test « posté » (Activité de voyage/interlude, Scène ou Activité de bataille) :
 *  compétence(s) AU CHOIX, caractéristique de repli, Difficulté, et Test COMBINÉ éventuel. Champs plats,
 *  partagés tels quels par les données JSON — vocabulaire commun, sans logique de résolution attachée. */
export interface TestSpec { skills?: RefDesignee[]; char?: CharKey; difficulty?: Difficulty; combined?: boolean }

/** Résultat d'un « Test du meilleur parmi N compétences » pour UN acteur (la compétence retenue + le jet). */
export interface SkillBestResult {
  value: number;
  roll: number;
  target: number;
  sl: number;
  success: boolean;
  /** Compétence effectivement utilisée (la meilleure de l'acteur parmi les options). */
  used?: RefDesignee;
}

/** Pour l'acteur donné, prend SA meilleure compétence (spec-aware) parmi `options`, puis lance le Test
 *  (Difficulté + `mod`). Primitive NEUTRE et seedée — « cette personne tente une tâche qui accepte
 *  plusieurs compétences → on utilise celle où elle est la meilleure ». Partagée voyage (Cartographe/
 *  Dessin, Survie/Guérison…) et, à venir, équipage naval (Voile/Ramer…). `options` vide ⇒ Test sur 0. */
export function resolveSkillBest(
  actor: Combatant,
  options: readonly RefDesignee[],
  difficulty: Difficulty = 'intermediaire',
  rng: RNG = defaultRNG,
  mod = 0,
): SkillBestResult {
  let bestVal = -Infinity;
  let used: RefDesignee | undefined;
  for (const ref of options) {
    const v = testValue(actor, ref.id, undefined, ref.spec);
    if (v > bestVal) { bestVal = v; used = ref; }
  }
  const value = Number.isFinite(bestVal) ? bestVal : 0;
  const res = rollTest(value, difficulty, rng, mod);
  return { value, roll: res.roll, target: res.target, sl: res.sl, success: res.success, used };
}

/** Meilleur membre du groupe pour un test donné. `extraMod` ajoute un modificateur PAR acteur (ex. malus
 *  psy de Sociabilité, qui dépend du personnage) — la valeur effective sert au choix ET au résultat.
 *  `sense` (optionnel) : transmis tel quel à `testValue` (sens NARRATIVEMENT sollicité par CE Test précis). */
export function partyBest(
  party: Combatant[],
  skill?: string,
  characteristic?: CharKey,
  extraMod?: (c: Combatant) => number,
  spec?: string, // spécialisation ciblée (Métier (Serrurier)…) — transmise à `testValue` pour la bonne instance
  sense?: PairedSense,
): { actor: Combatant; value: number } | null {
  const r = maxBy(party, (c) => testValue(c, skill, characteristic, spec, sense) + (extraMod?.(c) ?? 0));
  return r ? { actor: r.item, value: r.value } : null;
}

/** Meilleur PJ pour une liste de compétences AU CHOIX (celle qui donne la plus haute valeur décide).
 *  `skills` vide/absent ⇒ une unique option de PURE Caractéristique (`id`/`spec` indéfinis).
 *  `sense` (optionnel) : transmis tel quel à `partyBest`/`testValue`. */
export function bestForSkills(
  party: Combatant[],
  skills: RefDesignee[] | undefined,
  char: CharKey | undefined,
  sense?: PairedSense,
): { actor: Combatant; value: number; skillId?: string; spec?: string } | null {
  const choices: RefDesignee[] = skills?.length ? skills : [{ id: undefined as unknown as string, spec: undefined }];
  // Le meilleur ACTEUR par option, puis argmax sur les options (first-max via `maxBy`). Une option
  // ne concourt que si le groupe fournit un porteur (`partyBest` null ⇒ groupe vide ⇒ résultat null).
  const perChoice = choices
    .map((sk) => ({ sk, best: partyBest(party, sk.id, char, undefined, sk.spec, sense) }))
    .filter((x): x is { sk: RefDesignee; best: { actor: Combatant; value: number } } => x.best !== null);
  const r = maxBy(perChoice, (x) => x.best.value);
  return r ? { actor: r.item.best.actor, value: r.item.best.value, skillId: r.item.sk.id, spec: r.item.sk.spec } : null;
}

/** Meilleur PJ pour un Test COMBINÉ de deux compétences (LDB 12 l.202-206) : celui dont le PLUS FAIBLE des
 *  deux (le facteur limitant du Test combiné) est le plus élevé. Renvoie l'acteur + ses deux valeurs. */
export function bestForCombined(
  party: Combatant[],
  sk1: RefDesignee,
  sk2: RefDesignee,
  char: CharKey | undefined,
): { actor: Combatant; value1: number; value2: number } | null {
  const r = maxBy(party, (c) => Math.min(testValue(c, sk1.id, char, sk1.spec), testValue(c, sk2.id, char, sk2.spec)));
  if (!r) return null;
  return { actor: r.item, value1: testValue(r.item, sk1.id, char, sk1.spec), value2: testValue(r.item, sk2.id, char, sk2.spec) };
}

/** Meilleure OPTION pour un acteur parmi un catalogue d'options portant des `skills` : score d'une option =
 *  la MEILLEURE compétence de l'acteur dedans (`bestForSkills([actor], opt.skills).value`), par `testValue`
 *  (= compétence RAW). Argmax via `maxBy`. Le filtrage des options (possession, activités sans Test…) et les
 *  replis restent à la charge de l'appelant. */
export function bestSkilledOption<T extends { skills?: RefDesignee[] }>(
  actor: Combatant,
  options: readonly T[],
): { option: T; value: number } | null {
  const r = maxBy(options, (opt) => bestForSkills([actor], opt.skills ?? [], undefined)?.value ?? -Infinity);
  return r ? { option: r.item, value: r.value } : null;
}

/** DÉTAIL d'un Soutien (LDB 12 l.187-200) tel qu'il s'AFFICHE : combien de membres soutiennent et le
 *  bonus total qu'ils octroient. FORME UNIQUE, partagée par le moteur (`partyAssisted`/
 *  `bestAssistedOption`), les pendings qui la portent (`state/pendings.ts`) et la primitive de
 *  breakdown qui la rend en ligne de mod (`ui/breakdown.ts` — `soutienMod`/`supportSplit`). */
export interface SupportDetail {
  count: number;
  bonus: number;
  /** Les SOUTIENS eux-mêmes, par id de Combattant — la provenance du bonus est une STRUCTURE, jamais
   *  un libellé composé. Rendue en micro-chips par `ui/RollLine.tsx` (`ModLine.by`). */
  ids: string[];
}

/** Ligne de mod « Soutien » (LDB 12) — SOURCE UNIQUE : le bonus d'un jet de GROUPE soutenu s'affiche
 *  comme TOUT autre modificateur (ligne du breakdown, verte si +), pas fondu dans la base ni relégué
 *  en sous-titre. `undefined` si personne ne soutient (aucune ligne « Soutien +0 » inventée).
 *  La provenance ne porte QUE des ids : le moteur est pur, et le NOM se résout au RENDU (couture
 *  unique `ui/RollLine.tsx`) — un résolveur à fournir par appelant s'oublie, et l'écran affiche
 *  alors l'id brut (recette B3a, « pregen-101 »). */
export function soutienMod(support?: SupportDetail): ModLine | undefined {
  if (!support || support.count <= 0) return undefined;
  return {
    label: 'Soutien',
    value: support.bonus,
    famille: 'jet',
    ref: RULE_REF.soutien,
    by: (support.ids ?? []).map((id) => ({ id })),
  };
}

/** DÉFAIT le Soutien FONDU dans une valeur de jet (`partyAssisted().value` = meneur + bonus) : la base
 *  AFFICHÉE redevient celle du meneur seul et le Soutien reprend sa place de ligne de mod. SOURCE
 *  UNIQUE du geste « base = value − Soutien » que chaque surface soutenue réécrivait (Activité,
 *  Dissipation, Rechargement d'Arme d'équipe, Test de scène, étape de cascade, récap de voyage). */
export function supportSplit(value: number, support?: SupportDetail): { base: number; mods: ModLine[] } {
  const m = soutienMod(support);
  return { base: value - (m?.value ?? 0), mods: m ? [m] : [] };
}

/**
 * DÉFAIT une valeur de Test FONDUE en base NUE + composantes NOMMÉES : le Soutien (`supportSplit`)
 * PUIS toutes les composantes de `testValue` (`testValueParts` — États, Encombrement, séquelles,
 * passifs, effets, outil manquant). SOURCE UNIQUE du geste d'affichage des surfaces hors combat
 * (Test de scène, Activité, Évaluation, Dissipation, Soin, Chirurgie).
 *
 * La CIBLE ne bouge pas : `base + Σ mods === value` par construction, et la base rendue vaut alors
 * `skillBaseValue` (+ `fused`, la part déjà fondue et annoncée AILLEURS par l'appelant — le malus
 * psy social d'un Test de scène, `LDB 21`).
 *
 * GARDE DE RECONSTRUCTION : les composantes ne sortent QUE si elles reconstruisent EXACTEMENT la
 * valeur jetée (`skillBaseValue + Σ parts + fused === value − Soutien`). Une valeur produite par une
 * AUTRE formule (valeur de combat, Caractéristique nue, soigneur PNJ sans fiche) retombe sur
 * `supportSplit` : l'écran ne nomme jamais une composante que le jet n'a pas subie.
 *
 * `exact` DIT laquelle des deux voies a servi — l'invariant arithmétique, lui, tient dans les DEUX
 * (la base est une soustraction : elle absorbe n'importe quelle erreur de l'appelant). Sans ce
 * drapeau, un appelant qui déclare un modificateur qu'il n'a pas fondu obtient une ligne cohérente
 * mais une base FAUSSE, en silence. `false` ⇒ la base n'est PAS le Niveau de Compétence nu.
 */
export function testValueSplit(
  c: Combatant | undefined,
  value: number,
  opts?: { support?: SupportDetail; skill?: string; characteristic?: CharKey; spec?: string; sense?: PairedSense; fused?: number },
): { base: number; mods: ModLine[]; exact: boolean } {
  const sup = supportSplit(value, opts?.support);
  // Rien à décomposer (côté MONDE, Test sans compétence ni caractéristique) : la valeur EST la base,
  // il n'y a aucune reconstruction à rater.
  if (!c || (!opts?.skill && !opts?.characteristic)) return { ...sup, exact: true };
  const parts = testValueParts(c, opts.skill, opts.characteristic, opts.spec, opts.sense);
  const sum = parts.reduce((s, p) => s + p.value, 0);
  const nu = skillBaseValue(c, opts.skill, opts.spec, opts.characteristic);
  if (nu + sum + (opts.fused ?? 0) !== sup.base) return { ...sup, exact: false };
  return { base: sup.base - sum, mods: [...sup.mods, ...parts], exact: true };
}

/** Test de GROUPE avec SOUTIEN (LDB 12 l.187-200) — SOURCE UNIQUE de la coopération hors combat : le plus
 *  compétent (`partyBest`) lance, et chaque AUTRE membre ÉLIGIBLE (l.195 ; Test de pure
 *  Caractéristique → tout le monde) le soutient à +10, plafonné au Bonus de la Caractéristique testée du
 *  meneur (`assistBonus`). À utiliser PARTOUT où le groupe œuvre de concert (Test étendu, Tests de scène,
 *  survie/perception en voyage, fouille, dissipation à plusieurs…). Renvoie le meneur, sa valeur SOUTENUE
 *  (Soutien déjà fondu — la CIBLE en dérive), le détail (`support`) pour l'affichage, et sa valeur NUE
 *  (`base`, `LDB 09 l.17` : `skillBaseValue` sur la compétence/spécialisation/caractéristique du choix
 *  du meneur — jamais reconstituée par soustraction). ATTENTION : `extraMod` (malus psy social, `LDB 21`) entre
 *  dans `value` mais PAS dans `base` : un appelant qui en fournit un porte lui-même la ligne qui le
 *  nomme (`testValueSplit(..., { fused })`), sans quoi l'écart resterait muet. `eligible` : filtre
 *  GÉOMÉTRIQUE additionnel (adjacence, l.196) — voir `soutienBonus`. */
export function partyAssisted(
  party: Combatant[],
  skill?: string,
  characteristic?: CharKey,
  extraMod?: (c: Combatant) => number,
  spec?: string,
  eligible?: (c: Combatant) => boolean,
): { actor: Combatant; value: number; base: number; support: SupportDetail } | null {
  const leader = partyBest(party, skill, characteristic, extraMod, spec);
  if (!leader) return null;
  const support = soutienDetail(party, leader.actor, skill, characteristic, spec, eligible);
  return {
    actor: leader.actor,
    value: leader.value + support.bonus,
    base: skillBaseValue(leader.actor, skill, spec, characteristic),
    support,
  };
}

/** DÉTAIL de SOUTIEN (LDB 12 l.187-200) pour un meneur DONNÉ — SOURCE UNIQUE : combien de membres
 *  soutiennent, le bonus total, et QUI (`ids`). Brique partagée par `partyAssisted` ET les Tests à
 *  sélecteur de candidat (Tests de scène) où le meneur n'est pas le « meilleur » mais le candidat
 *  considéré : +10 par AUTRE membre VIVANT et ÉLIGIBLE (`hasSkillAdvance`, l.195 ; Test de pure
 *  Caractéristique → tous), plafonné au Bonus de la Caractéristique testée du meneur (l.198). `eligible` (l.196, « doit
 *  normalement être adjacent ») : prédicat GÉOMÉTRIQUE optionnel fourni par l'appelant (moteur PUR — la
 *  position/adjacence vit côté état) ; absent = comportement inchangé (aucune géométrie, ex. hors combat).
 *  Le plafond RETIENT les premiers éligibles dans l'ordre du groupe : `ids.length === count`. */
export function soutienDetail(
  party: Combatant[],
  leader: Combatant,
  skill?: string,
  characteristic?: CharKey,
  spec?: string,
  eligible?: (c: Combatant) => boolean,
): SupportDetail {
  const elig = party.filter((c) => c.id !== leader.id && !c.dead
    && (skill ? hasSkillAdvance(c, skill, spec) : true) // LDB 12 l.195
    && (eligible ? eligible(c) : true));
  const ck = effectiveSkillCharKey(leader, skill, { explicit: characteristic, spec });
  const b = assistBonus(elig.length, bonus(effectiveChar(leader, ck)));
  return { count: b / 10, bonus: b, ids: elig.slice(0, b / 10).map((c) => c.id) };
}

/** Bonus de SOUTIEN seul (`soutienDetail().bonus`) — pour les sites qui n'ont qu'un nombre à porter. */
export function soutienBonus(
  party: Combatant[],
  leader: Combatant,
  skill?: string,
  characteristic?: CharKey,
  spec?: string,
  eligible?: (c: Combatant) => boolean,
): number {
  return soutienDetail(party, leader, skill, characteristic, spec, eligible).bonus;
}

/** Meilleur résultat SOUTENU d'un groupe pour une Scène à compétences AU CHOIX (ADE II 8) : pour chaque
 *  option, `partyAssisted(crew, skill…)` (meneur + Soutien LDB 12) ; on garde l'option au plus haut score
 *  soutenu (argmax `maxBy`). `crew` vide ⇒ null. Réutilise `partyAssisted` + `maxBy`. Miroir SOUTENU de
 *  `bestForSkills` : là où celle-ci prend le meilleur PJ SEUL, celle-ci fait coopérer TOUT l'équipage
 *  affecté (les Personnages engagés dans la Scène, ADE II 8 l.153/157) — le meneur lance, les assistants
 *  capables ajoutent +10 chacun (plafonné). L'option de PURE Caractéristique (`skills` vide) reste possible. */
export function bestAssistedOption(
  crew: Combatant[],
  skills: RefDesignee[] | undefined,
  char: CharKey | undefined,
): { actor: Combatant; value: number; skillId?: string; spec?: string; support: SupportDetail } | null {
  // Options = les compétences AU CHOIX de la Scène, ou une unique option de PURE Caractéristique (repli
  // char-only, calqué sur `bestForSkills`). Chaque option est résolue en Soutien sur TOUT l'équipage `crew`.
  const options: RefDesignee[] = skills?.length ? skills : [{ id: undefined as unknown as string, spec: undefined }];
  const perOption = options
    .map((opt) => ({ opt, res: partyAssisted(crew, opt.id, char, undefined, opt.spec) }))
    .filter((x): x is { opt: RefDesignee; res: NonNullable<ReturnType<typeof partyAssisted>> } => x.res !== null);
  const r = maxBy(perOption, (x) => x.res.value);
  return r
    ? { actor: r.item.res.actor, value: r.item.res.value, skillId: r.item.opt.id, spec: r.item.opt.spec, support: r.item.res.support }
    : null;
}
