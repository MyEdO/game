/**
 * L'ACCUEIL d'un hôte (#3009) : ses entrées en zone, avant toute partie.
 */
import { t, type MsgKey } from '../i18n';
import type { Stockage } from '../lib/stockage';
import type { Bouton, EntreeDeLAccueil } from './elements';
import { AUTO_SLOT, SAVE_SLOTS, lireLaSauvegarde } from './sauvegardes';

/**
 * @contrat Vue
 * La zone de l'accueil, que la méthode `accueil` rend.
 */
export interface ZonesDeLAccueil {
  /**
   * « Jouer », « Reprendre », « Combat », « Atelier » et « Éditeur », dont le `jeu` `{ accueil }` nomme l'entrée que
   * l'hôte suit (`EntreeDeLAccueil`), puis « Options », dont le `jeu` `{ reglages: true }` ouvre le panneau des
   * réglages. « Reprendre » est refusé quand aucun emplacement du stockage ne porte de sauvegarde.
   */
  'accueil.gestes': Bouton[];
}

const LIBELLES = {
  jouer: 'ecran.accueil.jouer',
  reprendre: 'ecran.accueil.reprendre',
  combat: 'ecran.accueil.combat',
  atelier: 'ecran.accueil.atelier',
  editeur: 'ecran.accueil.editeur',
} as const satisfies Record<EntreeDeLAccueil, MsgKey>;

/** La zone de l'accueil sur `stockage`. */
export function zonesDeLAccueil(stockage: Stockage | null): ZonesDeLAccueil {
  const aReprendre = [AUTO_SLOT, ...SAVE_SLOTS].some((slot) => lireLaSauvegarde(stockage, slot) !== null);
  const refus: Partial<Record<EntreeDeLAccueil, string>> = aReprendre ? {} : { reprendre: t('ecran.accueil.reprendre.aucune') };
  return {
    'accueil.gestes': [
      ...(Object.keys(LIBELLES) as EntreeDeLAccueil[]).map((entree): Bouton => ({ type: 'bouton', id: entree, libelle: t(LIBELLES[entree]), jeu: { accueil: entree }, presse: false, focus: false, refus: refus[entree] ?? null })),
      { type: 'bouton', id: 'reglages', libelle: t('ecran.partie.reglages'), jeu: { reglages: true }, presse: false, focus: false, refus: null },
    ],
  };
}
