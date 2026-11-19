/**
 * La désignation d'un héros (#4411) : sur la route d'Altdorf, l'invite de la donnée posée sur le corps du voyageur, une
 * carte par héros dans la fenêtre du bas (EDO 02 l.89-91) ; aucune sortie tant qu'un héros n'est pas désigné
 * (`../../exploration-et-recit.md`, section `designation-d-un-heros`).
 */
import { combattants, groupe } from './compagnie.ts';
import type { Ecran, LigneDuJournal, TitreDuLieu } from './maquette.ts';

/** La route d'Altdorf, de nuit, et son journal. */
export const LA_ROUTE: TitreDuLieu = { nom: 'La route d’Altdorf', sous: 'Dans la forêt · la nuit' };
export const NUIT_SUR_LA_ROUTE: LigneDuJournal = { moment: 'La nuit, sur la route d’Altdorf' };
/** Le corps du voyageur, que le groupe trouve sur la route. */
export const LE_CORPS = 'Le corps du voyageur';

export default {
  etats: [{
    nom: 'designation-d-un-heros', gabarit: 'lieu-et-voyage', decor: 'grand-route', titre: LA_ROUTE,
    invite: { sur: 'corps', titre: LE_CORPS, texte: 'En retournant le cadavre, vous découvrez avec stupeur qu’il est le sosie de l’un d’entre vous. Lequel ?' },
    journal: [NUIT_SUR_LA_ROUTE, 'Mira retourne le corps du voyageur.'],
    combattants: combattants(),
    fenetre: {
      titre: 'Désigner un héros',
      centre: { role: 'choix', groupes: [{ cartes: groupe().map((h) => ({ qui: h.id, detail: [h.carriere], ...(h.id === 'aldric' ? { choisie: true as const } : {}) })) }] },
      gestes: [{ libelle: 'Désigner', principal: true }], reserves: [],
    },
  }],
} satisfies Ecran;
