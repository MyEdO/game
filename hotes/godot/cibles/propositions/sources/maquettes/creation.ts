/**
 * La création d'un héros (#4411), un écran à étapes (`../../heros.md`, sections `creation-*`) : Caractéristiques (LDB 05
 * l.319-464 ; méthodes l.337-341), signe astral (ADE II 03 l.36-63 ; `src/data/stars.json`), Compétences de race (LDB 05
 * l.484), Compétences de carrière (l.535), Talents (l.484, l.514-531, l.535 ; Magie mineure LDB 10 l.714), possessions
 * (l.542-583), identité (l.432, l.590, l.705-768), présentation. Vue : `src/noyau/creation/vueDeLaCreation.ts:222-413`.
 * Les étapes Race et Carrière sont les maquettes jugées (`../../../maquettes/`).
 */
import type { Acquis, Carac, CaseEnCreation, Creation, Ecran, HerosDuGroupe, HerosEnCreation, PageDesCaracteristiques, TalentTire } from './maquette.ts';

const ETAPES = ['Race', 'Carrière', 'Caractéristiques', 'Signe astral', 'Compétences de race', 'Compétences de carrière', 'Talents', 'Possessions', 'Identité', 'Présentation'];

/** Le groupe en création : le héros neuf se dessine tant qu'il n'a pas de portrait. */
const groupe = (neuf: Partial<HerosDuGroupe> = {}): HerosDuGroupe[] => [
  { id: 'bjorn', nom: 'Bjorn', carriere: 'Chasseur', blessures: 16, max: 16 },
  { id: 'mira', nom: 'Mira', carriere: 'Éclaireuse', blessures: 11, max: 11 },
  { id: 'esquisse', nom: 'Nouveau héros', carriere: 'Artiste', choisi: true, ...neuf },
];

/** Ce que le héros d'exemple a retenu aux quatre premières étapes. */
const ACQUIS: Acquis[] = [
  { rubrique: 'Race', valeur: 'Humains (Reiklander)', px: 20 },
  { rubrique: 'Carrière · Courtisans', valeur: 'Artiste', px: 50 },
  { rubrique: 'Caractéristiques', valeur: 'Jets gardés', px: 50 },
  { rubrique: 'Signe astral', valeur: 'Le Trait du Peintre', px: 25 },
];
const COMPETENCES: Acquis = { rubrique: 'Compétences', valeur: 'Six de race, huit de carrière' };
const TALENTS: Acquis = { rubrique: 'Talents', valeur: 'Six acquis' };
const POSSESSIONS: Acquis = { rubrique: 'Possessions', valeur: 'Sept', bourse: 84 };
const SUIVANT = { libelle: 'Suivant', principal: true } as const;
const heros = (acquis: Acquis[], pose: number, refus?: string): HerosEnCreation => ({ acquis, pose, geste: refus ? { ...SUIVANT, refus, survol: true } : SUIVANT });

/* ───────── les Caractéristiques ───────── */
const NOMS: [Carac, string][] = [['CC', 'Capacité de Combat'], ['CT', 'Capacité de Tir'], ['F', 'Force'], ['E', 'Endurance'], ['I', 'Initiative'], ['Ag', 'Agilité'], ['Dex', 'Dextérité'], ['Int', 'Intelligence'], ['FM', 'Force Mentale'], ['Soc', 'Sociabilité']];
/** Les dix 2d10 tirés, dans l'ordre du profil. */
const JETS = [11, 8, 7, 13, 14, 10, 16, 12, 9, 15];
const AUGMENTATIONS: Partial<Record<Carac, number>> = { F: 0, I: 2, Dex: 3 };
const HUMAINS = 20;
/** Le profil quand chaque Caractéristique porte `porte`, aux dés ou en points. */
const profil = (porte: number[], en: 'de' | 'points'): CaseEnCreation[] => {
  const cases = NOMS.map(([carac, nom], k): CaseEnCreation => ({ carac, nom, [en]: porte[k], valeur: porte[k] + HUMAINS + (AUGMENTATIONS[carac] ?? 0), ...(carac in AUGMENTATIONS ? { augmentations: AUGMENTATIONS[carac] } : {}) }));
  const bonus = (c: Carac) => Math.floor(cases.find((x) => x.carac === c)!.valeur / 10);
  return [{ carac: 'M', nom: 'Mouvement', valeur: 4, origine: 'Humains' }, ...cases, { carac: 'B', nom: 'Blessures', valeur: bonus('F') + 2 * bonus('E') + bonus('FM'), origine: 'calculé' }];
};
/** Les répartitions de l'étape, sur le profil `p`. */
const repartitions = (p: CaseEnCreation[]): PageDesCaracteristiques['repartitions'] => {
  const valeur = (c: Carac) => p.find((x) => x.carac === c)!.valeur;
  return [
    { rubrique: 'Augmentations de carrière', note: 'Artiste Apprentie', reste: { n: 0, sur: 5 }, lignes: [
      { carac: 'F', nom: 'Force', augmentations: { n: 0, sur: 5 }, valeur: valeur('F') },
      { carac: 'I', nom: 'Initiative', augmentations: { n: 2, sur: 5 }, valeur: valeur('I') },
      { carac: 'Dex', nom: 'Dextérité', augmentations: { n: 3, sur: 5 }, valeur: valeur('Dex') }] },
    { rubrique: 'Destin et Résilience', note: 'Humains : 2 et 1', reste: { n: 0, sur: 3 }, lignes: [
      { nom: 'Destin', augmentations: { n: 1, sur: 3 }, valeur: 3 },
      { nom: 'Résilience', augmentations: { n: 2, sur: 3 }, valeur: 3 }] },
  ];
};
const METHODES: PageDesCaracteristiques['methodes'] = [{ id: 'garder', nom: 'Garder les jets', px: 50 }, { id: 'reassigner', nom: 'Réassigner les jets', px: 25 }, { id: 'points', nom: 'Répartir 100 points' }];
const DEXTERITE = 'Elle indique votre capacité à accomplir des tâches manuelles délicates telles que jouer d\'un instrument de musique ou confectionner habilement des objets. Elle vous aide aussi pour les tours de passe-passe ou pour faire les poches.';
const FAITS = [{ rubrique: 'Blessures', valeur: 'BF + (2 × BE) + BFM' }, { rubrique: 'Chance, Détermination', valeur: 'Destin, Résilience' }];
const caracteristiques = (nom: string, methode: PageDesCaracteristiques['methode'], porte: number[], retenu: Acquis, refus?: string): Creation => {
  const p = profil(porte, methode === 'points' ? 'points' : 'de');
  const reassignes = methode === 'reassigner' ? { jets: JETS.map((de) => ({ de, carac: NOMS[porte.indexOf(de)][0] })) } : { texte: DEXTERITE };
  const points = methode === 'points' ? { points: { reste: { n: 100 - porte.reduce((a, b) => a + b, 0), sur: 100 }, min: 4, max: 18 } } : {};
  return {
    nom, gabarit: 'fiche', etapes: ETAPES, rang: 3,
    page: { etape: 'caracteristiques', methodes: METHODES, methode, ...points, espece: { nom: 'Humains', valeur: HUMAINS }, profil: p, pressee: 'Dex', ...reassignes, faits: FAITS, repartitions: repartitions(p) },
    heros: heros([...ACQUIS.slice(0, 2), retenu], 0.3, refus), groupe: groupe(),
  };
};

const MINEURS = ['Alerte', 'Amitié animale', 'Bruits', 'Choc', 'Conservation', 'Coup de vent', 'Créer un petit animal', 'Drain', 'Éblouissant', 'En catimini', 'Feux follets', 'Flamme magique', 'Fléchette', 'Lumière', 'Murmures', 'Pas léger', 'Protection contre la pluie', 'Purification de l\'eau', 'Putréfaction', 'Repères', 'Secousse', 'Serrure ouverte', 'Sommeil', 'Source', 'Tendre l\'oreille'];
const RETENUS = ['Fléchette', 'Lumière', 'Sommeil'];
const TIRAGE_FIN = { de: 99, nom: 'Vivacité' };
const talents = (nom: string, deuxieme: TalentTire, sorciere: boolean): Creation => ({
  nom, gabarit: 'fiche', etapes: ETAPES, rang: 7,
  page: {
    etape: 'talents',
    race: { acquis: ['Destinée'], auChoix: [{ nom: 'Affable' }, { nom: 'Perspicace', choisie: true }] },
    tirages: [{ de: 15, nom: 'Artiste', precision: 'Peinture', utilisation: true }, deuxieme, TIRAGE_FIN],
    carriere: sorciere
      ? [{ nom: 'Harmonisation aethyrique' }, { nom: 'Lire/Écrire' }, { nom: 'Magie mineure', choisie: true }, { nom: 'Seconde vue' }]
      : [{ nom: 'Artiste', precision: 'Au choix' }, { nom: 'Infatigable', choisie: true }, { nom: 'Persévérant' }, { nom: 'Vivacité', refus: 'Maxi atteint', survol: true }],
    page: sorciere
      ? { talent: 'Magie mineure', niveau: 'Sorcière novice', reste: { n: 0, sur: 3 }, refus: 'Plus rien à répartir.',
        sorts: MINEURS.map((s) => (RETENUS.includes(s) ? { nom: s, retenu: true } : s === 'Tendre l\'oreille' ? { nom: s, survol: true } : { nom: s })),
        texte: 'Quand vous prenez ce Talent, vous pratiquez, et mémorisez de façon permanente, un nombre de Sorts égal à votre Bonus de Force Mentale.' }
      : { talent: 'Infatigable', icone: 'poing', niveau: 'Artiste Apprentie', maxi: 'Bonus de Force', tests: 'Ramer et Natation',
        texte: 'Vous avez l\'échine solide, rompue au dur labeur. Vous pouvez ajouter vos Niveaux d\'Infatigable à votre DR dans tous les Tests opposés de Force et vous pouvez porter un nombre de Points supplémentaires d\'Encombrement équivalent à votre Niveau d\'Infatigable.' },
  },
  heros: heros([...(sorciere ? [ACQUIS[0], { rubrique: 'Carrière · Lettrés', valeur: 'Sorcière', px: 50 }, ...ACQUIS.slice(2)] : ACQUIS), COMPETENCES, TALENTS], 0.7),
  groupe: groupe(sorciere ? { carriere: 'Sorcière' } : {}),
});

export default {
  etats: [
    caracteristiques('creation-caracteristiques', 'garder', JETS, ACQUIS[2]),
    caracteristiques('creation-caracteristiques-reassigner', 'reassigner', [9, 8, 7, 13, 14, 10, 16, 12, 11, 15], { rubrique: 'Caractéristiques', valeur: 'Jets réassignés', px: 25 }),
    caracteristiques('creation-caracteristiques-points', 'points', [9, 8, 7, 13, 14, 10, 16, 10, 4, 5], { rubrique: 'Caractéristiques', valeur: 'Cent points répartis' }, 'Répartition des 100 Points : total 96/100 Points.'),
    {
      nom: 'creation-signe-astral', gabarit: 'fiche', etapes: ETAPES, rang: 4,
      page: {
        etape: 'signe', tirage: { de: 13, px: 25 }, tenu: 'Le Trait du Peintre',
        signes: ['Wymund l\'Anachorète', 'La Grande Croix', 'Le Trait du Peintre', 'Gnuthus le Buffle', 'Dragomas le Dragon', 'Le Crépuscule', 'Le Fourreau de Grungni', 'Mammit le Sage', 'Mummit le Fou', 'Les Deux Bœufs',
          'Le Danseur', 'Le Tambour', 'Le Flûtiste', 'Vobist le Pâle', 'La Charrette Brisée', 'La Chèvre Sauvage', 'Le Chaudron de Rhya', 'Cackelfax le Coq', 'La Scie à Os', 'L\'Étoile du Sorcier'],
        variantes: [{ d10: '1-3', nom: 'Sixième sens' }, { d10: '4-6', nom: 'Seconde vue' }, { d10: '7-9', nom: 'Magie mineure' }, { d10: '10', nom: 'Sorcier !' }],
        page: {
          constellation: 'Signe de la Précision', classique: 'Verros', dates: '9 nachhexen – 28 nachhexen', ciel: 'un archer bandant son arc',
          attributs: [{ carac: 'CT', valeur: 2 }, { carac: 'Ag', valeur: 2 }, { carac: 'CC', valeur: -3 }],
          texte: 'Les natifs du Trait du Peintre sont faits pour devenir poètes, peintres, sculpteurs... Des artistes de toutes sortes. Ils créent de la beauté partout où ils vont, et même ceux qui, au gré des aléas de l\'existence, ne se retrouvent pas à exercer dans un domaine artistique, trouvent le moyen de faire de l\'œuvre de leur vie une sorte d\'art.',
        },
      },
      heros: heros(ACQUIS, 0.42), groupe: groupe(),
    },
    {
      nom: 'creation-competences-de-race', gabarit: 'fiche', etapes: ETAPES, rang: 5,
      page: {
        etape: 'competencesDeRace', espece: 'Humains (Reiklander)',
        paliers: [{ palier: 5, pris: { n: 3, sur: 3 } }, { palier: 3, pris: { n: 2, sur: 3 } }],
        competences: [
          { carac: 'FM', base: 29, nom: 'Calme', palier: 3 }, { carac: 'Soc', base: 35, nom: 'Charme', palier: 5 }, { carac: 'Soc', base: 35, nom: 'Commandement', palier: 0 },
          { carac: 'CC', base: 28, nom: 'Corps à corps', precision: 'Base', palier: 0 }, { carac: 'Int', base: 37, nom: 'Évaluation', palier: 5 },
          { carac: 'Int', base: 37, nom: 'Langue', precision: 'Bretonnien', palier: 0 }, { carac: 'Int', base: 37, nom: 'Langue', precision: 'Wastelander', palier: 0 },
          { carac: 'Soc', base: 35, nom: 'Marchandage', palier: 3 }, { carac: 'CT', base: 30, nom: 'Projectiles', precision: 'Arc', palier: 0 }, { carac: 'Soc', base: 35, nom: 'Ragot', palier: 5 },
          { carac: 'Int', base: 37, nom: 'Savoir', precision: 'Reikland', palier: 0 }, { carac: 'Int', base: 37, nom: 'Soin aux animaux', palier: 0 }],
      },
      heros: heros([...ACQUIS, { rubrique: 'Compétences de race', valeur: { n: 5, sur: 6 } }], 0.5, 'Encore une Compétence de race à +3.'), groupe: groupe(),
    },
    {
      nom: 'creation-competences-de-carriere', gabarit: 'fiche', etapes: ETAPES, rang: 6,
      page: {
        etape: 'competencesDeCarriere', niveau: 'Artiste Apprentie', reste: { n: 6, sur: 40 },
        competences: [
          { carac: 'Dex', nom: 'Art', precision: 'Peinture', augmentations: { n: 10, sur: 10 }, race: 0, test: 49, pressee: true },
          { carac: 'FM', nom: 'Calme', augmentations: { n: 4, sur: 10 }, race: 3, test: 36 },
          { carac: 'Ag', nom: 'Discrétion', precision: 'Urbaine', augmentations: { n: 2, sur: 10 }, race: 0, test: 34 },
          { carac: 'Int', nom: 'Évaluation', augmentations: { n: 5, sur: 10 }, race: 5, test: 47 },
          { carac: 'I', nom: 'Perception', augmentations: { n: 5, sur: 10 }, race: 0, test: 46 },
          { carac: 'Soc', nom: 'Ragot', augmentations: { n: 4, sur: 10 }, race: 5, test: 44 },
          { carac: 'E', nom: 'Résistance', augmentations: { n: 2, sur: 10 }, race: 0, test: 35 },
          { carac: 'E', nom: 'Résistance à l\'alcool', augmentations: { n: 2, sur: 10 }, race: 0, test: 35 }],
        page: {
          carac: { nom: 'Dextérité', valeur: 39 },
          specialisations: ['Calligraphie', 'Cartographie', 'Écriture', 'Gravure', 'Icones', 'Mosaïque', 'Peinture', 'Sculpture', 'Tatouage', 'Tissage', 'Boucherie', 'Rédaction', 'Dessin'],
          texte: ['Créez des œuvres d\'art avec le moyen d\'expression de votre choix.', 'Ne pas avoir accès aux Outils de la profession appropriés entraînera une pénalité à vos Tests. Le DR obtenu détermine la qualité de l\'œuvre finale.'],
        },
      },
      heros: heros([...ACQUIS, { rubrique: 'Compétences de race', valeur: 'Six augmentées' }, { rubrique: 'Compétences de carrière', valeur: { n: 34, sur: 40 } }], 0.6, 'Six Augmentations restent à répartir.'), groupe: groupe(),
    },
    talents('creation-talents', { de: 24, nom: 'Chanceux' }, false),
    talents('creation-talents-doublon', { de: 68, nom: 'Perspicace', doublon: { raison: 'Maxi atteint : sans effet si gardé', relance: 'Relancer Perspicace' } }, false),
    talents('creation-talents-sorts-mineurs', { de: 24, nom: 'Chanceux' }, true),
    {
      nom: 'creation-possessions', gabarit: 'fiche', etapes: ETAPES, rang: 8,
      page: {
        etape: 'possessions',
        bourse: { de: 7, somme: 84, statut: 'Argent 1', formule: '1d10 pistoles d\'argent × Standing' },
        auChoix: { niveau: 'Artiste Apprentie', options: [{ nom: 'Pinceau', precision: 'brosse', choisie: true }, { nom: 'Ciseau' }, { nom: 'Plume d\'oie' }] },
        dotations: [
          { rubrique: 'Dotation des Courtisans', objets: [{ nom: 'Vêtements', precision: 'costume luxueux', note: 'Raffiné' }, { nom: 'Dague' }, { nom: 'Bourse' }, { nom: 'Pince à épiler' }, { nom: 'Cure-oreille', nombre: 2 }, { nom: 'Peigne' }] },
          { rubrique: 'Dotation de l\'Artiste Apprentie', objets: [{ nom: 'Pinceau', precision: 'brosse', note: 'Choisi' }] }],
        bagage: [
          { id: 'costume', nom: 'Vêtements', note: 'Raffiné' }, { id: 'dague', nom: 'Dague' }, { id: 'bourse', nom: 'Bourse', somme: 84 }, { id: 'pinceau', nom: 'Pinceau', note: 'Au choix', choisi: true },
          { id: 'pince', nom: 'Pince à épiler' }, { id: 'cure', nom: 'Cure-oreille', nombre: 2 }, { id: 'peigne', nom: 'Peigne' }],
        pris: { icone: 'palette', nom: 'Pinceau (brosse)', sous: 'Outils et nécessaires · Encombrement 0', prix: 48 },
      },
      heros: heros([...ACQUIS, COMPETENCES, TALENTS, POSSESSIONS], 0.8), groupe: groupe(),
    },
    {
      nom: 'creation-identite', gabarit: 'fiche', etapes: ETAPES, rang: 9,
      page: {
        etape: 'identite', sexe: { valeurs: ['Masculin', 'Féminin'], tenue: 1 }, nom: 'Astrid Altdorfer',
        physique: [{ de: 8, nom: 'Âge', formule: '15 + d10', valeur: '23 ans' }, { de: 27, nom: 'Taille', formule: '145 + 5d10', valeur: '172 cm' }, { de: 16, nom: 'Yeux', formule: '2d10', valeur: 'Marron' }, { de: 13, nom: 'Cheveux', formule: '2d10', valeur: 'Brun foncé' }],
        ecrits: [{ nom: 'Motivation', texte: 'Peindre ce que nul n’ose regarder', saisi: true }, { nom: 'Ambition à court terme', texte: 'Trouver un mécène à Altdorf' }, { nom: 'Ambition à long terme', texte: 'Voir une de ses toiles au palais impérial' }],
        espece: 'Humains (Reiklander)', carriere: 'Artiste Apprentie', marque: 'palette',
      },
      heros: { ...heros([...ACQUIS, COMPETENCES, TALENTS, POSSESSIONS], 0.9), nom: 'Astrid Altdorfer' }, groupe: groupe({ nom: 'Astrid Altdorfer' }),
    },
    {
      nom: 'creation-presentation', gabarit: 'fiche', etapes: ETAPES, rang: 10,
      page: {
        etape: 'presentation', buste: 'astrid', nom: 'Astrid Altdorfer', espece: 'Humains (Reiklander)', carriere: 'Artiste Apprentie', classe: 'Courtisans',
        physique: [{ rubrique: 'Âge', valeur: '23 ans' }, { rubrique: 'Taille', valeur: '172 cm' }, { rubrique: 'Yeux', valeur: 'Marron' }, { rubrique: 'Cheveux', valeur: 'Brun foncé' }],
        blessures: { n: 10, sur: 10 },
        reserves: [{ nom: 'Destin', valeur: 3 }, { nom: 'Chance', valeur: 4 }, { nom: 'Résilience', valeur: 3 }, { nom: 'Détermination', valeur: 3 }],
        signe: 'Le Trait du Peintre', statut: 'Argent 1', bourse: 84, motivation: 'Peindre ce que nul n’ose regarder',
        profil: ([['M', 4], ['CC', 28], ['CT', 30], ['F', 27], ['E', 33], ['I', 41], ['Ag', 32], ['Dex', 39], ['Int', 37], ['FM', 29], ['Soc', 35], ['B', 10]] as [Carac, number][]).map(([carac, valeur]) => ({ carac, valeur })),
        competences: [
          { carac: 'Dex', nom: 'Art', precision: 'Peinture', valeur: 49 }, { carac: 'FM', nom: 'Calme', valeur: 37 }, { carac: 'Soc', nom: 'Charme', valeur: 40 },
          { carac: 'Ag', nom: 'Discrétion', precision: 'Urbaine', valeur: 37 }, { carac: 'Int', nom: 'Évaluation', valeur: 47 }, { carac: 'Int', nom: 'Langue', precision: 'Bretonnien', valeur: 40 },
          { carac: 'Soc', nom: 'Marchandage', valeur: 38 }, { carac: 'I', nom: 'Perception', valeur: 46 }, { carac: 'Soc', nom: 'Ragot', valeur: 45 },
          { carac: 'E', nom: 'Résistance', valeur: 36 }, { carac: 'E', nom: 'Résistance à l\'alcool', valeur: 35 }],
        talents: ['Artiste (Peinture)', 'Chanceux', 'Destinée', 'Infatigable', 'Perspicace', 'Vivacité'],
      },
      heros: {
        nom: 'Astrid Altdorfer', pose: 1, palette: true, geste: { libelle: 'Engager', principal: true },
        acquis: [{ rubrique: 'Race tirée au d100', valeur: 'Humains (Reiklander)', px: 20 }, { rubrique: 'Carrière tirée au d100', valeur: 'Artiste', px: 50 }, { rubrique: 'Caractéristiques', valeur: 'Jets gardés', px: 50 }, { rubrique: 'Signe tiré au d100', valeur: 'Le Trait du Peintre', px: 25 }, { rubrique: 'PX de création', px: 145 }],
      },
      groupe: groupe({ id: 'astrid', nom: 'Astrid Altdorfer', blessures: 10, max: 10 }),
    },
  ],
} satisfies Ecran;
