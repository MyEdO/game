/**
 * L'exploration (#4411) : la salle commune de La Diligence, ce qui y est à portée du groupe et les gestes que la
 * situation ouvre (LDB 12 l.200, LDB 15 l.55, LDB 18 l.296-298), sous les trois regards que le jeu supporte (#3935) :
 * le décor change, pas les pièces (`../../exploration-et-recit.md`, section `exploration`).
 */
import { combattants, groupe } from './compagnie.ts';
import type { ChoseDeLaScene, Combattant, Ecran, Exploration, LigneDuJournal, Regard, TitreDuLieu } from './maquette.ts';

/** La salle commune de La Diligence. */
export const LA_DILIGENCE: TitreDuLieu = { nom: 'La Diligence', sous: 'Auberge-relais · salle commune' };
/** Le journal de la soirée, la ligne neuve à part. */
export const SOIREE: LigneDuJournal[] = [{ moment: 'Le soir, à La Diligence' }, 'Le groupe entre dans la salle commune.'];
/** L'aubergiste, à qui l'on parle. */
export const GUSTAV: Combattant = { nom: 'Gustav Fondleburger', buste: 'gustav', ennemi: false, blessures: 12, max: 12, etats: [] };
/** Le groupe, Mira en tête. */
export const MIRA_MENE = groupe({ mira: { attend: 'Mène le groupe' } }, 'mira');

/** Ce qui est à portée dans la salle (`usable.*`, `arete.*`, `src/i18n/messages/fr.ts`). */
const CHOSES = {
  porte: { id: 'porte', nom: 'Porte de la cour', geste: { id: 'franchir', libelle: 'Sortie extérieure' } },
  cocher: { id: 'cocher', nom: 'Le cocher', geste: { id: 'parler', libelle: 'Parler' } },
  cliente: { id: 'cliente', nom: 'La voyageuse', geste: { id: 'parler', libelle: 'Parler' } },
  coffre: { id: 'coffre', nom: 'Coffre', geste: { id: 'fouiller', libelle: 'Fouiller' } },
  dague: { id: 'dague', nom: 'Dague', geste: { id: 'ramasser', libelle: 'Ramasser' }, survolee: 'Posée au sol. Mira, qui mène le groupe, la prendra.' },
  croisee: { id: 'croisee', nom: 'Croisée', geste: { id: 'enjamber', libelle: 'Enjamber la fenêtre' }, signalee: true },
} satisfies Record<string, ChoseDeLaScene>;

/** La salle sous le regard `regard`, ce qui y est à portée, la ligne neuve du journal. */
const salle = (nom: string, regard: Regard, choses: ChoseDeLaScene[], neuve: string, gestes: boolean): Exploration => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'salle', titre: LA_DILIGENCE, regard, choses,
  ...(gestes ? { gestes: [{ id: 'soigner', libelle: 'Soigner' }, { id: 'reposer', libelle: 'Se reposer' }, { id: 'fouiller', libelle: 'Fouiller la pièce' }] } : {}),
  ouvrir: [{ id: 'carte', libelle: 'Carte du monde' }, ...(gestes ? [{ id: 'carnet' as const, libelle: 'Carnet d’enquête' }] : [])],
  journal: [...SOIREE, neuve], retour: 'Le lieu', combattants: combattants(), groupe: MIRA_MENE,
});
const FOUILLE = 'Le groupe fouille la pièce.';

export default {
  etats: [
    {
      ...salle('exploration', 'tactique', [CHOSES.porte, CHOSES.cocher, CHOSES.coffre,
        { id: 'gustav', nom: 'Gustav Fondleburger', geste: { id: 'parler', libelle: 'Parler' }, survolee: 'Le propriétaire, derrière son comptoir.' },
        { id: 'avis', nom: 'Avis placardé', geste: { id: 'lire', libelle: 'Lire' }, signalee: true }], 'Un avis est placardé près du comptoir.', false),
      marcheVers: 'gustav',
    },
    salle('exploration-gestes', 'tactique', [CHOSES.porte, CHOSES.cocher, CHOSES.coffre, CHOSES.dague, CHOSES.croisee], FOUILLE, true),
    salle('exploration-dessus', 'plateau', [CHOSES.porte, CHOSES.cocher, CHOSES.coffre, CHOSES.dague, CHOSES.croisee], FOUILLE, true),
    salle('exploration-premiere-personne', 'immersion', [CHOSES.porte, CHOSES.cliente, CHOSES.dague], FOUILLE, true),
  ],
} satisfies Ecran;
