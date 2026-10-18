/**
 * Voyage par ÉTAPES — Compagnon T1 (EDOC), « CHAPITRE 5 : Voyager »
 * (`Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/08 - CHAPITRE 5 - Voyager.md`).
 *
 * Sous-système OPTIONNEL : « Tout comme le chapitre Entre deux aventures, tous ces outils sont
 * optionnels et voués à enrichir les règles présentées à la page 261 de WFJDR » (EDOC 8 l.33).
 * Il enrichit le déplacement de base du LdB SANS le remplacer — le défaut reste jour-par-jour.
 *
 * Ce module est PUR (RNG injecté, aucun accès store) : il calcule le nombre d'Étapes, tire la
 * Météo par Étape (table verbatim EDOC 8 l.50-59), donne la difficulté d'un Test d'Exposition
 * de fin d'Étape (« Attraper Froid », l.90) et le rendement de l'activité d'Approvisionnement
 * (« Trouver de la nourriture et des herbes », LDB 09 l.565-572). Les valeurs RAW sont citées en
 * commentaire ; rien n'est inventé.
 */
import type { RNG } from './dice';
import { d100 } from './dice';
import type { CharKey, Difficulty } from './types';
import { rule } from './policy';
import type { CodexTarget } from './ruleRefs';
import { weather, weatherConditions, weatherPhysicalTestChars } from '../data';
import { indexParId } from '../data/versionDataset';
import { weatherIdSchema } from '../data/schemas/defs/weather';
import { findTableEntry } from './tables';

/** Les quatre saisons du tableau de Météo (EDOC 8 l.52). */
export type Season = 'printemps' | 'ete' | 'automne' | 'hiver';

/** Saisons « froides » (rhume après Exposition, l.92 : « En hiver ou au printemps … contracte un rhume »). */
export const COLD_SEASONS: Season[] = ['printemps', 'hiver'];

/**
 * Saison dérivée de l'index de mois impérial (0 = Nachhexen … 11 = Vorhexen). Le calendrier impérial
 * suit les saisons terrestres. Découpage en 4 quarts de 3 mois (ancré sur l'année qui démarre à
 * Nachhexen) :
 *  printemps = Jahrdrung(1)/Pflugzeit(2)/Sigmarzeit(3) ; été = Sommerzeit(4)/Vorgeheim(5)/Nachgeheim(6) ;
 *  automne = Erntezeit(7)/Brauzeit(8)/Kaldezeit(9) ; hiver = Ulriczeit(10)/Vorhexen(11)/Nachhexen(0).
 *  Un jour intercalaire (month = null) prend le défaut printemps (la campagne EiS démarre fin Jahrdrung).
 */
export function seasonOfMonth(monthIndex: number | null): Season {
  if (monthIndex == null) return 'printemps';
  const m = ((monthIndex % 12) + 12) % 12;
  if (m >= 1 && m <= 3) return 'printemps'; // Jahrdrung, Pflugzeit, Sigmarzeit
  if (m >= 4 && m <= 6) return 'ete';       // Sommerzeit, Vorgeheim, Nachgeheim
  if (m >= 7 && m <= 9) return 'automne';   // Erntezeit, Brauzeit, Kaldezeit
  return 'hiver';                           // Ulriczeit(10), Vorhexen(11), Nachhexen(0)
}

/**
 * Conditions météo (EDOC 8 l.50-59), de la plus clémente à la pire — l'ordre fixe le « degré de temps
 * éloigné de Beau temps » de l'activité Plein Air (l.141).
 *
 * DÉRIVÉ du schéma (`weatherIdSchema`, `data/schemas/defs/weather.ts`) : la DÉCLARATION est l'unique
 * vérité de l'alphabet — une union littérale recopiée ici aurait divergé en silence du z.enum qui
 * valide le fichier.
 *
 * AXE DISTINCT : la météo AUTHORÉE d'une Scène jouée (`Scene['weather']`, `sceneWeatherSchema`,
 * `data/schemas/defs-scenes/scene.ts`) — son libellé vit sur le nœud (`enumNomme`).
 */
export type Weather = (typeof weatherIdSchema.options)[number];

/** Fiche Codex de la condition météo (catalogue `weatherConditions`, `weather.json`) — SOURCE UNIQUE
 *  de la `ref` des lignes de jet que la météo du jour modifie (tir, Tests physiques, Activités). */
export function weatherRef(w: Weather): CodexTarget {
  return { category: 'weatherConditions', id: w };
}

/** Une plage d100 → météo. */
interface WeatherRange { min: number; max: number; weather: Weather; }

/**
 * TABLE DE MÉTÉO VERBATIM (EDOC 8 l.52-59 — « Le MJ doit effectuer un jet de Météo au début de
 * chaque étape »). Pour chaque saison, les plages d100 `{min, max}` (bornes INCLUSES ; 00 → 100),
 * les DEUX telles que la source les imprime. Un tiret RAW (« - ») = plage absente cette saison.
 *
 *  | Météo            | Printemps | Été    | Automne | Hiver  |
 *  | Temps sec        | 01-10     | 01-40  | 01-30   | -      |
 *  | Beau temps       | 11-30     | 41-70  | 31-60   | 01-10  |
 *  | Pluie            | 31-90     | 71-95  | 61-90   | 11-60  |
 *  | Pluie diluvienne | 91-95     | 96-00  | 91-98   | 61-65  |
 *  | Neige            | 96-00     | -      | 99-00   | 66-90  |
 *  | Blizzard         | -         | -      | -       | 91-00  |
 */
const saisonParId = indexParId('weather', weather);
/** Plages d100 d'une saison, LIVE (le dataset `weather` est éditable au Codex). */
export function weatherRanges(season: Season): WeatherRange[] {
  return (saisonParId(season)?.ranges ?? []) as WeatherRange[];
}

/** Météo depuis un jet d100 explicite (1-100) et une saison — lecture LIVE de la donnée éditable. */
export function weatherFromRoll(roll: number, season: Season): Weather {
  const ranges = weatherRanges(season);
  return findTableEntry(ranges, roll).weather;
}

/** Jet de Météo d'une Étape (EDOC 8 l.50) : d100 sur la table de la saison. */
export function rollStageWeather(rng: RNG, season: Season): { roll: number; weather: Weather } {
  const roll = d100(rng);
  return { roll, weather: weatherFromRoll(roll, season) };
}

/**
 * Nombre d'Étapes d'un trajet (EDOC 8 l.40) : « Un voyage entre deux villages proches comprend
 * généralement une seule étape. Les trajets plus longs entre des villes importantes peuvent
 * comprendre entre 2 et 4 étapes. Tout voyage plus long doit être divisé en plusieurs étapes. »
 * Le canon laisse le découpage « à la discrétion du MJ » (l.23) sans formule de distance ; on
 * dérive un nombre depuis la distance (paliers documentés, fidèles aux exemples : village proche =
 * 1, ville à ville = 2-4) PUIS on applique le « bonus d'Étapes » d'auteur (l.40 : « augmentez le
 * nombre d'Étapes de 2 ou plus ») — lu PAR DÉFAUT sur la règle optionnelle `travel-etapes-count-bonus`
 * (point de lecture UNIQUE ; les tests purs passent le paramètre). Minimum 1 (l.25/27).
 *
 * Modificateur de MOUVEMENT du groupe (EDOC 8 l.25) : « Une fois le nombre d'Étapes déterminé, il
 * est modifié par le score de Mouvement le plus faible des Personnages, qu'ils soient à pied, à
 * cheval ou dans un véhicule. Si ce chiffre est inférieur ou égal à 3, le voyage doit être augmenté
 * de 1 ou 2 Étapes. Si tous les Personnages ont [...] un Mouvement de 6 ou plus, le nombre total
 * d'Étapes est réduit de moitié pour atteindre un résultat minimum de 1. » `groupMinMovement` (absent
 * par défaut = comportement inchangé) porte ce score ; le choix « 1 ou 2 » est lu sur la règle
 * optionnelle `travel-etapes-low-move-bonus` (EDOC 8 l.25 — MJ décide, valeur maison). La division
 * par deux arrondit à l'inférieur (RAW ne précise pas l'arrondi ; plancher à 1 dans tous les cas).
 */
export function stageCount(
  distanceKm: number,
  countBonus = Number(rule('travel-etapes-count-bonus')),
  groupMinMovement?: number,
): number {
  const km = Math.max(0, distanceKm);
  // Paliers : ≤ ~25 km (village proche) = 1 ; jusqu'à ~150 km (ville à ville) = 2-4 ; au-delà, +1
  // par tranche de 50 km. Choix documenté — le canon ne chiffre pas la distance (l.38 « les cartes
  // de l'Empire sont notoirement imprécises »).
  let base: number;
  if (km <= 25) base = 1;
  else if (km <= 150) base = Math.min(4, 2 + Math.floor((km - 25) / 50)); // 26-75=2, 76-125=3, 126-150=4
  else base = 4 + Math.ceil((km - 150) / 50);
  let stages = base + Math.max(0, Math.floor(countBonus));
  if (groupMinMovement != null) {
    if (groupMinMovement <= 3) stages += Math.max(0, Math.floor(Number(rule('travel-etapes-low-move-bonus'))));
    else if (groupMinMovement >= 6) stages = Math.floor(stages / 2);
  }
  return Math.max(1, stages);
}

/**
 * Difficulté du Test d'Exposition de fin d'Étape — option « Attraper Froid » (EDOC 8 l.90) :
 * « tout Personnage exposé à la pluie ou à la neige sans un bon manteau et une tente … doit faire un
 * Test d'Exposition. Les Personnages exposés à une averse [pluie diluvienne] ou à un blizzard doivent
 * faire le Test même s'ils ont à la fois un manteau et une tente, mais l'absence de l'un ou l'autre
 * rend ce Test Complexe (-10), tandis que l'absence des deux le rend Difficile (-20). »
 *
 * Renvoie `null` si AUCUN Test n'est requis (beau temps / temps sec, ou pluie-neige normale avec
 * manteau + tente). Sinon la Difficulté du Test de Résistance.
 *  - météo modérée (pluie/neige) : Test seulement si manteau OU tente manquant ;
 *  - météo extrême (pluie diluvienne/blizzard) : Test TOUJOURS (l.90).
 *  - difficulté : les DEUX présents → Intermédiaire (+0) ; un seul manquant → Complexe (-10) ;
 *    les deux manquants → Difficile (-20).
 */
export function stageExposureDifficulty(weather: Weather, hasCloak: boolean, hasTent: boolean): Difficulty | null {
  const modere = weather === 'pluie' || weather === 'neige';
  const extreme = weather === 'pluie-diluvienne' || weather === 'blizzard';
  if (!modere && !extreme) return null; // sec / beau : pas d'intempéries (l.72)
  const missing = (hasCloak ? 0 : 1) + (hasTent ? 0 : 1);
  if (modere && missing === 0) return null; // pluie/neige normale, bien équipé → aucun Test (l.90)
  if (missing === 2) return 'difficile';    // -20 (absence des deux)
  if (missing === 1) return 'complexe';      // -10 (absence de l'un)
  return 'intermediaire';                    // +0 (extrême, manteau + tente)
}

/** Une saison froide expose-t-elle au rhume après Exposition (l.75) ? printemps/hiver uniquement. */
export function isColdSeason(season: Season): boolean {
  return COLD_SEASONS.includes(season);
}

// ── EFFETS de la météo (EDOC 8) — DONNÉE (`weather.json` conditions), MÊME vocabulaire que
//    `sea-weather.json`. Lecture par les readers ci-dessous ; aucun `switch (weather)` en code. ──

/** Effets d'une météo terrestre (donnée `weather.json` conditions). Enrichit `Weather` d'un id lisible. */
export interface WeatherCondition {
  id: Weather;
  label: string;
  desc?: string;
  /** Visibilité en mètres (0 ≈ nulle) — plafonne la portée du tir en combat (l.76/82/86/127). */
  visibiliteM?: number;
  /** Pénalité aux armes à distance en combat (Pluie -10 l.76, Pluie diluvienne -20 l.82). */
  rangedMod?: number;
  /** Armes à distance INUTILES (Blizzard l.127). */
  rangedUseless?: boolean;
  /** Poudre à canon exposée inutilisable (Pluie diluvienne l.82). */
  powderUseless?: boolean;
  /** Pénalité à tous les Tests physiques (Pluie diluvienne l.82) — caracs de `weatherPhysicalTestChars`. */
  physicalTestMod?: number;
  /** Mouvement plafonné à la marche (Neige l.86, Blizzard l.127). */
  movementWalkOnly?: boolean;
  /** Animaux au Trait Nerveux effrayables par les éclairs (Pluie diluvienne l.82). */
  lightningNervous?: boolean;
  /** Test de Résistance de traversée ou État — DISTINCT de l'Exposition de fin d'Étape (Neige l.86, Blizzard l.127).
   *  `enjeu` = énoncé VERBATIM (ce que l'échec coûte), surfacé sous le titre du pas de cascade. */
  resistanceTest?: { difficulty: Difficulty; onFail: 'extenue'; enjeu?: string };
}

/**
 * PORTE UNIQUE de la condition météo `w` — libellé ET effets, en lecture LIVE de la donnée éditable au
 * Codex (`weather.json` conditions). Aucune carte FR ne double ce dataset : `weatherCondition(w).label`
 * EST le libellé de la météo, partout.
 *
 * FAIL-FAST NOMINATIF (patron `data/overrides.ts::miscastEntries`) : un id sans fiche est
 * structurellement inatteignable — le `superRefine` de complétude du schéma refuse la suppression aux
 * trois portes (CI, boot dev, save Codex). Ce throw n'est que la ceinture : mieux vaut nommer l'id
 * absent qu'afficher une météo muette.
 */
export function weatherCondition(w: Weather): WeatherCondition {
  const found = weatherConditions.find((c) => c.id === w) as WeatherCondition | undefined;
  if (!found) {
    throw new Error(`weatherCondition : météo « ${w} » absente de weather.json (ids : ${weatherConditions.map((c) => c.id).join(', ')}).`);
  }
  return found;
}

/** Pénalité aux armes à distance en combat sous la météo `w` (0 si aucune). */
export function weatherRangedMod(w: Weather): number {
  return weatherCondition(w).rangedMod ?? 0;
}
/** Armes à distance inutiles sous la météo `w` (Blizzard) ? */
export function weatherRangedUseless(w: Weather): boolean {
  return !!weatherCondition(w).rangedUseless;
}
/** Poudre à canon exposée inutilisable sous la météo `w` (Pluie diluvienne) ? */
export function weatherPowderUseless(w: Weather): boolean {
  return !!weatherCondition(w).powderUseless;
}
/** Visibilité (mètres) sous la météo `w` — `undefined` si dégagée. */
export function weatherVisibiliteM(w: Weather): number | undefined {
  return weatherCondition(w).visibiliteM;
}
/** Mouvement plafonné à la marche sous la météo `w` (Neige/Blizzard) ? */
export function weatherMovementWalkOnly(w: Weather): boolean {
  return !!weatherCondition(w).movementWalkOnly;
}
/** Test de Résistance de traversée (Neige/Blizzard) sous la météo `w` — `undefined` si aucun. */
export function weatherResistanceTest(w: Weather): WeatherCondition['resistanceTest'] {
  return weatherCondition(w).resistanceTest;
}
/** Animaux Nerveux effrayables par les éclairs sous la météo `w` (Pluie diluvienne) ? */
export function weatherLightningNervous(w: Weather): boolean {
  return !!weatherCondition(w).lightningNervous;
}

/** Une caractéristique est-elle « physique » au sens EDOC 8 l.82 (liste MAISON éditable) ? */
export function isPhysicalTestChar(char: CharKey): boolean {
  return (weatherPhysicalTestChars as string[]).includes(char);
}
/** Méthode d'Approvisionnement (LDB 09 l.565-572, option « Trouver de la nourriture et des herbes »). */
export type ForageMethod = 'recherche' | 'chasse' | 'piegeage';

/**
 * Rendement de l'Approvisionnement (LDB 09 l.568-572) : nombre de personnes nourries depuis le DR
 * d'un Test de Survie en extérieur réussi, selon la méthode.
 *  - Recherche de nourriture (l.568) : « un succès procure suffisamment de nourriture pour un
 *    Personnage. Chaque DR procure assez de nourriture pour une personne de plus. » → 1 + DR.
 *  - Chasser et pêcher (l.570) : « un Test réussi permet de nourrir deux personnes, et deux personnes
 *    supplémentaires par DR. » → 2 + 2×DR (matériel requis — arc/lance/canne/filet).
 *  - Piégeage (l.572) : « Permet de nourrir le même nombre de personnes que Chasser et pêcher. »
 * `slTest` = DR du Test (négatif/0 si échec → 0 ration). Renvoie le nombre de rations-jour obtenues.
 */
export function forageYield(slTest: number, method: ForageMethod = 'recherche'): number {
  if (slTest < 0) return 0; // échec : aucune nourriture (le DR négatif ne nourrit personne)
  const dr = Math.max(0, slTest);
  if (method === 'chasse' || method === 'piegeage') return 2 + 2 * dr; // l.570/572
  return 1 + dr; // recherche (l.568)
}
