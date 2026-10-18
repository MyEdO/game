/**
 * Montures en VOYAGE (EDOC 7 « Montures et véhicules ») — moteur PUR, données `src/data/montures.json`
 * (table « Mouvement pour les montures » + Endurance des profils, verbatim EDOC 07 l.13-93 et l.121-130).
 *
 * RAW modélisé :
 *  - Vitesse de voyage (EDOC 07 l.140) : « Chaque point de Mouvement équivaut à un 1,5 km par heure au
 *    pas, 2,5 km par heure au trot, et 3 km par heure au galop. » Certaines bêtes ne trottent pas
 *    (colonne « - » de la table des allures, l.121-130).
 *  - Endurance des allures (EDOC 07 l.142-144) : au pas jusqu'à 12 heures sans repos ; au trot pendant
 *    Bonus d'Endurance heures ; au petit galop pendant la MOITIÉ du Bonus d'Endurance en heures.
 *  - Au-delà (EDOC 07 l.146) : par heure supplémentaire, +1 Exténué + Test de Résistance Intermédiaire
 *    (+0) ; échec → +1 Exténué de plus ET jet sur le Tableau des Incidents de monte (l.148-155,
 *    `rollMountIncident` — la donnée `incidents-monture.json`). Exténué > Bonus d'Endurance → la bête
 *    s'effondre (Sonné + À Terre) puis dernier Test de Résistance (+0) « sans aucun modificateur » ;
 *    échec = morte.
 *  - Incidents (EDOC 07 l.157-174) : Sangle cassée / Perte d'un fer → Test de Chevaucher Complexe (-10)
 *    du cavalier ou chute de 2 mètres (Dégâts de Chute appliqués par l'appelant) ; Sangle → -20 aux
 *    futurs Tests de Chevaucher jusqu'à réparation ; Fer → l'animal au pas jusqu'au maréchal-ferrant ;
 *    Boiteux → ½ vitesse de marche, ni monté ni attelé ; Patte brisée → Fracture (Majeure), immobile.
 *
 * Une monture du groupe = une Possession `nature: 'bete'` d'un héros (SOCLE POSSESSIONS #617/#618)
 * dont le `creatureId` figure dans `montures.json`. L'état d'incident persiste sur la Possession (`mountInjury`).
 * L'Exténué des bêtes est journalier (la halte de nuit vaut repos — LDB 16, l'Exténué part au repos).
 */
import monturesJson from '../data/montures.json';
import type { Combatant } from './types';
import type { Possession } from './possession';
import { possessionLabel, possessionCombatRideable } from './possession';
import { d100, type RNG } from './dice';
import { rollTest, testDetail } from './tests';
import { testValue } from './skills';
import { rollMountIncident, mountIncidentEffects, type TravelTableEntry } from './travelTables';
import { t, type MsgKey } from '../i18n';
import { refLabel, dataLabel } from '../data';
import { indexParId, memoParVersion } from '../data/versionDataset';

export type Allure = 'pas' | 'trot' | 'galop';
export const ALLURES: readonly Allure[] = ['pas', 'trot', 'galop'];
const ALLURE_KEY: Record<Allure, MsgKey> = { pas: 'mt.allurePas', trot: 'mt.allureTrot', galop: 'mt.allureGalop' };
/** Libellé JOUEUR d'une allure — fonction, jamais carte de phrases figée à l'évaluation du module
 *  (elle ne suivrait pas `setLocale`, dette nommée de `src/i18n/index.ts`). */
export const allureLabel = (a: Allure): string => t(ALLURE_KEY[a]);
/** EDOC 07 l.140 : km/h par point de Mouvement, selon l'allure. */
export const ALLURE_KMH_PER_M: Record<Allure, number> = { pas: 1.5, trot: 2.5, galop: 3 };

/** Une ligne de la table EDOC (M + Endurance + « trotte ou pas ») liée aux créatures possédables (Possession
 *  `nature: 'bete'`, SOCLE POSSESSIONS #617/#618). */
export interface MountProfile {
  id: string;
  label: string;
  /** Créatures du bestiaire (`creatures.json`) auxquelles ce profil s'applique. */
  creatureIds: string[];
  /** Mouvement (EDOC 07 l.121-130). */
  m: number;
  /** Endurance du profil (EDOC 07 l.13-93) — le Bonus en dérive. */
  e: number;
  /** La bête trotte-t-elle ? (colonne Trot « - » pour chien/poney/trait/bœuf, l.121-130). */
  trot: boolean;
  /** Charge portée en Points d'Enc (colonne « Capacité d'encombrement », EDOC 07 l.97-108) — capacité de bât
   *  du porteur (`CargoCarrier`, engine/cargo.ts). */
  encPortee: number;
}

export const MOUNT_PROFILES: MountProfile[] = (monturesJson as { entries: MountProfile[] }).entries;
const montureParId = indexParId('montures', MOUNT_PROFILES);
const montureParCreature = memoParVersion('montures', () =>
  new Map(MOUNT_PROFILES.flatMap((p) => p.creatureIds.map((c) => [c, p] as const))),
);

export function mountProfileById(id: string): MountProfile | undefined {
  return montureParId(id);
}
export function mountProfileForCreature(creatureId: string): MountProfile | undefined {
  return montureParCreature().get(creatureId);
}
/** Bonus d'Endurance d'un profil (dizaines de E). */
export const mountBE = (p: MountProfile): number => Math.floor(p.e / 10);

/** Incidents de monte PERSISTANTS sur l'instance (EDOC 07 l.157-174). */
export type MountInjury = 'sangle-cassee' | 'perte-d-un-fer' | 'boiteux' | 'patte-brisee';

/** Une monture du groupe : le héros propriétaire (= cavalier), la Possession `nature: 'bete'`, le profil EDOC. */
export interface PartyMount {
  hero: Combatant;
  possession: Possession & { nature: 'bete' };
  profile: MountProfile;
}

/** Cette bête peut-elle (encore) être montée ? Boiteux : « ne peut pas … être monté » (l.157) ;
 *  Patte brisée : « demeure immobile » (l.161). */
const rideable = (p: Possession & { nature: 'bete' }): boolean =>
  !p.destroyed && !mountIncidentEffects(p.mountInjury)?.preventsMount; // la séquelle DÉCLARE `preventsMount`

/** 1re bête possédée `avec-le-groupe` d'un héros passant `gate` (`possessions` = tout le registre du
 *  store, filtré par `ownerId`) — mutualise l'itération commune de `heroMount`/`heroCombatMount`. */
function firstOwnedBete(
  h: Combatant,
  possessions: Possession[],
  gate: (p: Possession & { nature: 'bete' }) => boolean,
): (Possession & { nature: 'bete' }) | undefined {
  for (const p of possessions) {
    if (p.ownerId !== h.id || p.nature !== 'bete' || p.location.kind !== 'avec-le-groupe') continue;
    if (gate(p)) return p;
  }
  return undefined;
}

/** Monture UTILISABLE d'un héros : première Possession bête (avec-le-groupe) au profil EDOC, encore
 *  montable (`possessions` = tout le registre du store, filtré par `ownerId`). */
export function heroMount(h: Combatant, possessions: Possession[]): PartyMount | undefined {
  const p = firstOwnedBete(h, possessions, (c) => 'creatureId' in c.ref && !!mountProfileForCreature(c.ref.creatureId) && rideable(c));
  if (!p) return undefined;
  const profile = 'creatureId' in p.ref ? mountProfileForCreature(p.ref.creatureId) : undefined;
  return profile ? { hero: h, possession: p, profile } : undefined;
}

/** Monture de COMBAT d'un héros (LDB 14) : 1re bête possédée avec-le-groupe acceptant un cavalier
 *  (`possessionCombatRideable`, LDB 339) — indépendant du profil EDOC (le `cheval` LDB n'en a pas). */
export function heroCombatMount(h: Combatant, possessions: Possession[]): (Possession & { nature: 'bete' }) | undefined {
  return firstOwnedBete(h, possessions, possessionCombatRideable);
}

/** Les montures des héros VIVANTS du groupe (un héros = au plus une monture). */
export function partyMounts(party: Combatant[], possessions: Possession[]): PartyMount[] {
  return party
    .filter((h) => !h.dead && !h.outOfRencontre)
    .map((h) => heroMount(h, possessions))
    .filter((m): m is PartyMount => !!m);
}

/** Le groupe peut-il voyager en selle ? (chaque héros vivant a une monture utilisable). */
export function partyFullyMounted(party: Combatant[], possessions: Possession[]): boolean {
  const alive = party.filter((h) => !h.dead && !h.outOfRencontre);
  return alive.length > 0 && alive.every((h) => !!heroMount(h, possessions));
}

/** Allures praticables PAR LE GROUPE : le trot exige que TOUTES les bêtes trottent (l.121-130). */
export function availableAllures(mounts: PartyMount[]): Allure[] {
  if (!mounts.length) return [];
  return mounts.every((m) => m.profile.trot) ? ['pas', 'trot', 'galop'] : ['pas', 'galop'];
}

/** Allure EFFECTIVE d'une bête : Perte d'un fer → « au pas jusqu'à ce que le fer ait été remplacé »
 *  (l.166) ; une bête qui ne trotte pas (l.121-130) reste au pas quand le groupe trotte. */
function effectiveAllure(m: PartyMount, allure: Allure): Allure {
  const forced = mountIncidentEffects(m.possession.mountInjury)?.forcedAllure; // allure imposée par la séquelle
  if (forced) return forced;
  if (allure === 'trot' && !m.profile.trot) return 'pas';
  return allure;
}

/** Vitesse du groupe en selle (km/h) : la plus LENTE des montures à l'allure choisie (EDOC 07 l.140). */
export function mountedSpeedKmh(mounts: PartyMount[], allure: Allure): number {
  if (!mounts.length) return 0;
  return Math.min(...mounts.map((m) => m.profile.m * ALLURE_KMH_PER_M[effectiveAllure(m, allure)]));
}

/** Endurance d'une allure, en heures (EDOC 07 l.142-144) : pas 12 h ; trot BE h ; galop ½ BE h. */
export function allureEnduranceHours(p: MountProfile, allure: Allure): number {
  if (allure === 'pas') return 12;
  return allure === 'trot' ? mountBE(p) : mountBE(p) / 2;
}

/** Bête Boiteuse MENÉE à pied : « pas plus vite que la moitié de sa vitesse de marche » (l.157) —
 *  plafond de km/h pour un groupe qui continue à pied avec elle. `null` si aucune bête boiteuse. */
export function lameLedCapKmh(party: Combatant[], possessions: Possession[]): number | null {
  let cap: number | null = null;
  const heroIds = new Set(party.filter((h) => !h.dead && !h.outOfRencontre).map((h) => h.id));
  for (const p of possessions) {
    if (p.nature !== 'bete' || !heroIds.has(p.ownerId) || p.mountInjury !== 'boiteux') continue;
    if (!('creatureId' in p.ref)) continue;
    const profile = mountProfileForCreature(p.ref.creatureId);
    if (!profile) continue;
    const kmh = (profile.m * ALLURE_KMH_PER_M.pas) / 2;
    cap = cap == null ? kmh : Math.min(cap, kmh);
  }
  return cap;
}

/** Ligne de jet (forme partagée `testDetail`). */
export type MountTestLine = ReturnType<typeof testDetail>;

export interface MountIncidentResolved {
  entry: TravelTableEntry;
  /** État persistant posé sur la Possession (`mountInjury`). */
  injury?: MountInjury;
  /** Test de Chevaucher du cavalier (Sangle cassée / Perte d'un fer, l.165-174). */
  riderTest?: MountTestLine;
  /** Chute de selle ratée : hauteur en mètres (2 m, l.166/l.171) — Dégâts de Chute côté appelant. */
  riderFallM?: number;
  lines: string[];
}

/**
 * Résout UN Incident de monte (EDOC 07 l.157-174) pour une monture et son cavalier. PUR (ne mute pas
 * la Possession : l'appelant pose `injury` et applique la chute). Le -20 d'une Sangle cassée antérieure
 * s'applique aux Tests de Chevaucher suivants (l.174) — lu sur `possession.mountInjury`.
 */
export function resolveMountIncident(entry: TravelTableEntry, mount: PartyMount, rng: RNG): MountIncidentResolved {
  const mountLabel = possessionLabel(mount.possession);
  const out: MountIncidentResolved = { entry, lines: [t('mt.incident', { mount: mountLabel, label: entry.label })] };
  const eff = entry.mount;
  if (!eff) return out; // incident sans suite déclarée : la ligne d'incident, rien de plus
  if (eff.riderTest) {
    // Test du cavalier, sous peine de chute (l.166 / l.171). Une séquelle DÉJÀ portée grève ce Test (l.174).
    const carried = mountIncidentEffects(mount.possession.mountInjury)?.ridingPenalty ?? 0;
    const base = Math.max(0, testValue(mount.hero, eff.riderTest.skill.id, eff.riderTest.char) + carried);
    const tst = rollTest(base, eff.riderTest.difficulty, rng);
    out.riderTest = testDetail(refLabel('skills', eff.riderTest.skill), base, tst);
    if (!tst.success) {
      out.riderFallM = eff.riderTest.fallM;
      out.lines.push(t('mt.riderFalls', { name: mount.hero.label, metres: `${eff.riderTest.fallM}` }));
    } else {
      out.lines.push(t('mt.riderHolds', { name: mount.hero.label }));
    }
  }
  out.injury = entry.id as MountInjury; // la séquelle persistée EST l'id de son incident
  // CONDITION DE FIN et ISSUE : fragments AUTHORÉS de l'entrée (dérivés de son verbatim), passés par
  // `dataLabel` — le gabarit du catalogue les accueille, aucun texte de règle n'est composé ici.
  const fin = eff.endCondition ? dataLabel(eff.endCondition) : undefined;
  if (eff.ridingPenalty) {
    out.lines.push(fin
      ? t('mt.injuryRidingPenaltyUntil', { mount: mountLabel, penalty: `${eff.ridingPenalty}`, fin })
      : t('mt.injuryRidingPenalty', { mount: mountLabel, penalty: `${eff.ridingPenalty}` }));
  }
  if (eff.forcedAllure) {
    const allure = allureLabel(eff.forcedAllure).toLowerCase();
    out.lines.push(fin
      ? t('mt.injuryForcedAllureUntil', { mount: mountLabel, allure, fin })
      : t('mt.injuryForcedAllure', { mount: mountLabel, allure }));
  }
  if (eff.preventsMount) out.lines.push(t('mt.injuryPreventsMount', { mount: mountLabel }));
  if (eff.outcome) out.lines.push(t('mt.injuryOutcome', { mount: mountLabel, issue: dataLabel(eff.outcome) }));
  if (eff.notHealedByCare) out.lines.push(t('mt.injuryNotHealedByCare', { mount: mountLabel }));
  return out;
}

export interface MountDayOutcome {
  mount: PartyMount;
  /** Heures chevauchées AU-DELÀ de l'endurance de l'allure (EDOC 07 l.146). */
  overHours: number;
  /** États Exténué accumulés par la bête ce jour (repartent à la halte de nuit). */
  extenue: number;
  tests: MountTestLine[];
  incidents: MountIncidentResolved[];
  /** Exténué > BE : la bête s'effondre — Sonné + À Terre (l.146). */
  collapsed: boolean;
  /** Dernier Test de Résistance (+0), « sans aucun modificateur », raté : la bête est morte (l.146). */
  dead: boolean;
  lines: string[];
}

/**
 * Résout la fatigue d'UNE journée en selle (EDOC 07 l.142-146) pour chaque monture : par heure au-delà
 * de l'endurance de l'allure, +1 Exténué + Test de Résistance Intermédiaire (+0), avec le malus d'États
 * Exténué de la bête (-10 par État, LDB 16) ; échec → +1 Exténué ET Incident de monte. Exténué > BE →
 * effondrement (Sonné + À Terre) puis Test de Résistance SANS modificateur ; échec = morte.
 * PUR : rend l'issue structurée, l'appelant applique (injuries, chute du cavalier, retrait de la bête).
 */
export function resolveMountedDay(mounts: PartyMount[], hours: number, allure: Allure, rng: RNG, priorHours = 0): MountDayOutcome[] {
  const out: MountDayOutcome[] = [];
  for (const mount of mounts) {
    const p = mount.profile;
    const be = mountBE(p);
    const endurance = allureEnduranceHours(p, effectiveAllure(mount, allure));
    // Endurance comptée sur le JOUR calendaire (#340) : `priorHours` = heures DÉJÀ chevauchées aujourd'hui
    // (trajets enchaînés). Seules les heures NEUVES au-delà de l'endurance sont testées — les heures déjà
    // parcourues avant ce trajet ne re-fatiguent pas la bête (elles l'ont fait à leur propre trajet).
    const priorOver = Math.max(0, priorHours - endurance);
    const overHours = Math.max(0, priorHours + hours - endurance) - priorOver;
    const o: MountDayOutcome = { mount, overHours, extenue: 0, tests: [], incidents: [], collapsed: false, dead: false, lines: [] };
    for (let h = 0; h < Math.ceil(overHours - 1e-9); h++) {
      o.extenue += 1; // « il gagne un État Exténué » (l.146)
      const base = Math.max(0, p.e - 10 * o.extenue); // -10 par État Exténué (LDB 16)
      const tst = rollTest(base, 'intermediaire', rng);
      o.tests.push(testDetail(t('mt.testOf', { skill: refLabel('skills', { id: 'resistance' }), mount: possessionLabel(mount.possession) }), base, tst));
      if (!tst.success) {
        o.extenue += 1; // « l'animal prend un nouvel État Exténué » (l.146)
        const inc = resolveMountIncident(rollMountIncident(d100(rng)), mount, rng);
        o.incidents.push(inc);
        o.lines.push(...inc.lines);
        // Bête qui ne peut plus être montée : la journée de selle s'arrête là pour elle.
        if (inc.injury === 'boiteux' || inc.injury === 'patte-brisee') break;
      }
      if (o.extenue > be) {
        o.collapsed = true; // Sonné + À Terre (l.146)
        const t2 = rollTest(p.e, 'intermediaire', rng); // « sans aucun modificateur »
        o.tests.push(testDetail(t('mt.testCollapseOf', { skill: refLabel('skills', { id: 'resistance' }), mount: possessionLabel(mount.possession) }), p.e, t2));
        o.dead = !t2.success;
        o.lines.push(o.dead
          ? t('mt.collapseDead', { mount: possessionLabel(mount.possession) })
          : t('mt.collapse', { mount: possessionLabel(mount.possession) }));
        break;
      }
    }
    if (o.extenue > 0 && !o.collapsed) o.lines.push(t('mt.wearyDay', { mount: possessionLabel(mount.possession), n: o.extenue }));
    out.push(o);
  }
  return out;
}
