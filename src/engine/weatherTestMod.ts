/**
 * CANAL UNIQUE de la pénalité météo « Tests physiques » (EDOC 8 l.82, #341, #2724). Le calcul brut
 * `weatherPhysicalTestMod` est PRIVÉ de ce module : toute surface qui ajoute la météo à un breakdown de
 * Test passe par `weatherTestMods`.
 *
 * Frontière : les mods météo WEAPON-CONTEXTUELS (tir dégradé `weatherRangedMod`, poudre inutilisable
 * `weatherPowderUseless`) NE passent PAS par ici — ils restent dans `attackEnv` (state), car ils dépendent
 * de l'ARME, pas de la caractéristique du Test. Ce canal ne porte QUE le −10 « Tests physiques » scopé par
 * la LISTE maison `physicalTestChars` (la carac du Test décide : CC/CT/F/E/Ag/Dex).
 */
import type { CharKey } from './types';
import type { ModLine } from './combat';
import { isPhysicalTestChar, weatherCondition, weatherRef, type Weather } from './travelStages';
import { t } from '../i18n';

/** Pénalité de la météo `w` à un Test basé sur la caractéristique `char` (Pluie diluvienne -10 aux
 *  Tests physiques, l.82) — 0 si la météo n'en porte pas ou si `char` n'est pas physique. */
function weatherPhysicalTestMod(w: Weather, char: CharKey): number {
  const mod = weatherCondition(w).physicalTestMod;
  return mod != null && isPhysicalTestChar(char) ? mod : 0;
}

/** Ligne(s) « Météo : … » d'un Test dont la caractéristique est `ck`, sous la météo `weather` — vide si pas
 *  de météo, pas de carac (mode social), ou carac non physique / météo sans pénalité (pluie simple). Un
 *  seul point de calcul : toutes les surfaces de Test (attaque/défense/activité) en dérivent. */
export function weatherTestMods(weather: Weather | undefined, ck: CharKey | null): ModLine[] {
  if (!weather || !ck) return [];
  const v = weatherPhysicalTestMod(weather, ck);
  return v ? [{ label: t('tp.modWeather', { weather: weatherCondition(weather).label }), value: v, famille: 'circonstance', ref: weatherRef(weather) }] : [];
}
