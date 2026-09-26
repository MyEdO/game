/**
 * Actions GROUPE (hors combat) — module à part du store, même patron
 * `(get, set)` que combatFlow : équipement (équiper/transférer/skin), avancement PX
 * (caractéristiques/compétences/talents/carrière, prothèses), consommables de fiche, butin.
 * Refacto pure — comportement préservé.
 */
import { Combatant, CharKey, CHAR_LABELS, ItemInstance } from '../engine/types';
import { recomputeLoadout, loadoutCreate, loadoutDelete, loadoutSetActive, loadoutSetSlot, equipConflicts, canStow } from '../engine/items';
import type { Possession } from '../engine/possession';
import { possessionLabel } from '../engine/possession';
import { resolveCarrier, carriersCoLocated } from './carrier';
import {
  buyCharAdvance as engineBuyCharAdvance,
  buySkillAdvance as engineBuySkillAdvance,
  buyTalent as engineBuyTalent,
  changeCareer as engineChangeCareer,
  isCareerLevelComplete,
  inCareerChar,
  mentorBlocks,
} from '../engine/advancement';
import { rule } from '../engine/policy';
import {
  skillSlots,
  talentSlots,
  availableChars,
  designationsFor,
  freeSlotFor,
  designateSlot,
  talentMaxReached,
  arcaneDomainGate,
} from '../engine/careerSlots';
import { applyTalentAcquisition, heroMaxWounds, fortuneMax, resolveMax, competenceEnCarriere, talentEnCarriere } from '../engine/talentEffects';
import { heroSessionXp, regainDetermination } from '../engine/session';
import { skillCharacteristicById } from '../engine/character';
import { nextProsthesisTier, grantProsthesisTier } from '../engine/trauma';
import { bonus, effectiveChar } from '../engine/characteristics';
import { castingKindOf } from '../engine/combatFeatures/dispatch';
import { canAfford, toMoney, Money, formatMoney } from '../engine/money';
import { isArcaneSpell } from '../engine/magic';
import { spellCost } from '../engine/grimoire';
import { levelsForCareer, byId, findCareerById, findSpellById, findTrappingById, findTalentById, refLabel, dataLabel } from '../data/index';
import { t } from '../i18n';
import { seatSlotsRemaining } from './netOwnership';
import { PARTY_MAX } from './combatants';
import { releaseSeat } from './seating';
import type { Scene } from './scene';
import { rosterUpdate } from './roster';
import { ensureBourse, creditBourse, bourseOf, payWithAllocation, soloPayer } from './bourseFlow';
import { transferPossession } from './possessionsFlow';

import type { Get, Set } from './flowTypes';

/** Recalcule les Blessures max (BF + 2·BE + BFM × Taille + Dur à cuire) après une Augmentation
 *  de Caractéristique ou un nouveau Talent ; un gain de max augmente aussi le courant (mute). */
function recomputeWounds(hero: Combatant) {
  // Augmentation permanente de Caractéristique → recalcul de la BASE (formule × Taille de l'espèce).
  const newMax = heroMaxWounds(hero);
  const delta = newMax - hero.wounds.max;
  hero.wounds.base = newMax;
  hero.wounds.max = newMax;
  if (delta > 0) hero.wounds.current += delta;
  if (hero.wounds.current > newMax) hero.wounds.current = newMax;
}

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
  let msg = '';
  set((s) => {
    const carrier = resolveCarrier(s, carrierId);
    if (!carrier) return {};
    if (carrier.kind === 'hero') {
      return {
        party: s.party.map((h) => {
          if (h.id !== carrierId) return h;
          const clone: Combatant = structuredClone(h);
          clone.items ??= [];
          msg = applyToggleEquip(clone.items, uid, clone.label);
          recomputeLoadout(clone);
          return clone;
        }),
      };
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
  let msg = '';
  set((s) => {
    const carrier = resolveCarrier(s, carrierId);
    if (!carrier) return {};
    if (carrier.kind === 'hero') {
      return {
        party: s.party.map((h) => {
          if (h.id !== carrierId) return h;
          const clone: Combatant = structuredClone(h);
          clone.items ??= [];
          const r = applyStow(clone.items, uid, containerUid, clone.label);
          msg = r.msg;
          if (!r.moved) return h; // capacité insuffisante ou item introuvable : aucune mutation, pas de recompute
          recomputeLoadout(clone);
          return clone;
        }),
      };
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
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      fn(clone);
      recomputeLoadout(clone);
      return clone;
    }),
  }));
}

export function createLoadout(_get: Get, set: Set, heroId: string): void {
  mutLoadout(set, heroId, (c) => loadoutCreate(c));
}
export function deleteLoadout(_get: Get, set: Set, heroId: string, id: string): void {
  mutLoadout(set, heroId, (c) => loadoutDelete(c, id));
}
export function setActiveLoadout(_get: Get, set: Set, heroId: string, id: string): void {
  mutLoadout(set, heroId, (c) => loadoutSetActive(c, id));
}
export function setLoadoutSlot(_get: Get, set: Set, heroId: string, id: string, slot: 'main' | 'off', uid: string | null): void {
  mutLoadout(set, heroId, (c) => loadoutSetSlot(c, id, slot, uid));
}

/** Libellé d'un porteur déjà résolu (héros ou possession — doctrine id/label). */
function carrierLabel(carrier: { kind: 'hero'; hero: Combatant } | { kind: 'possession'; possession: Possession }): string {
  return carrier.kind === 'hero' ? carrier.hero.label : possessionLabel(carrier.possession);
}

/** Donne un objet d'un PORTEUR (héros ou possession) à un autre — #620 généralise le don héros→héros
 *  aux 4 combinaisons (héros↔héros, héros↔possession, possession↔possession). `recomputeLoadout`
 *  reste réservé aux Combatant (armes actives) — une possession n'a pas de loadout. */
export function transferItem(get: Get, set: Set, uid: string, fromCarrierId: string, toCarrierId: string): void {
  if (fromCarrierId === toCarrierId) return;
  const state = get();
  const from = resolveCarrier(state, fromCarrierId);
  const to = resolveCarrier(state, toCarrierId);
  if (!from || !to) return;
  if (!carriersCoLocated(from, to)) return;
  const fromItems = from.kind === 'hero' ? (from.hero.items ?? []) : from.possession.items;
  const item = fromItems.find((i) => i.uid === uid);
  if (!item) return;
  const contents = item.container ? fromItems.filter((i) => i.inside === item.uid) : [];
  const fromLabel = carrierLabel(from);
  const toLabel = carrierLabel(to);
  const movedUids = new Set([uid, ...contents.map((i) => i.uid)]);

  set((s) => {
    const patch: Partial<{ party: Combatant[]; possessions: Possession[] }> = {};
    if (from.kind === 'hero' || to.kind === 'hero') {
      patch.party = s.party.map((h) => {
        if (from.kind === 'hero' && h.id === fromCarrierId) {
          const c: Combatant = structuredClone(h);
          c.items = (c.items ?? []).filter((i) => !movedUids.has(i.uid));
          recomputeLoadout(c);
          return c;
        }
        if (to.kind === 'hero' && h.id === toCarrierId) {
          const c: Combatant = structuredClone(h);
          c.items = [
            ...(c.items ?? []),
            { ...item, equipped: false, inside: undefined }, // arrive NON équipé, LIBRE
            ...contents.map((i) => ({ ...i, equipped: false })), // contenu du contenant, lien `inside` préservé
          ];
          recomputeLoadout(c);
          return c;
        }
        return h;
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

function applySkinPatch(it: ItemInstance, patch: Record<string, string | undefined>): void {
  const next: Record<string, string> = { ...(it.skin ?? {}) };
  for (const [k, v] of Object.entries(patch)) { if (v == null) delete next[k]; else next[k] = v; }
  it.skin = Object.keys(next).length ? next : undefined;
}

/** Skin (habillage cosmétique) d'un objet — porteur héros OU possession (#620). `recomputeLoadout`
 *  (propage skin → `Weapon.skin` actif) reste réservé au héros. */
export function setItemSkin(_get: Get, set: Set, carrierId: string, uid: string, patch: Record<string, string | undefined>): void {
  set((s) => {
    const carrier = resolveCarrier(s, carrierId);
    if (!carrier) return {};
    if (carrier.kind === 'hero') {
      return {
        party: s.party.map((h) => {
          if (h.id !== carrierId) return h;
          const clone: Combatant = structuredClone(h);
          const it = (clone.items ?? []).find((i) => i.uid === uid);
          if (it) {
            applySkinPatch(it, patch);
            recomputeLoadout(clone); // propage skin → Weapon.skin actif
          }
          return clone;
        }),
      };
    }
    return {
      possessions: s.possessions.map((p) => {
        if (p.uid !== carrierId) return p;
        const clone: Possession = structuredClone(p);
        const it = clone.items.find((i) => i.uid === uid);
        if (it) applySkinPatch(it, patch);
        return clone;
      }),
    };
  });
}

/** Change la FORME d'une arme ABSTRAITE (« Arme simple » → épée/hache/masse/marteau de guerre/demi-lance) :
 *  pose `item.shape` parmi les `formChoices` du trapping (forme hors-liste → no-op), puis recompute pour que
 *  l'arme active (si tenue) reprenne la silhouette (`Weapon.shape`). Cosmétique RAW — toutes les formes d'une
 *  Arme simple partagent les mêmes stats (LDB 62). Même patron (clone + recomputeLoadout) que setItemSkin. */
export function setItemShape(_get: Get, set: Set, heroId: string, uid: string, shape: string): void {
  mutLoadout(set, heroId, (c) => {
    const it = (c.items ?? []).find((i) => i.uid === uid);
    if (!it?.trappingId) return;
    const choices = findTrappingById(it.trappingId)?.formChoices;
    if (!choices?.includes(shape)) return; // forme hors `formChoices` → ignorée
    it.shape = shape;
  });
}

export function grantXp(get: Get, set: Set, heroId: string, amount: number): void {
  let name = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      name = h.label;
      const clone: Combatant = structuredClone(h);
      clone.xp = (clone.xp ?? 0) + amount;
      return clone;
    }),
  }));
  if (name) get().log(`${name} : ${amount >= 0 ? '+' : ''}${amount} PX.`);
}

export function buyCharAdvance(get: Get, set: Set, heroId: string, char: CharKey): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const inC = inCareerChar(careerCtx(clone).careerChars, char);
      if (mentorBlocks(inC, rule('advancement-mentor') === true, !!get().flags['mentor'])) {
        msg = t('pf.charNeedsMentor', { name: clone.label, what: CHAR_LABELS[char] });
        return h;
      }
      const r = engineBuyCharAdvance(clone, char, inC);
      if (!r.ok) {
        msg = t('pf.refused', { name: clone.label, what: CHAR_LABELS[char], reason: r.reason ?? '' });
        return h;
      }
      recomputeWounds(clone);
      msg = t('pf.advanceBought', { name: clone.label, what: CHAR_LABELS[char], cost: r.cost, hors: inC ? '' : t('pf.fragOutOfCareer') });
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Libellé d'affichage d'une Compétence/Talent concret. */
function lbl(name: string, spec?: string): string {
  return spec ? `${name} (${spec})` : name;
}

/** Achète une Augmentation de Compétence — identité (skillId, spec), LDB 09 l.42. L'achat via un
 *  emplacement « (Au choix) » libre DÉSIGNE l'emplacement (LDB 09 l.38 : la Spécialisation se
 *  choisit à l'allocation). Remise −5 PX si la Compétence est ajoutée par un talent ET déjà
 *  dans la carrière (LDB 10 Maître artisan…). */
export function buySkillAdvance(get: Get, set: Set, heroId: string, skillId: string, spec?: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const ctx = careerCtx(clone);
      const skillLabel = byId('skill', skillId)?.label ?? skillId; // AFFICHAGE (messages) + conversion pour le moteur
      const known = clone.skills.some((sk) => sk.id === skillId && (sk.spec ?? '') === (spec ?? ''));
      const { statut: status, remise: discount } = competenceEnCarriere(clone, ctx.sSlots, ctx.designations, skillId, spec);
      const inC = status != null;
      if (known && mentorBlocks(inC, rule('advancement-mentor') === true, !!get().flags['mentor'])) {
        msg = t('pf.charNeedsMentor', { name: clone.label, what: lbl(skillLabel, spec) });
        return h;
      }
      if (!known) {
        if (!inC) {
          msg = t('pf.skillNotAcquirable', { name: clone.label, what: lbl(skillLabel, spec) });
          return h;
        }
        // Acquérir la Compétence de carrière à advances 0, puis l'augmenter (l'Augmentation est payée).
        const characteristic = skillCharacteristicById(skillId); // par id (≠ 2e lookup par libellé)
        clone.skills.push({ id: skillId, spec, characteristic, advances: 0 });
      }
      const r = engineBuySkillAdvance(clone, skillId, spec, inC, discount);
      if (!r.ok) {
        msg = t('pf.refused', { name: clone.label, what: lbl(skillLabel, spec), reason: r.reason ?? '' });
        return h;
      }
      // Première allocation via un slot joker libre → désignation automatique (LDB 09 l.38).
      if (status === 'free') {
        const slot = freeSlotFor(ctx.sSlots, ctx.designations, skillId, spec);
        if (slot) designateSlot(clone, ctx.career, slot, skillId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      }
      msg = t('pf.advanceBought', { name: clone.label, what: lbl(skillLabel, spec), cost: r.cost, hors: inC ? '' : t('pf.fragOutOfCareer') });
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante sur une (id, spec)
 *  concrète (éventuellement déjà possédée via l'espèce) — il devient in-carrière et montable en
 *  PX. Arbitrage RAW : specs distinctes par carrière, désignations par carrière. */
export function designateCareerSlot(get: Get, set: Set, heroId: string, slotKey: string, optionId: string, spec?: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
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
    }),
  }));
  if (msg) get().log(msg);
}

/** Achète une Augmentation de Talent — identité (talentId, spec). In-carrière = `talentEnCarriere` : un
 *  emplacement du niveau COURANT le couvre (LDB 07 l.103 ; explicite, désigné, ou libre → désignation
 *  automatique), ou un ajout de carrière ; hors carrière interdit (LDB 07 l.93) ; Maxi respecté (LDB 10). Applique les effets d'acquisition
 *  (+5 Caractéristique de départ, Véloce) et recale Blessures/Chance/Détermination. */
export function buyTalent(get: Get, set: Set, heroId: string, talentId: string, spec?: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const ctx = careerCtx(clone);
      const talentLabel = refLabel('talents', { id: talentId, spec }); // AFFICHAGE + conversion pour le moteur
      const status = talentEnCarriere(clone, ctx.tSlots, ctx.designations, talentId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      if (!status) {
        msg = t('pf.talentOutOfCareer', { name: clone.label, label: talentLabel });
        return h;
      }
      if (talentMaxReached(clone, talentId, spec)) {
        msg = t('pf.talentMaxed', { name: clone.label, label: talentLabel });
        return h;
      }
      if (spec != null && findTalentById(talentId)?.specsSource === 'arcaneDomains') {
        const gate = arcaneDomainGate(clone, spec);
        if (!gate.ok) {
          msg = t('pf.refused', { name: clone.label, what: talentLabel, reason: gate.reason ?? '' });
          return h;
        }
      }
      const fortuneBefore = fortuneMax(clone);
      const resolveBefore = resolveMax(clone);
      const r = engineBuyTalent(clone, talentId, spec); // spec = identité PERSISTÉE (id si migré), jamais re-dérivée du libellé
      if (!r.ok) {
        msg = t('pf.refused', { name: clone.label, what: talentLabel, reason: r.reason ?? '' });
        return h;
      }
      if (status === 'free') {
        const slot = freeSlotFor(ctx.tSlots, ctx.designations, talentId, spec);
        if (slot) designateSlot(clone, ctx.career, slot, talentId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      }
      // Effets d'acquisition (+5 Caractéristique de départ, Véloce) + attributs dérivés.
      applyTalentAcquisition(clone, talentId, spec);
      recomputeWounds(clone); // Dur à cuire / Très résistant (BE)
      clone.fortune = (clone.fortune ?? 0) + (fortuneMax(clone) - fortuneBefore); // Chanceux
      clone.resolve = (clone.resolve ?? 0) + (resolveMax(clone) - resolveBefore); // Obstiné
      msg = t('pf.talentBought', { name: clone.label, label: talentLabel, cost: r.cost });
      // Magie mineure (LDB 10 l.714) : BFM sorts inclus au Talent — à choisir (0 PX, Avancement).
      if (castingKindOf(talentId) === 'mineure') {
        const q = bonus(effectiveChar(clone, 'force-mentale'));
        if (q > 0) msg += t('pf.minorMagicIncluded', { n: q });
      }
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Apprend/mémorise un sort (LDB 46 l.16-20 + Talents LDB 10) : coût en PX selon la
 *  famille (engine/grimoire.spellCost) ; un sort de Magie du Chaos inflige AUSSI
 *  +1 Point de Corruption (« le Sort s'insinue dans votre esprit ») — appliqué par
 *  l'appelant store (seuil → mutation). */
export function buySpell(get: Get, set: Set, heroId: string, spellId: string, opts: { discountXp?: number } = {}): { ok: boolean; chaos?: boolean } {
  let msg = '';
  let result: { ok: boolean; chaos?: boolean } = { ok: false };
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const sp = findSpellById(spellId); // accès UNIQUE par id stable (prod et tests)
      if (!sp) {
        msg = t('pf.spellNotFound', { id: spellId });
        return h;
      }
      const clone: Combatant = structuredClone(h);
      const full = spellCost(clone, sp);
      if (full == null) {
        msg = t('pf.spellCannotLearn', { name: clone.label, spell: sp.label });
        return h;
      }
      // Recherche universitaire (ACE 12 l.55) : « mémoriser un sort pour 100PX de moins que
      // son prix normal (pour un minimum de 100PX) » — remise sur CET achat seul, jamais au-dessus
      // du prix normal (plancher inerte pour les sorts à moins de 100 PX).
      const cost = opts.discountXp && full > 0 ? Math.min(full, Math.max(100, full - opts.discountXp)) : full;
      if ((clone.xp ?? 0) < cost) {
        msg = t('pf.spellNeedsXp', { name: clone.label, cost, spell: sp.label, left: clone.xp ?? 0 });
        return h;
      }
      clone.xp = (clone.xp ?? 0) - cost;
      clone.spells = [...(clone.spells ?? []), sp.id]; // runtime = id de sort (pas le libellé)
      msg = cost > 0
        ? t('pf.spellLearned', { name: clone.label, spell: sp.label, cost, remise: cost < full ? t('pf.fragSpellDiscount', { n: full - cost }) : '' })
        : t('pf.spellGranted', { name: clone.label, spell: sp.label });
      result = { ok: true, chaos: sp.family === 'chaos' };
      return clone;
    }),
  }));
  if (msg) get().log(msg);
  return result;
}

/** Composant d'incantation (LDB 46 l.107-113, règle optionnelle `magic-composant`) : achète un
 *  composant pour un Sort d'Arcane/Domaine CONNU du héros — coût = NI pistoles d'argent (l.113),
 *  prélevé sur la Bourse de l'incantateur. « acheté pour un Sort spécifique […], ne marche que pour ce
 *  Sort. » Le composant absorbe le contrecoup à l'incantation (consumé) — cf. applyMiscast. */
export function buySpellComponent(get: Get, set: Set, heroId: string, spellId: string): void {
  const hero = get().party.find((h) => h.id === heroId);
  const sp = findSpellById(spellId);
  if (!hero || !sp) { get().log(t('pf.componentSpellNotFound')); return; }
  if (!isArcaneSpell(sp) || sp.cn == null) { get().log(t('pf.componentArcaneOnly', { spell: sp.label })); return; }
  if (!(hero.spells ?? []).includes(spellId)) { get().log(t('pf.spellUnknown', { name: hero.label, spell: sp.label })); return; }
  // Coût = NI (cn) pistoles d'argent (silver), débité de la Bourse de l'incantateur (bénéficiaire = ce héros).
  const cost = toMoney({ silver: sp.cn });
  if (!canAfford(bourseOf(hero), cost)) { get().log(t('pf.componentTooExpensive', { spell: sp.label, money: formatMoney(cost) })); return; }
  payWithAllocation(get, set, { debits: soloPayer(heroId, cost), recipient: heroId, purpose: 'Composant d’incantation' });
  set((s) => ({
    party: s.party.map((h) => h.id === heroId ? { ...h, componentSpells: [...(h.componentSpells ?? []), spellId] } : h),
  }));
  get().log(t('pf.componentBought', { name: hero.label, spell: sp.label, money: formatMoney(cost) }));
}

/** Édite la bio MUTABLE d'un héros (hors combat) : Motivation + Ambitions court/long terme (LDB 05).
 *  Mute `store.party` (→ persisté par la save) ET propage au roster s'il y est (rosterUpdate). */
export function setHeroBackground(get: Get, set: Set, heroId: string, patch: { motivation?: string; ambitionShort?: string; ambitionLong?: string }): void {
  set((s) => ({
    party: s.party.map((h) => h.id === heroId ? {
      ...h,
      motivation: patch.motivation ?? h.motivation,
      details: { ...h.details, ambitionShort: patch.ambitionShort ?? h.details?.ambitionShort, ambitionLong: patch.ambitionLong ?? h.details?.ambitionLong },
    } : h),
  }));
  const hero = get().party.find((h) => h.id === heroId);
  if (hero) rosterUpdate(hero);
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
  const lines: string[] = [];
  set((s) => ({
    party: s.party.map((h) => {
      if (h.kind !== 'hero') return h;
      const f = rewards.heroes?.[h.id] ?? {};
      const xp = heroSessionXp({ short: f.ambitionShort, long: f.ambitionLong }, group);
      if (!xp && !f.motivation) return h;
      const clone: Combatant = structuredClone(h);
      if (xp) { clone.xp = (clone.xp ?? 0) + xp; lines.push(t('pf.ambitionXp', { name: clone.label, xp })); }
      if (f.motivation) {
        const before = clone.resolve ?? 0;
        clone.resolve = regainDetermination(clone, 1);
        if (clone.resolve > before) lines.push(t('pf.motivationResolve', { name: clone.label }));
      }
      return clone;
    }),
  }));
  for (const l of lines) get().log(l);
  get().restoreFortuneNow(); // Chance restaurée pour la prochaine séance (LDB 17 l.41)
}

/** Retire UN composant d'incantation possédé pour un Sort (sans remboursement). */
export function removeSpellComponent(_get: Get, set: Set, heroId: string, spellId: string): void {
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const list = [...(h.componentSpells ?? [])];
      const i = list.indexOf(spellId);
      if (i < 0) return h;
      list.splice(i, 1); // retire une seule occurrence
      return { ...h, componentSpells: list };
    }),
  }));
}

/** Rachat PX d'une prothèse (LDB 73) : les PALIERS sont DÉCLARÉS sur l'entrée de catalogue
 *  (`TrappingData.prosthesisTraining`) et joués dans l'ordre par `nextProsthesisTier` — ce flux ne nomme
 *  aucune prothèse. Fausse jambe : 100 PX (Mouvement) puis 200 PX (Esquive) ; Crochet : 400 PX (l.23). */
export function trainProsthesis(get: Get, set: Set, heroId: string, uid: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
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
      if ((clone.xp ?? 0) < tier.px) { msg = t('pf.notEnoughXp', { name: clone.label, cost: tier.px }); return h; }
      clone.xp = (clone.xp ?? 0) - tier.px;
      grantProsthesisTier(it, tier);
      msg = t('pf.prosthesisTierBought', { name: clone.label, item: it.label, tier: tier.label, cost: tier.px });
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

export function changeCareer(get: Get, set: Set, heroId: string, newCareer: string, newLevel: number): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      // Validation LDB 07 l.137 + LDB 07 l.144-148 : complétion, niveau cible, surcoût de Classe.
      const completed = isCompleted(clone);
      const sameClass = findCareerById(clone.career ?? '')?.class === findCareerById(newCareer)?.class;
      const targetLevelExists = levelsForCareer(newCareer).some((l) => l.level === newLevel);
      const gmJump = rule('advancement-career-jump') === true;
      const r = engineChangeCareer(clone, newCareer, newLevel, { completed, sameClass, targetLevelExists, gmJump });
      if (!r.ok) {
        msg = t('pf.careerRefused', { name: clone.label, reason: r.reason ?? '' });
        return h;
      }
      msg = t('pf.careerChanged', { name: clone.label, career: dataLabel(findCareerById(newCareer)?.label ?? newCareer), level: newLevel, cost: r.cost });
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Ajoute un héros au groupe dans un emplacement du siège `seat` (0 = hôte/solo) — point
 *  d'entrée UNIQUE de la composition d'équipe (PartyScreen, HeroSelector, créateur ; côté
 *  invité l'action est enveloppée en intent, l'hôte injecte le siège autoritaire). Refuse
 *  groupe plein, doublon d'id, ou quota d'emplacements du siège épuisé. La Richesse de carrière
 *  (LDB 05 l.578-583) crédite SA propre Bourse (SOCLE POSSESSIONS §8, #531) — plus de bourse de groupe. */
export function partyAddHero(get: Get, set: Set, hero: Combatant, wealth?: Money, seat = 0): void {
  const s = get();
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
 *  place → préserve l'index/ordre) ; transfère la possession au `seat` (l'ancien id est libéré).
 *  Source UNIQUE du remplacement, réutilisée par le créateur (édition en place) et le bouton
 *  « Remplacer » du slot. Ne touche PAS la bourse (un remplacement n'est pas un recrutement). */
export function partyReplaceHero(get: Get, set: Set, oldId: string, hero: Combatant, seat = 0): void {
  const s = get();
  const idx = s.party.findIndex((h) => h.id === oldId);
  if (idx < 0) return;                                                    // l'ancien n'est plus là
  if (hero.id !== oldId && s.party.some((h) => h.id === hero.id)) return; // doublon d'id
  const copy: Combatant = structuredClone(hero);
  const ownership = { ...s.net.ownership };
  delete ownership[oldId];
  ownership[copy.id] = seat;
  set({ party: s.party.map((h, i) => (i === idx ? copy : h)), net: { ...s.net, ownership } });
}


// (usePartyItem — consommable hors combat — vit dans `state/consumableFlow.ts` : le Flow du
//  consommable peut porter un nœud `test` → modale restreinte au buveur, hors de portée de ce module.)
