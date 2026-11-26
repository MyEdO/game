/**
 * L'ÉDITEUR DE CAMPAGNE (#4411) : son cadre commun aux deux documents, le projet de La Diligence, ses documents, les
 * gestes de sa barre ; sa validation (`src/hote/editeur.ts:190-689`). Pas d'écran : `editeur-de-scene.ts` et
 * `editeur-carte-du-monde.ts` le composent.
 */
import type { Editeur } from './maquette.ts';

/** Le projet, ses documents, les gestes de la barre par groupe. */
export const CADRE: Pick<Editeur, 'projet' | 'documents' | 'gestes'> = {
  projet: { nom: 'Éditeur de campagne', sous: 'L’Ennemi Intérieur — chapitre 1 : la route d’Altdorf' },
  documents: ['Scène', 'Carte du monde', 'Narratif'],
  gestes: [
    [{ id: 'annuler', libelle: 'Annuler' }, { id: 'refaire', libelle: 'Rétablir', ferme: true }],
    [{ id: 'copier', libelle: 'Copier' }, { id: 'coller', libelle: 'Coller', ferme: true }, { id: 'dupliquer', libelle: 'Dupliquer' }],
    [{ id: 'disque', libelle: 'Enregistrer' }, { id: 'jouer', libelle: 'Tester la scène', principal: true }],
  ],
};

/** La validation du projet, sans défaut. */
export const VALIDATION = 'Aucun défaut détecté. Contrôlé : réfs de logique (déclencheurs, dialogues, rencontres, entités, carte du monde), architecture (corps, étages, façades, toitures).';
