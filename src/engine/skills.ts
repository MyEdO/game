/**
 * Valeur d'une Compétence/Caractéristique pour les Tests « dans le monde »
 * (hors combat) : Caractéristique + Augmentations de la compétence.
 */
import { refCouvre, type RefDesignee } from '../data/schemas/grammaire/ref';
import type { SujetDuJet } from '../data/schemas/grammaire/mecanique';
import { Combatant, CharKey } from './types';
import { byId, psychologies, refLabel, testSkillLabel } from '../data';
import { t, deElide } from '../i18n';
import type { PlayerText } from '../i18n/playerText';
import { itemCapability } from './capabilities';
import { effectiveChar, bonusDe } from './characteristics';
import { assistBonus } from './tests';
import {
  testStatePenalty,
  testStatePenaltyParts,
  activeCharTestMod,
  activeCharTestModParts,
  passivePartLine,
  isMovementSkill,
  isOutOfAction,
} from './conditions';
import { agilityTestPenalty } from './encumbrance';
import { traumaSkillPenalty, traumaSkillPenaltyParts, passiveSkillSum, passiveSkillParts, passiveTestMod, passiveTestModParts } from './trauma';
import type { GameOp, PairedSense } from './ops';
import type { ModLine } from './combat';
import { RULE_REF } from './ruleRefs';
import { rule } from './policy';
import { effectivePsychTraits, isPsychImmune, vise, type SourcePsy } from './psychology';
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
  const pick = alt.chars[String(rule(alt.gatedByRule.id))];
  if (!pick) return ck;
  // Liste = la MEILLEURE des Caractéristiques citées chez ce porteur (argmax UNIQUE du moteur).
  return Array.isArray(pick) ? (maxBy(pick, (k) => effectiveChar(c, k))?.item ?? ck) : pick;
}

/** Caractéristique (CharKey STABLE) d'une compétence par son `id`. `SkillData.characteristic` EST
 *  une CharKey ('dexterite'…), multilangue-safe — jamais une conversion par libellé. */
export function skillCharKeyById(skillId: string): CharKey | undefined {
  return byId('skill', skillId)?.characteristic;
}

/** Caractéristique EFFECTIVE d'un Test de compétence — POINT UNIQUE (consommé par `testValue` ET
 *  `castingValue`) : explicite > carac de l'INSTANCE possédée (défaut DATA-DRIVEN : un statbloc peut
 *  porter une carac alternative) > carac de la Compétence (JSON, par id) > repli ; PUIS surcharge par
 *  règle optionnelle « caractéristique alternative » (`altCharKey` : Métier/Intimidation/Magie ogre). */
export function effectiveSkillCharKey(c: Combatant, sujet: SujetDuJet, fallback: CharKey = 'dexterite'): CharKey {
  const { skill: ref, characteristic: explicit } = sujet;
  if (explicit) return explicit;
  const sk = ref ? c.skills.find((s) => refCouvre(ref, s)) : undefined;
  let ck: CharKey = sk?.characteristic ?? (ref ? skillCharKeyById(ref.id) : undefined) ?? fallback;
  if (ref) ck = altCharKey(c, ref.id, ck);
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
export function testValue(c: Combatant, sujet: SujetDuJet, sense?: PairedSense): number {
  const { skill: ref, characteristic } = sujet;
  if (!ref && !characteristic) return 0;
  // `ref.id` = skillId STABLE (multilingue : jamais un libellé). La compétence possédée est trouvée par id ;
  // `ref.spec` cible une spécialisation précise (Savoir (Magie), Métier (Forgeron)…) quand le héros en possède
  // plusieurs avec des avances différentes — sinon (spec absent) la première instance de l'id suffit.
  const skill = ref?.id;
  const sk = ref ? c.skills.find((s) => refCouvre(ref, s)) : undefined;
  // Caractéristique : POINT UNIQUE partagé avec castingValue (carac d'instance data-driven + carac alternative).
  const ck = effectiveSkillCharKey(c, sujet);
  const base = effectiveChar(c, ck);
  const states = testStatePenalty(c, skill, { sense });
  const enc = ck === 'agilite' ? agilityTestPenalty(c) : 0; // charge : couche d'ÉTAT orthogonale (≠ passif d'élément)
  const traumaSkill = traumaSkillPenalty(c, skill, sense); // séquelle permanente (fracture Langue l.300 ; Surdité l.363)
  // Passifs INTRINSÈQUES d'élément (Σ), tous via le collecteur unifié : compétence nommée + port d'armure
  // (`passiveSkillSum` : Groin poilu +10 Pistage, −N% en X du port d'armure) + mods de Test char-qualifiés
  // (`passiveTestMod` : mutation Visage inversé −20 Soc, objet Laid −Soc).
  const passive = passiveSkillSum(c, skill) + passiveTestMod(c, ck);
  // Mods de Test char-QUALIFIÉS d'effets ACTIFS (op `testMod{characteristic}` exécutée — Mystracine « +10 aux
  // Tests d'E et de FM, −10 Ag/I/Int », LDB 71 l.33) : sommés pour la seule carac testée ; les mods
  // GLOBAUX (sans char) sont déjà comptés via `testStatePenalty`. `movementOnly`
  // (#193, Genou démis « Tests impliquant cette jambe ») restreint aux Tests classés « déplacement ».
  const fxChar = activeCharTestMod(c, ck, { movement: isMovementSkill(skill) });
  return base + (sk?.advances ?? 0) + states + enc + traumaSkill + passive + fxChar + skillToolMod(c, skill);
}

/** Ce qu'un Test désigne : sa Compétence (`TestNomme` d'une fiche, `RefDesignee` d'une donnée) ou sa
 *  seule Caractéristique. */
export type TestDesigne = { readonly skill: RefDesignee; readonly characteristic?: undefined } | { readonly characteristic: CharKey; readonly skill?: undefined };

/**
 * DÉCOMPOSITION EXHAUSTIVE de `testValue` en composantes NOMMÉES — LE socle d'affichage de tout Test
 * hors combat, et la garantie que l'écran annonce ce que le moteur calcule. INVARIANT vérifié par la
 * garde `test-value-parts.test.ts` :
 *
 *     testValue(c, sujet, sense) === skillBaseValue(c, sujet) + Σ testValueParts(…)
 *
 * Un poste AJOUTÉ à `testValue` sans son producteur de parts casse cette garde — c'est ELLE qui
 * interdit la dérive, pas ce commentaire. Chaque part tire son libellé de la DONNÉE (le `src` du
 * collecteur `passiveMods`, via `passivePartLine`/`refLabel`) : aucun branchement par id d'entité.
 * L'ORDRE des postes suit celui de `testValue`, poste pour poste.
 */
export function testValueParts(c: Combatant, sujet: SujetDuJet, sense?: PairedSense): ModLine[] {
  const { skill: ref, characteristic } = sujet;
  if (!ref && !characteristic) return []; // ni compétence ni caractéristique : `testValue` rend 0
  const skill = ref?.id;
  const ck = effectiveSkillCharKey(c, sujet);
  const out: ModLine[] = [];
  out.push(...testStatePenaltyParts(c, skill, { sense })); // États + Sort global + symptôme global (LDB 16 / MSRC 16)
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
export function skillBaseValue(c: Combatant, sujet: SujetDuJet): number {
  const { skill: ref, characteristic } = sujet;
  if (!ref && !characteristic) return 0;
  const adv = ref ? c.skills.find((s) => refCouvre(ref, s))?.advances ?? 0 : 0;
  return effectiveChar(c, effectiveSkillCharKey(c, sujet)) + adv;
}

/** Valeur de Test « brute » pour un Test de COMBAT : `testValue` PRIVÉE de la pénalité d'États HORS combat
 *  (`testStatePenalty`, qu'elle inclut déjà) — pour que l'appelant ajoute la pénalité de COMBAT
 *  (`combatTestPenalty`) UNE SEULE fois, sans double-compte. = Caractéristique effective + avances + passifs
 *  intrinsèques + Encombrement/Traumatisme, SANS la pénalité d'État (réappliquée en version combat par
 *  l'appelant). Utilisée par les Tests de RÉCUPÉRATION d'États (Empoisonné… : −10 d'État compté une fois). */
export function rawCombatTestBase(c: Combatant, sujet: SujetDuJet): number {
  return testValue(c, sujet) - testStatePenalty(c, sujet.skill?.id);
}

/** Le personnage possède-t-il la compétence `skillId` (et, si `spec` fourni, cette spécialisation —
 *  ex. Projectiles (Poudre noire)) ? Par id STABLE. Sert aux modulateurs (ex. `easierIf`). */
export function actorHasSkill(c: Combatant, ref: RefDesignee): boolean {
  return c.skills.some((s) => refCouvre(ref, s));
}

/** Le personnage POSSÈDE-t-il la Compétence (Base = toujours ; Avancée = au moins une Augmentation) ?
 *  LDB 09 l.25, LDB 09 l.30. `spec` cible une spécialisation précise (sinon la première instance de l'id,
 *  comme `skillBaseValue`). Une Compétence `specsSoeursDeBase` dont le porteur a augmenté UNE
 *  Spécialisation est de Base dans toutes les autres : LDB 09 l.571. */
export function possesses(c: Combatant, ref: RefDesignee): boolean {
  const sd = byId('skill', ref.id);
  if (!sd) return false;
  const inst = c.skills?.find((s) => refCouvre(ref, s));
  const soeurAugmentee = sd.specsSoeursDeBase === true && (c.skills ?? []).some((s) => refCouvre({ id: ref.id }, s) && (s.advances ?? 0) > 0);
  return sd.acces === 'base' || (inst?.advances ?? 0) > 0 || soeurAugmentee;
}

/** Qui peut TENTER un Test ACTIF — le mener, le soutenir, s'y porter candidat. LDB 09 l.30, LDB 16 l.113.
 *  Contrat : Test ACTIF seulement ; un Test SUBI (LDB 16 l.74) ne le lit pas. Sans `skill` (Test de
 *  Caractéristique), seule la mise hors d'action compte. */
export function peutTenter(c: Combatant, sujet: SujetDuJet = {}): boolean {
  return !isOutOfAction(c) && (!sujet.skill || possesses(c, sujet.skill));
}

/** Ce que nomme un refus : le Test d'une Compétence (spécialisation comprise) ou d'une Caractéristique, ou une action. */
type QuoiRefuse = TestDesigne | { action: string };
function quoiRefuse(quoi: QuoiRefuse): PlayerText {
  return 'action' in quoi ? t('refus.quoiAction', { action: quoi.action }) : t('refus.quoiTest', { de: deElide(testSkillLabel(quoi)) });
}

/** Refus NOMMÉ du Test (par Compétence) ou de l'action que personne dans le groupe ne peut tenter
 *  (`peutTenter`). LDB 09 l.30. */
export function refusPersonneNePeutTenter(quoi: QuoiRefuse): PlayerText {
  return t('refus.personneNePeutTenter', { quoi: quoiRefuse(quoi) });
}

/** Refus NOMMÉ, décliné par ACTEUR, d'un Test qu'il ne peut pas tenter (`peutTenter`). LDB 09 l.30. */
export function refusNePeutTenter(c: Combatant, quoi: QuoiRefuse): PlayerText {
  return t('refus.nePeutTenter', { qui: c.label, quoi: quoiRefuse(quoi) });
}

/** Le personnage a-t-il AU MOINS UNE Augmentation dans `skillId` (spécialisation ciblée si `spec`) ?
 *  Prédicat d'éligibilité au SOUTIEN — LDB 12 l.195. Plus strict que `actorHasSkill` (simple présence). */
function hasSkillAdvance(c: Combatant, ref: RefDesignee): boolean {
  return c.skills.some((s) => refCouvre(ref, s) && (s.advances ?? 0) >= 1);
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
  const interlocuteur: SourcePsy = { genre: 'interlocuteur', groups: targetGroups };
  const possede = effectivePsychTraits(tester).some((t) => t.type === type && t.cible && vise(t.cible, interlocuteur, 'percu', tester));
  if (!possede) return false;
  const actif = (tester.psychState ?? []).some((p) => p.type === type && p.active && p.cible && vise(p.cible, interlocuteur, 'percu', tester));
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
 *  Vrai si la caractéristique sous-jacente est `sociabilite` (Charme, Marchandage, Intimidation, Commérage…). */
export function isSocialTest({ skill, characteristic }: SujetDuJet): boolean {
  if (characteristic) return characteristic === 'sociabilite';
  if (skill) return skillCharKeyById(skill.id) === 'sociabilite';
  return false;
}

/** Meilleur membre du groupe pour un test donné, parmi ceux qui peuvent le tenter (`peutTenter`). `extraMod` ajoute un modificateur PAR acteur (ex. malus
 *  psy de Sociabilité, qui dépend du personnage) — la valeur effective sert au choix ET au résultat.
 *  `sense` (optionnel) : transmis tel quel à `testValue` (sens NARRATIVEMENT sollicité par CE Test précis). */
export function partyBest(
  party: Combatant[],
  sujet: SujetDuJet,
  extraMod?: (c: Combatant) => number,
  sense?: PairedSense,
): { actor: Combatant; value: number } | null {
  const r = maxBy(party.filter((c) => peutTenter(c, sujet)), (c) => testValue(c, sujet, sense) + (extraMod?.(c) ?? 0));
  return r ? { actor: r.item, value: r.value } : null;
}

/** Meilleur PJ pour une liste de Tests AU CHOIX (celui qui donne la plus haute valeur décide) ; le
 *  `test` rendu EST l'élément retenu de `tests`. `sense` (optionnel) : transmis tel quel à
 *  `partyBest`/`testValue`. */
export function bestForTests(
  party: Combatant[],
  tests: readonly TestDesigne[],
  sense?: PairedSense,
): { actor: Combatant; value: number; test: TestDesigne } | null {
  // Le meilleur ACTEUR par Test, puis argmax sur les Tests (first-max via `maxBy`). Un Test ne
  // concourt que si le groupe fournit un porteur (`partyBest` null ⇒ groupe vide ⇒ résultat null).
  const perTest = tests.flatMap((test) => {
    const best = partyBest(party, test, undefined, sense);
    return best ? [{ test, best }] : [];
  });
  const r = maxBy(perTest, (x) => x.best.value);
  return r ? { actor: r.item.best.actor, value: r.item.best.value, test: r.item.test } : null;
}

/** Meilleur PJ pour un Test COMBINÉ de deux Tests (LDB 12 l.202-206) : celui dont le PLUS FAIBLE des
 *  deux (le facteur limitant du Test combiné) est le plus élevé. Renvoie l'acteur + ses deux valeurs. */
export function bestForCombined(
  party: Combatant[],
  t1: TestDesigne,
  t2: TestDesigne,
): { actor: Combatant; value1: number; value2: number } | null {
  const able = party.filter((c) => peutTenter(c, t1) && peutTenter(c, t2));
  const r = maxBy(able, (c) => Math.min(testValue(c, t1), testValue(c, t2)));
  if (!r) return null;
  return { actor: r.item, value1: testValue(r.item, t1), value2: testValue(r.item, t2) };
}

/** Meilleure OPTION TENTABLE pour un acteur parmi un catalogue d'options portant des Tests (`testsDe`) :
 *  score d'une option = le meilleur Test que l'acteur peut tenter dedans (`bestForTests([actor], …)`,
 *  `peutTenter`) ; une option qu'il ne peut pas tenter ne concourt pas. Argmax via `maxBy` ; `null` si
 *  aucune option n'est tentable. LDB 09 l.30. */
export function bestSkilledOption<T>(
  actor: Combatant,
  options: readonly T[],
  testsDe: (option: T) => readonly TestDesigne[],
): { option: T; value: number } | null {
  const tentables = options.flatMap((option) => {
    const b = bestForTests([actor], testsDe(option));
    return b ? [{ option, value: b.value }] : [];
  });
  return maxBy(tentables, (x) => x.value)?.item ?? null;
}

/** DÉTAIL d'un Soutien (LDB 12 l.187-200) tel qu'il s'AFFICHE : combien de membres soutiennent et le
 *  bonus total qu'ils octroient. FORME UNIQUE, partagée par le moteur (`partyAssisted`/
 *  `bestAssistedOption`), les pendings qui la portent (`noyau/pendings.ts`) et la primitive de
 *  breakdown qui la rend en ligne de mod (`soutienMod`). */
export interface SupportDetail {
  count: number;
  bonus: number;
  /** Les SOUTIENS eux-mêmes, par id de Combattant — la provenance du bonus est une STRUCTURE, jamais
   *  un libellé composé. Rendue en micro-chips (`ModLine.by`). */
  ids: string[];
}

/** Ligne de mod « Soutien » (LDB 12) — SOURCE UNIQUE : le bonus d'un jet de GROUPE soutenu s'affiche
 *  comme TOUT autre modificateur (ligne du breakdown, verte si +), pas fondu dans la base ni relégué
 *  en sous-titre. `undefined` si personne ne soutient (aucune ligne « Soutien +0 » inventée).
 *  La provenance ne porte QUE des ids : le moteur est pur, et le NOM se résout au RENDU (couture
 *  unique) — un résolveur à fournir par appelant s'oublie, et l'écran affiche
 *  alors l'id brut (recette B3a). */
export function soutienMod(support?: SupportDetail): ModLine | undefined {
  if (!support || support.count <= 0) return undefined;
  return {
    label: refLabel('regles', RULE_REF.soutien),
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
  opts?: { support?: SupportDetail; sujet?: SujetDuJet; sense?: PairedSense; fused?: number },
): { base: number; mods: ModLine[]; exact: boolean } {
  const sup = supportSplit(value, opts?.support);
  const sujet = opts?.sujet;
  // Rien à décomposer (côté MONDE, Test sans compétence ni caractéristique) : la valeur EST la base,
  // il n'y a aucune reconstruction à rater.
  if (!c || !sujet || (!sujet.skill && !sujet.characteristic)) return { ...sup, exact: true };
  const parts = testValueParts(c, sujet, opts.sense);
  const sum = parts.reduce((s, p) => s + p.value, 0);
  const nu = skillBaseValue(c, sujet);
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
  sujet: SujetDuJet,
  extraMod?: (c: Combatant) => number,
  eligible?: (c: Combatant) => boolean,
): { actor: Combatant; value: number; base: number; support: SupportDetail } | null {
  return soutenuPar(party, partyBest(party, sujet, extraMod), sujet, eligible);
}

/** Le Test SOUTENU d'un meneur déjà retenu (`leader`, sa valeur seule) : `partyAssisted` sans le choix du meneur. */
function soutenuPar(
  party: Combatant[],
  leader: { actor: Combatant; value: number } | null,
  sujet: SujetDuJet,
  eligible?: (c: Combatant) => boolean,
): { actor: Combatant; value: number; base: number; support: SupportDetail } | null {
  if (!leader) return null;
  const support = soutienDetail(party, leader.actor, sujet, eligible);
  return {
    actor: leader.actor,
    value: leader.value + support.bonus,
    base: skillBaseValue(leader.actor, sujet),
    support,
  };
}

/** DÉTAIL de SOUTIEN (LDB 12 l.187-200) pour un meneur DONNÉ — SOURCE UNIQUE : combien de membres
 *  soutiennent, le bonus total, et QUI (`ids`). Brique partagée par `partyAssisted` ET les Tests à
 *  sélecteur de candidat (Tests de scène) où le meneur n'est pas le « meilleur » mais le candidat
 *  considéré : +10 par AUTRE membre qui peut tenter (`peutTenter`) et ÉLIGIBLE (`hasSkillAdvance`, l.195 ; Test de pure
 *  Caractéristique → tous), plafonné au Bonus de la Caractéristique testée du meneur (l.198). `eligible` (l.196, « doit
 *  normalement être adjacent ») : prédicat GÉOMÉTRIQUE optionnel fourni par l'appelant (moteur PUR — la
 *  position/adjacence vit côté état) ; absent = comportement inchangé (aucune géométrie, ex. hors combat).
 *  Le plafond RETIENT les premiers éligibles dans l'ordre du groupe : `ids.length === count`. */
export function soutienDetail(
  party: Combatant[],
  leader: Combatant,
  sujet: SujetDuJet,
  eligible?: (c: Combatant) => boolean,
): SupportDetail {
  const ref = sujet.skill;
  const elig = party.filter((c) => c.id !== leader.id && peutTenter(c)
    && (ref ? hasSkillAdvance(c, ref) : true) // LDB 12 l.195
    && (eligible ? eligible(c) : true));
  const ck = effectiveSkillCharKey(leader, sujet);
  const b = assistBonus(elig.length, bonusDe(leader, ck));
  return { count: b / 10, bonus: b, ids: elig.slice(0, b / 10).map((c) => c.id) };
}

/** Bonus de SOUTIEN seul (`soutienDetail().bonus`) — pour les sites qui n'ont qu'un nombre à porter. */
export function soutienBonus(
  party: Combatant[],
  leader: Combatant,
  sujet: SujetDuJet,
  eligible?: (c: Combatant) => boolean,
): number {
  return soutienDetail(party, leader, sujet, eligible).bonus;
}

/** Meilleur résultat SOUTENU d'un groupe pour une Scène à Tests AU CHOIX (ADE II 8) : pour chaque
 *  Test, `partyAssisted(crew, …)` (meneur + Soutien LDB 12) ; on garde le Test au plus haut score
 *  soutenu (argmax `maxBy`), rendu tel que l'élément de `tests`. `crew` vide ⇒ null. Réutilise `partyAssisted` + `maxBy`. Miroir SOUTENU de
 *  `bestForTests` : là où celle-ci prend le meilleur PJ SEUL, celle-ci fait coopérer TOUT l'équipage
 *  affecté (les Personnages engagés dans la Scène, ADE II 8 l.153/157) — le meneur lance, les assistants
 *  capables ajoutent +10 chacun (plafonné). */
export function bestAssistedOption(
  crew: Combatant[],
  tests: readonly TestDesigne[],
  meneur?: Combatant,
): { actor: Combatant; value: number; test: TestDesigne; support: SupportDetail } | null {
  // Chaque Test est résolu en Soutien sur TOUT l'équipage `crew`, mené par `meneur` quand le geste le
  // nomme, par le plus compétent sinon.
  const perTest = tests.flatMap((test) => {
    const res = meneur
      ? soutenuPar(crew, partyBest([meneur], test), test)
      : partyAssisted(crew, test);
    return res ? [{ test, res }] : [];
  });
  const r = maxBy(perTest, (x) => x.res.value);
  return r ? { actor: r.item.res.actor, value: r.item.res.value, test: r.item.test, support: r.item.res.support } : null;
}
