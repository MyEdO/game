/**
 * LA COMPAGNIE DU VOYAGE (#4411) : les quatre héros des lieux et de la route, tels que le bandeau et les fenêtres les
 * nomment, et leurs réserves (`../lieux-et-nuit/bustes.js`).
 */
import type { Reserves } from './dome.ts';
import type { Combattant, Dit, HerosDuGroupe } from './maquette.ts';

type Id = 'bjorn' | 'mira' | 'aldric' | 'greta';
const HEROS: Record<Id, { nom: string; carriere: string; blessures: number; max: number; reserves: Reserves }> = {
  bjorn: { nom: 'Bjorn', carriere: 'Chasseur', blessures: 16, max: 16, reserves: { chance: 3, resilience: 1, determination: 1 } },
  mira: { nom: 'Mira', carriere: 'Éclaireuse', blessures: 11, max: 11, reserves: { chance: 2, resilience: 2, determination: 2 } },
  aldric: { nom: 'Aldric', carriere: 'Érudit', blessures: 12, max: 12, reserves: { chance: 2, resilience: 1, determination: 1 } },
  greta: { nom: 'Greta Hartmann', carriere: 'Soldate', blessures: 8, max: 14, reserves: { chance: 1, resilience: 2, determination: 2 } },
};
const IDS: Id[] = ['bjorn', 'mira', 'aldric', 'greta'];

/** Les réserves de chaque héros. */
export const RESERVES = { bjorn: HEROS.bjorn.reserves, mira: HEROS.mira.reserves, aldric: HEROS.aldric.reserves, greta: HEROS.greta.reserves };

/** Un héros comme les fenêtres le nomment. */
const combattant = (id: Id): Combattant => ({ nom: HEROS[id].nom, buste: id, ennemi: false, blessures: HEROS[id].blessures, max: HEROS[id].max, etats: [] });
/** Les héros, et les `autres` combattants de la scène. */
export const combattants = (autres: Record<string, Combattant> = {}): Record<string, Combattant> => ({
  bjorn: combattant('bjorn'), mira: combattant('mira'), aldric: combattant('aldric'), greta: combattant('greta'), ...autres,
});

/** Le groupe du bandeau, ce que dit chaque héros ; `choisi`, le héros choisi. */
export const groupe = (dits: Partial<Record<Id, Dit>> = {}, choisi: Id | null = null): HerosDuGroupe[] => IDS.map((id) => ({
  id, nom: HEROS[id].nom, carriere: HEROS[id].carriere, blessures: HEROS[id].blessures, max: HEROS[id].max,
  ...(dits[id] ? { dit: dits[id] } : {}), ...(id === choisi ? { choisi: true } : {}),
}));
