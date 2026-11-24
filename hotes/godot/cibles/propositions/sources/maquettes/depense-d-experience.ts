/**
 * La dépense d'expérience (#4411), au gabarit de la fiche (`../../heros.md`, section `progression-depense-d-experience`) :
 * coûts LDB 07 l.51-56, hors carrière l.91, Talent l.105, achèvement l.124-131, niveau suivant l.137, autre carrière
 * l.118 et l.144 ; emplacement « (Au choix) » LDB 09 l.38 ; Sorts LDB 10 l.680-696, l.714-722, composant LDB 46
 * l.107-113. Vue `src/noyau/monde/advancement.ts:143-317`, `src/engine/grimoire.ts:176-193`.
 */
import type { Carac, CompetenceAAugmenter, DepenseDExperience, Ecran, IdentiteQuiProgresse } from './maquette.ts';

const CARACS: Carac[] = ['M', 'CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc', 'B'];
/** Le profil : chaque case [valeur, Augmentations, prix de la suivante, de la carrière]. */
const profil = (cases: [number, number?, number?, true?][]): DepenseDExperience['profil'] => cases.map(([valeur, augmentations, px, carriere], k) => ({
  carac: CARACS[k], valeur, ...(augmentations ? { augmentations } : {}), ...(px ? { px } : {}), ...(carriere ? { carriere } : {}) }));
const GROUPE = [
  { id: 'ilyanwe', nom: 'Ilyanwe la Voilée', carriere: 'Sorcière', blessures: 17, max: 17, choisi: true as const },
  { id: 'berta', nom: 'Berta', carriere: 'Soldate', blessures: 12, max: 12 },
];
const GESTES = [{ libelle: 'Niveau suivant', refus: 'niveau actuel non complété' }, { libelle: 'Autre carrière', px: 200 }];
const NOTE = 'Niveau achevé : 100 PX. Hors de sa Classe : 100 PX de plus.';
const ILYANWE = { id: 'ilyanwe', nom: 'Ilyanwe la Voilée', espece: 'Hauts elfes', classe: 'Lettrés', gestes: GESTES, note: NOTE };
const niveau2 = (apres: number | null, talent: boolean): IdentiteQuiProgresse => ({
  ...ILYANWE, niveau: 'Sorcière', rang: 2, px: 240, ...(apres === null ? {} : { apres }),
  exigences: [{ texte: 'Dix Augmentations en CC, Ag, Int et FM', compte: { n: 0, sur: 4 } }, { texte: 'Dix dans huit Compétences', compte: { n: 1, sur: 8 } }, { texte: 'Un Talent du niveau', ...(talent ? { fait: true } : {}) }],
});
const PROFIL_2 = profil([[5], [33, 5, 25, true], [30, 0, 50], [26, 0, 50], [45, 0, 50], [62, 0, 50], [58, 0, 25, true], [52, 0, 50], [80, 6, 30, true], [70, 6, 30, true], [29, 0, 50], [17]]);
const LANGUES = ['Albionais', 'Bretonnien', 'Classique', 'Elthárin', 'Estalien', 'Ghassalli', 'Gospodarin', 'Grumbarth', 'Guilde', 'Halfling', 'Khazalid', 'Norse', 'Queekique', 'Reikspiel', 'Tiléen', 'Voleur', 'Wastelander'];
/** Les Compétences du niveau 2, l'emplacement « (Au choix) » ouvert ou non. */
const competences2 = (ouvert: boolean): CompetenceAAugmenter[] => [
  { carac: 'F', nom: 'Intimidation', augmentations: 0, test: 26, px: 10 },
  { carac: 'I', nom: 'Intuition', augmentations: 5, test: 67, px: 10 },
  { carac: 'Int', nom: 'Langue', precision: 'Au choix', augmentations: 0, test: 80, px: 10, aDesigner: true, ...(ouvert ? { pressee: true, specialisations: { noms: LANGUES, retenue: 'Bretonnien' } } : {}) },
  { carac: 'Int', nom: 'Langue', precision: 'Bataille', augmentations: 0, test: 80, px: 10 },
  { carac: 'Int', nom: 'Langue', precision: 'Magick', augmentations: 10, test: 90, px: 15, exigee: true },
];
const NOTE_DES_TALENTS = 'cent PX, et cent de plus par fois déjà pris';

export default {
  etats: [
    {
      nom: 'progression-depense-d-experience', gabarit: 'fiche',
      identite: { ...ILYANWE, niveau: 'Sorcière novice', rang: 1, px: 285, apres: 275,
        exigences: [{ texte: 'Cinq Augmentations en CC, Int et FM', compte: { n: 2, sur: 3 } }, { texte: 'Cinq dans huit Compétences', compte: { n: 6, sur: 8 } }, { texte: 'Un Talent du niveau', fait: true }] },
      profil: profil([[5], [33, 2, 25, true], [30, 0, 50], [26, 0, 50], [45, 0, 50], [62, 0, 50], [58, 0, 50], [52, 0, 50], [80, 5, 25, true], [70, 6, 30, true], [29, 0, 50], [17]]),
      competences: [
        { carac: 'CC', nom: 'Corps à corps', precision: 'Armes d\'hast', augmentations: 5, test: 38, px: 10, exigee: true },
        { carac: 'CC', nom: 'Corps à corps', precision: 'Base', augmentations: 3, test: 36, px: 10 },
        { carac: 'Ag', nom: 'Esquive', augmentations: 5, test: 63, px: 10, exigee: true },
        { carac: 'FM', nom: 'Focalisation', augmentations: 8, test: 78, px: 15, exigee: true },
        { carac: 'I', nom: 'Intuition', augmentations: 5, test: 67, px: 10, exigee: true },
        { carac: 'Int', nom: 'Langue', precision: 'Magick', augmentations: 10, test: 90, px: 15, exigee: true },
        { carac: 'I', nom: 'Perception', augmentations: 2, test: 64, px: 10, pressee: true },
        { carac: 'Int', nom: 'Savoir', precision: 'Magie', augmentations: 6, test: 86, px: 15, exigee: true }],
      horsCarriere: 6, ouvert: 'Talents',
      talents: { rubrique: 'De Sorcière novice', note: NOTE_DES_TALENTS, talents: [
        { icone: 'etoile', nom: 'Harmonisation aethyrique', sous: 'Maxi : Bonus d\'Initiative · Tests : Focalisation', px: 100 },
        { icone: 'livre', nom: 'Lire/Écrire', sous: 'Acquis · Maxi : 1', refus: 'Maxi atteint' },
        { icone: 'feu', nom: 'Magie mineure', sous: 'Acquis · Maxi : 1', refus: 'Maxi atteint' },
        { icone: 'oeil', nom: 'Seconde vue', sous: 'Acquis une fois · Maxi : Bonus d\'Initiative', px: 200 }] },
      groupe: GROUPE,
    },
    {
      nom: 'progression-depense-d-experience-creneaux', gabarit: 'fiche',
      identite: niveau2(230, false), profil: PROFIL_2, competences: competences2(true), horsCarriere: 6, ouvert: 'Talents',
      talents: { rubrique: 'De Sorcière', note: NOTE_DES_TALENTS, talents: [
        { icone: 'etoile', nom: 'Magie des Arcanes (Au choix)', sous: 'À désigner : un Domaine · Maxi : 1', px: 100 },
        { icone: 'oeil', nom: 'Détection d\'artefact', sous: 'Maxi : Bonus d\'Initiative · Tests : Intuition', px: 100 },
        { icone: 'poing', nom: 'Mains agiles', sous: 'Maxi : Bonus de Dextérité · Tests : Escamotage', px: 100 },
        { icone: 'oeil', nom: 'Sixième sens', sous: 'Maxi : Bonus d\'Initiative · Tests : Intuition', px: 100 }] },
      groupe: GROUPE,
    },
    {
      nom: 'progression-depense-d-experience-sorts', gabarit: 'fiche',
      identite: niveau2(null, true), profil: PROFIL_2,
      competences: [...competences2(false), { carac: 'I', nom: 'Perception', augmentations: 5, test: 67, px: 10 }, { carac: 'Soc', nom: 'Ragot', augmentations: 0, test: 29, px: 10 }],
      horsCarriere: 6, ouvert: 'Sorts',
      sorts: {
        listes: [
          { rubrique: 'Magie des Arcanes (Feu)', note: 'cent PX par Sort, deux cents au-delà de huit connus', sorts: [
            { nom: 'Carreau', ni: 4, composant: 48 }, { nom: 'Cautériser', ni: 4, composant: 48 }, { nom: 'Dôme', ni: 7, composant: 84 }, { nom: 'Mur de feu', ni: 6, composant: 72 },
            { nom: 'Arme aethyrique', ni: 2, px: 100 }, { nom: 'Cœurs ardents', ni: 8, px: 100 }] },
          { rubrique: 'Magie mineure', note: 'sept Sorts connus ; cinquante PX le suivant', sorts: [{ nom: 'Alerte', ni: 0, px: 50 }, { nom: 'Bruits', ni: 0, px: 50 }] }],
        bourse: { heros: 'Ilyanwe', avoir: 288 },
      },
      groupe: GROUPE,
    },
  ],
} satisfies Ecran;
