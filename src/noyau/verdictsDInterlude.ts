/**
 * Verdicts de l'INTERLUDE, en module FEUILLE : les gestes d'Activité (`noyau/interludeFlow.ts`,
 * `noyau/favorFlow.ts`) et l'écran d'interlude les lisent, sans que l'un importe l'autre.
 * Le geste applique le verdict en tête (`refuseSi`) ; l'écran le lit sans le recalculer.
 */
import { advancementBaseId, findCareerById, findSpellById, findTalentById, findTrappingById, levelsForCareer, libelleOuAbsence, refLabel } from '../data';
import { interludeEventFor, type InterludeEventFx } from '../data/interludeEvents';
import { t, type MsgKey } from '../i18n';
import type {
  IdDActivite, IdDeDepot, IdDeQualiteDArtisanat, IdDEntrainement, IdDeSort, IdDeTalent, IdDeTraitPsyPorte, IdDObjet, IdDObjetDuCatalogue,
} from './designations';
import { possesses, type TestDesigne } from '../engine/skills';
import { rollLine, type RollLineParts } from './ligneDeJet';
import { buildWeapon } from '../engine/items';
import { combatValue, weaponSkillId, type ModLine } from '../engine/combat';
import { focusSkillFor, focusValueOf } from '../engine/magic';
import { RULE_REF } from '../engine/ruleRefs';
import { effectiveEntry } from '../engine/variants';
import type { CharKey, Combatant, Difficulty, ItemInstance } from '../engine/types';
import { favorRequiredActivities } from '../engine/favor';
import { learnableSpells } from '../engine/grimoire';
import { reussiteSansObjet, type GameOp } from '../engine/ops';
import type { PsychTrait } from '../engine/psychology';
import { identiteDeCiblage, refDeCible, type RefDeCible } from '../engine/psych/ciblage';
import { actorStatus } from '../engine/social';
import { fromBrass, toBrass, toMoney, priceToMoney, formatMoney } from '../engine/money';
import {
  ACTIVITIES, RESOLVER_OWNER, activityAvailableAt, activityById, cleDEntrainement, craftSpecOf, entrainementOptions, learnableTalents, metierOf, orderBlockOf, statusIncomeMax, travelActivitySpec,
  type ActivityDef, type EntrainementOption, type GenreDeDepot, type LearnOption, type ResolverOf, type TravelActivitySpec, type VoieDActivite,
} from '../engine/activities';
import { outOfTradeReason } from '../engine/disponibilite';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { availabilitySchema } from '../data/schemas/grammaire/valeurs';
import { refCouvre } from '../data/schemas/grammaire/ref';
import type { Jeu } from './etat';
import { refusDeBourse } from './bourseFlow';
import { refusDePx } from './depenseDePx';
import { bourseOf } from '../engine/bourse';
import { aubeApresNuits } from '../engine/clock';
import { garanti } from '../lib/garanti';

/** L'état que lisent les verdicts d'interlude. */
export type EtatDInterlude = Pick<Jeu, 'interlude' | 'party' | 'bank'>;

/** Les Événements de la période sont-ils encore à tirer (phase `'tirage'`, #942 L7) ? LDB 22 l.5 */
export function interludeDrawPending(s: Pick<Jeu, 'interlude'>): boolean {
  return s.interlude?.phase === 'tirage';
}

/** Les héros dont le dé d'Événement reste à poser pendant le tirage, dans l'ordre du groupe ; vide hors
 *  tirage. Le tirage peut rester ouvert sans dé en attente : le dénouement de groupe reste alors à valider. */
export function desEnAttente(s: EtatDInterlude): Combatant[] {
  const itl = s.interlude;
  if (!itl || !interludeDrawPending(s)) return [];
  return s.party.filter((h) => itl.perHero[h.id] && itl.perHero[h.id].eventRoll == null);
}

const nomDuHeros = (s: EtatDInterlude, heroId: string): string =>
  libelleOuAbsence(s.party.find((h) => h.id === heroId), 'heros', heroId);

/** Refus d'un geste d'interlude pendant le tirage des Événements : la raison affichée, ou `null`. Verdict
 *  UNIQUE des gestes qui ne consomment pas d'Activité (engager un Artisanat, retirer une planque). LDB 22 l.5 */
export function refusDuTirage(s: EtatDInterlude, heroId: string): string | null {
  return interludeDrawPending(s) ? t('if.drawPending', { name: nomDuHeros(s, heroId) }) : null;
}

/** Refus d'un geste qui CONSOMME une Activité d'interlude : tirage en attente, puis plus d'Activité
 *  restante. Verdict UNIQUE des gestes d'Activité et de l'écran. LDB 23 l.5 */
export function refusDActivite(s: EtatDInterlude, heroId: string): string | null {
  return refusDuTirage(s, heroId)
    ?? ((s.interlude?.perHero[heroId]?.left ?? 0) <= 0 ? t('if.noActivityLeft', { name: nomDuHeros(s, heroId) }) : null);
}

/** Refus de retirer le dépôt `depotId` : la planque n'attend que le tirage, l'investissement consomme une
 *  Activité de son dépositaire, le Mécénat s'ouvre comme son Activité (`refusDOuvertureDActivite` : lieu
 *  et Test d'Évaluation tentable compris). Verdict UNIQUE de `bankWithdraw` et de l'écran ; `null` pour un
 *  dépôt absent, que le geste ignore. LDB 23 l.168-170, ACE 12 l.47-49 ; LDB 09 l.30 */
export function refusDeRetrait(s: EtatDeDepot, depotId: IdDeDepot): string | null {
  const dep = (s.bank ?? []).find((d) => d.uid === depotId);
  if (!dep) return null;
  const mecenat = dep.kind === 'mecenat' ? activiteDeMecenat() : undefined;
  if (mecenat) return refusDOuvertureDActivite(s, dep.heroId, mecenat, { depotId });
  return dep.kind === 'planque' ? refusDuTirage(s, dep.heroId) : refusDActivite(s, dep.heroId);
}

/** L'Activité de Mécénat, variante d'Opération bancaire. ACE 12 l.45-49 */
const activiteDeMecenat = (): ActivityDef | undefined => ACTIVITIES.find((a) => a.resolver === 'mecenat');

/** Classe du héros, `id` STABLE (`ClassData.id`) — les événements visent une Classe par id
 *  (`revenueClasses`/`revenueBlockedClasses`, eux aussi en id). Carrière → id de classe. */
export function heroClass(h: Combatant): string {
  return findCareerById(h.career ?? '')?.class.id ?? '';
}

/** Libellé de l'Événement d'un héros — appelé sous une garde `fx` (le dé et `fx` sont écrits ENSEMBLE
 *  au dénouement) ; sans dé, il se tait au lieu de nommer la première ligne du tableau. */
export const eventLabelOf = (st: { eventRoll?: number }): string =>
  st.eventRoll == null ? t('if.eventGeneric') : interludeEventFor(st.eventRoll).label;

/** Un Événement de la période qui vaut pour un héros : son id, son libellé et ses effets. */
export interface EffetDeLaPeriode { id: string; label: string; fx: InterludeEventFx }

/** Les Événements de la période qui valent pour le héros : le sien, puis chaque Événement de groupe
 *  (`partyWide`) tiré par un participant, une fois par Événement. LECTEUR UNIQUE des effets d'Événement.
 *  LDB 22 l.5 */
export function effetsDeLaPeriode(s: Pick<Jeu, 'interlude'>, heroId: string): EffetDeLaPeriode[] {
  const itl = s.interlude;
  const propre = itl?.perHero[heroId];
  if (!itl || !propre) return [];
  const vus = new Set<string>();
  const effets: EffetDeLaPeriode[] = [];
  for (const [tireur, st] of [[heroId, propre] as const, ...Object.entries(itl.perHero).filter(([id]) => id !== heroId)]) {
    if (!st.fx || (tireur !== heroId && !st.fx.partyWide)) continue;
    const id = st.eventRoll == null ? `sans-de-${tireur}` : interludeEventFor(st.eventRoll).id;
    if (vus.has(id)) continue;
    vus.add(id);
    effets.push({ id, label: eventLabelOf(st), fx: st.fx });
  }
  return effets;
}

/** Les Événements de la période qui modifient les Revenus du héros (`revenuePct`, Classe visée), et leur
 *  pourcentage cumulé : chacun vise le gain de base, ils s'additionnent. LDB 22 l.40, l.44, l.83, l.91 */
export function revenusDeLaPeriode(s: EtatDInterlude, heroId: string): { effets: EffetDeLaPeriode[]; pct: number } {
  const h = s.party.find((x) => x.id === heroId);
  const effets = h ? effetsDeLaPeriode(s, heroId).filter(({ fx }) => fx.revenuePct && (!fx.revenueClasses || fx.revenueClasses.some((c) => c === heroClass(h)))) : [];
  return { effets, pct: effets.reduce((n, e) => n + e.fx.revenuePct!, 0) };
}

/** Un Événement de la période bloque-t-il les Revenus pour la Classe du héros : la raison, ou `null`.
 *  Lu par la chronique ; le geste et l'écran lisent `refusDeRevenus`. LDB 22 */
export function blocageDeRevenus(s: EtatDInterlude, heroId: string): string | null {
  const h = s.party.find((x) => x.id === heroId);
  const bloquant = effetBloquantLesRevenus(s, heroId);
  return h && bloquant ? t('if.incomeBlocked', { name: h.label, event: bloquant.label }) : null;
}

/** L'Événement de la période qui interdit les Revenus à la Classe du héros, s'il en est un. LDB 22 */
export function effetBloquantLesRevenus(s: EtatDInterlude, heroId: string): EffetDeLaPeriode | undefined {
  const h = s.party.find((x) => x.id === heroId);
  return h && effetsDeLaPeriode(s, heroId).find(({ fx }) => fx.revenueBlockedClasses?.some((c) => c === '*' || c === heroClass(h)));
}

/** Refus d'entreprendre les Revenus : celui de toute Activité, puis le blocage de l'Événement. Verdict
 *  UNIQUE du geste, de l'entrée et du volet. LDB 22, LDB 23 l.5 */
export function refusDeRevenus(s: EtatDInterlude, heroId: string): string | null {
  return refusDActivite(s, heroId) ?? blocageDeRevenus(s, heroId);
}

const herosDe = (s: EtatDInterlude, heroId: string): Combatant | undefined => s.party.find((h) => h.id === heroId);

/** Refus d'engager un Artisanat : tirage, ouvrage en cours, Métier absent, puis l'ouvrage `trappingId`
 *  (inconnu, hors commerce, matériaux hors de la bourse). Sans ouvrage choisi, seul le héros est jugé.
 *  Verdict UNIQUE de l'ouvrage composé (`refusDeLaComposition`) et du volet. LDB 23 l.74-78 */
export function refusDArtisanat(s: EtatDInterlude, heroId: string, trappingId?: string): string | null {
  const refus = refusDuTirage(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  if (h.craft) return t('if.craftBusy', { name: h.label, label: findTrappingById(h.craft.trappingId)?.label ?? h.craft.trappingId });
  if (!metierOf(h)) return t('if.craftNoSkill', { name: h.label });
  if (trappingId == null) return null;
  const tr = findTrappingById(trappingId);
  if (!tr) return t('if.trappingUnknown', { id: trappingId });
  const spec = craftSpecOf(tr);
  if (!spec) return t('trade.craftRefused', { reason: outOfTradeReason(tr.label) });
  return refusDeBourse(h, fromBrass(spec.materialsBrass), 'if.craftMaterialsKo');
}

/** L'option d'Apprentissage particulier (`learnableTalents`, la liste du volet) du Talent `talentId`, ou
 *  `undefined` : Talent de carrière, au Maxi ou à spécialisation. LDB 23 l.68 */
export function optionDApprentissage(h: Combatant, talentId: string): LearnOption | undefined {
  return learnableTalents(h).find((o) => o.id === talentId);
}

/** Refus d'un Talent qu'Apprentissage particulier ne peut pas enseigner au héros : inconnu, ou hors de
 *  `learnableTalents`. LDB 23 l.68 */
function refusDuTalentAApprendre(h: Combatant, talentId: string): string | null {
  if (!findTalentById(talentId)) return t('if.talentUnknown', { id: talentId });
  return optionDApprentissage(h, talentId) ? null : t('if.talentNonApprenable', { name: h.label, label: refLabel('talents', { id: talentId }) });
}

/** Refus d'un Apprentissage particulier AVANT le tirage du tuteur : Activité, Talent à apprendre, PX, puis
 *  une bourse sous le tuteur le MOINS cher (fourchette de l'option). Le tirage se juge après, au même
 *  message près. Verdict UNIQUE du geste et du volet. LDB 23 l.66-72 */
export function refusDApprentissage(s: EtatDInterlude, heroId: string, talentId: string): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  const opt = optionDApprentissage(h, talentId);
  if (!opt) return refusDuTalentAApprendre(h, talentId);
  return refusDePx(h, opt.xpCost) ?? refusDeBourse(h, fromBrass(opt.tutorMinBrass), 'if.tuteurMinKo');
}

/** L'option d'Entraînement (`entrainementOptions`) de clé `cle` (`cleDEntrainement`), ou `undefined` : hors carrière
 *  seulement. */
export function optionDEntrainement(h: Combatant, cle: IdDEntrainement): EntrainementOption | undefined {
  return entrainementOptions(h).find((o) => cleDEntrainement(o) === cle);
}

/** Refus d'un Entraînement AVANT le tirage du tuteur : Activité, option hors carrière, PX, puis une bourse
 *  sous le tuteur le MOINS cher (`entrainementTutorRange`). Verdict UNIQUE du geste et du volet. LDB 23 l.132-136 */
export function refusDEntrainement(s: EtatDInterlude, heroId: string, cle: IdDEntrainement): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  const opt = optionDEntrainement(h, cle);
  if (!opt) return t('if.entrainementUnknown', { name: h.label });
  return refusDePx(h, opt.xpCost) ?? refusDeBourse(h, fromBrass(opt.tutorMinBrass), 'if.tuteurMinKo');
}

/** Refus de Passer commande `trappingId` : Activité, objet inconnu, hors commerce ou tenu en boutique
 *  (`orderBlockOf`), puis un prix hors de la bourse. Verdict UNIQUE de `orderItem` et du volet. LDB 23 l.178-184 */
export function refusDeCommande(s: EtatDInterlude, heroId: string, trappingId: string): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  const tr = findTrappingById(trappingId);
  if (!tr) return t('if.trappingUnknown', { id: trappingId });
  const block = orderBlockOf(tr);
  if (block === 'sans-prix') return t('trade.orderRefused', { reason: outOfTradeReason(tr.label) });
  if (block === 'stock-ordinaire') return t('if.orderInShops', { label: tr.label, availability: libelleDeValeur(availabilitySchema, String(tr.availability)) });
  return refusDeBourse(h, priceToMoney(tr.price), 'if.orderTooExpensive');
}

/** L'état que lit le devis d'un dépôt : celui de l'interlude, et le lieu (Mécénat). */
export type EtatDeDepot = EtatDInterlude & Pick<Jeu, 'lieu'>;


/** Devis d'un dépôt. `refus` : la raison affichée, ou `null` ; `debite` : ce que la bourse paie (sous de
 *  cuivre) ; `depose` : ce que la banque reçoit. */
export interface DevisDeDepot { refus: string | null; debite: number; depose: number }

/** Devis d'un dépôt de `montantBrass` : le refus (Activité, Statut Bronze pour investir, lieu et mise
 *  minimale du Mécénat, bourse), la somme débitée, et celle RÉELLEMENT déposée après le `bankPct` de
 *  l'Événement. Devis UNIQUE de `bankDeposit` et du volet. LDB 23 l.164-170, LDB 22 l.40, ACE 12 l.49 */
export function devisDeDepot(s: EtatDeDepot, heroId: string, kind: GenreDeDepot, montantBrass: number): DevisDeDepot {
  const debite = Math.max(1, Math.floor(montantBrass));
  // Les `bankPct` de la période s'additionnent sur la somme placée. LDB 22 l.40
  const pct = effetsDeLaPeriode(s, heroId).reduce((n, { fx }) => n + (fx.bankPct ?? 0), 0);
  const depose = pct ? Math.max(0, Math.floor((debite * (100 + pct)) / 100)) : debite;
  return { refus: refusDeDepot(s, heroId, kind, debite), debite, depose };
}

function refusDeDepot(s: EtatDeDepot, heroId: string, kind: GenreDeDepot, montant: number): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  if (kind === 'investir' && actorStatus(h).tier === 'bronze') return t('if.bankTierKo', { name: h.label });
  if (kind === 'mecenat') {
    const def = activiteDeMecenat();
    if (!def || !activityAvailableAt(def, s.lieu)) return t('if.mecenatHorsLieu');
    const min = toBrass(toMoney(def.minInvest ?? {}));
    if (montant < min) return t('if.mecenatMin', { min: formatMoney(fromBrass(min)) });
  }
  return refusDeBourse(h, fromBrass(montant), 'if.depositPurseKo');
}

/** Les cibles reçues par l'ouverture d'une Activité du catalogue : objet, sort, dépôt, Talent, instance de
 *  Trait psychologique. */
export interface CiblesChoisies { itemUid?: IdDObjet; spellId?: IdDeSort; depotId?: IdDeDepot; talentId?: IdDeTalent; traitPsy?: IdDeTraitPsyPorte }

/** Une instance de Trait psychologique visée : son type, et sa Cible si elle en porte une. */
export interface TraitPsyVise { type: string; cible?: RefDeCible }

/** Un Trait psychologique PORTÉ que le joueur peut choisir : sa clé d'instance (`identiteDeCiblage`), le Trait,
 *  et sa visée. */
export interface TraitPsyChoisissable { cle: string; trait: PsychTrait; vise: TraitPsyVise }

/** Les cibles qu'une Activité du catalogue offre au héros : armes inhabituelles non maîtrisées (ACE 12
 *  l.17-21), objets non identifiés (ADE II 4 l.41, ACE 12 l.33-42), sorts payants à mémoriser (ACE 12 l.55),
 *  Traits psychologiques portés quand la réussite en retire un au choix (ADE II 09 l.33). Listes UNIQUES du
 *  volet et du geste, vides hors de leur Activité. */
export interface CiblesDActivite {
  armes: ItemInstance[];
  artefacts: ItemInstance[];
  sorts: ReturnType<typeof learnableSpells>;
  traitsPsy: TraitPsyChoisissable[];
}

export function ciblesDActivite(h: Combatant, def: ActivityDef): CiblesDActivite {
  const items = h.items ?? [];
  return {
    armes: def.resolver === 'masterWeapon'
      ? items.filter((i) => (i.kind === 'melee' || i.kind === 'distance') && i.requiresMastery && i.trappingId && !(h.masteredWeapons ?? []).includes(i.trappingId))
      : [],
    artefacts: def.resolver === 'identify' || def.resolver === 'identifyByResearch' ? items.filter((i) => i.identified === false) : [],
    sorts: def.resolver === 'memorizeDiscount' ? learnableSpells(h).filter((x) => x.cost > 0) : [],
    traitsPsy: retireUnTraitAuChoix(def) ? traitsPsyChoisissables(h) : [],
  };
}

/** La réussite de `def` retire-t-elle un Trait psychologique au choix du joueur ? ADE II 09 l.33 */
const retireUnTraitAuChoix = (def: ActivityDef): boolean =>
  (opsDeReussite(def) ?? []).some((o) => o.op === 'removePsychTrait' && !o.psychType);

/** Les Traits psychologiques portés par `h`, un par INSTANCE (type et Cible). */
export function traitsPsyChoisissables(h: Combatant): TraitPsyChoisissable[] {
  const vus = new Map<string, PsychTrait>();
  for (const p of h.psychTraits ?? []) vus.set(identiteDeCiblage(p.type, p.cible), p);
  return [...vus].map(([cle, trait]) => ({ cle, trait, vise: { type: trait.type, ...(trait.cible !== undefined ? { cible: refDeCible(trait.cible) } : {}) } }));
}

/** La visée du Trait psychologique porté par `h` de clé `cle` (`traitsPsyChoisissables`), ou `undefined`. */
export const viseDuTrait = (h: Combatant, cle: IdDeTraitPsyPorte | undefined): TraitPsyVise | undefined =>
  (cle === undefined ? undefined : traitsPsyChoisissables(h).find((x) => x.cle === cle)?.vise);

/** Les ops d'issue sous la cible choisie : le retrait d'un Trait psychologique « de votre choix » vise
 *  l'INSTANCE choisie, portée ou non (`opSansObjet` juge une instance disparue). Lu par le verdict et par la
 *  confirmation du jet. ADE II 09 l.33 */
export function opsCiblees(ops: GameOp[], vise: TraitPsyVise | undefined): GameOp[] {
  return ops.map((o): GameOp => (o.op === 'removePsychTrait' && !o.psychType && vise
    ? { op: 'removePsychTrait', psychType: { id: vise.type }, ...(vise.cible ? { cible: vise.cible } : {}) }
    : o));
}

/** Le Savoir (Magie) qu'exige l'identification d'un artefact, ou `undefined`. ADE II 4 l.41 */
export const savoirDeLaMagie = (h: Combatant): Combatant['skills'][number] | undefined =>
  (possesses(h, SAVOIR_MAGIE) ? h.skills.find((k) => refCouvre(SAVOIR_MAGIE, k)) : undefined);
const SAVOIR_MAGIE = { id: 'savoir', spec: 'magie' } as const;

/** Refus d'une cible : liste vide (`vide`), ou, la cible choisie (`choisie`), cible hors de la liste (`horsListe`). */
function refusDeCible(h: Combatant, ids: string[], id: string | undefined, vide: MsgKey, horsListe: MsgKey, choisie: boolean): string | null {
  if (!ids.length) return t(vide, { name: h.label });
  return !choisie || (id != null && ids.includes(id)) ? null : t(horsListe, { name: h.label });
}

/** Ops que pose une RÉUSSITE de l'Activité (`onSuccess`, bandes de succès ou sans `on` qu'un succès peut
 *  atteindre), ou `null` si un résolveur, un rendu de dépôt ou une issue de bataille la résout : son effet
 *  ne se lit pas en ops. */
function opsDeReussite(def: ActivityDef): GameOp[] | null {
  const bandes = (def.outcomes ?? []).filter((b) => b.on === 'reussite' || (b.on == null && (b.maxSL == null || b.maxSL >= 0)));
  const horsOps = bandes.some((b) => b.resolver || b.payoutPct != null || b.battle?.length);
  if (horsOps || (def.resolver && !def.outcomes?.length && !def.onSuccess?.length)) return null;
  return [...(def.onSuccess ?? []), ...bandes.flatMap((b) => b.ops ?? [])];
}

/** Refus d'une Activité dont la RÉUSSITE, sous la cible choisie, n'aurait rien à changer au héros
 *  (`reussiteSansObjet`, jugée avant le jet). ACE 12 l.15, ADE II 09 l.33 */
function refusDeReussiteSansObjet(h: Combatant, def: ActivityDef, opts: CiblesChoisies): string | null {
  const raison = reussiteSansObjet(h, opsCiblees(opsDeReussite(def) ?? [], viseDuTrait(h, opts.traitPsy)), { avantLeJet: true, source: { kind: 'activite', id: def.id } });
  return raison ? t('if.reussiteSansObjet', { raison, label: def.label }) : null;
}

/** Refus de la cible d'une Activité du catalogue : celle de son résolveur, puis le Trait psychologique au choix ; avant le
 *  choix de ses cibles (`choisie` faux), seule une cible qui manque au héros la ferme. */
function refusDeCibleDActivite(s: EtatDInterlude, h: Combatant, def: ActivityDef, opts: CiblesChoisies, choisie: boolean): string | null {
  const cibles = ciblesDActivite(h, def);
  return refusDeCibleDuResolveur(s, h, def, cibles, opts, choisie)
    ?? (retireUnTraitAuChoix(def) ? refusDeCible(h, cibles.traitsPsy.map((x) => x.cle), opts.traitPsy, 'if.noPsychTrait', 'if.psychTraitNotTarget', choisie) : null);
}

function refusDeCibleDuResolveur(s: EtatDInterlude, h: Combatant, def: ActivityDef, cibles: CiblesDActivite, opts: CiblesChoisies, choisie: boolean): string | null {
  switch (def.resolver) {
    case 'craftExtended': return h.craft ? null : t('if.craftNone', { name: h.label });
    case 'masterWeapon': return refusDeCible(h, cibles.armes.map((i) => i.uid), opts.itemUid, 'if.noWeaponToMaster', 'if.weaponNotTarget', choisie);
    case 'identify':
      return refusDeCible(h, cibles.artefacts.map((i) => i.uid), opts.itemUid, 'if.noArtefact', 'if.artefactNotTarget', choisie)
        ?? (savoirDeLaMagie(h) ? null : t('if.noSavoirMagie', { name: h.label }));
    case 'identifyByResearch': return refusDeCible(h, cibles.artefacts.map((i) => i.uid), opts.itemUid, 'if.noArtefact', 'if.artefactNotTarget', choisie);
    case 'memorizeDiscount': return refusDeCible(h, cibles.sorts.map((x) => x.spell.id), opts.spellId, 'if.noSpellToMemorize', 'if.spellNotTarget', choisie);
    case 'mecenat': {
      const dep = (s.bank ?? []).find((d) => d.uid === opts.depotId);
      return dep?.kind === 'mecenat' && dep.heroId === h.id ? null : t('if.mecenatDepotKo', { name: h.label });
    }
    case 'reputation': {
      const { tier, standing } = actorStatus(h);
      return refusDeBourse(h, statusIncomeMax(tier, standing), 'if.reputationPurseKo');
    }
    default: return null;
  }
}

/** Comment s'ouvre l'Activité d'un résolveur d'interlude : par le catalogue sur la meilleure de ses
 *  compétences déclarées (`voie`), par le catalogue sur une valeur que le résolveur dérive (`derivee`), ou
 *  jamais par le catalogue (`horsCatalogue` : une issue de bande). */
const OUVERTURE: Record<ResolverOf<'interlude'>, 'voie' | 'derivee' | 'horsCatalogue'> = {
  income: 'derivee', craftExtended: 'derivee', learnTalent: 'derivee', identify: 'derivee', entrainement: 'derivee',
  mecenat: 'voie', ritualFocus: 'derivee', masterWeapon: 'derivee', identifyByResearch: 'voie', memorizeDiscount: 'voie',
  combatTraining: 'voie', punchausen: 'voie', knowledgeResearch: 'derivee', reputation: 'derivee', wrathOfTheGods: 'horsCatalogue',
  dissensionScout: 'voie', dissensionEmeute: 'voie', contremaitre: 'voie',
};

/** L'ouverture de `def` : sans résolveur, sa meilleure compétence ; un résolveur hors interlude ne s'y ouvre pas. */
function ouvertureDe(def: ActivityDef): 'voie' | 'derivee' | 'horsCatalogue' {
  if (!def.resolver) return 'voie';
  return RESOLVER_OWNER[def.resolver] === 'interlude' ? OUVERTURE[def.resolver as ResolverOf<'interlude'>] : 'horsCatalogue';
}

/** Refus de l'Activité `def` du catalogue quelle que soit sa cible : celui de toute Activité (Revenus a le sien), Activité
 *  fermée, hors catalogue ou sans compétence, hors de ce lieu, préalable de la Dissension. LDB 09 l.30, LDB 23 l.5 */
export function refusDeLActivite(s: EtatDeDepot, heroId: string, def: ActivityDef): string | null {
  const refus = def.resolver === 'income' ? refusDeRevenus(s, heroId) : refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus) return refus;
  if (!h) return t('if.herosInconnu', { id: heroId });
  const ouverture = ouvertureDe(def);
  if (!def.contexts.includes('interlude') || def.blocked) return t('if.activiteFermee', { label: def.label });
  if (ouverture === 'horsCatalogue') return t('if.horsCatalogue', { label: def.label });
  if (ouverture === 'voie' && !def.tests?.length) return t('if.activiteSansCompetence', { label: def.label });
  if (!activityAvailableAt(def, s.lieu)) return t('if.placeOnly', { label: def.label });
  if (def.resolver === 'dissensionEmeute' && !s.interlude?.perHero[heroId]?.dissensionReady) return t('if.dissensionNotReady', { name: h.label });
  return null;
}

/** Refus d'ouvrir l'Activité `def` du catalogue : celui de l'Activité (`refusDeLActivite`), et de l'Apprentissage, la
 *  cible (`ciblesDActivite`), aucune voie que le héros puisse tenter (`preJetDActivite`), puis une réussite sans objet.
 *  Avant le choix de sa cible (`choisie` faux), seule une cible qui manque au héros la ferme, et ce qui suit la cible
 *  attend qu'elle soit choisie. Verdict UNIQUE de l'Activité composée (`refusDeLaComposition`), du retrait de Mécénat et
 *  des volets : une Activité que le verdict ouvre, le geste l'ouvre. LDB 09 l.30, LDB 23 l.5, ACE 12, ADE II 4,
 *  ADE II 09 l.33 */
export function refusDOuvertureDActivite(s: EtatDeDepot, heroId: string, def: ActivityDef, opts: CiblesChoisies = {}, choisie = true): string | null {
  const refus = refusDeLActivite(s, heroId, def) ?? (def.resolver === 'learnTalent' ? refusDApprentissage(s, heroId, opts.talentId ?? '') : null);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  return refusDeCibleDActivite(s, h, def, opts, choisie)
    ?? (!choisie && cibleAChoisir(h, def, opts) ? null : preJetDActivite(s, heroId, def, opts)?.refus ?? refusDeReussiteSansObjet(h, def, opts));
}

/** L'Activité `def` lit-elle une cible (objet, sort, Trait psychologique) absente d'`opts` ? */
function cibleAChoisir(h: Combatant, def: ActivityDef, opts: CiblesChoisies): boolean {
  const { armes, artefacts, sorts, traitsPsy } = ciblesDActivite(h, def);
  return ((armes.length > 0 || artefacts.length > 0) && opts.itemUid === undefined)
    || (sorts.length > 0 && opts.spellId === undefined)
    || (traitsPsy.length > 0 && opts.traitPsy === undefined);
}

/** Le brouillon de l'Activité que compose un héros de l'interlude (`fenetreChoisir('interlude', …)`), que le choix
 *  `pratiquer` conclut : l'Activité, ses cibles, l'option d'Entraînement, et l'ouvrage d'Artisanat à engager avec ses
 *  Atouts et ses Défauts. LDB 23 l.5 */
export interface CompositionDActivite {
  activite: IdDActivite;
  cibles: Omit<CiblesChoisies, 'depotId'>;
  entrainement?: IdDEntrainement;
  ouvrage?: IdDObjetDuCatalogue;
  atouts: IdDeQualiteDArtisanat[];
  defauts: IdDeQualiteDArtisanat[];
}

/** Le brouillon de l'Activité `activite` : la composition `c` du héros quand elle la compose, sinon un brouillon vide. */
export const brouillonDe = (c: CompositionDActivite | undefined, activite: IdDActivite): CompositionDActivite =>
  (c?.activite === activite ? c : { activite, cibles: {}, atouts: [], defauts: [] });

/** Où chaque axe de la composition pose sa valeur dans le brouillon : une cible, l'option d'Entraînement, l'ouvrage. */
const POSE_DE_L_AXE = { talent: 'talentId', objet: 'itemUid', sort: 'spellId', traitPsychologique: 'traitPsy', entrainement: null, ouvrage: null } as const;
/** Un axe de la composition qui pose une valeur dans le brouillon. */
export type AxeDuBrouillon = keyof typeof POSE_DE_L_AXE;

/** Le brouillon `c` où l'axe `axe` pose `valeur`. */
export function poserDansLeBrouillon(c: CompositionDActivite, axe: AxeDuBrouillon, valeur: string): CompositionDActivite {
  const cle = POSE_DE_L_AXE[axe];
  return cle === null ? { ...c, [axe]: valeur } : { ...c, cibles: { ...c.cibles, [cle]: valeur } };
}

/** Refus de pratiquer l'Activité composée `c` : engager l'ouvrage choisi quand l'Artisanat n'en a pas en cours
 *  (`refusDArtisanat`), suivre l'Entraînement choisi (`refusDEntrainement`), un Apprentissage sans Talent choisi, sinon
 *  ouvrir l'Activité sur ses cibles (`refusDOuvertureDActivite`). Brouillon en cours (`conclue` faux), ce qu'un choix à
 *  venir tranche (ouvrage, option, Talent, cible) ne le ferme pas. Verdict UNIQUE du choix `pratiquer`, de chaque valeur
 *  offerte à la composition, et des volets. LDB 23 l.5 */
export function refusDeLaComposition(s: EtatDeDepot, heroId: string, c: CompositionDActivite, conclue = true): string | null {
  const def = garanti(activityById(c.activite), c.activite, 'Activité composée');
  const aChoisir = (cle: MsgKey) => (conclue ? t(cle) : null);
  if (def.resolver === 'craftExtended' && !herosDe(s, heroId)?.craft) return refusDArtisanat(s, heroId, c.ouvrage) ?? (c.ouvrage === undefined ? aChoisir('interlude.choisir.ouvrage') : null);
  if (def.resolver === 'entrainement') return c.entrainement === undefined ? refusDeLActivite(s, heroId, def) ?? aChoisir('interlude.choisir.entrainement') : refusDEntrainement(s, heroId, c.entrainement);
  if (def.resolver === 'learnTalent' && c.cibles.talentId === undefined) return refusDeLActivite(s, heroId, def) ?? aChoisir('interlude.choisir.talent');
  return refusDOuvertureDActivite(s, heroId, def, c.cibles, conclue);
}

/** Le refus de la valeur `valeur` de l'axe `axe` offerte à la composition : celui du brouillon `c` où elle est posée,
 *  brouillon en cours (`refusDeLaComposition`) ; ce qu'un choix à venir tranche reste à `pratiquer`. LDB 23 l.5 */
export const refusDeLaValeur = (s: EtatDeDepot, heroId: string, c: CompositionDActivite, axe: AxeDuBrouillon, valeur: string): string | null =>
  refusDeLaComposition(s, heroId, poserDansLeBrouillon(c, axe, valeur), false);

/** L'état que lit le verdict d'une Faveur : celui de l'interlude, et les Faveurs dues. */
export type EtatDeFaveur = EtatDInterlude & Pick<Jeu, 'favors'>;

/** Refus d'acquitter la Faveur `favorId` par une Activité : celui de l'Activité, une Faveur que le héros ne
 *  doit pas, puis une Faveur Importante, qui ne s'acquitte pas par Activité. Verdict UNIQUE de
 *  `settleFavorActivity` et du volet. LDB 23 l.147-151 */
export function refusDAcquitterUneFaveur(s: EtatDeFaveur, heroId: string, favorId: string): string | null {
  const refus = refusDActivite(s, heroId);
  if (refus) return refus;
  const favor = (s.favors ?? []).find((f) => f.id === favorId && f.heroId === heroId);
  if (!favor) return t('favor.inconnue', { name: nomDuHeros(s, heroId) });
  return favorRequiredActivities(favor.level) == null ? t('favor.importanteHorsActivite') : null;
}

/** Ce que lit le verdict de confirmation dans le jet d'Activité en attente. */
export interface ConfirmationDActivite { heroId: string; success?: boolean; talent?: string; tutorBrass?: number; costBrass?: number }

/** Refus d'appliquer le jet d'Activité confirmé : Activité, Talent à apprendre (et, sur un succès, les PX
 *  de son achat : avec la liste du volet, les deux refus d'`acheterLeTalent`), puis ce que la confirmation
 *  débite (tuteur d'Apprentissage, dépense de Réputation) hors de la bourse. Verdict UNIQUE de
 *  `jetValider('activite')`, avant tout débit. LDB 23 l.66-72, l.228-234 */
export function refusDeConfirmerLActivite(s: EtatDInterlude, pa: ConfirmationDActivite): string | null {
  const refus = refusDActivite(s, pa.heroId);
  const h = herosDe(s, pa.heroId);
  if (refus || !h) return refus;
  const opt = pa.talent ? optionDApprentissage(h, pa.talent) : undefined;
  return (pa.talent && !opt ? refusDuTalentAApprendre(h, pa.talent) : null)
    ?? (opt && pa.success ? refusDePx(h, opt.xpCost) : null)
    ?? (pa.tutorBrass ? refusDeBourse(h, fromBrass(pa.tutorBrass), 'if.tuteurKo') : null)
    ?? (pa.costBrass ? refusDeBourse(h, fromBrass(pa.costBrass), 'if.reputationPurseKo') : null);
}

/** Compétence de Carrière qui sert à Gagner de l'argent (dette `4e/activites#revenus`). LDB 07 l.82, LDB 08 l.110 */
export function incomeSkillOf(h: Combatant): string {
  const lvl1 = levelsForCareer(h.career ?? '')[0];
  const ids = (lvl1?.skills ?? []).map(advancementBaseId).filter((x): x is string => !!x); // AdvancementRef → skillId
  const owned = ids.find((id) => possesses(h, { id }));
  return owned ?? ids[0] ?? 'athletisme';
}

/** Pré-jet d'une Activité d'interlude : la spec de Test de `travelActivitySpec`. */
export type PreJetDActivite = Extract<TravelActivitySpec, { test: TestDesigne }> & { ligne: RollLineParts };

/** Ce que le pré-jet lit au-delà des cibles : l'ouvrage d'Artisanat visé, engagé (`h.craft`) ou à engager. */
export interface ContexteDePreJet { ouvrage?: { difficulty: Difficulty } }

/** Voies du Test d'Activité que son résolveur DÉRIVE du héros (`OUVERTURE` `derivee`), et les
 *  modificateurs qu'il pose ; `{}` = les voies déclarées par la donnée ; `undefined` = la cible ou la
 *  compétence que l'ouverture lit manque. LDB 08 l.110, LDB 23 l.66-102, LDB 23 l.220-234, ACE 12 l.21,
 *  ADE II 4 l.41, VDM 02 l.129-141 */
function voiesDuTest(
  h: Combatant, def: ActivityDef, cibles: CiblesChoisies, fails: Record<string, number>, ctx: ContexteDePreJet,
): { voies?: VoieDActivite[]; mods?: ModLine[] } | undefined {
  switch (def.resolver) {
    case 'income':
    case 'reputation':
      return { voies: [{ test: { skill: { id: incomeSkillOf(h) } } }] };
    case 'craftExtended': {
      const ouvrage = ctx.ouvrage ?? h.craft;
      const metier = metierOf(h);
      return ouvrage ? { voies: [{ test: { skill: { id: 'metier', ...(metier?.spec ? { spec: metier.spec } : {}) } }, difficulty: ouvrage.difficulty }] } : undefined;
    }
    case 'learnTalent': {
      const talent = findTalentById(cibles.talentId ?? '');
      if (!talent) return undefined;
      const tMax = effectiveEntry(talent).max;
      const char: CharKey = tMax && typeof tMax === 'object' ? tMax.bonusOf : 'intelligence';
      const tentatives = fails[talent.id] ?? 0;
      return {
        voies: [{ test: { characteristic: char } }],
        mods: tentatives ? [{ label: t('if.acharnement'), value: 10 * tentatives, famille: 'jet', ref: RULE_REF['apprentissage-particulier'] }] : [],
      };
    }
    case 'masterWeapon': {
      const item = ciblesDActivite(h, def).armes.find((i) => i.uid === cibles.itemUid);
      if (!item) return undefined;
      // L'arme synthétique n'a pas d'uid retrouvable : le gate de maîtrise est inerte pour ce Test.
      const kind = item.kind === 'distance' ? ('distance' as const) : ('melee' as const);
      const valeur = combatValue(h, kind, buildWeapon({ label: item.label, type: kind, damage: item.damage ?? { plusBF: true, flat: 0 }, subType: item.subType, uid: `entrainement-${item.uid}` }));
      return { voies: [{ test: { skill: { id: weaponSkillId(kind) } }, valeur }] };
    }
    case 'identify': {
      const savoir = savoirDeLaMagie(h);
      return savoir ? { voies: [{ test: { skill: { id: savoir.id, ...(savoir.spec ? { spec: savoir.spec } : {}) } } }] } : undefined;
    }
    case 'knowledgeResearch': {
      const savoirs = h.skills.filter((k) => k.id === 'savoir' && (k.advances ?? 0) > 0);
      return {
        voies: savoirs.length
          ? savoirs.map((k) => ({ test: { skill: { id: k.id, ...(k.spec ? { spec: k.spec } : {}) } } }))
          : [{ test: { characteristic: 'intelligence' }, difficulty: 'complexe' }],
      };
    }
    case 'ritualFocus': {
      const sp = findSpellById(cibles.spellId ?? h.ritual?.spellId ?? '');
      const sk = sp ? focusSkillFor(h, sp) : undefined;
      const valeur = sp ? focusValueOf(h, sp) : null;
      return sk && valeur != null ? { voies: [{ test: { skill: { id: 'focalisation', ...(sk.spec ? { spec: sk.spec } : {}) } }, valeur }] } : undefined;
    }
    default:
      return {};
  }
}

/** PRÉ-JET d'une Activité d'interlude : la voie, sa valeur, sa Difficulté et ses modificateurs, par la
 *  spec UNIQUE des Activités (`travelActivitySpec`), et sa LIGNE de jet montée par `rollLine` (base nue,
 *  composantes nommées, cible). Le geste (`openCatalogActivity`) en pose son pending, le volet en rend la
 *  ligne. `undefined` = rien à jeter (Activité sans Test, cible absente). */
export function preJetDActivite(
  s: EtatDInterlude, heroId: string, def: ActivityDef, cibles: CiblesChoisies = {}, ctx: ContexteDePreJet = {},
): PreJetDActivite | undefined {
  const h = herosDe(s, heroId);
  const derivees = h ? voiesDuTest(h, def, cibles, s.interlude?.perHero[heroId]?.learnFails ?? {}, ctx) : undefined;
  const spec = h && derivees ? travelActivitySpec(h, def, derivees) : null;
  if (!h || !spec || spec.target === null) return undefined;
  // Une valeur POSÉE par la voie (arme visée, Focalisation) ne se décompose pas en Niveau de Compétence.
  const valeurPosee = (derivees?.voies ?? []).some((v) => v.valeur != null);
  const ligne = rollLine({
    actor: h, test: spec.test, valeur: spec.value, difficulty: spec.difficulty, surLaCible: spec.mods,
    ...(valeurPosee ? { valeurEtrangere: true } : {}),
  });
  return { ...spec, ligne };
}

/** L'état que lit le devis de clôture. */
export type EtatDeCloture = Pick<Jeu, 'interlude' | 'party' | 'bank' | 'pendingOrders' | 'gameTime'>;

type LotDeCloture = NonNullable<NonNullable<Jeu['interlude']>['perHero'][string]['closeOps']>[number];

/** Un montant, en sous de cuivre, attaché à un héros. */
export interface MontantDeHeros { heroId: string; brass: number }

/** Ce que la clôture de l'interlude FAIT, calculé une fois : sa validation (`fenetreValider('interlude')`) l'applique, le récap l'affiche. */
export interface DevisDeCloture {
  /** Les bourses non vides, chacune dépensée en totalité. LDB 23 l.15 */
  gaspillages: MontantDeHeros[];
  gaspille: number;
  /** Les Revenus de la période, remis après le gaspillage. LDB 23 l.191 */
  revenus: MontantDeHeros[];
  revenu: number;
  /** Les participants vivants qui redescendent d'un Niveau de Carrière, et leur Niveau d'arrivée. LDB 23 l.33 */
  retrogradations: { heroId: string; niveau: number }[];
  /** Les dépôts, que la clôture ne touche pas. */
  conserve: number;
  /** Les commandes, livrées à l'ouverture du prochain interlude. LDB 23 l.182 */
  commandes: string[];
  /** Les Artisanats en cours, qui restent au héros. */
  ouvrages: { heroId: string; trappingId: string }[];
  /** Les issues différées, posées après le repos de clôture. ACE 12 l.15 */
  lots: { heroId: string; lots: LotDeCloture[] }[];
  /** Le repos de la période, et l'heure de la reprise. */
  jours: number;
  reprise: number;
}

/** Le devis de clôture de l'interlude ouvert, ou `null` hors interlude. Rétrogradations, Revenus, ouvrages
 *  et issues différées visent les participants VIVANTS (`perHero`) ; le gaspillage, toutes les bourses du
 *  groupe. LDB 23 l.15, l.33, l.191 */
export function devisDeCloture(s: EtatDeCloture): DevisDeCloture | null {
  const itl = s.interlude;
  if (!itl) return null;
  const participants = s.party.filter((h) => itl.perHero[h.id] && !h.dead);
  const gaspillages = s.party.map((h) => ({ heroId: h.id, brass: toBrass(bourseOf(h)) })).filter((g) => g.brass > 0);
  const revenus = participants.map((h) => ({ heroId: h.id, brass: itl.perHero[h.id].revenueBrass })).filter((r) => r.brass > 0);
  const jours = itl.weeks * 7;
  return {
    gaspillages,
    gaspille: gaspillages.reduce((n, g) => n + g.brass, 0),
    revenus,
    revenu: revenus.reduce((n, r) => n + r.brass, 0),
    retrogradations: participants
      .filter((h) => (h.careerLevel ?? 1) >= 3 && !itl.perHero[h.id].didRevenus)
      .map((h) => ({ heroId: h.id, niveau: (h.careerLevel ?? 1) - 1 })),
    conserve: (s.bank ?? []).reduce((n, b) => n + b.brass, 0),
    commandes: (s.pendingOrders ?? []).map((o) => o.trappingId),
    ouvrages: participants.flatMap((h) => (h.craft ? [{ heroId: h.id, trappingId: h.craft.trappingId }] : [])),
    lots: participants
      .filter((h) => (itl.perHero[h.id].closeOps ?? []).length > 0)
      .map((h) => ({ heroId: h.id, lots: itl.perHero[h.id].closeOps! })),
    jours,
    reprise: aubeApresNuits(s.gameTime, jours),
  };
}

/** Les pertes d'argent des Événements de la période, bourse par bourse, sur la bourse d'avant les
 *  Activités : les `moneyPct` qui valent pour le participant s'additionnent sur cette même assiette,
 *  plafonnés à la bourse. LDB 22 l.36, l.115 */
export function pertesDArgentDuTirage(s: Pick<Jeu, 'interlude' | 'party'>): { heroId: string; pct: number; brass: number }[] {
  const itl = s.interlude;
  if (!itl) return [];
  return s.party.flatMap((h) => {
    if (!itl.perHero[h.id]) return [];
    const pct = Math.min(100, -effetsDeLaPeriode(s, h.id).reduce((n, { fx }) => n + (fx.moneyPct ?? 0), 0));
    const brass = Math.floor((toBrass(bourseOf(h)) * pct) / 100);
    return pct > 0 && brass > 0 ? [{ heroId: h.id, pct, brass }] : [];
  });
}

/** Les Activités que les Événements de GROUPE de la période ôtent au participant (une par Événement) ;
 *  celles d'un Événement individuel sont ôtées au dé du héros. LDB 22 l.123 */
export function activitesPerduesAuGroupe(s: Pick<Jeu, 'interlude'>, heroId: string): EffetDeLaPeriode[] {
  return effetsDeLaPeriode(s, heroId).filter(({ fx }) => fx.partyWide && fx.loseActivity);
}

/** Un Événement de la période exige-t-il que les dépôts en banque réputée vérifient leur faillite ? LDB 22 l.111 */
export function verificationDeFaillite(s: Pick<Jeu, 'interlude'>, heroId: string): boolean {
  return effetsDeLaPeriode(s, heroId).some(({ fx }) => fx.bankCrashCheck);
}
