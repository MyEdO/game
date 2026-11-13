/**
 * Actions GROUPE (hors combat) — module à part du store, même patron
 * `(get, set)` que combatFlow : équipement (équiper/transférer), avancement PX
 * (caractéristiques/compétences/talents/carrière, prothèses), consommables de fiche, butin.
 */
import { Combatant, CharKey, CHAR_LABELS, ItemInstance, type Main } from '../engine/types';
import { choisirApparenceDObjet, recomputeLoadout, loadoutCreate, loadoutDelete, loadoutSetSlot, equipConflicts, canStow, isOffHandEligible, setADeuxMains } from '../engine/items';
import type { Possession } from '../engine/possession';
import { possessionLabel } from '../engine/possession';
import { resolveCarrier, porteurLocalise, porteurDeLObjet, refusSansPorteur, refusDuHerosPorteur, lotDeLObjet, sansLeLot, avecLeLot, ecrireLesPorteurs, type Carrier } from './monde/carrier';
import { carriersColocated } from '../engine/cargo';
import { refuserGeste, refuserGesteDuSiege } from './refusVisible';
import { refusDepensePx, refusDInventaire, refusDuBackground, refuseSi } from './verrousDeFiche';
import { mentorRequis, libelleAvecSpec, refusDAcquerirLeTalent, refusDePx, refusDeChangerDeCarriere, contexteDeChangement } from './depenseDePx';
import {
  buyCharAdvance as engineBuyCharAdvance,
  buySkillAdvance as engineBuySkillAdvance,
  buyTalent as engineBuyTalent,
  changeCareer as engineChangeCareer,
  isCareerLevelComplete,
  inCareerChar,
  advanceCost,
  talentCost,
} from '../engine/advancement';
import {
  skillSlots,
  talentSlots,
  availableChars,
  designationsFor,
  freeSlotFor,
  designateSlot,
  talentAcquisitions,
  acquerirTalent,
} from '../engine/careerSlots';
import { applyTalentAcquisition, fortuneMax, resolveMax, competenceEnCarriere, talentEnCarriere } from '../engine/talentEffects';
import { heroSessionXp, regainDetermination } from '../engine/session';
import { skillCharacteristicById } from '../engine/character';
import { nextProsthesisTier, grantProsthesisTier } from '../engine/trauma';
import { bonus, effectiveChar } from '../engine/characteristics';
import { castingKindOf } from '../engine/combatFeatures/dispatch';
import { toMoney, Money, formatMoney } from '../engine/money';
import { isArcaneSpell } from '../engine/magic';
import { eligibleTalent, spellCost, verdictApprentissage } from '../engine/grimoire';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { levelsForCareer, byId, careerLabelFor, findSpellById, findTrappingById, refLabel, type SpellData } from '../data/index';
import { t } from '../i18n';
import { decidingSeat, seatSlotsRemaining } from './netOwnership';
import { rangDAjout, rangsDuGroupe, seatOwns } from './sieges';
import { PARTY_MAX, actorIn, ecrireActeur } from './monde/combatants';
import { releaseSeat } from './monde/seating';
import type { Scene } from './monde/scene';
import { persisterLeHeros } from './plateforme';
import { creditBourse, payWithAllocation, refusDeBourse, soloPayer } from './bourseFlow';
import { ensureBourse, bourseOf, withBourseMoney } from '../engine/bourse';
import { transmettreLaPossession } from './possessionsFlow';
import { poserLObjet } from './objetsAuSol';

import type { Get, Set } from './flowTypes';
import { battleRng } from './battleRng';
import { herosDeLEngagement, richesseDeLEngagement, verdictDEngagement, type HerosEngage } from './creation/engagement';
import type { Jeu } from './etat';
import { memeSpecialisation, type RefDesignee } from '../data/schemas/grammaire/ref';
import { gainCorruption } from './corruptionFlow';
import { touchActors } from './combatOrParty';
import { nePeutPasDifferer, applyEffects } from './combatEffects';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { ValidationsDeFenetre } from './validationDeFenetre';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { IdDeHeros } from './designations';
import { garanti } from '../lib/garanti';
import { nomDe } from '../engine/nom';

/** Contexte carrière d'un héros : niveaux + slots cumulés/courants + désignations (LDB 07). */
function careerCtx(hero: Combatant) {
  const career = hero.career ?? '';
  const level = hero.careerLevel ?? 1;
  const levels = levelsForCareer(career);
  return {
    career,
    level,
    levels,
    sSlots: skillSlots(levels, level), // Compétences : cumul niveaux ≤ courant (l.76)
    tSlots: talentSlots(levels, level), // Talents : niveau courant seul (l.103)
    careerChars: availableChars(levels, level), // Caractéristiques : cumul (l.43)
    designations: designationsFor(hero, career),
  };
}

/** Les clés des emplacements de carrière du héros, Compétences puis Talents (`careerCtx`), que `designerLeCreneau`
 *  désigne. */
export function creneauxDuHeros(hero: Combatant): string[] {
  const ctx = careerCtx(hero);
  return [...ctx.sSlots, ...ctx.tSlots].map((sl) => sl.key);
}

function isCompleted(hero: Combatant): boolean {
  const ctx = careerCtx(hero);
  if (!ctx.levels.some((l) => l.level === ctx.level)) return false;
  return isCareerLevelComplete(hero, ctx.level, {
    skillSlots: ctx.sSlots,
    talentSlots: ctx.tSlots,
    careerChars: ctx.careerChars,
    designations: ctx.designations,
  });
}

/** Bascule `equipped` sur les items d'un porteur (héros OU possession, #620) en place : retire d'abord
 *  les conflits de port (armure de même couche, autre cape — LDB 63, échange façon jeu vidéo, journalisé).
 *  `items` est muté EN PLACE (référence du porteur clone) — le retour n'est que le message. */
function applyToggleEquip(items: ItemInstance[], uid: string, label: string): string {
  let msg = '';
  const it = items.find((i) => i.uid === uid);
  if (!it) return msg;
  if (!it.equipped) {
    it.inside = undefined; // on ne porte pas un objet rangé dans un sac : il en sort d'abord
    const out = equipConflicts({ items }, it);
    for (const o of out) o.equipped = false;
    if (out.length) msg = t('pf.swapLayer', { name: label, out: out.map((o) => o.label).join(' + '), item: it.label });
  }
  it.equipped = !it.equipped;
  return msg;
}

/** L'id du porteur de l'objet `uid` (`porteurDeLObjet`), `undefined` après son refus dit (`refusSansPorteur`). Hors combat
 *  (`refusDInventaire` d'abord), ce porteur est un héros du groupe ou une possession. */
function porteurDuGroupe(get: Get, set: Set, uid: string): string | undefined {
  return refuseSi(get, set, (s) => refusSansPorteur(s, uid)) ? undefined : porteurDeLObjet(get(), uid);
}

/** L'id du héros du groupe qui porte l'objet `uid`, `undefined` après son refus dit (`refusDuHerosPorteur`). */
function herosPorteur(get: Get, set: Set, uid: string): string | undefined {
  return refuseSi(get, set, (s) => refusDuHerosPorteur(s, uid)) ? undefined : porteurDeLObjet(get(), uid);
}

/** Équipe/déséquipe un objet de son PORTEUR (héros de `party` OU possession de `possessions`, doctrine
 *  « porteur unique » #614/#620) — un héros recalcule aussi ses armes/armure actives (`recomputeLoadout`,
 *  réservé aux Combatant : une possession n'a pas de loadout d'arme). */
export function equiperLObjet(get: Get, set: Set, uid: string): void {
  if (refuseSi(get, set, refusDInventaire)) return;
  const carrierId = porteurDuGroupe(get, set, uid);
  if (!carrierId) return;
  let msg = '';
  set((s) => {
    const carrier = resolveCarrier(s, carrierId);
    if (!carrier) return {};
    if (carrier.kind === 'heros') {
      return ecrireActeur(s, carrierId, (h) => {
        const clone: Combatant = structuredClone(h);
        clone.items ??= [];
        msg = applyToggleEquip(clone.items, uid, clone.label);
        recomputeLoadout(clone);
        return clone;
      });
    }
    return {
      possessions: s.possessions.map((p) => {
        if (p.uid !== carrierId) return p;
        const clone: Possession = structuredClone(p);
        msg = applyToggleEquip(clone.items, uid, possessionLabel(clone));
        return clone;
      }),
    };
  });
  if (msg) get().ecrireAuJournal(msg);
}

/** Range (`containerUid` non-null) ou sort (null) un objet d'un PORTEUR d'un contenant (LDB 64). Ranger
 *  vérifie la capacité (`canStow`) et met l'objet à l'état « rangé » (ni porté ni tenu) ; sortir le remet
 *  en vrac. Renvoie le message (échec de capacité inclus) ; `items` muté EN PLACE. */
function applyStow(items: ItemInstance[], uid: string, containerUid: string | null, label: string): { msg: string; moved: boolean } {
  const it = items.find((i) => i.uid === uid);
  if (!it) return { msg: '', moved: false };
  if (containerUid) {
    if (!canStow({ items }, it, containerUid)) {
      const msg = t('pf.stowTooBig', { name: label, item: it.label });
      return { msg, moved: false };
    }
    const bag = items.find((i) => i.uid === containerUid);
    it.inside = containerUid; // rangé : ni porté ni tenu
    it.equipped = false;
    const msg = t('pf.stow', { name: label, item: it.label, bag: bag ? t('pf.fragInBag', { bag: bag.label }) : '' });
    return { msg, moved: true };
  }
  it.inside = undefined; // sorti du sac (remis en vrac)
  const msg = t('pf.unstow', { name: label, item: it.label });
  return { msg, moved: true };
}

/** Même patron qu'`equiperLObjet` (clone + recomputeLoadout réservé au héros) — porteur héros OU possession. */
export function rangerLObjet(get: Get, set: Set, uid: string, containerUid: string | null): void {
  if (refuseSi(get, set, refusDInventaire)) return;
  const carrierId = porteurDuGroupe(get, set, uid);
  if (!carrierId) return;
  let msg = '';
  set((s) => {
    const carrier = resolveCarrier(s, carrierId);
    if (!carrier) return {};
    if (carrier.kind === 'heros') {
      return ecrireActeur(s, carrierId, (h) => {
        const clone: Combatant = structuredClone(h);
        clone.items ??= [];
        const r = applyStow(clone.items, uid, containerUid, clone.label);
        msg = r.msg;
        if (!r.moved) return h; // capacité insuffisante ou item introuvable : aucune mutation, pas de recompute
        recomputeLoadout(clone);
        return clone;
      });
    }
    return {
      possessions: s.possessions.map((p) => {
        if (p.uid !== carrierId) return p;
        const clone: Possession = structuredClone(p);
        const r = applyStow(clone.items, uid, containerUid, possessionLabel(clone));
        msg = r.msg;
        return r.moved ? clone : p;
      }),
    };
  });
  if (msg) get().ecrireAuJournal(msg);
}

/** Applique une mutation de loadout à un héros (clone + recompute), même pattern qu'equiperLObjet. */
function mutLoadout(set: Set, heroId: string, fn: (c: Combatant) => void): void {
  set((s) => ecrireActeur(s, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    fn(clone);
    recomputeLoadout(clone);
    return clone;
  }));
}

/** Applique `fn` au loadout du héros, sauf refus d'inventaire (`refusDInventaire`), qui se DIT. */
function gesteDeSet(get: Get, set: Set, heroId: string, fn: (c: Combatant) => void): void {
  if (refuseSi(get, set, refusDInventaire)) return;
  mutLoadout(set, heroId, fn);
}

export function creerLaPanoplie(get: Get, set: Set, heroId: string): void {
  gesteDeSet(get, set, heroId, (c) => loadoutCreate(c));
}
/** Refus de supprimer le set `id` de `hero` : la raison affichée, ou `null`. Combat (`refusDInventaire`), set
 *  introuvable, set d'une arme invoquée (le sort le gère), dernier set (le héros en garde toujours un).
 *  Verdict UNIQUE de `supprimerLaPanoplie` et du bouton Supprimer d'`EquipmentPanel`. */
export function refusDeSupprimerSet(s: Pick<Jeu, 'battle'>, hero: Combatant, id: string): string | null {
  const verrou = refusDInventaire(s);
  if (verrou) return verrou;
  const lo = hero.loadouts?.find((l) => l.id === id);
  if (!lo) return t('pf.loadoutNotFound');
  if ((hero.items ?? []).find((it) => it.uid === lo.main)?.conjured) return t('pf.loadoutConjured');
  return (hero.loadouts?.length ?? 0) > 1 ? null : t('pf.loadoutLast');
}

export function supprimerLaPanoplie(get: Get, set: Set, heroId: string, id: string): void {
  const hero = actorIn(get(), heroId);
  const refus = hero ? refusDeSupprimerSet(get(), hero, id) : t('pf.loadoutNotFound');
  if (refus) return void refuserGeste(get, set, refus);
  mutLoadout(set, heroId, (c) => loadoutDelete(c, id));
}
/** Refus de tenir `uid` (ou de vider l'emplacement, `null`) dans la main `slot` du set `loadoutId` : la
 *  raison affichée, ou `null`. Verdict UNIQUE du geste `garnirLaPanoplie` et des deux écrans d'armes
 *  (`EquipmentPanel`, `HandPicker`). `hero` = la copie que l'appelant lit (`actorIn`). LDB 14 l.138 */
export function refusEmplacementDeMain(
  s: Pick<Jeu, 'battle'>, hero: Combatant, loadoutId: string, slot: Main, uid: string | null,
): string | null {
  const verrou = refusDInventaire(s);
  if (verrou) return verrou;
  const lo = hero.loadouts?.find((l) => l.id === loadoutId);
  if (!lo) return t('pf.loadoutNotFound');
  if ((hero.items ?? []).find((it) => it.uid === lo.main)?.conjured) return t('pf.loadoutConjured');
  if (slot === 'secondaire' && setADeuxMains(hero, lo)) return t('pf.offHandTwoHanded');
  if (uid == null) return null;
  const it = (hero.items ?? []).find((i) => i.uid === uid);
  if (!it) return t('pf.loadoutItemNotFound');
  return slot === 'secondaire' && !isOffHandEligible(it) ? t('pf.offHandIneligible') : null;
}

export function garnirLaPanoplie(get: Get, set: Set, heroId: string, id: string, slot: Main, uid: string | null): void {
  const hero = actorIn(get(), heroId);
  if (!hero) return void refuserGeste(get, set, t('pf.loadoutNotFound'));
  const refus = refusEmplacementDeMain(get(), hero, id, slot, uid);
  if (refus) return void refuserGeste(get, set, refus);
  mutLoadout(set, heroId, (c) => loadoutSetSlot(c, id, slot, uid));
}

/** Libellé d'un porteur déjà résolu (héros ou possession — doctrine id/label). */
function carrierLabel(carrier: Carrier): string {
  return carrier.kind === 'heros' ? carrier.hero.label : possessionLabel(carrier.possession);
}

/** Donne un objet de son PORTEUR (héros ou possession) à un autre — #620 généralise le don héros→héros
 *  aux 4 combinaisons (héros↔héros, héros↔possession, possession↔possession). `recomputeLoadout`
 *  reste réservé aux Combatant (armes actives) — une possession n'a pas de loadout. En combat, rien ne
 *  change de mains (`refusDInventaire`) : un don à sa mule contournerait le verrou d'`equiperLObjet`. */
export function transmettreLObjet(get: Get, set: Set, uid: string, toCarrierId: string): void {
  if (refuseSi(get, set, refusDInventaire)) return;
  const fromCarrierId = porteurDuGroupe(get, set, uid);
  if (!fromCarrierId) return;
  const state = get();
  const from = resolveCarrier(state, fromCarrierId)!;
  const to = resolveCarrier(state, toCarrierId);
  const fromItems = from.kind === 'heros' ? (from.hero.items ?? []) : from.possession.items;
  const item = fromItems.find((i) => i.uid === uid)!;
  if (!to) return void refuserGeste(get, set, t('pf.giveNotFound'));
  if (fromCarrierId === toCarrierId) return void refuserGeste(get, set, t('pf.giveSelf', { from: carrierLabel(from), item: item.label }));
  if (!carriersColocated(porteurLocalise(from), porteurLocalise(to))) {
    return void refuserGeste(get, set, t('pf.giveNotColocated', { from: carrierLabel(from), to: carrierLabel(to), item: item.label }));
  }
  const lot = lotDeLObjet(fromItems, uid);
  const fromLabel = carrierLabel(from);
  const toLabel = carrierLabel(to);
  set((s) => ecrireLesPorteurs(s, {
    [fromCarrierId]: (items) => sansLeLot(items, lot),
    [toCarrierId]: (items) => avecLeLot(items, lot, to.kind === 'heros'),
  }));
  get().ecrireAuJournal(t('pf.give', { from: fromLabel, item: item.label, to: toLabel }));
}

/** #2967 */
export function poserLApparence(get: Get, set: Set, uid: string, apparence: string): void {
  const heroId = herosPorteur(get, set, uid);
  if (!heroId) return;
  const resolveTrapping = objetDuNarratif(get().campaignNarratif);
  const it = get().party.find((h) => h.id === heroId)!.items!.find((i) => i.uid === uid)!;
  if (!it.trappingId) return void refuserGeste(get, set, t('pf.apparenceSansCatalogue', { item: it.label }));
  if (!choisirApparenceDObjet({ ...it }, apparence, resolveTrapping)) return void refuserGeste(get, set, t('pf.apparenceNonAdmise', { item: it.label }));
  mutLoadout(set, heroId, (c) => {
    choisirApparenceDObjet(c.items!.find((i) => i.uid === uid)!, apparence, resolveTrapping);
  });
}

export function accorderLesPx(get: Get, set: Set, heroId: string, amount: number): void {
  let name = '';
  set((s) => ecrireActeur(s, heroId, (h) => {
    name = h.label;
    const clone: Combatant = structuredClone(h);
    clone.xp = (clone.xp ?? 0) + amount;
    return clone;
  }));
  if (name) get().ecrireAuJournal(`${name} : ${amount >= 0 ? '+' : ''}${amount} PX.`);
}

/** SEULE couture de dépense de PX : le refus (`refusDepensePx`) tombe ici, sinon `depense` s'écrit par
 *  `ecrireActeur`. Rend `false` au refus. */
export function depenserPx(get: Get, set: Set, heroId: string, depense: (h: Combatant) => Combatant): boolean {
  const refus = refusDepensePx(get());
  if (refus) return !refuserGeste(get, set, refus);
  set((s) => ecrireActeur(s, heroId, depense));
  return true;
}

export function acheterLaCaracteristique(get: Get, set: Set, heroId: string, char: CharKey): void {
  let msg = '';
  if (!depenserPx(get, set, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const inC = inCareerChar(careerCtx(clone).careerChars, char);
    if (mentorRequis(get(), inC)) {
      // LDB 07 l.89
      msg = t('pf.charNeedsMentor', { name: nomDe(clone), what: CHAR_LABELS[char] });
      return h;
    }
    const manque = refusDePx(clone, advanceCost(clone.charAdvances?.[char] ?? 0, 'caracteristique', inC));
    if (manque) {
      msg = manque;
      return h;
    }
    const r = engineBuyCharAdvance(clone, char, inC);
    if (!r.ok) {
      msg = t('pf.refused', { name: nomDe(clone), what: CHAR_LABELS[char], reason: r.reason ?? '' });
      return h;
    }
    msg = t('pf.advanceBought', { name: nomDe(clone), what: CHAR_LABELS[char], cost: r.cost, hors: inC ? '' : t('pf.fragOutOfCareer') });
    return clone;
  })) return;
  if (msg) get().ecrireAuJournal(msg);
}

/** Achète une Augmentation de Compétence — identité : la référence, LDB 09 l.44. L'achat via un
 *  emplacement « (Au choix) » libre DÉSIGNE l'emplacement (LDB 09 l.38 : la Spécialisation se
 *  choisit à l'allocation). Remise −5 PX si la Compétence est ajoutée par un talent ET déjà
 *  dans la carrière (LDB 10 Maître artisan…). */
export function acheterLaCompetence(get: Get, set: Set, heroId: string, skill: RefDesignee): void {
  const { id: skillId, spec } = skill;
  let msg = '';
  if (!depenserPx(get, set, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const ctx = careerCtx(clone);
    const skillLabel = byId('skill', skillId)?.label ?? skillId; // AFFICHAGE (messages) + conversion pour le moteur
    const known = clone.skills.some((sk) => sk.id === skillId && memeSpecialisation(sk.spec, spec));
    const { statut: status, remise: discount } = competenceEnCarriere(clone, ctx.sSlots, ctx.designations, skillId, spec);
    const inC = status != null;
    if (known && mentorRequis(get(), inC)) {
      // LDB 07 l.89
      msg = t('pf.charNeedsMentor', { name: nomDe(clone), what: libelleAvecSpec(skillLabel, spec) });
      return h;
    }
    if (!known) {
      if (!inC) {
        msg = t('pf.skillNotAcquirable', { name: nomDe(clone), what: libelleAvecSpec(skillLabel, spec) });
        return h;
      }
      // Acquérir la Compétence de carrière à advances 0, puis l'augmenter (l'Augmentation est payée).
      const characteristic = skillCharacteristicById(skillId); // par id (≠ 2e lookup par libellé)
      clone.skills.push({ id: skillId, spec, characteristic, advances: 0 });
    }
    const avant = clone.skills.find((sk) => sk.id === skillId && memeSpecialisation(sk.spec, spec))?.advances ?? 0;
    const manque = refusDePx(clone, advanceCost(avant, 'competence', inC, discount));
    if (manque) {
      msg = manque;
      return h;
    }
    const r = engineBuySkillAdvance(clone, skill, inC, discount);
    if (!r.ok) {
      msg = t('pf.refused', { name: nomDe(clone), what: libelleAvecSpec(skillLabel, spec), reason: r.reason ?? '' });
      return h;
    }
    // Première allocation via un slot joker libre → désignation automatique (LDB 09 l.38).
    if (status === 'free') {
      const slot = freeSlotFor(ctx.sSlots, ctx.designations, skillId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      if (slot) designateSlot(clone, ctx.career, slot, skillId, spec, [...ctx.sSlots, ...ctx.tSlots]);
    }
    msg = t('pf.advanceBought', { name: nomDe(clone), what: libelleAvecSpec(skillLabel, spec), cost: r.cost, hors: inC ? '' : t('pf.fragOutOfCareer') });
    return clone;
  })) return;
  if (msg) get().ecrireAuJournal(msg);
}

/** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante sur une (id, spec)
 *  concrète (éventuellement déjà possédée via l'espèce) — il devient in-carrière et montable en
 *  PX. Arbitrage RAW : specs distinctes par carrière, désignations par carrière. */
export function designerLeCreneau(get: Get, set: Set, heroId: string, slotKey: string, option: RefDesignee): void {
  const { id: optionId, spec } = option;
  let msg = '';
  set((s) => ecrireActeur(s, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const ctx = careerCtx(clone);
    const all = [...ctx.sSlots, ...ctx.tSlots];
    const slot = all.find((sl) => sl.key === slotKey);
    if (!slot) {
      msg = t('pf.unknownSlot', { name: nomDe(clone) });
      return h;
    }
    const r = designateSlot(clone, ctx.career, slot, optionId, spec, all);
    if (!r.ok) {
      msg = t('pf.designateRefused', { name: nomDe(clone), reason: r.reason ?? '' });
      return h;
    }
    const label = refLabel(slot.kind === 'skill' ? 'skills' : 'talents', option); // AFFICHAGE seul
    msg = t('pf.designated', { name: nomDe(clone), label });
    return clone;
  }));
  if (msg) get().ecrireAuJournal(msg);
}

/** Achète une Augmentation de Talent — identité (talentId, spec). In-carrière = `talentEnCarriere` : un
 *  emplacement du niveau COURANT le couvre (LDB 07 l.103 ; explicite, désigné, ou libre → désignation
 *  automatique), ou un ajout de carrière ; hors carrière interdit (LDB 07 l.93) ; Maxi respecté (LDB 10). Applique les effets d'acquisition
 *  (+5 Caractéristique de départ, Véloce) et recale Blessures/Chance/Détermination. */
export function acheterLeTalent(get: Get, set: Set, heroId: string, talent: RefDesignee): void {
  const { id: talentId, spec } = talent;
  let msg = '';
  if (!depenserPx(get, set, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const ctx = careerCtx(clone);
    const talentLabel = refLabel('talents', talent); // AFFICHAGE + conversion pour le moteur
    const status = talentEnCarriere(clone, ctx.tSlots, ctx.designations, talentId, spec, [...ctx.sSlots, ...ctx.tSlots]);
    if (!status) {
      msg = t('pf.talentOutOfCareer', { name: nomDe(clone), label: talentLabel });
      return h;
    }
    const refusPropre = refusDAcquerirLeTalent(clone, talentId, spec);
    if (refusPropre) {
      msg = refusPropre;
      return h;
    }
    const manque = refusDePx(clone, talentCost(talentAcquisitions(clone, talentId, spec)));
    if (manque) {
      msg = manque;
      return h;
    }
    const fortuneBefore = fortuneMax(clone);
    const resolveBefore = resolveMax(clone);
    const r = engineBuyTalent(clone, talentId, spec); // spec = identité PERSISTÉE (id si migré), jamais re-dérivée du libellé
    if (!r.ok) {
      msg = t('pf.refused', { name: nomDe(clone), what: talentLabel, reason: r.reason ?? '' });
      return h;
    }
    if (status === 'free') {
      const slot = freeSlotFor(ctx.tSlots, ctx.designations, talentId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      if (slot) designateSlot(clone, ctx.career, slot, talentId, spec, [...ctx.sSlots, ...ctx.tSlots]);
    }
    // Effets d'acquisition (+5 Caractéristique de départ, Véloce) + Chance et Détermination.
    applyTalentAcquisition(clone, talentId, spec);
    clone.fortune = (clone.fortune ?? 0) + (fortuneMax(clone) - fortuneBefore); // Chanceux
    clone.resolve = (clone.resolve ?? 0) + (resolveMax(clone) - resolveBefore); // Obstiné
    msg = t('pf.talentBought', { name: nomDe(clone), label: talentLabel, cost: r.cost });
    // Magie mineure (LDB 10 l.714) : BFM sorts inclus au Talent — à choisir (0 PX, Avancement).
    if (castingKindOf(talentId) === 'mineure') {
      const q = bonus(effectiveChar(clone, 'force-mentale'));
      if (q > 0) msg += t('pf.minorMagicIncluded', { n: q });
    }
    return clone;
  })) return;
  if (msg) get().ecrireAuJournal(msg);
}

/** Apprend/mémorise un sort (LDB 46 l.16-20 + Talents LDB 10) : coût en PX selon la
 *  famille (engine/grimoire.spellCost) ; un sort payé par Magie du Chaos est une prise de plus du
 *  Talent, bornée par son Maxi (`acquerirTalent`, LDB 10 l.704-708), et tout sort de Magie du Chaos
 *  inflige AUSSI +1 Point de Corruption, appliqué par l'appelant store (seuil → mutation). */
export function acheterLeSort(get: Get, set: Set, heroId: string, spellId: string, opts: { discountXp?: number } = {}): { ok: boolean; chaos?: boolean } {
  let msg = '';
  let result: { ok: boolean; chaos?: boolean } = { ok: false };
  if (!depenserPx(get, set, heroId, (h) => {
    const sp = findSpellById(spellId); // accès UNIQUE par id stable (prod et tests)
    if (!sp) {
      msg = t('pf.spellNotFound', { id: spellId });
      return h;
    }
    const clone: Combatant = structuredClone(h);
    const full = spellCost(clone, sp);
    if (full == null) {
      msg = t(verdictApprentissage(clone, sp) === 'dejaConnu' ? 'pf.spellAlreadyKnown' : 'pf.spellCannotLearn', { name: nomDe(clone), spell: sp.label });
      return h;
    }
    // Recherche universitaire (ACE 12 l.55) : « mémoriser un sort pour 100PX de moins que
    // son prix normal (pour un minimum de 100PX) » — remise sur CET achat seul, jamais au-dessus
    // du prix normal (plancher inerte pour les sorts à moins de 100 PX).
    const cost = opts.discountXp && full > 0 ? Math.min(full, Math.max(100, full - opts.discountXp)) : full;
    const manque = refusDePx(clone, cost);
    if (manque) {
      msg = manque;
      return h;
    }
    const talent = eligibleTalent(clone, sp)!;
    const chaos = talent.kind === 'chaos';
    if (chaos && full > 0 && !acquerirTalent(clone, { id: talent.talentId, spec: talent.spec })) {
      msg = t('adv.talentMax');
      return h;
    }
    clone.xp = (clone.xp ?? 0) - cost;
    clone.spells = [...(clone.spells ?? []), sp.id]; // runtime = id de sort (pas le libellé)
    msg = cost > 0
      ? t('pf.spellLearned', { name: nomDe(clone), spell: sp.label, cost, remise: cost < full ? t('pf.fragSpellDiscount', { n: full - cost }) : '' })
      : t('pf.spellGranted', { name: nomDe(clone), spell: sp.label });
    result = { ok: true, chaos };
    return clone;
  })) return { ok: false };
  if (msg) get().ecrireAuJournal(msg);
  return result;
}

/** Composant d'incantation (LDB 46 l.107-113, règle optionnelle `magie-composant`) : achète un
 *  composant pour un Sort d'Arcane/Domaine CONNU du héros — coût = NI pistoles d'argent (l.113),
 *  prélevé sur la Bourse de l'incantateur. « acheté pour un Sort spécifique […], ne marche que pour ce
 *  Sort. » Le composant absorbe le contrecoup à l'incantation (consumé) — cf. applyMiscast. */
export function acheterLaComposante(get: Get, set: Set, heroId: string, spellId: string): void {
  const hero = actorIn(get(), heroId);
  const refus = refusAchatDeComposant(hero, spellId);
  if (refus) return void refuserGeste(get, set, refus);
  const sp = findSpellById(spellId)!;
  const cost = coutDuComposant(sp);
  payWithAllocation(get, set, { debits: soloPayer(heroId, cost), recipient: heroId, purpose: 'Composant d’incantation' });
  set((s) => ecrireActeur(s, heroId, (h) => ({ ...h, componentSpells: [...(h.componentSpells ?? []), spellId] })));
  get().ecrireAuJournal(t('pf.componentBought', { name: nomDe(hero!), spell: sp.label, money: formatMoney(cost) }));
}

/** Coût d'un composant d'incantation. LDB 46 l.113 */
export function coutDuComposant(sp: Pick<SpellData, 'cn'>): Money {
  return toMoney({ silver: sp.cn ?? 0 });
}

/** Un composant s'achète pour ce Sort : d'Arcane ou de Domaine, à NI. LDB 46 l.107-113 */
const prendUnComposant = (sp: SpellData): boolean => isArcaneSpell(sp) && sp.cn != null;

/** Sorts CONNUS du héros pour lesquels la fiche offre un composant : ceux que `refusAchatDeComposant`
 *  ne refuse que par la bourse. LDB 46 l.107-113 */
export function composantsOfferts(hero: Combatant): SpellData[] {
  return (hero.spells ?? []).map((id) => findSpellById(id)).filter((sp): sp is SpellData => !!sp && prendUnComposant(sp));
}

/** Refus d'acheter un composant pour `spellId` : la raison affichée, ou `null`. Verdict UNIQUE du geste
 *  `acheterLaComposante` et de la fiche. LDB 46 l.107-113 */
export function refusAchatDeComposant(hero: Combatant | undefined, spellId: string): string | null {
  const sp = findSpellById(spellId);
  if (!hero || !sp) return t('pf.componentSpellNotFound');
  if (!prendUnComposant(sp)) return t('pf.componentArcaneOnly', { spell: sp.label });
  if (!(hero.spells ?? []).includes(spellId)) return t('pf.spellUnknown', { name: nomDe(hero), spell: sp.label });
  const cost = coutDuComposant(sp);
  return refusDeBourse(hero, cost, 'pf.componentTooExpensive', { spell: sp.label });
}

/** Édite la bio MUTABLE d'un héros (hors combat) : Motivation + Ambitions court/long terme (LDB 05).
 *  Mute `store.party` (→ persisté par la save) ET propage au roster s'il y est (`persisterLeHeros`). */
export function ecrireLHistorique(get: Get, set: Set, heroId: string, patch: { motivation?: string; ambitionShort?: string; ambitionLong?: string }): void {
  if (refuseSi(get, set, refusDuBackground)) return;
  set((s) => ecrireActeur(s, heroId, (h) => ({
    ...h,
    motivation: patch.motivation ?? h.motivation,
    details: { ...h.details, ambitionShort: patch.ambitionShort ?? h.details?.ambitionShort, ambitionLong: patch.ambitionLong ?? h.details?.ambitionLong },
  })));
  const hero = get().party.find((h) => h.id === heroId);
  if (hero) persisterLeHeros(hero);
}

/** Les cases du groupe de la fin de séance (`ChoixDesFenetres.finDeSeance`, sans rangée). */
export type AxeDuGroupe = 'ambitionCourte' | 'ambitionLongue';
/** Les cases de chaque héros de la fin de séance (`ChoixDesFenetres.finDeSeance`, rangée du héros). */
export type AxeDuHerosDeLaSeance = 'ambitionPersonnelleCourte' | 'ambitionPersonnelleLongue' | 'motivation';

/** La fin de séance ouverte (LDB 05 Ambitions, LDB 17 Détermination) : les cases cochées de chaque héros et du groupe,
 *  que choisit `fenetreChoisir('finDeSeance', …)` et qu'applique `fenetreValider('finDeSeance')`. */
export interface FinDeSeance {
  heros: Record<IdDeHeros, Partial<Record<AxeDuHerosDeLaSeance, boolean>>>;
  groupe: Partial<Record<AxeDuGroupe, boolean>>;
}

/** Les héros dont la fin de séance coche les cases. */
export const herosDeLaSeance = (s: Pick<Jeu, 'party'>): Combatant[] => s.party.filter((h) => h.kind === 'heros');

/** Ouvre la fin de séance, aucune case cochée : l'Effet `sessionEnd` (#83), le menu de jeu, le récap de chapitre. */
export function ouvrirLaFinDeSeance(set: Set): void {
  set({ finDeSeance: { heros: {}, groupe: {} } });
}

/** Pourquoi le menu de jeu ne clôt pas la séance : hors exploration, ou chez l'invité ; `null` = elle s'ouvre. */
export function refusDeFinDeSeance(s: Pick<Jeu, 'mode' | 'net'>): string | null {
  if (s.mode !== 'exploration') return t('gameMenu.finDeSeance.horsExploration');
  return s.net.mode === 'invite' ? t('gameMenu.finDeSeance.invite') : null;
}

/**
 * Fin de séance de jeu (LDB 05 Ambitions l.793-841 + LDB 17 Détermination l.81) : octroie les PX
 * d'Ambition accomplie (personnelle +50/+500, de groupe +50/+500 à chaque héros), regagne 1 Point de
 * Détermination aux héros ayant agi selon leur Motivation (plafonné au max), ferme la fin de séance, puis restaure la
 * Chance du groupe (couture de séance, `restoreFortune`). SOURCE UNIQUE de la validation de la fin de séance et du récap
 * de chapitre.
 */
export function terminerLaSeance(get: Get, set: Set): void {
  const { heros, groupe } = garanti(get().finDeSeance, 'finDeSeance', 'fin de séance ouverte');
  const group = { short: groupe.ambitionCourte, long: groupe.ambitionLongue };
  const lines = new Map<string, string[]>();
  set((s) => ecrireActeur(s, herosDeLaSeance(s).map((h) => h.id), (h) => {
    const f = heros[h.id] ?? {};
    const xp = heroSessionXp({ short: f.ambitionPersonnelleCourte, long: f.ambitionPersonnelleLongue }, group);
    if (!xp && !f.motivation) return h;
    const clone: Combatant = structuredClone(h);
    const siennes: string[] = [];
    if (xp) { clone.xp = (clone.xp ?? 0) + xp; siennes.push(t('pf.ambitionXp', { name: nomDe(clone), xp })); }
    if (f.motivation) {
      const before = clone.resolve ?? 0;
      clone.resolve = regainDetermination(clone, 1);
      if (clone.resolve > before) siennes.push(t('pf.motivationResolve', { name: nomDe(clone) }));
    }
    lines.set(h.id, siennes);
    return clone;
  }));
  for (const l of [...lines.values()].flat()) get().ecrireAuJournal(l);
  set({ finDeSeance: null });
  get().restaurerLaFortune(); // Chance restaurée pour la prochaine séance (LDB 17 l.41)
}

/** Retire UN composant d'incantation possédé pour un Sort (sans remboursement). */
export function retirerLaComposante(_get: Get, set: Set, heroId: string, spellId: string): void {
  set((s) => ecrireActeur(s, heroId, (h) => {
    const list = [...(h.componentSpells ?? [])];
    const i = list.indexOf(spellId);
    if (i < 0) return h;
    list.splice(i, 1); // retire une seule occurrence
    return { ...h, componentSpells: list };
  }));
}

/** Rachat PX d'une prothèse (LDB 73) : les PALIERS sont DÉCLARÉS sur l'entrée de catalogue
 *  (`TrappingData.prosthesisTraining`) et joués dans l'ordre par `nextProsthesisTier` — ce flux ne nomme
 *  aucune prothèse. Fausse jambe : 100 PX (Mouvement) puis 200 PX (Esquive) ; Crochet : 400 PX (l.23). */
export function entrainerLaProthese(get: Get, set: Set, uid: string): void {
  const heroId = herosPorteur(get, set, uid);
  if (!heroId) return;
  let msg = '';
  if (!depenserPx(get, set, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const it = (clone.items ?? []).find((i) => i.uid === uid);
    if (!it) { msg = t('pf.prosthesisNotTrainable', { name: nomDe(clone) }); return h; }
    const tier = nextProsthesisTier(it);
    if (!tier) {
      // Prothèse non entraînable (aucun palier déclaré / non portée) vs. déjà entièrement maîtrisée.
      const done = it.equipped && !!it.trappingId && (findTrappingById(it.trappingId)?.prosthesisTraining?.length ?? 0) > 0;
      msg = done ? t('pf.prosthesisTrained', { name: nomDe(clone), item: it.label }) : t('pf.prosthesisNotTrainable', { name: nomDe(clone) });
      return h;
    }
    const manque = refusDePx(clone, tier.px);
    if (manque) { msg = manque; return h; }
    clone.xp = (clone.xp ?? 0) - tier.px;
    grantProsthesisTier(it, tier);
    msg = t('pf.prosthesisTierBought', { name: nomDe(clone), item: it.label, tier: tier.label, cost: tier.px });
    return clone;
  })) return;
  if (msg) get().ecrireAuJournal(msg);
}

export function changerDeCarriere(get: Get, set: Set, heroId: string, newCareer: string, newLevel: number): void {
  let msg = '';
  if (!depenserPx(get, set, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    // Validation LDB 07 l.137 + LDB 07 l.144-148 : complétion, niveau cible, surcoût de Classe.
    const completed = isCompleted(clone);
    const refus = refusDeChangerDeCarriere(get(), clone, newCareer, newLevel, completed);
    if (refus) {
      msg = refus;
      return h;
    }
    const r = engineChangeCareer(clone, newCareer, newLevel, contexteDeChangement(clone, newCareer, newLevel, completed));
    if (!r.ok) {
      msg = t('pf.careerRefused', { name: nomDe(clone), reason: r.reason ?? '' });
      return h;
    }
    msg = t('pf.careerChanged', { name: nomDe(clone), career: careerLabelFor({ career: newCareer, appearance: clone.appearance }), level: newLevel, cost: r.cost });
    return clone;
  })) return;
  if (msg) get().ecrireAuJournal(msg);
}

/** Couture de la composition du groupe (ajout, retrait, remplacement, intentions coop comprises) : en
 *  combat, le groupe est la file de combat, et `finalizeBattle` y reporte chaque combattant
 *  (`REPORT_DE_COMBATTANT`, #2312) — la composition ne change pas. Dit le refus, rend `true` s'il tombe. */
function compositionRefusee(get: Get, set: Set, refus: string | null = refusComposition(get())): boolean {
  return refus !== null && refuserGesteDuSiege(get, set, refus);
}

/** Raison du refus de composition (`compositionRefusee`), ou `null` — lue par l'écran d'équipe. */
export function refusComposition(s: Pick<Jeu, 'battle'>): string | null {
  return s.battle ? t('pf.partyInCombat') : null;
}

/** Raison du refus d'AJOUTER un héros au groupe pour `seat` : composition close (`refusComposition`),
 *  groupe plein (`PARTY_MAX`), héros déjà présent, quota d'emplacements du siège épuisé
 *  (`seatSlotsRemaining`) ; `null` s'il entre. Verdict UNIQUE de `recruterLeHeros` et des écrans qui
 *  l'offrent (`heroId` absent : l'offre d'un héros encore à choisir). */
export function refusDAjoutAuGroupe(s: Pick<Jeu, 'battle' | 'party' | 'net'>, heroId: string | undefined, seat: number): string | null {
  const present = heroId === undefined ? undefined : s.party.find((h) => h.id === heroId);
  return refusComposition(s)
    ?? (s.party.length >= PARTY_MAX ? t('pf.partyFull', { max: PARTY_MAX }) : null)
    ?? (present ? t('pf.partyDuplicate', { name: nomDe(present) }) : null)
    ?? (seatSlotsRemaining(s, seat) <= 0 ? t('pf.seatSlotsSpent') : null);
}

/** Raison du refus de RETIRER, REMPLACER ou MODIFIER le héros `heroId` pour `seat` : composition close
 *  (`refusComposition`), héros d'un autre siège (`seatOwns`) ; `null` s'il se compose. Verdict UNIQUE de
 *  `renvoyerLeHeros`, `remplacerLeHeros`, de l'engagement en édition (`refusDEngagement`) et de l'écran d'équipe. */
export function refusDeComposerLeHeros(s: Pick<Jeu, 'battle' | 'net' | 'party'>, heroId: string, seat: number): string | null {
  return refusComposition(s) ?? (seatOwns(s, seat, heroId) ? null : t('pf.heroOfAnotherSeat'));
}

/** Raison du refus de RECRUTER `heros` pour le siège qui décide (`decidingSeat`) : le refus d'ajout au groupe
 *  (`refusDAjoutAuGroupe`) du héros qu'il bâtira, puis la raison qui refuse l'engagement lui-même
 *  (`verdictDEngagement`) ; `null` s'il se recrute. Verdict UNIQUE de `recruterLeHeros` et des écrans qui l'offrent. */
export function refusDeRecruter(s: Pick<Jeu, 'battle' | 'party' | 'net'>, heros: HerosEngage): string | null {
  const verdict = verdictDEngagement(heros);
  const seat = decidingSeat(s);
  return 'refus' in verdict ? refusDAjoutAuGroupe(s, undefined, seat) ?? verdict.refus : refusDAjoutAuGroupe(s, verdict.id, seat);
}

/** Raison du refus de RENVOYER le héros `heroId` pour le siège qui décide (`refusDeComposerLeHeros`) ; `null` s'il se
 *  renvoie. Verdict UNIQUE de `renvoyerLeHeros` et des écrans qui l'offrent. */
export function refusDeRenvoyer(s: Pick<Jeu, 'battle' | 'net' | 'party'>, heroId: string): string | null {
  return refusDeComposerLeHeros(s, heroId, decidingSeat(s));
}

/** Raison du refus de LANCER la partie avec ce groupe : un invité (l'hôte lance), un groupe vide, ou un siège invité
 *  qui a encore des emplacements à remplir (`seatSlotsRemaining`) ; `null` si elle se lance. Verdict UNIQUE de
 *  `lancerCampagne` (`scenes/campaign.ts`), du pont d'un hôte (`lancer`) et de l'écran d'équipe. */
export function refusDeLancer(s: Pick<Jeu, 'net' | 'party'>): string | null {
  if (s.net.mode === 'invite') return t('party.guest.waiting');
  if (s.party.length === 0) return t('party.action.start.empty');
  const invites = new Set(s.net.slots.filter((seat) => seat !== 0));
  return [...invites].some((seat) => seatSlotsRemaining(s, seat) > 0) ? t('party.action.start.guestPending') : null;
}

/** Une partie est-elle EN COURS (une scène vivante, hors lancement d'une campagne choisie) : l'écran d'équipe
 *  offre alors « Reprendre », et le choix de campagne se ferme. */
export function partieEnCours(s: Pick<Jeu, 'scene' | 'pendingCampaign'>): boolean {
  return s.scene != null && !s.pendingCampaign;
}

/** Ajoute un héros au groupe dans un emplacement du siège qui décide (`decidingSeat` : le siège local, ou celui
 *  du transport pour un intent), au rang `rangDAjout` — point d'entrée UNIQUE de la composition d'équipe (PartyScreen, HeroSelector,
 *  créateur), le héros bâti par le noyau de `heros` (`herosDeLEngagement`), refusé par `refusDAjoutAuGroupe` ou par
 *  le brouillon incomplet. Les possessions aux dés d'un pré-tiré se tirent d'abord, puis sa Richesse de départ (`richesseDeLEngagement`, LDB 05 l.578-583), tirée ICI seul au RNG du
 *  jeu (`battleRng`), crédite SA propre Bourse (SOCLE POSSESSIONS §8, #531). */
export function recruterLeHeros(get: Get, set: Set, heros: HerosEngage): void {
  const s = get();
  const seat = decidingSeat(s);
  // Tout refus se juge AVANT de bâtir : un geste refusé ne consomme aucun id (#2907).
  if (compositionRefusee(get, set, refusDeRecruter(s, heros))) return;
  const copy: Combatant = ensureBourse(herosDeLEngagement(heros, get().forgerUnId, battleRng()), get().forgerUnId);
  const wealth = richesseDeLEngagement(heros, battleRng());
  const rangs = { ...rangsDuGroupe(s), [copy.id]: rangDAjout(s, seat)! };
  set({
    party: [...s.party, copy],
    net: { ...s.net, ownership: { ...s.net.ownership, [copy.id]: seat }, rangs },
  });
  creditBourse(get, set, copy.id, wealth);
  get().ecrireAuJournal(t('pf.startingWealth', { name: nomDe(copy), money: formatMoney(wealth) }));
}

/**
 * Lève de leur place TOUS les emplacements du groupe — PURE, rend la scène à écrire. Le groupe
 * ENTIER quitte le lieu (`quitterLaScene`) : une scène quittée ne garde pas un héros absent, et le
 * revisit ne rassoit personne.
 *
 * La RECOMPOSITION du groupe (retrait, remplacement, permutation) ne passe PAS par ici : elle est
 * réconciliée par la couture d'occupation du store, qui compare les corps rang par rang.
 * Rend la scène d'entrée, même référence, si personne n'était assis — aucun delta d'instance.
 */
export function releaseHeroSeats<S extends Scene | null>(scene: S): S {
  if (!scene?.seatAssignments) return scene;
  let next: Scene = scene;
  for (let rang = 1; rang <= PARTY_MAX; rang++) next = releaseSeat(next, { kind: 'groupe', rang });
  return next as S;
}

/** Retire un héros du groupe (écran d'équipe), refusé par `refusDeRenvoyer`, et nettoie sa possession
 *  réseau ; son rang (`net.rangs`) reste vide.
 *  SUCCESSION (§6/§19, décision №3, SOCLE POSSESSIONS #615) — jamais d'orphelin gelé : les
 *  Possessions du héros retiré ET sa Bourse passent à un héritier VIVANT, défaut = le DOYEN (1er
 *  membre RESTANT de `party` après retrait qui n'est PAS mort — un héros mort reste dans `party`,
 *  idiome `party.filter(h => !h.dead)` du repo : un cadavre n'hérite pas). Aucun vivant restant
 *  (groupe vidé ou tout-morts) → repli : rien à hériter, la Bourse/les Possessions du partant
 *  restent SUR LUI (il quitte le groupe avec son bien, aucun héritier vivant à défausser dessus). */
export function renvoyerLeHeros(get: Get, set: Set, heroId: string): void {
  if (compositionRefusee(get, set, refusDeRenvoyer(get(), heroId))) return;
  const s = get();
  const idx = s.party.findIndex((h) => h.id === heroId);
  if (idx < 0) return;
  const hero = s.party[idx];
  const remaining = s.party.filter((h) => h.id !== heroId);
  const heir = remaining.find((h) => !h.dead);
  if (heir) {
    for (const p of get().possessions) {
      if (p.ownerId === heroId) transmettreLaPossession(get, set, p.uid, heir.id);
    }
    const bourse = bourseOf(hero);
    if (bourse.gold || bourse.silver || bourse.brass) creditBourse(get, set, heir.id, bourse);
  }
  const ownership = { ...s.net.ownership };
  delete ownership[heroId];
  const rangs = rangsDuGroupe(s);
  delete rangs[heroId];
  set((s2) => ({ party: s2.party.filter((h) => h.id !== heroId), net: { ...s2.net, ownership, rangs } }));
}

/** Remplace ATOMIQUEMENT le héros `heroId` par celui que le noyau bâtit de `heros` (`herosDeLEngagement`) à SA position dans `party` (substitution en
 *  place → préserve l'index/ordre) et à SON rang (`net.rangs`) ; refusé par `refusDeComposerLeHeros`, la possession
 *  passe du siège qui décide (`decidingSeat`, qui possède `heroId`) au remplaçant (l'ancien id est libéré).
 *  Source UNIQUE du remplacement, réutilisée par le créateur (édition en place) et le bouton
 *  « Remplacer » du slot. Le remplaçant porte la Bourse du remplacé (un remplacement n'est pas un recrutement) ; un id
 *  déjà au groupe est refusé et dit. */
export function remplacerLeHeros(get: Get, set: Set, heroId: string, heros: HerosEngage): void {
  // Tout refus se juge AVANT de bâtir : un geste refusé ne consomme aucun id (#2907).
  const verdict = verdictDEngagement(heros);
  if (compositionRefusee(get, set, refusDeComposerLeHeros(get(), heroId, decidingSeat(get())) ?? ('refus' in verdict ? verdict.refus : null)) || 'refus' in verdict) return;
  const s = get();
  const idx = s.party.findIndex((h) => h.id === heroId);
  if (idx < 0) return;                                                    // l'ancien n'est plus là
  const doublon = verdict.id !== undefined && verdict.id !== heroId ? s.party.find((h) => h.id === verdict.id) : undefined;
  if (compositionRefusee(get, set, doublon ? t('pf.partyDuplicate', { name: nomDe(doublon) }) : null)) return;
  const copy = withBourseMoney(herosDeLEngagement(heros, get().forgerUnId, battleRng()), bourseOf(s.party[idx]), get().forgerUnId);
  const ownership = { ...s.net.ownership };
  delete ownership[heroId];
  ownership[copy.id] = decidingSeat(s);
  const rangs = rangsDuGroupe(s);
  const rang = rangs[heroId];
  delete rangs[heroId];
  rangs[copy.id] = rang;
  set({ party: s.party.map((h, i) => (i === idx ? copy : h)), net: { ...s.net, ownership, rangs } });
}


/** Les cases de la fin de séance (`CorpsDesChoix`), cochées ou décochées par l'hôte, parmi celles que l'état ouvre
 *  (`OUVERTS_DU_CHOIX`). */
export function choixDeLaFinDeSeance(get: Get, set: Set) {
  const ouverte = () => garanti(get().finDeSeance, 'finDeSeance', 'fin de séance ouverte');
  const duGroupe = (axe: AxeDuGroupe) => (valeur: boolean) => set({ finDeSeance: { ...ouverte(), groupe: { ...ouverte().groupe, [axe]: valeur } } });
  const duHeros = (axe: AxeDuHerosDeLaSeance) => (valeur: boolean, pid: IdDeHeros) => {
    const f = ouverte();
    set({ finDeSeance: { ...f, heros: { ...f.heros, [pid]: { ...f.heros[pid], [axe]: valeur } } } });
  };
  return {
    finDeSeance: {
      ambitionCourte: duGroupe('ambitionCourte'),
      ambitionLongue: duGroupe('ambitionLongue'),
      ambitionPersonnelleCourte: duHeros('ambitionPersonnelleCourte'),
      ambitionPersonnelleLongue: duHeros('ambitionPersonnelleLongue'),
      motivation: duHeros('motivation'),
    },
  } satisfies Partial<CorpsDesChoix>;
}

/** « Terminer la séance » (`ValidationsDeFenetre`, l'hôte) : `terminerLaSeance`. */
export function validationsDuGroupe(get: Get, set: Set) {
  return { finDeSeance: () => terminerLaSeance(get, set) } satisfies Partial<ValidationsDeFenetre>;
}

/** « Annuler » : la fin de séance se ferme sans rien appliquer. */
export function sortiesDuGroupe(_get: Get, set: Set) {
  return { finDeSeance: () => set({ finDeSeance: null }) } satisfies Partial<SortiesDeFenetre>;
}

export function creerActionsDuGroupe(get: Get, set: Set) {
  return {
    recruterLeHeros: (heros) => recruterLeHeros(get, set, heros),
    renvoyerLeHeros: (heroId) => renvoyerLeHeros(get, set, heroId),
    remplacerLeHeros: (heroId, heros) => remplacerLeHeros(get, set, heroId, heros),
    equiperLObjet: (uid) => equiperLObjet(get, set, uid),
    rangerLObjet: (uid, containerUid) => rangerLObjet(get, set, uid, containerUid),
    creerLaPanoplie: (heroId) => creerLaPanoplie(get, set, heroId),
    supprimerLaPanoplie: (heroId, id) => supprimerLaPanoplie(get, set, heroId, id),
    garnirLaPanoplie: (heroId, id, slot, uid) => garnirLaPanoplie(get, set, heroId, id, slot, uid),
    transmettreLObjet: (uid, destinataireId) => transmettreLObjet(get, set, uid, destinataireId),
    poserLObjet: (uid) => poserLObjet(get, set, uid),
    poserLApparence: (uid, apparence) => poserLApparence(get, set, uid, apparence),
    accorderLesPx: (heroId, amount) => accorderLesPx(get, set, heroId, amount),
    acheterLaCaracteristique: (heroId, char) => acheterLaCaracteristique(get, set, heroId, char),
    acheterLaCompetence: (heroId, skill) => acheterLaCompetence(get, set, heroId, skill),
    acheterLeTalent: (heroId, talent) => acheterLeTalent(get, set, heroId, talent),
    designerLeCreneau: (heroId, slotKey, option) => designerLeCreneau(get, set, heroId, slotKey, option),
    /** Mémorise un sort (PX selon le Talent, LDB 46/10) ; un sort du Chaos corrompt (+1, seuil → mutation). */
    acheterLeSort: (heroId, spellId) => {
      const r = acheterLeSort(get, set, heroId, spellId);
      if (r.ok && r.chaos) {
        const hero = actorIn(get(), heroId);
        if (hero) {
          for (const l of gainCorruption(get, set, hero, 1)) get().ecrireAuJournal(l);
          set(touchActors(get()));
        }
      }
    },
    acheterLaComposante: (heroId, spellId) => acheterLaComposante(get, set, heroId, spellId),
    retirerLaComposante: (heroId, spellId) => retirerLaComposante(get, set, heroId, spellId),
    ecrireLHistorique: (heroId, patch) => ecrireLHistorique(get, set, heroId, patch),
    ouvrirLaFinDeSeance: () => {
      const refus = refusDeFinDeSeance(get());
      if (refus) refuserGeste(get, set, refus);
      else ouvrirLaFinDeSeance(set);
    },
    entrainerLaProthese: (uid) => entrainerLaProthese(get, set, uid),
    changerDeCarriere: (heroId, newCareer, newLevel) => changerDeCarriere(get, set, heroId, newCareer, newLevel),
    fixerLeGroupe: (p) => set({ party: p }),
    // Longues Séances de Jeu (LDB 17 l.47) : réutilise l'Effet `restoreFortune` (NE DUPLIQUE PAS la
    // logique — même case que le début de session, qui appelle `engine/fortune.restoreFortune`).
    // Corps de BLOC, retour CONSOMMÉ (#1508) : une flèche à corps expression typée `() => void` avale le
    // signal en silence. `restoreFortune` est une donnée LITTÉRALE sans canal de dés — d'où le fail-fast.
    restaurerLaFortune: () => { nePeutPasDifferer(applyEffects(get, set, [{ type: 'restoreFortune' }]), 'partyFlow.restaurerLaFortune'); },
  } satisfies FabriqueDuNoyau;
}
