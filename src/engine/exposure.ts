/**
 * Exposition (LDB 18 l.327-334) — un environnement difficile/extrême (froid OU chaleur).
 * « Après 4 heures passées dans un environnement difficile – comme lorsque les températures sont
 * négatives, dans un désert brûlant ou une tempête, vous devez effectuer un Test de Résistance.
 * Lorsque vous vous retrouvez dans un environnement aux conditions extrêmes, ce Test doit être
 * effectué toutes les deux heures. »
 * FROID (l.334) : 1ᵉʳ échec → −10 CT/Agilité/Dextérité ; 2ᵉ → −10 toutes les autres ; 3ᵉ+ →
 * 1d10 Dégâts ignorant les PA (min 1) ; à 0 PB → Inconscient. « Certaines Possessions accordent
 * des bonus et des pénalités pour ces Tests » : sans bon Manteau, pénalité au Test de Froid
 * (LDB 65 — silence, valeur maison `exposure-no-coat-penalty`). La PEAU DE PHOQUE (MDG 14
 * l.277-279 : « +1 DR sur les Tests de Résistance effectués pour supporter l'exposition au froid »)
 * est consommée par `sealskinDR` : sur un Test BINAIRE, le +1 DR retient l'échec de justesse
 * (échec dont le DR remonte à ≥ +1) — lecture déclarée, aucun ±10 inventé.
 * CHALEUR (l.330) : 1ᵉʳ échec → −10 Int/FM + 1 Exténué ; 2ᵉ → −10 toutes les autres + 1 Exténué ;
 * 3ᵉ+ → 1d10 Dégâts ignorant les PA (min 1). « Vous débarrasser d'une Possession lourde annule
 * 1 Test échoué » (LDB 18 l.332) : IMPLÉMENTÉ où l'architecture le permet (choix du joueur, cf.
 * `heaviestPossession`/`dropHeaviestPossession` — la CONSÉQUENCE vit dans l'applier de cascade
 * partagé `state/restFlow.ts`, seul point où l'Exposition se résout Test par Test).
 *
 * La cadence (2h/4h ci-dessus) est LE SEUL chiffre du RAW ; son application à une NUIT dehors (un
 * nombre de Tests), l'annulation par une Tente (LDB 74 — silence) et la dissipation des pénalités
 * sont maison, réglées par le registre `policy.ts` (`exposure-night-difficile-count` /
 * `exposure-night-extreme-count` / `exposure-tent-cancels` / `exposure-expire-hours`) — cf.
 * `exposureTestCount`/`exposureShelterFromTent`. La météo de scène donne la sévérité : pluie/neige
 * = difficile, tempête = extrême (froid). Pur : mute `c`, renvoie jets + journal.
 */
import { CHAR_LABELS, type Combatant, type CharKey, type Difficulty, type ItemInstance } from './types';
import type { RNG } from './dice';
import { rollTest } from './tests';
import { addCondition, hasCondition, loseWounds } from './conditions';
import { hasCapability, itemCapability } from './capabilities';
import { itemLabel } from './items';
import { t } from '../i18n';
import { rule } from './policy';
import { RULE_REF } from './ruleRefs';
import type { ModLine } from './combat';

export type ExposureSeverity = 'clement' | 'difficile' | 'extreme';

/** Sévérité d'Exposition dérivée de la météo de scène (donnée d'auteur — pas de simulation). */
export function weatherExposure(weather?: string): ExposureSeverity {
  if (weather === 'tempete') return 'extreme';
  if (weather === 'pluie' || weather === 'neige') return 'difficile';
  return 'clement';
}

/** Le personnage PORTE-t-il une protection contre les intempéries (Manteau/Cape, ch.65 l.44) ? Capacité
 *  `weatherProtection` AGRÉGÉE et GATÉE sur le port (`engine/capabilities`) — une cape doit être PORTÉE
 *  pour protéger du froid ; lue PAR ID (≠ nom de l'objet). */
export function hasCoat(c: Combatant): boolean {
  return hasCapability(c, 'weatherProtection');
}

/** Un abri (Tente) dans le paquetage du groupe ? (campement — application déclarée). Capacité `isShelter`
 *  par-OBJET, NON gatée sur le port (une tente n'a pas à être « portée » au sens armure pour abriter le
 *  camp) — lue PAR ID dans le catalogue (≠ nom de l'objet). */
export function partyHasTent(party: Combatant[]): boolean {
  return party.some((h) => (h.items ?? []).some((it) => itemCapability(it, 'isShelter')));
}

/** La Tente ANNULE-t-elle l'Exposition du camp (nuit difficile → 0 Test, extrême → rythme difficile) ?
 *  Règle optionnelle `exposure-tent-cancels` (LDB 74 — silence, valeur maison : le RAW ne prête à la
 *  Tente AUCUN effet sur l'Exposition, seul le Sac de couchage a un bonus chiffré au Froid, LDB 74
 *  l.60). Désactivée, une Tente ne compte plus comme abri automatique (repli sur l'abri de fortune). */
export function exposureShelterFromTent(party: Combatant[]): boolean {
  return rule('exposure-tent-cancels') !== false && partyHasTent(party);
}

/** Peau de phoque (MDG 14 l.277-279) : « +1 DR sur les Tests de Résistance effectués pour supporter
 *  l'exposition au froid » — capacité `sealskin`, GATÉE sur le port (c'est un pardessus). */
export function sealskinDR(c: Combatant): number {
  return hasCapability(c, 'sealskin') ? 1 : 0;
}

export interface ExposureRoll {
  base: number;
  target: number;
  roll: number;
  sl: number;
  success: boolean;
}

/** Volet d'Exposition (LDB 18 l.330/334) — deux cascades distinctes, un SEUL système. */
export type ExposureKind = 'froid' | 'chaleur';

const FIRST_FAIL: Record<ExposureKind, CharKey[]> = {
  froid: ['capacite-de-tir', 'agilite', 'dexterite'],
  chaleur: ['intelligence', 'force-mentale'],
};
const SECOND_FAIL: Record<ExposureKind, CharKey[]> = {
  froid: ['capacite-de-combat', 'force', 'endurance', 'initiative', 'intelligence', 'force-mentale', 'sociabilite'],
  chaleur: ['capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite', 'sociabilite'],
};

/** Nombre de Tests d'une nuit dehors selon sévérité et abri — cadence RAW (LDB 18 l.328 : 4h/2h),
 *  application « nuit ~8h » maison via `exposure-night-difficile-count`/`exposure-night-extreme-count`
 *  (policy.ts). Un abri (Tente) ramène une nuit extrême au rythme difficile. */
export function exposureTestCount(severity: ExposureSeverity, sheltered: boolean): number {
  if (severity === 'clement') return 0;
  const difficile = Number(rule('exposure-night-difficile-count'));
  const extreme = Number(rule('exposure-night-extreme-count'));
  if (severity === 'extreme') return sheltered ? difficile : extreme;
  return sheltered ? 0 : difficile;
}

/** Protection magique contre les intempéries (op `weatherWard`) : aucun Test de froid tant qu'elle dure. */
export function isWeatherWarded(c: Combatant): boolean {
  return (c.activeEffects ?? []).some((e) => e.weatherImmune);
}

/** Cible (et base) d'UN Test d'Exposition au froid : Résistance +0, pénalité maison sans manteau ni
 *  cape (LDB 65 l.44 — « des pénalités », non chiffrées ; valeur `exposure-no-coat-penalty`). */
export function exposureTarget(c: Combatant, resVal: number): number {
  return Math.max(0, resVal - (hasCoat(c) ? 0 : Number(rule('exposure-no-coat-penalty'))));
}

/** Caractéristiques DU PREMIER échec d'Exposition (`FIRST_FAIL`), en libellés du catalogue — SOURCE
 *  du descripteur d'enjeu de l'étape (`voyage-stakes.json`, gabarit `exposure`) : chaque terme est
 *  l'effet que `applyExposureFailure` applique RÉELLEMENT, jamais une explication rédigée. PUR. */
export function exposureFirstFailChars(kind: ExposureKind = 'froid'): string {
  return FIRST_FAIL[kind].map((k) => CHAR_LABELS[k]).join('/');
}

/** Modificateur NOMMÉ compris dans `exposureTarget` : la pénalité maison « sans Manteau ni cape »
 *  (`exposure-no-coat-penalty`) se LIT sur la ligne de jet au lieu d'être un −N anonyme dans la cible
 *  (#1112). Renvoie `{}` quand rien ne s'applique (le porteur est couvert). */
export function exposureCoatMods(c: Combatant): { mods?: ModLine[] } {
  if (hasCoat(c)) return {};
  const pen = Number(rule('exposure-no-coat-penalty'));
  return pen ? { mods: [{ label: t('exp.noCoatMod'), value: -pen, famille: 'jet', ref: RULE_REF.exposition }] } : {};
}

/** Objet le plus lourd porté par `c` (Encombrement le plus élevé, strictement positif) — LA
 *  Possession lourde à jeter pour annuler 1 Test échoué d'Exposition (LDB 18 l.332, CHALEUR
 *  seulement). Aucun seuil inventé : le plus lourd objet porté EST par construction la Possession
 *  la plus lourde disponible ; `undefined` si rien n'a d'Encombrement. */
export function heaviestPossession(c: Combatant): ItemInstance | undefined {
  return (c.items ?? []).reduce<ItemInstance | undefined>(
    (best, it) => (it.enc > 0 && (!best || it.enc > best.enc) ? it : best),
    undefined,
  );
}

/** Se débarrasser de la Possession la plus lourde (LDB 18 l.332) : retire l'objet de l'inventaire de
 *  `c`. Renvoie son nom si un objet a bien été jeté (`undefined` si rien à jeter). Mute `c`. */
export function dropHeaviestPossession(c: Combatant): string | undefined {
  const it = heaviestPossession(c);
  if (!it) return undefined;
  c.items = (c.items ?? []).filter((x) => x.uid !== it.uid);
  return itemLabel(it);
}

/**
 * Applique la `failures`-ième défaillance d'Exposition (RAW l.330/334, escalade CUMULATIVE —
 * c'est cette dépendance qui rend la séquence SÉQUENTIELLE). Froid : 1 → −10 CT/Ag/Dex ; 2 → −10 le
 * reste ; 3+ → 1d10 Blessures (ignore les PA), Inconscient à 0 PB. Chaleur : 1 → −10 Int/FM
 * + Exténué ; 2 → −10 le reste + Exténué ; 3+ → 1d10 Blessures (ignore les PA). Mute `c` ; renvoie
 * le journal + les Blessures infligées. Partagé par `exposureNight` (eager), l'applicateur de
 * cascade « exposure » et la Température en mer (MDG 13 l.203-225).
 */
export function applyExposureFailure(c: Combatant, failures: number, rng: RNG, kind: ExposureKind = 'froid'): { log: string[]; wounds: number } {
  const log: string[] = [];
  const label = kind === 'froid' ? t('exp.labelFroid') : t('exp.labelChaleur');
  const effectId = kind === 'froid' ? 'exposition-froid' : 'exposition-chaleur';
  if (failures <= 2) {
    for (const k of (failures === 1 ? FIRST_FAIL : SECOND_FAIL)[kind]) {
      c.activeEffects = [...(c.activeEffects ?? []), { label, effectId, char: k, bonus: -10, duration: { scale: 'permanent' }, expiresOnRespite: true }];
    }
    if (kind === 'chaleur') addCondition(c, 'extenue'); // « vous gagnez un État Exténué » (1ᵉʳ ET 2ᵉ échec, l.330)
    log.push(kind === 'froid'
      ? (failures === 1 ? t('exp.shivers', { name: c.label }) : t('exp.frozen', { name: c.label }))
      : (failures === 1 ? t('exp.heatstruck', { name: c.label }) : t('exp.overwhelmed', { name: c.label })));
    return { log, wounds: 0 };
  }
  const dmg = Math.max(1, rng.int(1, 10));
  loseWounds(c, dmg);
  log.push(t('exp.wounds', { name: c.label, what: kind === 'froid' ? t('exp.fromCold') : t('exp.fromHeat'), dmg }));
  if (kind === 'froid' && c.wounds.current <= 0 && !hasCondition(c, 'inconscient')) {
    addCondition(c, 'inconscient');
    log.push(t('exp.sinksFrozen', { name: c.label }));
  }
  return { log, wounds: dmg };
}

/**
 * Une PÉRIODE d'Exposition pour `c` : `count` Tests de Résistance à `difficulty` (défaut +0) — au
 * froid : pénalité maison sans manteau (`exposureTarget`), la peau de phoque (+1 DR, MDG 14 l.277)
 * retient l'échec de justesse. Applique les échecs en cascade (RAW l.330/334, via `applyExposureFailure`).
 * Renvoie les jets et le journal. Nommée « night » pour la nuit dehors historique — sert aussi la
 * journée en mer (MDG 13 l.203-225).
 */
export function exposureNight(
  c: Combatant, count: number, resVal: number, rng: RNG,
  opts: { kind?: ExposureKind; difficulty?: Difficulty } = {},
): { rolls: ExposureRoll[]; log: string[]; failures: number; wounds: number } {
  const kind = opts.kind ?? 'froid';
  if (isWeatherWarded(c)) {
    return { rolls: [], log: [t('eff.weatherWarded', { name: c.label, what: kind === 'froid' ? t('eff.wardFroid') : t('eff.wardChaleur') })], failures: 0, wounds: 0 };
  }
  const rolls: ExposureRoll[] = [];
  const log: string[] = [];
  let failures = 0;
  let wounds = 0;
  const target = kind === 'froid' ? exposureTarget(c, resVal) : Math.max(0, resVal);
  const skin = kind === 'froid' ? sealskinDR(c) : 0;
  for (let i = 0; i < count; i++) {
    const res = rollTest(target, opts.difficulty ?? 'intermediaire', rng);
    // Peau de phoque : « +1 DR … pour supporter l'exposition au froid » (MDG 14 l.277) — sur un Test
    // binaire, l'échec dont le DR remonte à ≥ +1 est TENU (lecture déclarée, cf. en-tête).
    const held = !res.success && skin > 0 && res.sl + skin >= 1;
    rolls.push({ base: target, target: res.target, roll: res.roll, sl: res.sl + (res.success ? 0 : skin), success: res.success || held });
    if (res.success) continue;
    if (held) { log.push(t('exp.sealskinHeld', { name: c.label })); continue; }
    failures++;
    const f = applyExposureFailure(c, failures, rng, kind);
    log.push(...f.log);
    wounds += f.wounds;
  }
  if (kind === 'froid' && !hasCoat(c) && count > 0) log.push(t('exp.noCoat', { name: c.label, pen: Number(rule('exposure-no-coat-penalty')) }));
  return { rolls, log, failures, wounds };
}

/** Pose une échéance d'horloge (`untilTime`) sur les effets permanents qui DÉCLARENT se dissiper au
 *  répit (`ActiveEffect.expiresOnRespite` — pénalités d'Exposition, posées au chaud/au frais). Le délai
 *  vient de l'appelant, qui lit la MÊME règle éditable `exposure-expire-hours` au camp comme en mer. */
export function expireOnRespite(c: Combatant, untilTime: number): void {
  for (const e of c.activeEffects ?? []) {
    if (e.expiresOnRespite && e.duration.scale === 'permanent') e.duration = { scale: 'clock', until: untilTime };
  }
}
