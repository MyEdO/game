/**
 * Verdicts de l'INTERLUDE, en module FEUILLE : les gestes d'Activité (`noyau/interludeFlow.ts`,
 * `noyau/favorFlow.ts`) et l'écran d'interlude les lisent, sans que l'un importe l'autre.
 * Le geste applique le verdict en tête (`refuseSi`) ; l'écran le lit sans le recalculer.
 */
import { findCareerById, findTalentById, findTrappingById, libelleOuAbsence, refLabel } from '../data';
import { interludeEventFor } from '../data/interludeEvents';
import { t, type MsgKey } from '../i18n';
import type { IdDObjet } from './designations';
import { possesses } from '../engine/skills';
import type { Combatant, ItemInstance } from '../engine/types';
import { favorRequiredActivities } from '../engine/favor';
import { learnableSpells } from '../engine/grimoire';
import { reussiteSansObjet, type GameOp } from '../engine/ops';
import type { PsychTrait } from '../engine/psychology';
import { MOTIF_D_ID_DE_GROUPE, cibleDeRef, identiteDeCiblage, refDeCible, type RefDeCible } from '../engine/psych/ciblage';
import { actorStatus } from '../engine/social';
import { fromBrass, toBrass, toMoney, priceToMoney, formatMoney } from '../engine/money';
import {
  ACTIVITIES, RESOLVER_OWNER, activityAvailableAt, craftSpecOf, entrainementOptions, learnableTalents, metierOf, orderBlockOf, statusIncomeMax,
  type ActivityDef, type EntrainementOption, type LearnOption, type ResolverOf,
} from '../engine/activities';
import { outOfTradeReason } from '../engine/disponibilite';
import { memeSpecialisation, refCouvre } from '../data/schemas/grammaire/ref';
import type { Jeu } from './etat';
import { refusDeBourse } from './bourseFlow';
import { refusDePx } from './depenseDePx';
import { currentPlaceId } from './worldMap';

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

/** Refus de retirer le dépôt `index` : la planque n'attend que le tirage, l'investissement consomme une
 *  Activité de son dépositaire, le Mécénat s'ouvre comme son Activité (`refusDOuvertureDActivite` : lieu
 *  compris). Verdict UNIQUE de `bankWithdraw` et de l'écran ; `null` pour un dépôt absent, que le geste
 *  ignore. LDB 23 l.168-170, ACE 12 l.47-49 */
export function refusDeRetrait(s: EtatDeDepot, index: number): string | null {
  const dep = (s.bank ?? [])[index];
  if (!dep) return null;
  const mecenat = dep.kind === 'mecenat' ? activiteDeMecenat() : undefined;
  if (mecenat) return refusDOuvertureDActivite(s, dep.heroId, mecenat, { depositIndex: index });
  return dep.kind === 'stash' ? refusDuTirage(s, dep.heroId) : refusDActivite(s, dep.heroId);
}

/** L'Activité de Mécénat, variante d'Opération bancaire. ACE 12 l.45-49 */
const activiteDeMecenat = (): ActivityDef | undefined => ACTIVITIES.find((a) => a.resolver === 'mecenat');

/** Classe du héros, `id` STABLE (`ClassData.id`) — les événements visent une Classe par id
 *  (`revenueClasses`/`revenueBlockedClasses`, eux aussi en id). Carrière → id de classe. */
export function heroClass(h: Combatant): string {
  return findCareerById(h.career ?? '')?.class ?? '';
}

/** Libellé de l'Événement d'un héros — appelé sous une garde `fx` (le dé et `fx` sont écrits ENSEMBLE
 *  au dénouement) ; sans dé, il se tait au lieu de nommer la première ligne du tableau. */
export const eventLabelOf = (st: { eventRoll?: number }): string =>
  st.eventRoll == null ? t('if.eventGeneric') : interludeEventFor(st.eventRoll).label;

/** L'Événement de la période bloque-t-il les Revenus pour la Classe du héros : la raison, ou `null`.
 *  Lu par la chronique ; le geste et l'écran lisent `refusDeRevenus`. LDB 22 */
export function blocageDeRevenus(s: EtatDInterlude, heroId: string): string | null {
  const st = s.interlude?.perHero[heroId];
  const h = s.party.find((x) => x.id === heroId);
  const bloquees = st?.fx?.revenueBlockedClasses;
  if (!st || !h || !bloquees || !(bloquees.includes('*') || bloquees.includes(heroClass(h)))) return null;
  return t('if.incomeBlocked', { name: h.label, event: eventLabelOf(st) });
}

/** Refus d'entreprendre les Revenus : celui de toute Activité, puis le blocage de l'Événement. Verdict
 *  UNIQUE du geste, de l'entrée et du volet. LDB 22, LDB 23 l.5 */
export function refusDeRevenus(s: EtatDInterlude, heroId: string): string | null {
  return refusDActivite(s, heroId) ?? blocageDeRevenus(s, heroId);
}

const herosDe = (s: EtatDInterlude, heroId: string): Combatant | undefined => s.party.find((h) => h.id === heroId);

/** Refus d'engager un Artisanat : tirage, ouvrage en cours, Métier absent, puis l'ouvrage `trappingId`
 *  (inconnu, hors commerce, matériaux hors de la bourse). Sans ouvrage choisi, seul le héros est jugé.
 *  Verdict UNIQUE de `craftStart` et du volet. LDB 23 l.74-78 */
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

/** L'option d'Entraînement (`entrainementOptions`) que vise le geste, ou `undefined` : hors carrière seulement. */
export function optionDEntrainement(h: Combatant, kind: EntrainementOption['kind'], id: string, spec?: string): EntrainementOption | undefined {
  return entrainementOptions(h).find((o) => o.kind === kind && o.id === id && memeSpecialisation(o.spec, spec));
}

/** Refus d'un Entraînement AVANT le tirage du tuteur : Activité, option hors carrière, PX, puis une bourse
 *  sous le tuteur le MOINS cher (`entrainementTutorRange`). Verdict UNIQUE du geste et du volet. LDB 23 l.132-136 */
export function refusDEntrainement(s: EtatDInterlude, heroId: string, kind: EntrainementOption['kind'], id: string, spec?: string): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  const opt = optionDEntrainement(h, kind, id, spec);
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
  if (block === 'stock-ordinaire') return t('if.orderInShops', { label: tr.label, availability: String(tr.availability) });
  return refusDeBourse(h, priceToMoney(tr.price), 'if.orderTooExpensive');
}

/** L'état que lit le devis d'un dépôt : celui de l'interlude, et le lieu (Mécénat). */
export type EtatDeDepot = EtatDInterlude & Pick<Jeu, 'scene' | 'worldMap'>;

/** Les trois dépôts d'une Opération bancaire. */
export type GenreDeDepot = 'invest' | 'stash' | 'mecenat';

/** Devis d'un dépôt. `refus` : la raison affichée, ou `null` ; `debite` : ce que la bourse paie (sous de
 *  cuivre) ; `depose` : ce que la banque reçoit. */
export interface DevisDeDepot { refus: string | null; debite: number; depose: number }

/** Devis d'un dépôt de `montantBrass` : le refus (Activité, Statut Bronze pour investir, lieu et mise
 *  minimale du Mécénat, bourse), la somme débitée, et celle RÉELLEMENT déposée après le `bankPct` de
 *  l'Événement. Devis UNIQUE de `bankDeposit` et du volet. LDB 23 l.164-170, LDB 22 l.40, ACE 12 l.49 */
export function devisDeDepot(s: EtatDeDepot, heroId: string, kind: GenreDeDepot, montantBrass: number): DevisDeDepot {
  const debite = Math.max(1, Math.floor(montantBrass));
  const pct = s.interlude?.perHero[heroId]?.fx?.bankPct;
  const depose = pct ? Math.max(0, Math.floor((debite * (100 + pct)) / 100)) : debite;
  return { refus: refusDeDepot(s, heroId, kind, debite), debite, depose };
}

function refusDeDepot(s: EtatDeDepot, heroId: string, kind: GenreDeDepot, montant: number): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  if (kind === 'invest' && actorStatus(h).tier === 'bronze') return t('if.bankTierKo', { name: h.label });
  if (kind === 'mecenat') {
    const def = activiteDeMecenat();
    if (!def || !activityAvailableAt(def, currentPlaceId(s))) return t('if.mecenatHorsLieu');
    const min = toBrass(toMoney(def.minInvest ?? {}));
    if (montant < min) return t('if.mecenatMin', { min: formatMoney(fromBrass(min)) });
  }
  return refusDeBourse(h, fromBrass(montant), 'if.depositPurseKo');
}

/** Les cibles reçues par l'ouverture d'une Activité du catalogue : objet, sort, dépôt, Talent, instance de
 *  Trait psychologique. */
export interface CiblesChoisies { itemUid?: IdDObjet; spellId?: string; depositIndex?: number; talentId?: string; traitPsy?: TraitPsyVise }

/** Une instance de Trait psychologique visée : son type, et sa Cible si elle en porte une. */
export interface TraitPsyVise { type: string; cible?: RefDeCible }

/** Un Trait psychologique PORTÉ que le joueur peut choisir : sa clé d'instance (`identiteDeCiblage`), le Trait,
 *  et sa visée. */
export interface TraitPsyChoisissable { cle: string; trait: PsychTrait; vise: TraitPsyVise }

/** La clé d'instance d'une visée reçue, ou `null` si elle n'en a pas la forme. */
export function cleDuTraitVise(vise: unknown): string | null {
  const v = vise as Partial<TraitPsyVise> | null | undefined;
  if (typeof v?.type !== 'string') return null;
  const ref = v.cible as { id?: unknown; personnage?: unknown } | undefined;
  if (ref === undefined) return identiteDeCiblage(v.type);
  if (typeof ref?.id === 'string' && MOTIF_D_ID_DE_GROUPE.test(ref.id)) return identiteDeCiblage(v.type, cibleDeRef({ id: ref.id }));
  if (typeof ref?.personnage === 'string' && ref.personnage !== '' && !ref.personnage.startsWith('@')) {
    return identiteDeCiblage(v.type, cibleDeRef({ personnage: ref.personnage }));
  }
  return null;
}

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
      ? items.filter((i) => (i.kind === 'melee' || i.kind === 'ranged') && i.requiresMastery && i.trappingId && !(h.masteredWeapons ?? []).includes(i.trappingId))
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
function traitsPsyChoisissables(h: Combatant): TraitPsyChoisissable[] {
  const vus = new Map<string, PsychTrait>();
  for (const p of h.psychTraits ?? []) vus.set(identiteDeCiblage(p.type, p.cible), p);
  return [...vus].map(([cle, trait]) => ({ cle, trait, vise: { type: trait.type, ...(trait.cible !== undefined ? { cible: refDeCible(trait.cible) } : {}) } }));
}

/** Les ops d'issue sous la cible choisie : le retrait d'un Trait psychologique « de votre choix » vise
 *  l'INSTANCE choisie, portée ou non (`opSansObjet` juge une instance disparue). Lu par le verdict et par la
 *  confirmation du jet. ADE II 09 l.33 */
export function opsCiblees(ops: GameOp[], cibles: Pick<CiblesChoisies, 'traitPsy'>): GameOp[] {
  const vise = cleDuTraitVise(cibles.traitPsy) != null ? cibles.traitPsy! : undefined;
  return ops.map((o): GameOp => (o.op === 'removePsychTrait' && !o.psychType && vise
    ? { op: 'removePsychTrait', psychType: { id: vise.type }, ...(vise.cible ? { cible: vise.cible } : {}) }
    : o));
}

/** Le Savoir (Magie) qu'exige l'identification d'un artefact, ou `undefined`. ADE II 4 l.41 */
export const savoirDeLaMagie = (h: Combatant): Combatant['skills'][number] | undefined =>
  (possesses(h, SAVOIR_MAGIE.id, SAVOIR_MAGIE.spec) ? h.skills.find((k) => refCouvre(SAVOIR_MAGIE, k)) : undefined);
const SAVOIR_MAGIE = { id: 'savoir', spec: 'magie' } as const;

/** Refus d'une cible : liste vide (`vide`), ou cible hors de la liste (`horsListe`). */
function refusDeCible(h: Combatant, ids: string[], id: string | undefined, vide: MsgKey, horsListe: MsgKey): string | null {
  if (!ids.length) return t(vide, { name: h.label });
  return id != null && ids.includes(id) ? null : t(horsListe, { name: h.label });
}

/** Ops que pose une RÉUSSITE de l'Activité (`onSuccess`, bandes de succès ou sans `on` qu'un succès peut
 *  atteindre), ou `null` si un résolveur, un rendu de dépôt ou une issue de bataille la résout : son effet
 *  ne se lit pas en ops. */
function opsDeReussite(def: ActivityDef): GameOp[] | null {
  const bandes = (def.outcomes ?? []).filter((b) => b.on === 'success' || (b.on == null && (b.maxSL == null || b.maxSL >= 0)));
  const horsOps = bandes.some((b) => b.resolver || b.payoutPct != null || b.battle?.length);
  if (horsOps || (def.resolver && !def.outcomes?.length && !def.onSuccess?.length)) return null;
  return [...(def.onSuccess ?? []), ...bandes.flatMap((b) => b.ops ?? [])];
}

/** Refus d'une Activité dont la RÉUSSITE, sous la cible choisie, n'aurait rien à changer au héros
 *  (`reussiteSansObjet`, jugée avant le jet). ACE 12 l.15, ADE II 09 l.33 */
function refusDeReussiteSansObjet(h: Combatant, def: ActivityDef, opts: CiblesChoisies): string | null {
  const raison = reussiteSansObjet(h, opsCiblees(opsDeReussite(def) ?? [], opts), { avantLeJet: true, source: { kind: 'activity', id: def.id } });
  return raison ? t('if.reussiteSansObjet', { raison, label: def.label }) : null;
}

/** Refus de la cible d'une Activité du catalogue : celle de son résolveur, puis le Trait psychologique au choix. */
function refusDeCibleDActivite(s: EtatDInterlude, h: Combatant, def: ActivityDef, opts: CiblesChoisies): string | null {
  const cibles = ciblesDActivite(h, def);
  return refusDeCibleDuResolveur(s, h, def, cibles, opts)
    ?? (retireUnTraitAuChoix(def) ? refusDeCible(h, cibles.traitsPsy.map((x) => x.cle), cleDuTraitVise(opts.traitPsy) ?? undefined, 'if.noPsychTrait', 'if.psychTraitNotTarget') : null);
}

function refusDeCibleDuResolveur(s: EtatDInterlude, h: Combatant, def: ActivityDef, cibles: CiblesDActivite, opts: CiblesChoisies): string | null {
  switch (def.resolver) {
    case 'craftExtended': return h.craft ? null : t('if.craftNone', { name: h.label });
    case 'masterWeapon': return refusDeCible(h, cibles.armes.map((i) => i.uid), opts.itemUid, 'if.noWeaponToMaster', 'if.weaponNotTarget');
    case 'identify':
      return refusDeCible(h, cibles.artefacts.map((i) => i.uid), opts.itemUid, 'if.noArtefact', 'if.artefactNotTarget')
        ?? (savoirDeLaMagie(h) ? null : t('if.noSavoirMagie', { name: h.label }));
    case 'identifyByResearch': return refusDeCible(h, cibles.artefacts.map((i) => i.uid), opts.itemUid, 'if.noArtefact', 'if.artefactNotTarget');
    case 'memorizeDiscount': return refusDeCible(h, cibles.sorts.map((x) => x.spell.id), opts.spellId, 'if.noSpellToMemorize', 'if.spellNotTarget');
    case 'mecenat': {
      const dep = (s.bank ?? [])[opts.depositIndex ?? -1];
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
 *  jamais par le catalogue (`horsCatalogue` : son geste dédié, ou une issue de bande). */
const OUVERTURE: Record<ResolverOf<'interlude'>, 'voie' | 'derivee' | 'horsCatalogue'> = {
  income: 'derivee', craftExtended: 'derivee', learnTalent: 'derivee', identify: 'derivee', entrainement: 'horsCatalogue',
  mecenat: 'voie', ritualFocus: 'derivee', masterWeapon: 'derivee', identifyByResearch: 'voie', memorizeDiscount: 'voie',
  combatTraining: 'voie', punchausen: 'voie', knowledgeResearch: 'derivee', reputation: 'derivee', wrathOfTheGods: 'horsCatalogue',
  dissensionScout: 'voie', dissensionEmeute: 'voie', contremaitre: 'voie',
};

/** L'ouverture de `def` : sans résolveur, sa meilleure compétence ; un résolveur hors interlude ne s'y ouvre pas. */
function ouvertureDe(def: ActivityDef): 'voie' | 'derivee' | 'horsCatalogue' {
  if (!def.resolver) return 'voie';
  return RESOLVER_OWNER[def.resolver] === 'interlude' ? OUVERTURE[def.resolver as ResolverOf<'interlude'>] : 'horsCatalogue';
}

/** Refus d'ouvrir l'Activité `def` du catalogue : celui de son Activité (Revenus et Apprentissage ont le
 *  leur), Activité fermée, hors catalogue ou sans compétence, hors de ce lieu, préalable de la Dissension,
 *  cible (`ciblesDActivite`), puis une réussite sans objet. Verdict UNIQUE d'`openCatalogActivity`, du
 *  retrait de Mécénat et des volets : une Activité que le verdict ouvre, le geste l'ouvre. LDB 23 l.5, ACE 12,
 *  ADE II 4, ADE II 09 l.33 */
export function refusDOuvertureDActivite(s: EtatDeDepot, heroId: string, def: ActivityDef, opts: CiblesChoisies = {}): string | null {
  const refus = def.resolver === 'income' ? refusDeRevenus(s, heroId)
    : def.resolver === 'learnTalent' ? refusDApprentissage(s, heroId, opts.talentId ?? '')
    : refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus) return refus;
  if (!h) return t('if.herosInconnu', { id: heroId });
  const ouverture = ouvertureDe(def);
  if (!def.contexts.includes('interlude') || def.blocked) return t('if.activiteFermee', { label: def.label });
  if (ouverture === 'horsCatalogue') return t('if.horsCatalogue', { label: def.label });
  if (ouverture === 'voie' && !def.skills?.length) return t('if.activiteSansCompetence', { label: def.label });
  if (!activityAvailableAt(def, currentPlaceId(s))) return t('if.placeOnly', { label: def.label });
  if (def.resolver === 'dissensionEmeute' && !s.interlude?.perHero[heroId]?.dissensionReady) return t('if.dissensionNotReady', { name: h.label });
  return refusDeCibleDActivite(s, h, def, opts) ?? refusDeReussiteSansObjet(h, def, opts);
}

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
 *  de son achat : avec la liste du volet, les deux refus de `buyTalent`), puis ce que la confirmation
 *  débite (tuteur d'Apprentissage, dépense de Réputation) hors de la bourse. Verdict UNIQUE de
 *  `confirmActivity`, avant tout débit. LDB 23 l.66-72, l.228-234 */
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

