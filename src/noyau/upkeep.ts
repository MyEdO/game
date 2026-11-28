/**
 * Entretien QUOTIDIEN du groupe (#T2/#T3) — source unique, anti-double-comptage.
 *
 * « Tout est horodaté » : `runDailyUpkeep` traite les FRANCHISSEMENTS DE JOUR entre `lastUpkeepDay` et le jour
 * courant — une journée n'est jamais comptée deux fois, quel que soit le chemin emprunté. Ses appelants : le pas
 * d'horloge (`preparerLEntretienQuotidien`, `horloge.ts`), la nuit (`buildNightCascade`) et le sommeil d'office
 * (`sleepParty`, `restFlow.ts`) ; le voyage DIFFÈRE l'entretien à la cascade de nuit (plus bas).
 *
 * Par journée écoulée et par héros (#T3 — cascade RAW) :
 *  1. repas sur le garde-manger du jour, la cale du navire à bord en mer, le sac (LDB 66 l.20) sinon, ou faim
 *     (LDB 18 l.337-343) — cf. `engine/provisions` ;
 *  2. progression des MALADIES (LDB 20 : incubation/durée en jours CALENDAIRES, repos ou pas) —
 *     `dailyDiseaseUpkeep` (+ soins d'un soignant du groupe ou d'un veilleur de la scène où le groupe se tient
 *     depuis le début de la journée soldée, `enSceneDepuis`, `veilleursDeLaScene`, LDB 09 l.265) ;
 *  3. CONVALESCENCE des Blessures critiques (LDB 18 l.222 : « un nombre de jours égal à 30 – votre Bonus d'Endurance »,
 *     calendaire) — `tickTraumaRecovery`.
 *  4. effets déclenchés d'HORLOGE authorés en DONNÉE (`onDayStart`, et `onWake` le jour d'une nuit
 *     jouée) — `fireClockTriggers` (noyau/clockHooks), sans code par KIND de porteur.
 * (Corruption : AUCUN déclencheur temporel dans LDB 19 — rien à câbler, vérifié à la source ; les
 * mutations à cadence quotidienne des suppléments passent par leurs `effects: onDayStart`.)
 *
 * `purgeClockEffects` (appelé à CHAQUE passage, même sans franchissement de jour) dissipe les effets
 * à durée d'HORLOGE arrivés à échéance : contrecoups d'incantation `castPenalties.untilTime`
 * (LDB 46/40 — « Pensez à vos actes » une semaine, Drain de puissance N minutes…). Sa cadence n'est
 * PAS l'entretien mais la COUTURE du temps (`purgeSurAvanceDHorloge` ← `avancerLHorloge`) :
 * le voyage terrestre et la journée de mer avancent l'horloge et DIFFÈRENT l'entretien à la cascade
 * de nuit.
 *
 * Importe le moteur, les données, l'i18n et, du noyau : `battleRng`, `rollSeam`, le bus d'horloge (`clockHooks`, `bus`,
 * `flowTypes`), les porteurs à bord (`shipCrew`), `pendings` et les PNJ de la scène (`monde/sceneNpc`,
 * `monde/resolveursDuNarratif`).
 */
import { battleRng } from './battleRng';
import { porteursABord, tickCampaignVesselWeek } from './shipCrew';
import { WORLD_STEP_OWNER } from './pendings';
import { estBateauFluvial } from './worldMap';
import { avancerLesMaladies } from '../engine/disease';
import { dayIndex, MINUTES_PER_DAY } from '../engine/clock';
import { dailyFoodUpkeep, dailyWaterUpkeep, feedFromMeal, lotPerime, noterLeRepas, rationsDeCale, rationsDeLaCale, rationsDuSac } from '../engine/provisions';
import { peutTenter, testValue } from '../engine/skills';
import { HEAL_SKILL } from '../engine/healing';
import { effectiveChar, bonus } from '../engine/characteristics';
import { loseWounds, purgerEtats, removeActiveEffects, syncDerivedConditions } from '../engine/conditions';
import { nomDe } from '../engine/nom';
import { type Combatant, type ConditionInstance, type Difficulty, type UpkeepDeferTest, type TestIds } from '../engine/types';
import type { NightStakeId } from '../data/index';
import { rollStep } from './rollSeam';
import type { ModLine } from '../engine/combat';
import { dailyDiseaseUpkeep } from '../engine/rest';
import { incubationPendantLeVoyage } from './expositionAMaladie';
import { conditionLabel, refLabel } from '../data';
import { t } from '../i18n';
import { rule } from '../engine/policy';
import { tickTraumaRecovery } from '../engine/trauma';
import { applyOps } from '../engine/ops';
import { fireClockTriggers } from './clockHooks';
import { veilleursDeLaScene } from './monde/sceneNpc';
import { objetDuNarratif, presetDuNarratif } from './monde/resolveursDuNarratif';
import { bus, EVT } from './bus';

import type { Get, Set } from './flowTypes';
import type { Applique } from '../engine/faits';
import { ligneDeTexte, type EntreeDuJournal } from '../engine/journal';

interface LigneDEntretien {
  entree: EntreeDuJournal;
  actorId?: string;
}

function lignesDEntretien(entrees: readonly EntreeDuJournal[], actorId?: string): LigneDEntretien[] {
  return entrees.map((entree) => ({ entree, actorId }));
}

/** Purge les effets à durée d'HORLOGE arrivés à échéance (`untilTime` ≤ maintenant) : contrecoups
 *  d'incantation (LDB 46/40) ET buffs de sort à durée en minutes/heures/jours (LDB 47 — cascade #T3).
 *  Appelée par la COUTURE du temps (`purgeSurAvanceDHorloge`, tirée par `avancerLHorloge`) ET par
 *  l'entretien quotidien ; couvre le groupe ET les combattants d'une bataille en cours (copies de spawn).
 *  RENVOIE les dissipations (reprises dans le rapport du jour au franchissement). */
export function purgeClockEffects(get: Get, set: Set): LigneDEntretien[] {
  const now = get().gameTime;
  const expiredLog: LigneDEntretien[] = [];
  const pool = [...get().party, ...(get().battle?.combatants ?? [])];
  for (const h of pool) {
    const lignes: EntreeDuJournal[] = [];
    const exp = (h.castPenalties ?? []).filter((p) => p.untilTime != null && p.untilTime <= now);
    if (exp.length) {
      for (const p of exp) lignes.push(ligneDeTexte(t('upkeep.fades', { name: nomDe(h), what: p.label })));
      h.castPenalties = h.castPenalties!.filter((p) => !(p.untilTime != null && p.untilTime <= now));
    }
    const porte: Applique = { lignes: [], faits: [] }; // l'effet se dissipe D'ABORD au journal, les États qu'il portait partent ENSUITE (#1695)
    const fx = removeActiveEffects(h, (e) => e.duration.scale === 'clock' && e.duration.until <= now, porte);
    for (const e of fx) lignes.push(ligneDeTexte(t('upkeep.fades', { name: nomDe(h), what: e.label })));
    lignes.push(...porte.lignes);
    // États à durée d'HORLOGE (op `condition.durationHours` — Belladone : sommeil « 1d10+4 heures ») :
    // dissipés à l'échéance, même canal de purge que les effets actifs (LDB 72 l.18).
    const echu = (x: ConditionInstance) => x.untilTime != null && x.untilTime <= now;
    for (const x of (h.conditions ?? []).filter(echu)) lignes.push(ligneDeTexte(t('upkeep.condFades', { name: nomDe(h), cond: conditionLabel(x.id) })));
    const sortie: Applique = { lignes: [], faits: [] };
    purgerEtats(h, echu, sortie);
    lignes.push(...sortie.lignes);
    // Un effet d'HORLOGE qui vient d'expirer peut avoir suspendu un fait source d'État dérivé : la fenêtre
    // de conscience de LDB 20 l.170 (Détermination) se referme ICI — l'État repart par la réconciliation.
    lignes.push(...syncDerivedConditions(h).lignes);
    expiredLog.push(...lignesDEntretien(lignes, h.id));
  }
  if (expiredLog.length) { set({ party: [...get().party] }); get().ecrireAuJournal(expiredLog.map(({ entree }) => entree)); }
  return expiredLog;
}

/** Dissipations d'horloge PRODUITES par la couture du temps (`avancerLHorloge`) et pas encore
 *  reprises dans un bilan d'entretien, par état (`Get`, #4862) — drainées par `runDailyUpkeep`. */
const dissipationsDHorloge = new WeakMap<Get, LigneDEntretien[]>();

/** Purge d'horloge tirée par la COUTURE UNIQUE de l'avance du temps : tout chemin qui la signale
 *  (`avancerLHorloge`, écrivain unique de `gameTime` : avancerLeTemps, repos, voyages terrestre, fluvial et en
 *  mer, chantier naval) dissipe ce qui est échu, y compris ceux qui n'appellent PAS `runDailyUpkeep` (le voyage terrestre et la journée de
 *  mer diffèrent l'entretien à la cascade de nuit). Les lignes attendent le prochain bilan. */
export function purgeSurAvanceDHorloge(get: Get, set: Set, minutes: number): void {
  const enAttente = dissipationsDHorloge.get(get) ?? [];
  dissipationsDHorloge.set(get, enAttente);
  enAttente.push(
    ...purgeClockEffects(get, set),
    ...lignesDEntretien(jeterLesVivresPourris(get, set)),
    ...lignesDEntretien(avancerLEquipage(get, set, minutes)),
  );
}

/** Les maladies de l'équipage collectif (`porteursABord`) avancent de `minutes`, sans cycle de fiche, au port comme
 *  en mer. Navire maritime à quai, chaque journée franchie compte un repas frais, noté avant le pas. RENVOIE les
 *  lignes (déjà au journal). MDG 14 l.39, l.208, l.232 ; #4243 */
function avancerLEquipage(get: Get, set: Set, minutes: number): EntreeDuJournal[] {
  const equipage = porteursABord(get, set).find((p) => p.id === WORLD_STEP_OWNER);
  if (!equipage) return [];
  const now = get().gameTime;
  const { vessel } = get();
  if (vessel?.escale !== undefined && !estBateauFluvial(vessel)) {
    for (let jours = dayIndex(now) - dayIndex(now - minutes); jours > 0; jours--) noterLeRepas(equipage.porteur, 'repas');
  }
  const lignes = avancerLesMaladies(equipage.porteur, minutes, battleRng());
  equipage.ecrire();
  if (lignes.length) get().ecrireAuJournal(lignes);
  return lignes;
}

/** Jette de la cale du navire de campagne les lots de vivres pourris (`lotPerime`) à l'heure de jeu, au port
 *  comme en mer. RENVOIE les lignes, une par vivre (déjà au journal). MDG 14 l.238 ; LDB 47 l.93-97 ; #4058 */
function jeterLesVivresPourris(get: Get, set: Set): EntreeDuJournal[] {
  const vessel = get().vessel;
  if (!vessel?.provisions) return [];
  const now = get().gameTime;
  const pourris = vessel.provisions.filter((l) => lotPerime(l, now));
  if (!pourris.length) return [];
  const provisions = vessel.provisions.filter((l) => !lotPerime(l, now));
  set({ vessel: { ...vessel, provisions } });
  const lignes = [...new Set(pourris.map((l) => l.vivre))].map((vivre) => ligneDeTexte(t('eff.provisionsPourries', {
    perdues: rationsDeCale(pourris.filter((l) => l.vivre === vivre)), vivre: refLabel('trappings', { id: vivre }), total: rationsDeCale(provisions),
  })));
  get().ecrireAuJournal(lignes);
  return lignes;
}

/** Purge les effets « pour la prochaine aventure » (`ActiveEffect.duration.scale === 'adventure'` —
 *  LDB 23 l.209/218/234 : Entraînement au Combat, Observer une cible, Réputation) : la borne « fin
 *  d'aventure » n'a pas d'échéance chiffrable à la pose — elle est la PROCHAINE ouverture d'interlude
 *  (`ouvrirLInterlude`, seul appelant). RENVOIE les dissipations (journalisées par l'appelant). */
export function purgeAdventureEffects(get: Get, set: Set): EntreeDuJournal[] {
  const expiredLog: EntreeDuJournal[] = [];
  for (const h of get().party) {
    const porte: Applique = { lignes: [], faits: [] };
    const fx = removeActiveEffects(h, (e) => e.duration.scale === 'adventure', porte);
    for (const e of fx) expiredLog.push(ligneDeTexte(t('upkeep.fadesAdventure', { name: nomDe(h), what: e.label })));
    expiredLog.push(...porte.lignes);
  }
  if (expiredLog.length) { set({ party: [...get().party] }); get().ecrireAuJournal(expiredLog); }
  return expiredLog;
}

/** Un Test de Résistance d'entretien DIFFÉRÉ, prêt à devenir une étape de cascade de nuit. */
export interface DeferredUpkeepTest {
  heroId: string;
  /** L'id de l'enjeu de nuit du Test (#1117 point 5) — un kind inventé ne compile pas. */
  kind: NightStakeId;
  label: string;
  /** JOUR calendaire (`dayIndex`) auquel ce Test est DÛ — l'entretien traite chaque franchissement
   *  (boucle ci-dessous), donc un saut de 3 jours doit 3 Tests de Dessoûlage au MÊME héros. Le jour
   *  entre dans la CLÉ de bande (`noyau/nightBands`) : sans lui, ces 3 jets seraient 3 rangées de
   *  même id dans une seule fenêtre — injoignables. */
  day: number;
  base: number;
  /** Ids du Test (`UpkeepDeferTest.test`) quand le producteur les porte — la base est alors le Niveau
   *  de Compétence NU et le libellé de compétence de l'étape s'en DÉRIVE (`testSkillLabel`). */
  test?: TestIds;
  /** Difficulté DÉCLARÉE du Test (comprise dans `target`) — la ligne de jet la DIT (#1112). */
  difficulty: Difficulty;
  /** Modificateurs NOMMÉS compris dans `target` (Faim/Soif : « -10 % de plus pour chaque Test », LDB 18 l.338). */
  mods?: ModLine[];
  target: number;
  /** Écrêtage RÉELLEMENT subi par la cible (`clampTarget`) — rendu « plafond 99 » sur la ligne. */
  clamped?: number;
  meta?: Record<string, unknown>; // p.ex. { diseaseName, opsEchec: GameOp[] } — porté tel quel jusqu'à l'applier
}

/** Traite les journées écoulées depuis le dernier entretien (rations/faim, maladies, convalescence)
 *  + purge des effets d'horloge. No-op (hors purge) si aucun franchissement de jour. Appelé par le pas
 *  d'horloge (`preparerLEntretienQuotidien`), la nuit (`buildNightCascade`) et le sommeil d'office (`sleepParty`).
 *  RENVOIE les lignes du bilan : chaque appelant les AFFICHE (révélation témoin / bilan de nuit /
 *  recap de voyage) — le journal seul ne suffit pas (personne ne le lit). */
export function runDailyUpkeep(get: Get, set: Set, opts: { fedDaily?: boolean; onDeferTest: (t: DeferredUpkeepTest) => void }): LigneDEntretien[] {
  // Dissipations d'effets d'horloge : au FRANCHISSEMENT de jour, elles font partie du rapport
  // visible (hors franchissement — rythme combat — le journal et les icônes d'État suffisent).
  // Celles déjà dissipées par la COUTURE du temps depuis le dernier entretien (voyage terrestre,
  // journée de mer : ces chemins avancent l'horloge sans entretien) y sont REPRISES, sans quoi elles
  // ne vivraient que dans le journal.
  const purged = [...(dissipationsDHorloge.get(get)?.splice(0) ?? []), ...purgeClockEffects(get, set)];
  const today = dayIndex(get().gameTime);
  const last = get().lastUpkeepDay;
  if (today <= last) return [];
  const party = get().party;
  const { scene, campaignNarratif, enSceneDepuis } = get();
  const veilleurs = veilleursDeLaScene(scene, presetDuNarratif(campaignNarratif), objetDuNarratif(campaignNarratif));
  // LDB 09 l.265
  const soigne = (patient: Combatant, d: number) => {
    const present = enSceneDepuis !== null && enSceneDepuis <= (d - 1) * MINUTES_PER_DAY;
    return [...party, ...(present ? veilleurs : [])].some((h) => h !== patient && peutTenter(h, { skill: { id: HEAL_SKILL } }));
  };
  const lines: LigneDEntretien[] = [];
  let rations = 0;
  // À bord en mer, l'eau vient des tonneaux du navire (`vessel.waterLitres`) et les vivres de sa cale
  // (`vessel.provisions`), quand il les suit ; sinon l'eau du pays (règle `penurie-d-eau`) et le sac.
  // LDB 18 l.340 ; MDG 14 l.238, l.242 ; #4453
  const aBord = get().travelPlan?.sea != null;
  const waterLitres = aBord ? get().vessel?.waterLitres : undefined;
  const hasWater = waterLitres != null ? waterLitres > 0 : rule('penurie-d-eau') !== true;
  const provisions = aBord ? get().vessel?.provisions : undefined;
  const cale = provisions && { lots: provisions };
  const incubation = incubationPendantLeVoyage(get);
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
      const gardeManger = cale ? rationsDeLaCale(cale, d * MINUTES_PER_DAY) : rationsDuSac(h);
      const r = dailyFoodUpkeep(h, gardeManger, testValue(h, { skill: { id: 'resistance' }, characteristic: 'endurance' }), bonus(effectiveChar(h, 'endurance')), battleRng(), defer);
      if (r.rationConsumed && !cale) rations++;
      const faim: Applique = { lignes: [], faits: [] };
      loseWounds(h, r.damage, faim);
      lines.push(...lignesDEntretien([...r.log, ...faim.lignes], h.id));
      // 1bis. Eau / Soif (LDB 18 l.340) — accès à l'eau calculé plus haut (`hasWater`).
      const w = dailyWaterUpkeep(h, hasWater, testValue(h, { skill: { id: 'resistance' }, characteristic: 'endurance' }), bonus(effectiveChar(h, 'endurance')), battleRng(), defer);
      const soif: Applique = { lignes: [], faits: [] };
      loseWounds(h, w.damage, soif);
      lines.push(...lignesDEntretien([...w.log, ...soif.lignes], h.id));
      // 1ter. Dessoûlage (LDB 09 l.485) : une nuit sans boire dégrise. Deux Tests de Résistance à l'alcool
      //       Intermédiaires fixent la dissipation (10−DR h) et la gueule de bois (Exténué 5−DR h, horloge).
      if (h.drunk) {
        const alcool = { skill: { id: 'resistance-a-l-alcool' }, characteristic: 'endurance' } as const;
        const alc = testValue(h, alcool);
        // DIFFÉRÉ comme ses voisins (faim/soif) : le Test de Résistance à l'alcool est une étape de
        // cascade, jamais un jet roulé ici (sinon pré-résolu).
        defer({ kind: 'dessoulage', label: t('upkeep.sobering'), base: alc, test: alcool, difficulty: 'intermediaire' });
      }
      // 2. Maladies (LDB 20 — jours calendaires, #T3). Règle optionnelle : désactivable (maladie-mode off).
      if (rule('maladie-mode') !== 'off') {
        const peutDeclarer = incubation && ((maladieId: string) => incubation(h.id, maladieId));
        lines.push(...lignesDEntretien(dailyDiseaseUpkeep(h, battleRng(), defer, soigne(h, d), peutDeclarer), h.id));
      }
      // 3. Convalescence des Blessures critiques (LDB 18 — jours calendaires, #T3).
      lines.push(...lignesDEntretien(tickTraumaRecovery(h, 1, defer), h.id));
    }
    // 4. Effets déclenchés d'HORLOGE portés par la DONNÉE (Trait, Mutation, État… — `clockHooks`,
    //    bus-owned). `onDayStart` : une émission par jour franchi (le rattrapage en doit autant que
    //    de journées). `onWake` : le jour où une nuit a été JOUÉE (`lastNightDay`, posé par restFlow
    //    AVANT cet entretien) — franchir un jour n'est pas se réveiller.
    lines.push(...fireClockTriggers(get, 'onDayStart', { rng: battleRng() }));
    if (d === get().lastNightDay) lines.push(...fireClockTriggers(get, 'onWake', { rng: battleRng() }));
  }
  // Nuit forcée (maison `voyage-privation-de-sommeil`, #340) : chaque jour calendaire franchi SANS nuit jouée
  // (aucun repos depuis `lastNightDay`) inflige 1 État Exténué « privation de sommeil » par héros vivant.
  // Jamais silencieux (conséquence via applyOps `condition`) ; retiré au prochain vrai sommeil (LDB 16).
  if (rule('voyage-privation-de-sommeil') === true) {
    const missed = Math.max(0, today - Math.max(last, get().lastNightDay));
    if (missed > 0) {
      for (const h of party) {
        if (h.dead) continue;
        lines.push({ entree: ligneDeTexte(t('upkeep.sleepDeprived', { name: nomDe(h), n: missed, s: missed > 1 ? 's' : '' })), actorId: h.id });
        lines.push(...lignesDEntretien(applyOps(h, [{ op: 'condition', id: { id: 'extenue' }, value: missed }], { idNeuf: get().forgerUnId, rng: battleRng() }).lignes, h.id));
      }
    }
  }
  if (rations > 0) lines.unshift({ entree: ligneDeTexte(t('upkeep.rationsUsed', { n: rations, s: rations > 1 ? 's' : '' })) });
  const vessel = get().vessel;
  const prises = cale ? rationsDeCale(provisions) - rationsDeCale(cale.lots) : 0;
  if (cale && vessel && prises > 0) {
    set({ vessel: { ...vessel, provisions: cale.lots } });
    const left = rationsDeCale(cale.lots);
    lines.unshift({ entree: ligneDeTexte(t('upkeep.holdUsed', { n: prises, left, s: left > 1 ? 's' : '' })) });
  }
  // Navire de campagne (MDG 14) : PAIE hebdomadaire de l'équipage salarié puis recalcul du Moral, pour
  // CHAQUE semaine franchie depuis `lastMoraleWeek` (`tickCampaignVesselWeek`). #216, #1652.
  set({ lastUpkeepDay: today, party: [...party] }); // persiste faim/eau/maladies/convalescence AVANT le débit des gages
  lines.push(...lignesDEntretien(tickCampaignVesselWeek(get, set, today, battleRng()))); // débite les bourses PAR-DESSUS (lit get().party à jour)
  get().ecrireAuJournal(lines.map(({ entree }) => entree));
  if (lines.length) bus.emit(EVT.SCENE_DIRTY);
  return [...purged, ...lines]; // les dissipations du jour font partie du bilan affiché
}
