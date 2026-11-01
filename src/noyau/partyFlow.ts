/**
 * Actions GROUPE (hors combat) — module à part du store, même patron
 * `(get, set)` que combatFlow : équipement (équiper/transférer), avancement PX
 * (caractéristiques/compétences/talents/carrière, prothèses), consommables de fiche, butin.
 */
import { Combatant, CharKey, CHAR_LABELS, ItemInstance } from '../engine/types';
import { choisirApparenceDObjet, recomputeLoadout, loadoutCreate, loadoutDelete, loadoutSetActive, loadoutSetSlot, equipConflicts, canStow, isOffHandEligible, setADeuxMains } from '../engine/items';
import type { Possession } from '../engine/possession';
import { possessionLabel } from '../engine/possession';
import { resolveCarrier, porteurLocalise } from './monde/carrier';
import { carriersColocated } from '../engine/cargo';
import { refuserGeste } from './refusVisible';
import { refusDInventaire, refusDuBackground, refuseSi } from './verrousDeFiche';
import { refusDepensePx, mentorRequis, libelleAvecSpec, refusDAcquerirLeTalent, refusDePx, refusDeChangerDeCarriere, contexteDeChangement } from './depenseDePx';
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
} from '../engine/careerSlots';
import { applyTalentAcquisition, fortuneMax, resolveMax, competenceEnCarriere, talentEnCarriere } from '../engine/talentEffects';
import { heroSessionXp, regainDetermination } from '../engine/session';
import { skillCharacteristicById } from '../engine/character';
import { nextProsthesisTier, grantProsthesisTier } from '../engine/trauma';
import { bonus, effectiveChar } from '../engine/characteristics';
import { castingKindOf } from '../engine/combatFeatures/dispatch';
import { canAfford, toMoney, Money, formatMoney } from '../engine/money';
import { isArcaneSpell } from '../engine/magic';
import { spellCost, verdictApprentissage } from '../engine/grimoire';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { levelsForCareer, byId, findCareerById, findSpellById, findTrappingById, refLabel, dataLabel, type SpellData } from '../data/index';
import { t } from '../i18n';
import { decidingSeat, seatSlotsRemaining } from './netOwnership';
import { PARTY_MAX, actorIn, ecrireActeur } from './monde/combatants';
import { releaseSeat } from './monde/seating';
import type { Scene } from './monde/scene';
import { persisterLeHeros } from './plateforme';
import { creditBourse, payWithAllocation, soloPayer } from './bourseFlow';
import { ensureBourse, bourseOf } from '../engine/bourse';
import { transferPossession } from './possessionsFlow';

import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import { memeSpecialisation } from '../data/schemas/grammaire/ref';
import { gainCorruption } from './corruptionFlow';
import { touchActors } from './combatOrParty';
import { nePeutPasDifferer, applyEffects } from './combatEffects';
import type { ActionsDuNoyau } from './actionsDuNoyau';

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

/** Équipe/déséquipe un objet d'un PORTEUR (héros de `party` OU possession de `possessions`, doctrine
 *  « porteur unique » #614/#620) — un héros recalcule aussi ses armes/armure actives (`recomputeLoadout`,
 *  réservé aux Combatant : une possession n'a pas de loadout d'arme). */
export function toggleEquip(get: Get, set: Set, carrierId: string, uid: string): void {
  if (refuseSi(get, set, refusDInventaire)) return;
  let msg = '';
  set((s) => {
    const carrier = resolveCarrier(s, carrierId);
    if (!carrier) return {};
    if (carrier.kind === 'hero') {
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
  if (msg) get().log(msg);
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

/** Même patron que `toggleEquip` (clone + recomputeLoadout réservé au héros) — porteur héros OU possession. */
export function stowItem(get: Get, set: Set, carrierId: string, uid: string, containerUid: string | null): void {
  if (refuseSi(get, set, refusDInventaire)) return;
  let msg = '';
  set((s) => {
    const carrier = resolveCarrier(s, carrierId);
    if (!carrier) return {};
    if (carrier.kind === 'hero') {
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
  if (msg) get().log(msg);
}

/** Applique une mutation de loadout à un héros (clone + recompute), même pattern que toggleEquip. */
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

export function createLoadout(get: Get, set: Set, heroId: string): void {
  gesteDeSet(get, set, heroId, (c) => loadoutCreate(c));
}
/** Refus de supprimer le set `id` de `hero` : la raison affichée, ou `null`. Combat (`refusDInventaire`), set
 *  introuvable, set d'une arme invoquée (le sort le gère), dernier set (le héros en garde toujours un).
 *  Verdict UNIQUE de `deleteLoadout` et du bouton Supprimer d'`EquipmentPanel`. */
export function refusDeSupprimerSet(s: Pick<Jeu, 'battle'>, hero: Combatant, id: string): string | null {
  const verrou = refusDInventaire(s);
  if (verrou) return verrou;
  const lo = hero.loadouts?.find((l) => l.id === id);
  if (!lo) return t('pf.loadoutNotFound');
  if ((hero.items ?? []).find((it) => it.uid === lo.main)?.conjured) return t('pf.loadoutConjured');
  return (hero.loadouts?.length ?? 0) > 1 ? null : t('pf.loadoutLast');
}

export function deleteLoadout(get: Get, set: Set, heroId: string, id: string): void {
  const hero = actorIn(get(), heroId);
  const refus = hero ? refusDeSupprimerSet(get(), hero, id) : t('pf.loadoutNotFound');
  if (refus) return void refuserGeste(get, set, refus);
  mutLoadout(set, heroId, (c) => loadoutDelete(c, id));
}
export function setActiveLoadout(get: Get, set: Set, heroId: string, id: string): void {
  gesteDeSet(get, set, heroId, (c) => loadoutSetActive(c, id));
}
/** Refus de tenir `uid` (ou de vider l'emplacement, `null`) dans la main `slot` du set `loadoutId` : la
 *  raison affichée, ou `null`. Verdict UNIQUE du geste `setLoadoutSlot` et des deux écrans d'armes
 *  (`EquipmentPanel`, `HandPicker`). `hero` = la copie que l'appelant lit (`actorIn`). LDB 14 l.138 */
export function refusEmplacementDeMain(
  s: Pick<Jeu, 'battle'>, hero: Combatant, loadoutId: string, slot: 'main' | 'off', uid: string | null,
): string | null {
  const verrou = refusDInventaire(s);
  if (verrou) return verrou;
  const lo = hero.loadouts?.find((l) => l.id === loadoutId);
  if (!lo) return t('pf.loadoutNotFound');
  if ((hero.items ?? []).find((it) => it.uid === lo.main)?.conjured) return t('pf.loadoutConjured');
  if (slot === 'off' && setADeuxMains(hero, lo)) return t('pf.offHandTwoHanded');
  if (uid == null) return null;
  const it = (hero.items ?? []).find((i) => i.uid === uid);
  if (!it) return t('pf.loadoutItemNotFound');
  return slot === 'off' && !isOffHandEligible(it) ? t('pf.offHandIneligible') : null;
}

export function setLoadoutSlot(get: Get, set: Set, heroId: string, id: string, slot: 'main' | 'off', uid: string | null): void {
  const hero = actorIn(get(), heroId);
  if (!hero) return void refuserGeste(get, set, t('pf.loadoutNotFound'));
  const refus = refusEmplacementDeMain(get(), hero, id, slot, uid);
  if (refus) return void refuserGeste(get, set, refus);
  mutLoadout(set, heroId, (c) => loadoutSetSlot(c, id, slot, uid));
}

/** Libellé d'un porteur déjà résolu (héros ou possession — doctrine id/label). */
function carrierLabel(carrier: { kind: 'hero'; hero: Combatant } | { kind: 'possession'; possession: Possession }): string {
  return carrier.kind === 'hero' ? carrier.hero.label : possessionLabel(carrier.possession);
}

/** Donne un objet d'un PORTEUR (héros ou possession) à un autre — #620 généralise le don héros→héros
 *  aux 4 combinaisons (héros↔héros, héros↔possession, possession↔possession). `recomputeLoadout`
 *  reste réservé aux Combatant (armes actives) — une possession n'a pas de loadout. En combat, rien ne
 *  change de mains (`refusDInventaire`) : un don à sa mule contournerait le verrou de `toggleEquip`. */
export function transferItem(get: Get, set: Set, uid: string, fromCarrierId: string, toCarrierId: string): void {
  if (refuseSi(get, set, refusDInventaire)) return;
  const state = get();
  const from = resolveCarrier(state, fromCarrierId);
  const to = resolveCarrier(state, toCarrierId);
  const fromItems = !from ? [] : from.kind === 'hero' ? (from.hero.items ?? []) : from.possession.items;
  const item = fromItems.find((i) => i.uid === uid);
  if (!from || !to || !item) return void refuserGeste(get, set, t('pf.giveNotFound'));
  if (fromCarrierId === toCarrierId) return void refuserGeste(get, set, t('pf.giveSelf', { from: carrierLabel(from), item: item.label }));
  if (!carriersColocated(porteurLocalise(from), porteurLocalise(to))) {
    return void refuserGeste(get, set, t('pf.giveNotColocated', { from: carrierLabel(from), to: carrierLabel(to), item: item.label }));
  }
  const contents = item.container ? fromItems.filter((i) => i.inside === item.uid) : [];
  const fromLabel = carrierLabel(from);
  const toLabel = carrierLabel(to);
  const movedUids = new Set([uid, ...contents.map((i) => i.uid)]);

  set((s) => {
    let patch: Partial<Pick<Jeu, 'party' | 'battle' | 'possessions'>> = {};
    if (from.kind === 'hero' || to.kind === 'hero') {
      const heros = [...(from.kind === 'hero' ? [fromCarrierId] : []), ...(to.kind === 'hero' ? [toCarrierId] : [])];
      patch = ecrireActeur(s, heros, (h) => {
        const c: Combatant = structuredClone(h);
        if (h.id === fromCarrierId) c.items = (c.items ?? []).filter((i) => !movedUids.has(i.uid));
        else {
          c.items = [
            ...(c.items ?? []),
            { ...item, equipped: false, inside: undefined }, // arrive NON équipé, LIBRE
            ...contents.map((i) => ({ ...i, equipped: false })), // contenu du contenant, lien `inside` préservé
          ];
        }
        recomputeLoadout(c);
        return c;
      });
    }
    if (from.kind === 'possession' || to.kind === 'possession') {
      patch.possessions = s.possessions.map((p) => {
        if (from.kind === 'possession' && p.uid === fromCarrierId) {
          const c: Possession = structuredClone(p);
          c.items = c.items.filter((i) => !movedUids.has(i.uid));
          return c;
        }
        if (to.kind === 'possession' && p.uid === toCarrierId) {
          const c: Possession = structuredClone(p);
          c.items = [
            ...c.items,
            { ...item, equipped: false, inside: undefined },
            ...contents.map((i) => ({ ...i, equipped: false })),
          ];
          return c;
        }
        return p;
      });
    }
    return patch;
  });
  get().log(t('pf.give', { from: fromLabel, item: item.label, to: toLabel }));
}

/** #2967 */
export function choisirApparence(get: Get, set: Set, heroId: string, uid: string, apparence: string): void {
  const resolveTrapping = objetDuNarratif(get().campaignNarratif);
  mutLoadout(set, heroId, (c) => {
    const it = (c.items ?? []).find((i) => i.uid === uid);
    if (!it?.trappingId) return;
    choisirApparenceDObjet(it, apparence, resolveTrapping);
  });
}

export function grantXp(get: Get, set: Set, heroId: string, amount: number): void {
  let name = '';
  set((s) => ecrireActeur(s, heroId, (h) => {
    name = h.label;
    const clone: Combatant = structuredClone(h);
    clone.xp = (clone.xp ?? 0) + amount;
    return clone;
  }));
  if (name) get().log(`${name} : ${amount >= 0 ? '+' : ''}${amount} PX.`);
}

/** SEULE couture de dépense de PX : le refus (`refusDepensePx`) tombe ici, sinon `depense` s'écrit par
 *  `ecrireActeur`. Rend `false` au refus. */
export function depenserPx(get: Get, set: Set, heroId: string, depense: (h: Combatant) => Combatant): boolean {
  const refus = refusDepensePx(get());
  if (refus) return !refuserGeste(get, set, refus);
  set((s) => ecrireActeur(s, heroId, depense));
  return true;
}

export function buyCharAdvance(get: Get, set: Set, heroId: string, char: CharKey): void {
  let msg = '';
  if (!depenserPx(get, set, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const inC = inCareerChar(careerCtx(clone).careerChars, char);
    if (mentorRequis(get(), inC)) {
      // LDB 07 l.89
      msg = t('pf.charNeedsMentor', { name: clone.label, what: CHAR_LABELS[char] });
      return h;
    }
    const manque = refusDePx(clone, advanceCost(clone.charAdvances?.[char] ?? 0, 'characteristic', inC));
    if (manque) {
      msg = manque;
      return h;
    }
    const r = engineBuyCharAdvance(clone, char, inC);
    if (!r.ok) {
      msg = t('pf.refused', { name: clone.label, what: CHAR_LABELS[char], reason: r.reason ?? '' });
      return h;
    }
    msg = t('pf.advanceBought', { name: clone.label, what: CHAR_LABELS[char], cost: r.cost, hors: inC ? '' : t('pf.fragOutOfCareer') });
    return clone;
  })) return;
  if (msg) get().log(msg);
}

/** Achète une Augmentation de Compétence — identité (skillId, spec), LDB 09 l.42. L'achat via un
 *  emplacement « (Au choix) » libre DÉSIGNE l'emplacement (LDB 09 l.38 : la Spécialisation se
 *  choisit à l'allocation). Remise −5 PX si la Compétence est ajoutée par un talent ET déjà
 *  dans la carrière (LDB 10 Maître artisan…). */
export function buySkillAdvance(get: Get, set: Set, heroId: string, skillId: string, spec?: string): void {
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
      msg = t('pf.charNeedsMentor', { name: clone.label, what: libelleAvecSpec(skillLabel, spec) });
      return h;
    }
    if (!known) {
      if (!inC) {
        msg = t('pf.skillNotAcquirable', { name: clone.label, what: libelleAvecSpec(skillLabel, spec) });
        return h;
      }
      // Acquérir la Compétence de carrière à advances 0, puis l'augmenter (l'Augmentation est payée).
      const characteristic = skillCharacteristicById(skillId); // par id (≠ 2e lookup par libellé)
      clone.skills.push({ id: skillId, spec, characteristic, advances: 0 });
    }
    const avant = clone.skills.find((sk) => sk.id === skillId && memeSpecialisation(sk.spec, spec))?.advances ?? 0;
    const manque = refusDePx(clone, advanceCost(avant, 'skill', inC, discount));
    if (manque) {
      msg = manque;
      return h;
    }
    const r = engineBuySkillAdvance(clone, skillId, spec, inC, discount);
    if (!r.ok) {
      msg = t('pf.refused', { name: clone.label, what: libelleAvecSpec(skillLabel, spec), reason: r.reason ?? '' });
      return h;
    }
    // Première allocation via un slot joker libre → désignation automatique (LDB 09 l.38).
    if (status === 'free') {
      const slot = freeSlotFor(ctx.sSlots, ctx.designations, skillId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      if (slot) designateSlot(clone, ctx.career, slot, skillId, spec, [...ctx.sSlots, ...ctx.tSlots]);
    }
    msg = t('pf.advanceBought', { name: clone.label, what: libelleAvecSpec(skillLabel, spec), cost: r.cost, hors: inC ? '' : t('pf.fragOutOfCareer') });
    return clone;
  })) return;
  if (msg) get().log(msg);
}

/** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante sur une (id, spec)
 *  concrète (éventuellement déjà possédée via l'espèce) — il devient in-carrière et montable en
 *  PX. Arbitrage RAW : specs distinctes par carrière, désignations par carrière. */
export function designateCareerSlot(get: Get, set: Set, heroId: string, slotKey: string, optionId: string, spec?: string): void {
  let msg = '';
  set((s) => ecrireActeur(s, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const ctx = careerCtx(clone);
    const all = [...ctx.sSlots, ...ctx.tSlots];
    const slot = all.find((sl) => sl.key === slotKey);
    if (!slot) {
      msg = t('pf.unknownSlot', { name: clone.label });
      return h;
    }
    const r = designateSlot(clone, ctx.career, slot, optionId, spec, all);
    if (!r.ok) {
      msg = t('pf.designateRefused', { name: clone.label, reason: r.reason ?? '' });
      return h;
    }
    const label = refLabel(slot.kind === 'skill' ? 'skills' : 'talents', { id: optionId, spec }); // AFFICHAGE seul
    msg = t('pf.designated', { name: clone.label, label });
    return clone;
  }));
  if (msg) get().log(msg);
}

/** Achète une Augmentation de Talent — identité (talentId, spec). In-carrière = `talentEnCarriere` : un
 *  emplacement du niveau COURANT le couvre (LDB 07 l.103 ; explicite, désigné, ou libre → désignation
 *  automatique), ou un ajout de carrière ; hors carrière interdit (LDB 07 l.93) ; Maxi respecté (LDB 10). Applique les effets d'acquisition
 *  (+5 Caractéristique de départ, Véloce) et recale Blessures/Chance/Détermination. */
export function buyTalent(get: Get, set: Set, heroId: string, talentId: string, spec?: string): void {
  let msg = '';
  if (!depenserPx(get, set, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const ctx = careerCtx(clone);
    const talentLabel = refLabel('talents', { id: talentId, spec }); // AFFICHAGE + conversion pour le moteur
    const status = talentEnCarriere(clone, ctx.tSlots, ctx.designations, talentId, spec, [...ctx.sSlots, ...ctx.tSlots]);
    if (!status) {
      msg = t('pf.talentOutOfCareer', { name: clone.label, label: talentLabel });
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
      msg = t('pf.refused', { name: clone.label, what: talentLabel, reason: r.reason ?? '' });
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
    msg = t('pf.talentBought', { name: clone.label, label: talentLabel, cost: r.cost });
    // Magie mineure (LDB 10 l.714) : BFM sorts inclus au Talent — à choisir (0 PX, Avancement).
    if (castingKindOf(talentId) === 'mineure') {
      const q = bonus(effectiveChar(clone, 'force-mentale'));
      if (q > 0) msg += t('pf.minorMagicIncluded', { n: q });
    }
    return clone;
  })) return;
  if (msg) get().log(msg);
}

/** Apprend/mémorise un sort (LDB 46 l.16-20 + Talents LDB 10) : coût en PX selon la
 *  famille (engine/grimoire.spellCost) ; un sort de Magie du Chaos inflige AUSSI
 *  +1 Point de Corruption (« le Sort s'insinue dans votre esprit ») — appliqué par
 *  l'appelant store (seuil → mutation). */
export function buySpell(get: Get, set: Set, heroId: string, spellId: string, opts: { discountXp?: number } = {}): { ok: boolean; chaos?: boolean } {
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
      msg = t(verdictApprentissage(clone, sp) === 'deja-connu' ? 'pf.spellAlreadyKnown' : 'pf.spellCannotLearn', { name: clone.label, spell: sp.label });
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
    clone.xp = (clone.xp ?? 0) - cost;
    clone.spells = [...(clone.spells ?? []), sp.id]; // runtime = id de sort (pas le libellé)
    msg = cost > 0
      ? t('pf.spellLearned', { name: clone.label, spell: sp.label, cost, remise: cost < full ? t('pf.fragSpellDiscount', { n: full - cost }) : '' })
      : t('pf.spellGranted', { name: clone.label, spell: sp.label });
    result = { ok: true, chaos: sp.family === 'chaos' };
    return clone;
  })) return { ok: false };
  if (msg) get().log(msg);
  return result;
}

/** Composant d'incantation (LDB 46 l.107-113, règle optionnelle `magic-composant`) : achète un
 *  composant pour un Sort d'Arcane/Domaine CONNU du héros — coût = NI pistoles d'argent (l.113),
 *  prélevé sur la Bourse de l'incantateur. « acheté pour un Sort spécifique […], ne marche que pour ce
 *  Sort. » Le composant absorbe le contrecoup à l'incantation (consumé) — cf. applyMiscast. */
export function buySpellComponent(get: Get, set: Set, heroId: string, spellId: string): void {
  const hero = actorIn(get(), heroId);
  const refus = refusAchatDeComposant(hero, spellId);
  if (refus) return void refuserGeste(get, set, refus);
  const sp = findSpellById(spellId)!;
  const cost = coutDuComposant(sp);
  payWithAllocation(get, set, { debits: soloPayer(heroId, cost), recipient: heroId, purpose: 'Composant d’incantation' });
  set((s) => ecrireActeur(s, heroId, (h) => ({ ...h, componentSpells: [...(h.componentSpells ?? []), spellId] })));
  get().log(t('pf.componentBought', { name: hero!.label, spell: sp.label, money: formatMoney(cost) }));
}

/** Coût d'un composant d'incantation. LDB 46 l.113 */
export function coutDuComposant(sp: Pick<SpellData, 'cn'>): Money {
  return toMoney({ silver: sp.cn ?? 0 });
}

/** Refus d'acheter un composant pour `spellId` : la raison affichée, ou `null`. Verdict UNIQUE du geste
 *  `buySpellComponent` et de la fiche. LDB 46 l.107-113 */
export function refusAchatDeComposant(hero: Combatant | undefined, spellId: string): string | null {
  const sp = findSpellById(spellId);
  if (!hero || !sp) return t('pf.componentSpellNotFound');
  if (!isArcaneSpell(sp) || sp.cn == null) return t('pf.componentArcaneOnly', { spell: sp.label });
  if (!(hero.spells ?? []).includes(spellId)) return t('pf.spellUnknown', { name: hero.label, spell: sp.label });
  const cost = coutDuComposant(sp);
  return canAfford(bourseOf(hero), cost) ? null : t('pf.componentTooExpensive', { spell: sp.label, money: formatMoney(cost) });
}

/** Édite la bio MUTABLE d'un héros (hors combat) : Motivation + Ambitions court/long terme (LDB 05).
 *  Mute `store.party` (→ persisté par la save) ET propage au roster s'il y est (`persisterLeHeros`). */
export function setHeroBackground(get: Get, set: Set, heroId: string, patch: { motivation?: string; ambitionShort?: string; ambitionLong?: string }): void {
  if (refuseSi(get, set, refusDuBackground)) return;
  set((s) => ecrireActeur(s, heroId, (h) => ({
    ...h,
    motivation: patch.motivation ?? h.motivation,
    details: { ...h.details, ambitionShort: patch.ambitionShort ?? h.details?.ambitionShort, ambitionLong: patch.ambitionLong ?? h.details?.ambitionLong },
  })));
  const hero = get().party.find((h) => h.id === heroId);
  if (hero) persisterLeHeros(hero);
}

/** Récompenses de fin de séance (écran de fin de séance) : Ambitions accomplies par héros (perso) et de
 *  groupe, + héros ayant agi selon leur Motivation (regain de Détermination). */
export interface SessionRewards {
  heroes?: Record<string, { ambitionShort?: boolean; ambitionLong?: boolean; motivation?: boolean }>;
  group?: { ambitionShort?: boolean; ambitionLong?: boolean };
}

/**
 * Fin de séance de jeu (LDB 05 Ambitions l.793-841 + LDB 17 Détermination l.81) : octroie les PX
 * d'Ambition accomplie (personnelle +50/+500, de groupe +50/+500 à chaque héros), regagne 1 Point de
 * Détermination aux héros ayant agi selon leur Motivation (plafonné au max), puis restaure la Chance du
 * groupe (couture de séance, `restoreFortune`). SOURCE UNIQUE derrière l'écran de fin de séance.
 */
export function endSession(get: Get, set: Set, rewards: SessionRewards): void {
  const group = { short: rewards.group?.ambitionShort, long: rewards.group?.ambitionLong };
  const lines = new Map<string, string[]>();
  set((s) => ecrireActeur(s, s.party.filter((h) => h.kind === 'hero').map((h) => h.id), (h) => {
    const f = rewards.heroes?.[h.id] ?? {};
    const xp = heroSessionXp({ short: f.ambitionShort, long: f.ambitionLong }, group);
    if (!xp && !f.motivation) return h;
    const clone: Combatant = structuredClone(h);
    const siennes: string[] = [];
    if (xp) { clone.xp = (clone.xp ?? 0) + xp; siennes.push(t('pf.ambitionXp', { name: clone.label, xp })); }
    if (f.motivation) {
      const before = clone.resolve ?? 0;
      clone.resolve = regainDetermination(clone, 1);
      if (clone.resolve > before) siennes.push(t('pf.motivationResolve', { name: clone.label }));
    }
    lines.set(h.id, siennes);
    return clone;
  }));
  for (const l of [...lines.values()].flat()) get().log(l);
  get().restoreFortuneNow(); // Chance restaurée pour la prochaine séance (LDB 17 l.41)
}

/** Retire UN composant d'incantation possédé pour un Sort (sans remboursement). */
export function removeSpellComponent(_get: Get, set: Set, heroId: string, spellId: string): void {
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
export function trainProsthesis(get: Get, set: Set, heroId: string, uid: string): void {
  let msg = '';
  if (!depenserPx(get, set, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const it = (clone.items ?? []).find((i) => i.uid === uid);
    if (!it) { msg = t('pf.prosthesisNotTrainable', { name: clone.label }); return h; }
    const tier = nextProsthesisTier(it);
    if (!tier) {
      // Prothèse non entraînable (aucun palier déclaré / non portée) vs. déjà entièrement maîtrisée.
      const done = it.equipped && !!it.trappingId && (findTrappingById(it.trappingId)?.prosthesisTraining?.length ?? 0) > 0;
      msg = done ? t('pf.prosthesisTrained', { name: clone.label, item: it.label }) : t('pf.prosthesisNotTrainable', { name: clone.label });
      return h;
    }
    const manque = refusDePx(clone, tier.px);
    if (manque) { msg = manque; return h; }
    clone.xp = (clone.xp ?? 0) - tier.px;
    grantProsthesisTier(it, tier);
    msg = t('pf.prosthesisTierBought', { name: clone.label, item: it.label, tier: tier.label, cost: tier.px });
    return clone;
  })) return;
  if (msg) get().log(msg);
}

export function changeCareer(get: Get, set: Set, heroId: string, newCareer: string, newLevel: number): void {
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
      msg = t('pf.careerRefused', { name: clone.label, reason: r.reason ?? '' });
      return h;
    }
    msg = t('pf.careerChanged', { name: clone.label, career: dataLabel(findCareerById(newCareer)?.label ?? newCareer), level: newLevel, cost: r.cost });
    return clone;
  })) return;
  if (msg) get().log(msg);
}

/** Couture de la composition du groupe (ajout, retrait, remplacement, intentions coop comprises) : en
 *  combat, le groupe est la file de combat, et `finalizeBattle` y reporte chaque combattant
 *  (`REPORT_DE_COMBATTANT`, #2312) — la composition ne change pas. Journalise le refus, rend `true` s'il tombe. */
function compositionRefusee(get: Get): boolean {
  const refus = refusComposition(get());
  if (refus) get().log(refus);
  return refus !== null;
}

/** Raison du refus de composition (`compositionRefusee`), ou `null` — lue par l'écran d'équipe. */
export function refusComposition(s: Pick<Jeu, 'battle'>): string | null {
  return s.battle ? t('pf.partyInCombat') : null;
}

/** Ajoute un héros au groupe dans un emplacement du siège qui décide (`decidingSeat` : le siège local, ou celui
 *  du transport pour un intent) — point d'entrée UNIQUE de la composition d'équipe (PartyScreen, HeroSelector,
 *  créateur). Refuse
 *  groupe plein, doublon d'id, ou quota d'emplacements du siège épuisé. La Richesse de carrière
 *  (LDB 05 l.578-583) crédite SA propre Bourse (SOCLE POSSESSIONS §8, #531) — plus de bourse de groupe. */
export function partyAddHero(get: Get, set: Set, hero: Combatant, wealth?: Money): void {
  if (compositionRefusee(get)) return;
  const s = get();
  const seat = decidingSeat(s);
  if (s.party.length >= PARTY_MAX || s.party.some((h) => h.id === hero.id)) return;
  if (seatSlotsRemaining(s, seat) <= 0) return;
  const copy: Combatant = ensureBourse(structuredClone(hero));
  set({
    party: [...s.party, copy],
    net: { ...s.net, ownership: { ...s.net.ownership, [copy.id]: seat } },
  });
  if (wealth) {
    creditBourse(get, set, copy.id, wealth);
    get().log(t('pf.startingWealth', { name: copy.label, money: formatMoney(wealth) }));
  }
}

/**
 * Lève de leur place TOUS les emplacements du groupe — PURE, rend la scène à écrire. Le groupe
 * ENTIER quitte le lieu (`transitionTo`) : une scène quittée ne garde pas un héros absent, et le
 * revisit ne rassoit personne.
 *
 * La RECOMPOSITION du groupe (retrait, remplacement, permutation) ne passe PAS par ici : elle est
 * réconciliée par la couture d'occupation du store, qui compare les corps rang par rang.
 * Rend la scène d'entrée, même référence, si personne n'était assis — aucun delta d'instance.
 */
export function releaseHeroSeats<S extends Scene | null>(scene: S): S {
  if (!scene?.seatAssignments) return scene;
  let next: Scene = scene;
  for (let rang = 1; rang <= PARTY_MAX; rang++) next = releaseSeat(next, { kind: 'party', rang });
  return next as S;
}

/** Retire un héros du groupe (écran d'équipe) et nettoie sa possession réseau.
 *  SUCCESSION (§6/§19, décision №3, SOCLE POSSESSIONS #615) — jamais d'orphelin gelé : les
 *  Possessions du héros retiré ET sa Bourse passent à un héritier VIVANT, défaut = le DOYEN (1er
 *  membre RESTANT de `party` après retrait qui n'est PAS mort — un héros mort reste dans `party`,
 *  idiome `party.filter(h => !h.dead)` du repo : un cadavre n'hérite pas). Aucun vivant restant
 *  (groupe vidé ou tout-morts) → repli : rien à hériter, la Bourse/les Possessions du partant
 *  restent SUR LUI (il quitte le groupe avec son bien, aucun héritier vivant à défausser dessus). */
export function partyRemoveHero(get: Get, set: Set, heroId: string): void {
  if (compositionRefusee(get)) return;
  const s = get();
  const idx = s.party.findIndex((h) => h.id === heroId);
  if (idx < 0) return;
  const hero = s.party[idx];
  const remaining = s.party.filter((h) => h.id !== heroId);
  const heir = remaining.find((h) => !h.dead);
  if (heir) {
    for (const p of get().possessions) {
      if (p.ownerId === heroId) transferPossession(get, set, p.uid, heir.id);
    }
    const bourse = bourseOf(hero);
    if (bourse.gold || bourse.silver || bourse.brass) creditBourse(get, set, heir.id, bourse);
  }
  const ownership = { ...s.net.ownership };
  delete ownership[heroId];
  set((s2) => ({ party: s2.party.filter((h) => h.id !== heroId), net: { ...s2.net, ownership } }));
}

/** Remplace ATOMIQUEMENT le héros `oldId` par `hero` à SA position dans `party` (substitution en
 *  place → préserve l'index/ordre) ; transfère la possession du siège qui possédait `oldId`, sinon du siège qui
 *  décide (`decidingSeat`), au remplaçant (l'ancien id est libéré).
 *  Source UNIQUE du remplacement, réutilisée par le créateur (édition en place) et le bouton
 *  « Remplacer » du slot. Ne touche PAS la bourse (un remplacement n'est pas un recrutement). */
export function partyReplaceHero(get: Get, set: Set, oldId: string, hero: Combatant): void {
  if (compositionRefusee(get)) return;
  const s = get();
  const idx = s.party.findIndex((h) => h.id === oldId);
  if (idx < 0) return;                                                    // l'ancien n'est plus là
  if (hero.id !== oldId && s.party.some((h) => h.id === hero.id)) return; // doublon d'id
  const copy: Combatant = structuredClone(hero);
  const ownership = { ...s.net.ownership };
  const seat = ownership[oldId] ?? decidingSeat(s);
  delete ownership[oldId];
  ownership[copy.id] = seat;
  set({ party: s.party.map((h, i) => (i === idx ? copy : h)), net: { ...s.net, ownership } });
}


export function creerActionsDuGroupe(get: Get, set: Set) {
  return {
    partyAddHero: (hero, wealth) => partyAddHero(get, set, hero, wealth),
    partyRemoveHero: (heroId) => partyRemoveHero(get, set, heroId),
    partyReplaceHero: (oldId, hero) => partyReplaceHero(get, set, oldId, hero),
    toggleEquip: (heroId, uid) => toggleEquip(get, set, heroId, uid),
    stowItem: (heroId, uid, containerUid) => stowItem(get, set, heroId, uid, containerUid),
    createLoadout: (heroId) => createLoadout(get, set, heroId),
    deleteLoadout: (heroId, id) => deleteLoadout(get, set, heroId, id),
    setActiveLoadout: (heroId, id) => setActiveLoadout(get, set, heroId, id),
    setLoadoutSlot: (heroId, id, slot, uid) => setLoadoutSlot(get, set, heroId, id, slot, uid),
    transferItem: (uid, fromHeroId, toHeroId) => transferItem(get, set, uid, fromHeroId, toHeroId),
    choisirApparence: (heroId, uid, apparence) => choisirApparence(get, set, heroId, uid, apparence),
    grantXp: (heroId, amount) => grantXp(get, set, heroId, amount),
    buyCharAdvance: (heroId, char) => buyCharAdvance(get, set, heroId, char),
    buySkillAdvance: (heroId, skillId, spec) => buySkillAdvance(get, set, heroId, skillId, spec),
    buyTalent: (heroId, talentId, spec) => buyTalent(get, set, heroId, talentId, spec),
    designateCareerSlot: (heroId, slotKey, optionId, spec) => designateCareerSlot(get, set, heroId, slotKey, optionId, spec),
    /** Mémorise un sort (PX selon le Talent, LDB 46/10) ; un sort du Chaos corrompt (+1, seuil → mutation). */
    buySpell: (heroId, spellId) => {
      const r = buySpell(get, set, heroId, spellId);
      if (r.ok && r.chaos) {
        const hero = actorIn(get(), heroId);
        if (hero) {
          for (const l of gainCorruption(get, set, hero, 1)) get().log(l);
          set(touchActors(get()));
        }
      }
    },
    buySpellComponent: (heroId, spellId) => buySpellComponent(get, set, heroId, spellId),
    removeSpellComponent: (heroId, spellId) => removeSpellComponent(get, set, heroId, spellId),
    setHeroBackground: (heroId, patch) => setHeroBackground(get, set, heroId, patch),
    endSession: (rewards) => endSession(get, set, rewards),
    openSessionEnd: () => set({ sessionEndOpen: true }),
    closeSessionEnd: () => set({ sessionEndOpen: false }),
    trainProsthesis: (heroId, uid) => trainProsthesis(get, set, heroId, uid),
    changeCareer: (heroId, newCareer, newLevel) => changeCareer(get, set, heroId, newCareer, newLevel),
    setParty: (p) => set({ party: p }),
    // Longues Séances de Jeu (LDB 17 l.47) : réutilise l'Effet `restoreFortune` (NE DUPLIQUE PAS la
    // logique — même case que le début de session, qui appelle `engine/fortune.restoreFortune`).
    // Corps de BLOC, retour CONSOMMÉ (#1508) : une flèche à corps expression typée `() => void` avale le
    // signal en silence. `restoreFortune` est une donnée LITTÉRALE sans canal de dés — d'où le fail-fast.
    restoreFortuneNow: () => { nePeutPasDifferer(applyEffects(get, set, [{ type: 'restoreFortune' }]), 'partyFlow.restoreFortuneNow'); },
  } satisfies Partial<ActionsDuNoyau>;
}
