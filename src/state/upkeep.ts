/**
 * Entretien QUOTIDIEN du groupe (#T2/#T3) — source unique, anti-double-comptage.
 *
 * « Tout est horodaté » : chaque chemin qui avance l'horloge (advanceTime, repos, voyage) appelle
 * `runDailyUpkeep`, qui traite les FRANCHISSEMENTS DE JOUR entre `lastUpkeepDay` et le jour courant
 * — une journée n'est jamais comptée deux fois, quel que soit le chemin emprunté.
 *
 * Par journée écoulée et par héros (#T3 — cascade RAW) :
 *  1. consommation d'une Ration (LDB 66 l.20) sinon faim (LDB 18 l.337-343) — cf. `engine/provisions` ;
 *  2. progression des MALADIES (LDB 20 : incubation/durée en jours CALENDAIRES, repos ou pas) —
 *     `dailyDiseaseUpkeep` (+ soins d'un soignant au repos via `opts.caredFor`) ;
 *  3. CONVALESCENCE des Blessures critiques (LDB 18 l.222 : « un nombre de jours égal à 30 – votre Bonus d'Endurance »,
 *     calendaire) — `tickTraumaRecovery`.
 *  4. effets déclenchés d'HORLOGE authorés en DONNÉE (`onDayStart`, et `onWake` le jour d'une nuit
 *     jouée) — `fireClockTriggers` (state/clockHooks), sans code par KIND de porteur.
 * (Corruption : AUCUN déclencheur temporel dans LDB 19 — rien à câbler, vérifié à la source ; les
 * mutations à cadence quotidienne des suppléments passent par leurs `effects: onDayStart`.)
 *
 * `purgeClockEffects` (appelé à CHAQUE passage, même sans franchissement de jour) dissipe les effets
 * à durée d'HORLOGE arrivés à échéance : contrecoups d'incantation `castPenalties.untilTime`
 * (LDB 46/40 — « Pensez à vos actes » une semaine, Drain de puissance N minutes…). Sa cadence n'est
 * PAS l'entretien mais la COUTURE du temps (`purgeSurAvanceDHorloge` ← `EVT.TIME_ADVANCED`, store) :
 * le voyage terrestre et la journée de mer avancent l'horloge et DIFFÈRENT l'entretien à la cascade
 * de nuit.
 *
 * N'importe QUE du moteur + battleRng + le bus d'horloge `clockHooks` (pas de cycle avec les flux).
 */
import { battleRng } from './battleRng';
import { tickCampaignVesselWeek } from './shipCrew';
import { dayIndex } from '../engine/clock';
import { dailyFoodUpkeep, dailyWaterUpkeep, feedFromMeal } from '../engine/provisions';
import { testValue } from '../engine/skills';
import { effectiveChar, bonus, refreshWounds } from '../engine/characteristics';
import { loseWounds, syncDerivedConditions } from '../engine/conditions';
import { type CharKey, type Difficulty, type UpkeepDeferTest, type NightTestKind } from '../engine/types';
import { rollStep } from './rollSeam';
import type { ModLine } from '../engine/combat';
import { dailyDiseaseUpkeep } from '../engine/rest';
import { conditionLabel } from '../data';
import { t } from '../i18n';
import { rule } from '../engine/policy';
import { dropExpiredGrantedTraits } from '../engine/grantedTraits';
import { dropExpiredGrantedResources } from '../engine/grantedResources';
import { dropExpiredGrantedWeapons } from '../engine/conjuredWeapons';
import { dropExpiredGrantedMutations } from '../engine/corruption';
import { recomputeLoadout } from '../engine/items';
import { restoreSuppressedPsych } from '../engine/psychology';
import { tickTraumaRecovery } from '../engine/trauma';
import { applyOps } from '../engine/ops';
import { fireClockTriggers } from './clockHooks';
import { bus, EVT } from './bus';

import type { Get, Set } from './flowTypes';

export { dayIndex };

/** Purge les effets à durée d'HORLOGE arrivés à échéance (`untilTime` ≤ maintenant) : contrecoups
 *  d'incantation (LDB 46/40) ET buffs de sort à durée en minutes/heures/jours (LDB 47 — cascade #T3).
 *  Appelée par la COUTURE du temps (`purgeSurAvanceDHorloge`, abonnée à `EVT.TIME_ADVANCED`) ET par
 *  l'entretien quotidien ; couvre le groupe ET les combattants d'une bataille en cours (copies de spawn).
 *  RENVOIE les dissipations (reprises dans le rapport du jour au franchissement). */
export function purgeClockEffects(get: Get, set: Set): string[] {
  const now = get().gameTime;
  const expiredLog: string[] = [];
  const pool = [...get().party, ...(get().battle?.combatants ?? [])];
  for (const h of pool) {
    const exp = (h.castPenalties ?? []).filter((p) => p.untilTime != null && p.untilTime <= now);
    if (exp.length) {
      for (const p of exp) expiredLog.push(t('upkeep.fades', { name: h.label, what: p.label }));
      h.castPenalties = h.castPenalties!.filter((p) => !(p.untilTime != null && p.untilTime <= now));
    }
    const fx = (h.activeEffects ?? []).filter((e) => e.duration.scale === 'clock' && e.duration.until <= now);
    if (fx.length) {
      for (const e of fx) expiredLog.push(t('upkeep.fades', { name: h.label, what: e.label }));
      h.activeEffects = h.activeEffects!.filter((e) => !(e.duration.scale === 'clock' && e.duration.until <= now));
      dropExpiredGrantedTraits(h, fx); // traits accordés (op grantTrait) retirés avec leur effet
      dropExpiredGrantedResources(h, fx); // Chance/Destin accordés (gainResource) non dépensés
      dropExpiredGrantedWeapons(h, fx); // armes invoquées/naturelles accordées : loadout recomposé
      const mutDropped = dropExpiredGrantedMutations(h, fx); // mutation TEMPORISÉE (op rollMutation) détachée
      if (mutDropped) recomputeLoadout(h); // armes/PA naturels de mutation retirés → loadout recomposé
      restoreSuppressedPsych(h, fx); // Traits psy suspendus (Baume, LDB 42) restitués
      // Blessures max dérivées : un buff F/E/FM ou un `attrMod{wounds}` (Bonnet de fou) expiré, OU une
      // mutation détachée (charMod E/F/FM) recale max + courants.
      if (mutDropped || fx.some((e) => e.attrMods?.wounds || e.char === 'force' || e.char === 'endurance' || e.char === 'force-mentale')) refreshWounds(h);
    }
    // États à durée d'HORLOGE (op `condition.durationHours` — Belladone : sommeil « 1d10+4 heures ») :
    // dissipés à l'échéance, même canal de purge que les effets actifs (LDB 72 l.18).
    const conds = (h.conditions ?? []).filter((x) => x.untilTime != null && x.untilTime <= now);
    if (conds.length) {
      for (const x of conds) expiredLog.push(t('upkeep.condFades', { name: h.label, cond: conditionLabel(x.id) }));
      h.conditions = h.conditions.filter((x) => !(x.untilTime != null && x.untilTime <= now));
    }
    // Un effet d'HORLOGE qui vient d'expirer peut avoir suspendu un fait source d'État dérivé : la fenêtre
    // de conscience de LDB 20 l.170 (Détermination) se referme ICI — l'État repart par la réconciliation.
    expiredLog.push(...syncDerivedConditions(h));
  }
  if (expiredLog.length) { set({ party: [...get().party] }); get().log(expiredLog); }
  return expiredLog;
}

/** Dissipations d'horloge PRODUITES par la couture du temps (`EVT.TIME_ADVANCED`) et pas encore
 *  reprises dans un bilan d'entretien — drainées par `runDailyUpkeep`. */
const dissipationsDHorloge: string[] = [];

/** Purge d'horloge branchée sur la COUTURE UNIQUE de l'avance du temps : tout chemin qui émet
 *  `EVT.TIME_ADVANCED` (advanceTime, repos, voyage terrestre, journée de mer) dissipe ce qui est
 *  échu, y compris ceux qui n'appellent PAS `runDailyUpkeep` (le voyage terrestre et la journée de
 *  mer diffèrent l'entretien à la cascade de nuit). Les lignes attendent le prochain bilan. */
export function purgeSurAvanceDHorloge(get: Get, set: Set): void {
  dissipationsDHorloge.push(...purgeClockEffects(get, set));
}

/** Purge les effets « pour la prochaine aventure » (`ActiveEffect.duration.scale === 'adventure'` —
 *  LDB 23 l.209/218/234 : Entraînement au Combat, Observer une cible, Réputation) : la borne « fin
 *  d'aventure » n'a pas d'échéance chiffrable à la pose — elle est la PROCHAINE ouverture d'interlude
 *  (`startInterlude`, seul appelant). RENVOIE les dissipations (journalisées par l'appelant). */
export function purgeAdventureEffects(get: Get, set: Set): string[] {
  const expiredLog: string[] = [];
  for (const h of get().party) {
    const fx = (h.activeEffects ?? []).filter((e) => e.duration.scale === 'adventure');
    if (!fx.length) continue;
    for (const e of fx) expiredLog.push(t('upkeep.fadesAdventure', { name: h.label, what: e.label }));
    h.activeEffects = (h.activeEffects ?? []).filter((e) => e.duration.scale !== 'adventure');
  }
  if (expiredLog.length) { set({ party: [...get().party] }); get().log(expiredLog); }
  return expiredLog;
}

/** Traite les journées écoulées depuis le dernier entretien (rations/faim, maladies, convalescence)
 *  + purge des effets d'horloge. No-op (hors purge) si aucun franchissement de jour. Appelé par
 *  advanceTime, le repos (`opts.caredFor` = un soignant Guérison veille le groupe) et le voyage.
 *  RENVOIE les lignes du bilan : chaque appelant les AFFICHE (révélation témoin / bilan de nuit /
 *  recap de voyage) — le journal seul ne suffit pas (personne ne le lit). */
/** Un Test de Résistance d'entretien DIFFÉRÉ, prêt à devenir une étape de cascade de nuit. */
export interface DeferredUpkeepTest {
  heroId: string;
  /** Vocabulaire FERMÉ des étapes de nuit (#1117 point 5) — un kind inventé ne compile pas. */
  kind: NightTestKind;
  label: string;
  /** JOUR calendaire (`dayIndex`) auquel ce Test est DÛ — l'entretien traite chaque franchissement
   *  (boucle ci-dessous), donc un saut de 3 jours doit 3 Tests de Dessoûlage au MÊME héros. Le jour
   *  entre dans la CLÉ de bande (`state/nightBands`) : sans lui, ces 3 jets seraient 3 rangées de
   *  même id dans une seule fenêtre — injoignables. */
  day: number;
  base: number;
  /** Ids du Test (`UpkeepDeferTest.test`) quand le producteur les porte — la base est alors le Niveau
   *  de Compétence NU et le libellé de compétence de l'étape s'en DÉRIVE (`testSkillLabel`). */
  test?: { skill?: string; char?: CharKey; spec?: string };
  /** Difficulté DÉCLARÉE du Test (comprise dans `target`) — la ligne de jet la DIT (#1112). */
  difficulty: Difficulty;
  /** Modificateurs NOMMÉS compris dans `target` (Faim/Soif : « -10 % de plus pour chaque Test », LDB 18 l.338). */
  mods?: ModLine[];
  target: number;
  /** Écrêtage RÉELLEMENT subi par la cible (`clampTarget`) — rendu « plafond 99 » sur la ligne. */
  clamped?: number;
  meta?: Record<string, unknown>; // p.ex. { diseaseName, onFail: GameOp[] } — porté tel quel jusqu'à l'applier
}

export function runDailyUpkeep(get: Get, set: Set, opts: { caredFor?: boolean; fedDaily?: boolean; onDeferTest: (t: DeferredUpkeepTest) => void }): string[] {
  // Dissipations d'effets d'horloge : au FRANCHISSEMENT de jour, elles font partie du rapport
  // visible (hors franchissement — rythme combat — le journal et les icônes d'État suffisent).
  // Celles déjà dissipées par la COUTURE du temps depuis le dernier entretien (voyage terrestre,
  // journée de mer : ces chemins avancent l'horloge sans entretien) y sont REPRISES, sans quoi elles
  // ne vivraient que dans le journal.
  const purged = [...dissipationsDHorloge.splice(0), ...purgeClockEffects(get, set)];
  const today = dayIndex(get().gameTime);
  const last = get().lastUpkeepDay;
  if (today <= last) return [];
  const party = get().party;
  const lines: string[] = [];
  let rations = 0;
  // Accès à l'eau (LDB 18 l.340) : abondant au Reikland sauf règle `water-scarcity` ; en mer, suit les
  // tonneaux du navire (`vessel.waterLitres`) — stable sur l'entretien, calculé une fois.
  const waterLitres = get().vessel?.waterLitres;
  const hasWater = waterLitres != null ? waterLitres > 0 : rule('water-scarcity') !== true;
  for (let d = last + 1; d <= today; d++) {
    for (const h of party) {
      if (h.dead) continue;
      // Période NOURRIE (interlude « Entre deux aventures » : gîte et couvert payés par l'Argent
      // à gaspiller, LDB 23) : chaque jour est un repas — la Faim ne s'installe jamais.
      if (opts.fedDaily) feedFromMeal(h);
      // `onDeferTest` (cascade de nuit) : TOUT Test de Résistance d'entretien (Faim, maladie,
      //  convalescence) est DIFFÉRÉ en étape influençable au lieu d'être roulé ici (sinon témoin
      //  pré-résolu). Le wrapper calcule la cible (base + difficulté + pénalité) et ajoute le héros.
      const defer: UpkeepDeferTest = (spec) => {
          // Les modificateurs du producteur passent TELS QUELS : ce site ne re-classe rien (famille) et
          // ne perd rien (renvoi Codex) — il transporte.
          const surLaCible = spec.mods ?? [];
          // Le producteur DIT les ids de son Test (`spec.test`) → la valeur est celle de la PORTE
          // (`testValue` : États, Encombrement, séquelles, passifs), décomposée en Niveau de Compétence
          // nu + composantes NOMMÉES. Une `base` déjà calculée par le producteur (Faim/Soif/Dessoûlage)
          // la remplace — `rollLine` vérifie qu'elle se reconstruit. Sans ids : valeur étrangère assumée.
          const decl = !spec.test
            ? { actor: h, valeur: spec.base, valeurEtrangere: true as const, difficulty: spec.difficulty, surLaCible }
            : spec.base !== undefined
              ? { actor: h, test: spec.test, valeur: spec.base, difficulty: spec.difficulty, surLaCible }
              : { actor: h, test: spec.test, difficulty: spec.difficulty, surLaCible };
          opts.onDeferTest({
            heroId: h.id, kind: spec.kind, label: spec.label, difficulty: spec.difficulty, day: d,
            ...(spec.test ? { test: spec.test } : {}),
            ...rollStep(decl),
            meta: spec.meta,
          });
        };
      // 1. Nourriture (LDB 18 l.337-343).
      const r = dailyFoodUpkeep(h, testValue(h, 'resistance', 'endurance'), bonus(effectiveChar(h, 'endurance')), battleRng(), defer);
      if (r.rationConsumed) rations++;
      if (r.damage > 0) loseWounds(h, r.damage);
      lines.push(...r.log);
      // 1bis. Eau / Soif (LDB 18 l.340) — accès à l'eau calculé plus haut (`hasWater`).
      const w = dailyWaterUpkeep(h, hasWater, testValue(h, 'resistance', 'endurance'), bonus(effectiveChar(h, 'endurance')), battleRng(), defer);
      if (w.damage > 0) loseWounds(h, w.damage);
      lines.push(...w.log);
      // 1ter. Dessoûlage (LDB 09 l.485) : une nuit sans boire dégrise. Deux Tests de Résistance à l'alcool
      //       Intermédiaires fixent la dissipation (10−DR h) et la gueule de bois (Exténué 5−DR h, horloge).
      if (h.drunk) {
        const alcool = { skill: 'resistance-a-l-alcool', char: 'endurance' } as const;
        const alc = testValue(h, alcool.skill, alcool.char);
        // DIFFÉRÉ comme ses voisins (faim/soif) : le Test de Résistance à l'alcool est une étape de
        // cascade, jamais un jet roulé ici (sinon pré-résolu).
        defer({ kind: 'dessoulage', label: t('upkeep.sobering'), base: alc, test: alcool, difficulty: 'intermediaire' });
      }
      // 2. Maladies (LDB 20 — jours calendaires, #T3). Règle optionnelle : désactivable (disease-mode off).
      if (rule('disease-mode') !== 'off') lines.push(...dailyDiseaseUpkeep(h, battleRng(), defer, opts.caredFor));
      // 3. Convalescence des Blessures critiques (LDB 18 — jours calendaires, #T3).
      lines.push(...tickTraumaRecovery(h, 1, defer));
    }
    // 4. Effets déclenchés d'HORLOGE portés par la DONNÉE (Trait, Mutation, État… — `clockHooks`,
    //    bus-owned). `onDayStart` : une émission par jour franchi (le rattrapage en doit autant que
    //    de journées). `onWake` : le jour où une nuit a été JOUÉE (`lastNightDay`, posé par restFlow
    //    AVANT cet entretien) — franchir un jour n'est pas se réveiller.
    lines.push(...fireClockTriggers(get, 'onDayStart', { rng: battleRng() }));
    if (d === get().lastNightDay) lines.push(...fireClockTriggers(get, 'onWake', { rng: battleRng() }));
  }
  // Nuit forcée (maison `travel-sleep-forced`, #340) : chaque jour calendaire franchi SANS nuit jouée
  // (aucun repos depuis `lastNightDay`) inflige 1 État Exténué « privation de sommeil » par héros vivant.
  // Jamais silencieux (Consequence via applyOps `condition`) ; retiré au prochain vrai sommeil (LDB 16).
  if (rule('travel-sleep-forced') === true) {
    const missed = Math.max(0, today - Math.max(last, get().lastNightDay));
    if (missed > 0) {
      for (const h of party) {
        if (h.dead) continue;
        lines.push(t('upkeep.sleepDeprived', { name: h.label, n: missed, s: missed > 1 ? 's' : '' }));
        lines.push(...applyOps(h, [{ op: 'condition', id: 'extenue', value: missed }], { rng: battleRng() }));
      }
    }
  }
  if (rations > 0) lines.unshift(t('upkeep.rationsUsed', { n: rations, s: rations > 1 ? 's' : '' }));
  // Navire de campagne (MDG 14) : PAIE hebdomadaire de l'équipage salarié puis recalcul du Moral, une
  // fois par semaine calendaire (garde interne à `tickCampaignVesselWeek` ; un saut de plusieurs jours ne
  // recalcule qu'au franchissement de semaine). #216.
  set({ lastUpkeepDay: today, party: [...party] }); // persiste faim/eau/maladies/convalescence AVANT le débit des gages
  lines.push(...tickCampaignVesselWeek(get, set, today, battleRng())); // débite les bourses PAR-DESSUS (lit get().party à jour)
  get().log(lines);
  if (lines.length) bus.emit(EVT.SCENE_DIRTY);
  return [...purged, ...lines]; // les dissipations du jour font partie du bilan affiché
}
