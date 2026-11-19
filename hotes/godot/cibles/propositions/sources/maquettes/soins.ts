/**
 * Les soins (#4411) : la page des services du quartier ouverte sur le médecin. Le docteur de la guilde dans son
 * cabinet, le patient choisi au bandeau, les actes et leur prix, la bourse du patient (LDB 09 l.256-269, LDB 75 l.19)
 * (`../../lieux-et-nuit.md`, section `soins`).
 */
import { BOURSES, groupe } from './compagnie.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'services-du-lieu-medecin', gabarit: 'lieu-et-voyage', decor: 'cabinet',
    titre: { nom: 'Guilde des Médecins', sous: 'Teuerberg, Bögenhafen' },
    rail: {
      titre: 'Services de Teuerberg', ouvert: 'medecins', pied: 'On passe de l’un à l’autre sans ressortir',
      services: [{ id: 'auberge', nom: 'La Fin du Voyage' }, { id: 'taverne', nom: 'Les Piques croisées' }, { id: 'joailliers', nom: 'Guilde des Joailliers' }, { id: 'medecins', nom: 'Guilde des Médecins' }, { id: 'guet', nom: 'Caserne du Guet' }],
    },
    hote: { icone: 'soin', nom: 'Le docteur de la guilde', qualite: 'Docteur en médecine', competence: { nom: 'Guérison', seuil: 62 }, dit: 'Asseyez-vous sous la fenêtre et montrez-moi cela. Et ne bougez plus.' },
    patient: { qui: 'greta', mal: 'Cuisse lacérée, jambe gauche : la plaie attend d’être recousue.' },
    actes: [
      { id: 'soin', nom: 'Panser les Blessures', test: 'Guérison', texte: 'Lui rend le Bonus d’Intelligence du docteur, plus ses degrés de réussite.', prix: 60, prise: true },
      { id: 'scalpel', nom: 'Recoudre la cuisse lacérée', test: 'Chirurgie', texte: 'Longue opération : chaque passe lui coûte 1d10 Blessures et une Hémorragie.', prix: 180, maison: true }],
    aPayer: 60, avoir: BOURSES.greta,
    action: 'Payer et soigner',
    retour: 'Retour au quartier',
    groupe: groupe({ greta: { texte: 'Cuisse lacérée, à recoudre', mal: true } }, 'greta'),
  }],
} satisfies Ecran;
