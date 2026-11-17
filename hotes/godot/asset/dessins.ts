/**
 * LE CATALOGUE DES DESSINS (#3935) : par type d'élément dessiné (`icone`, `fond`, `paysage`, `src/hote/elements.ts`), le
 * cadre de ses dessins et chaque dessin de son registre par son id (`src/data/icons`, `src/data/fonds`,
 * `src/data/paysages`) ; et les cadres de panneau (`src/data/cadres`), avec les tranches de chacun. La construction le
 * dépose une fois dans le projet (`construire.mjs`, `res://art/dessins.json`) : une vue ne nomme un dessin que par
 * son id, `projet/scripts/dessin.gd` le trace ; un style du thème nomme son cadre, `projet/scripts/cadre.gd` le trace.
 */
import {
  CADRE_DES_CADRES,
  CADRE_DES_FONDS,
  CADRE_DES_ICONES,
  CADRE_DES_PAYSAGES,
  CADRES,
  COUCHES_DE_PAYSAGE,
  FONDS,
  ICON_DEFS,
} from '../../../src/noyau/index';

const dessinsDe = (registre: Record<string, { id: string; svg: string }>) => Object.fromEntries(Object.values(registre).map((d) => [d.id, d.svg]));

export const figerLesDessins = () => ({
  icone: { ...CADRE_DES_ICONES, dessins: dessinsDe(ICON_DEFS) },
  fond: { ...CADRE_DES_FONDS, dessins: dessinsDe(FONDS) },
  paysage: { ...CADRE_DES_PAYSAGES, dessins: dessinsDe(COUCHES_DE_PAYSAGE) },
  cadre: { ...CADRE_DES_CADRES, dessins: dessinsDe(CADRES), tranches: Object.fromEntries(Object.values(CADRES).map((c) => [c.id, c.tranches])) },
});
