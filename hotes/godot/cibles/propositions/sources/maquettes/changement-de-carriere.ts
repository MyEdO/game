/**
 * Le changement de carrière (#4411), au gabarit de la fiche (`../../heros.md`, section
 * `progression-changement-de-carriere`) : LDB 07 l.118-148 ; `validateCareerChange`, `src/engine/advancement.ts:185-205`
 * (le refus de la station hors d'atteinte est son texte) ; saut de niveau, règle optionnelle `progression-saut-de-niveau`
 * (`src/data/reglesOptionnelles.json:818` ; LDB 07 l.140, l.148).
 */
import type { ChangementDeCarriere, Ecran } from './maquette.ts';

const IDENTITE: ChangementDeCarriere['identite'] = {
  id: 'ilyanwe', nom: 'Ilyanwe la Voilée', espece: 'Hauts elfes', niveau: 'Sorcière', classe: 'Lettrés', rang: 2, px: 180, acheve: true, note: 'Changer coûte 100 PX.',
  exigences: [{ texte: 'Dix Augmentations en CC, Ag, Int et FM', fait: true, compte: { n: 4, sur: 4 } }, { texte: 'Dix dans huit Compétences', fait: true, compte: { n: 8, sur: 8 } }, { texte: 'Un Talent du niveau', fait: true }],
};
const PASSEES: ChangementDeCarriere['chemin']['stations'] = [
  { nom: 'Sorcière novice', niveau: 1, statut: 'Bronze 3', etat: 'faite', px: 100 },
  { nom: 'Sorcière', niveau: 2, statut: 'Argent 3', tenu: true, acheve: true, etat: 'faite' },
];
const CLASSES = [['ville', 'Citadins'], ['couronne', 'Courtisans'], ['epee', 'Guerriers'], ['route', 'Itinérants'], ['livre', 'Lettrés'], ['ancre', 'Riverains'], ['masque', 'Roublards'], ['epi', 'Ruraux']];
/** Les Classes, celle du héros à 100 PX ; `saut` : les autres se ferment. */
const classes = (saut: boolean) => CLASSES.map(([id, nom]) => (nom === 'Lettrés' ? { id, nom, px: 100, choisie: true as const } : { id, nom, px: 200, ...(saut ? { fermee: true as const } : {}) }));
const CARRIERES = ['Apothicaire', 'Érudit', 'Ingénieur', 'Juriste', 'Médecin', 'Nonne', 'Prêtre'];
const GROUPE = [
  { id: 'ilyanwe', nom: 'Ilyanwe la Voilée', carriere: 'Sorcière', blessures: 17, max: 17, choisi: true as const },
  { id: 'berta', nom: 'Berta', carriere: 'Soldate', blessures: 12, max: 12 },
];

export default {
  etats: [
    {
      nom: 'progression-changement-de-carriere', gabarit: 'fiche', identite: IDENTITE,
      chemin: { carriere: 'Sorcier', classe: 'Lettrés', stations: [...PASSEES,
        { nom: 'Maîtresse Sorcière', niveau: 3, statut: 'Or 1', etat: 'visee', px: 100 },
        { nom: 'Dame sorcière', niveau: 4, statut: 'Or 2', etat: 'loin', refus: 'Un niveau à la fois : devenir d’abord Maîtresse Sorcière', survol: true }] },
      vise: {
        ruban: 'Niveau suivant', nom: 'Maîtresse Sorcière', carriere: 'Sorcier', niveau: 3, statut: 'Or 1',
        ouvre: [{ rubrique: 'Caractéristique', noms: ['Initiative'] }, { rubrique: 'Compétences', noms: ['Chevaucher (Cheval)', 'Évaluation', 'Savoir (Guerre)', 'Soin aux animaux'] },
          { rubrique: 'Talents', noms: ['Diction instinctive', 'Maniement de deux armes', 'Menaçant', 'Perception de la magie'] }, { rubrique: 'Dotation', noms: ['Apprenti', 'Cheval de guerre léger', 'Objet magique'] }],
        note: 'Ce que les niveaux passés ont ouvert le reste, hormis leurs Talents.', geste: 'Devenir Maîtresse Sorcière', px: 100,
      },
      autre: { classes: classes(false), carrieres: CARRIERES.map((nom) => ({ nom })), note: 'Hors de sa Classe, le changement coûte 100 PX de plus.' },
      groupe: GROUPE,
    },
    {
      nom: 'progression-changement-de-carriere-saut', gabarit: 'fiche', identite: IDENTITE,
      chemin: { carriere: 'Sorcier', classe: 'Lettrés', stations: [...PASSEES,
        { nom: 'Maîtresse Sorcière', niveau: 3, statut: 'Or 1', etat: 'ouverte', px: 100 },
        { nom: 'Dame sorcière', niveau: 4, statut: 'Or 2', etat: 'ouverte', px: 100 }] },
      vise: {
        ruban: 'Autre carrière, même niveau', nom: 'Érudite', carriere: 'Érudit', niveau: 2, statut: 'Argent 2',
        ouvre: [{ rubrique: 'Caractéristique', noms: ['Initiative'] }, { rubrique: 'Compétences', noms: ['Art (Écriture)', 'Intuition', 'Langue (Au choix)', 'Métier (Au choix)', 'Perception', 'Savoir (Au choix)'] },
          { rubrique: 'Talents', noms: ['Affable', 'Lecture rapide', 'Savoir-vivre (Érudits)', 'Studieux'] }, { rubrique: 'Dotation', noms: ['Accès à une bibliothèque', 'Diplôme'] }],
        note: 'Le niveau tenu est achevé, la carrière est de sa Classe.', geste: 'Devenir Érudite', px: 100,
      },
      autre: { classes: classes(true), carrieres: CARRIERES.map((nom) => (nom === 'Érudit' ? { nom, choisie: true as const } : { nom })), arrivee: { valeurs: ['Premier niveau', 'Même niveau'], tenue: 1 }, note: 'Au même niveau : dans sa Classe seulement, niveau achevé.' },
      groupe: GROUPE,
    },
  ],
} satisfies Ecran;
