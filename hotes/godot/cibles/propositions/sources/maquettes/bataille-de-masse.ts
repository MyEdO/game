/**
 * La bataille de masse (#4411) : le Round de bataille sur le champ devant les remparts. Les Scènes et leurs postés,
 * poster un héros, le Test spectaculaire de Puissance, l'issue (ADE II 08 l.17-32, l.112-124, l.137-177)
 * (`../../combat-suite.md`, sections `bataille-de-masse*`).
 */
import { combattants, groupe } from './compagnie.ts';
import type { Armee, BatailleDeMasse, Ecran, SceneDeBataille } from './maquette.ts';

const armees = (allies: number, ennemis: number): { allies: Armee; ennemis: Armee } => ({
  allies: { nom: 'Armée des Personnages', depart: 50, puissance: allies },
  ennemis: { nom: 'Horde ennemie', depart: 55, puissance: ennemis },
});
const TERRAIN = 'La plaine boueuse s’étend devant les remparts ; la horde dévale la pente en hurlant.';
/** Les Scènes du Round ; `visee`, celle que le joueur regarde ; `place`, le héros choisi peut s'y poster. */
const scenes = (visee: string, place = false): SceneDeBataille[] => {
  const offre = place ? { place: true as const } : {};
  const toutes: SceneDeBataille[] = [
    { id: 'pluie', nom: 'Pluie de flèches', effet: '−1/touche · −2/vaincu Puiss. ennemie', postes: [], geste: 'Engager le combat' },
    { id: 'tenez', nom: 'Tenez votre position', effet: '−2 Puiss. ennemie', rupture: { points: 0, sur: 10 }, postes: ['greta', 'bjorn'], geste: 'Résoudre', ...offre },
    { id: 'motivation', nom: 'Motivation', effet: '+1/DR Puiss. alliée', postes: ['aldric'], geste: 'Résoudre', ...offre },
  ];
  return toutes.map((s) => (s.id === visee ? { ...s, visee: true } : s));
};
const JOUERA = { joue: false, scenes: [
  { scene: 'pluie', nom: 'Pluie de flèches', qui: 'groupe' as const },
  { scene: 'tenez', nom: 'Tenez votre position', qui: ['greta', 'bjorn'] },
  { scene: 'motivation', nom: 'Motivation', qui: ['aldric'] }] };
const AVANT: Omit<BatailleDeMasse, 'nom'> = {
  gabarit: 'lieu-et-voyage', decor: 'champ', round: { rang: 1, sur: 3 }, terrain: TERRAIN, armees: armees(50, 55), bonus: 10,
  jeu: JOUERA, gestes: [{ libelle: 'Test spectaculaire de Puissance', principal: true }, { libelle: 'Tirer un facteur (1d10)' }],
  combattants: combattants(),
};

export default {
  etats: [
    {
      ...AVANT, nom: 'bataille-de-masse', scenes: scenes('tenez'),
      apercu: { scene: 'tenez', lignes: [{ qui: 'greta', comment: 'Corps à corps' }, { qui: 'bjorn', comment: 'en Soutien' }],
        regles: [{ libelle: 'Test opposé', texte: 'chaque Round' }, { libelle: 'Déroute', texte: 'à 10, ou au bout de 5 Rounds' }] },
      groupe: groupe({
        bjorn: { id: 'tenez', texte: 'Posté : Tenez votre position' }, mira: { attend: 'Libre · à poster', sombre: true },
        aldric: { id: 'motivation', texte: 'Posté : Motivation' }, greta: { id: 'tenez', texte: 'Postée : Tenez votre position' } }, 'greta'),
    },
    {
      ...AVANT, nom: 'bataille-de-masse-poster', scenes: scenes('motivation', true),
      fenetre: {
        titre: 'Motivation · poster un héros',
        centre: { role: 'choix', groupes: [{ cartes: [
          { qui: 'aldric', detail: [{ test: 'Commandement', seuil: 38 }], marque: { nom: 'posté' } },
          { qui: 'mira', detail: [{ test: 'Charme', seuil: 41 }], choisie: true },
          { qui: 'bjorn', detail: [{ test: 'Intimidation', seuil: 33 }] },
          { qui: 'greta', detail: [{ test: 'Commandement', seuil: 36 }] }] }] },
        gestes: [{ libelle: 'Poster Mira', principal: true }, { libelle: 'Retirer Aldric du poste' }], reserves: [],
      },
    },
    {
      nom: 'bataille-de-masse-test-de-puissance', gabarit: 'lieu-et-voyage', decor: 'champ', round: { rang: 1, sur: 3 }, terrain: TERRAIN,
      armees: armees(42, 35), bonus: 10,
      jeu: { joue: true, scenes: [
        { scene: 'pluie', nom: 'Pluie de flèches', qui: 'groupe', ote: 5 },
        { scene: 'tenez', nom: 'Tenez votre position', qui: ['greta', 'bjorn'], ote: 2, rupture: { points: 3, sur: 10 } },
        { scene: 'motivation', nom: 'Motivation', qui: ['aldric'], echec: true }] },
      carton: {
        titre: 'Test spectaculaire de Puissance',
        allies: { seuil: 50, jet: 31, dr: 3, ote: 13 }, ennemis: { seuil: 48, jet: 67, dr: -2, ote: 8 },
        gestes: [{ libelle: 'Round suivant', principal: true }, { libelle: 'Rassemblement : Bjorn' }],
      },
      combattants: combattants(),
      groupe: groupe({
        bjorn: { texte: 'a tenu la position aux côtés de Greta' }, mira: { texte: 'trois flèches au but depuis le rempart' },
        aldric: { texte: 'n’a pas su rallier les blessés' }, greta: { texte: 'blessée en tenant la position', mal: true } }),
    },
    {
      nom: 'bataille-de-masse-issue', gabarit: 'lieu-et-voyage', decor: 'champ', round: null, armees: armees(46, 21),
      rounds: [{ allies: 42, ennemis: 35 }, { allies: 44, ennemis: 27 }, { allies: 46, ennemis: 21 }],
      carton: {
        titre: 'Issue de la bataille',
        allies: { issue: 'Victoire', gagne: true }, ennemis: { issue: 'En fuite' },
        phrase: 'À la fin des Rounds de bataille prévus, l’armée avec la Puissance la plus élevée gagne. Le côté adverse doit fuir, sous peine d’être détruit.',
        gestes: [{ libelle: 'Quitter le champ', principal: true }],
      },
      combattants: combattants(),
      groupe: groupe({
        bjorn: { texte: 'a tenu la position trois Rounds durant' }, mira: { texte: 'a vidé son carquois depuis le rempart' },
        aldric: { texte: 'a rallié les piquiers au dernier Round' }, greta: { texte: 'blessée, debout sur la brèche', mal: true } }),
    },
  ],
} satisfies Ecran;
