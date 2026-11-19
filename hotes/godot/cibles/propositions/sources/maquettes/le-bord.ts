/**
 * Le bord (#4411) : les postes où l'on affecte les héros aux rôles du navire, la station du héros choisi, les Activités
 * de la semaine en mer (`../../voyage.md`, sections `postes-de-bord*`, `activites-en-mer`). Rôles et compétences : MDG 14
 * l.15-37 ; Moral : MDG 14 l.133-143 ; `src/data/crew-roles.json`, `src/noyau/shipCrew.ts` ; station : MDG 13 l.714,
 * l.730, l.751, `src/data/ship-stations.json` ; Activités : MDG 15 l.266-300, `src/noyau/seaActivities.ts`.
 */
import { groupe } from './compagnie.ts';
import type { Bord, Ecran, PosteDuLieu } from './maquette.ts';

const ETAT = { coque: { blessures: 50, max: 50 }, moral: 75, eau: 2900, vivres: 735 };
/** Les rôles du bord ; `vigie`, ceux qui tiennent la vigie. */
const postes = (vigie: string[], repos: string[]): PosteDuLieu[] => [
  { id: 'vigie', nom: 'Vigie', sous: 'Perception', tenants: vigie, ...(vigie.length ? { place: true } : {}) },
  { id: 'mousse', nom: 'Mousse', sous: 'Voile ou Ramer' },
  { id: 'capitaine', nom: 'Capitaine', sous: 'Commandement', tenants: ['greta'], vise: true },
  { id: 'timonier', nom: 'Timonier', sous: 'Voile', tenants: ['mira'] },
  { id: 'navigateur', nom: 'Navigateur', sous: 'Orientation', tenants: ['aldric'] },
  { id: 'artilleur', nom: 'Artilleur', sous: 'Projectiles (Poudre noire)' },
  { id: 'cuisinier', nom: 'Cuisinier', sous: 'Métier (Cuisinier)' },
  { id: 'chirurgien', nom: 'Chirurgien', sous: 'Guérison' },
  { id: 'chansonnier', nom: 'Chansonnier', sous: 'Divertissement (Chant)' },
  { id: 'repos', nom: 'Repos', sous: 'Aucun rôle', tenants: repos },
];
/** Les postes de bord au troisième jour, Greta choisie ; `station`, Bjorn au repos et la station de Greta ouverte. */
const aSesPostes = (nom: string, station: boolean): Bord => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'bord',
  titre: { nom: 'Postes de bord', navire: 'La Sterne', marins: 15, jourEnMer: 3 },
  postes: station ? postes([], ['bjorn']) : postes(['bjorn'], []),
  billet: { role: 'role', poste: 'capitaine', competence: 'Commandement', test: 'Progression', essentiel: true },
  bord: { etat: ETAT, jouera: [
    { id: 'progression', nom: 'Progression', par: { qui: 'greta' }, competence: 'Commandement' },
    { id: 'orientation', nom: 'Orientation', par: { qui: 'aldric' }, competence: 'Orientation' },
    { id: 'entretien', nom: 'Entretien', par: { tenants: 'Les Mousses' }, competence: 'Voile ou Ramer' }] },
  ...(station ? { station: { qui: 'greta', stations: ['Gréement', 'Pont', 'Avirons'], tenue: 1, texte: 'Si un Personnage se trouve sur le pont, il doit réussir un Test d’Athlétisme Accessible (+20) sous peine de subir l’État À Terre.' } } : {}),
  ouvrir: 'Dossier du navire',
  retour: 'Revenir à la traversée',
  groupe: groupe({
    bjorn: { texte: station ? 'Au repos, aucun rôle' : 'Vigie, au nid-de-pie' },
    mira: { texte: 'Timonier, à la barre' },
    aldric: { texte: 'Navigateur, cartes et sablier' },
    greta: { texte: station ? 'Capitaine, sur le pont' : 'Capitaine, sur le château arrière' },
  }, 'greta'),
});

export default {
  etats: [
    aSesPostes('postes-de-bord', false),
    aSesPostes('postes-de-bord-station', true),
    {
      nom: 'activites-en-mer', gabarit: 'lieu-et-voyage', decor: 'bord',
      titre: { nom: 'Activités de la semaine', navire: 'La Sterne', jourEnMer: 8, regle: 'une Activité par héros' },
      postes: [
        { id: 'aucune', nom: 'Aucune Activité', sous: 'La semaine passe', tenants: ['bjorn', 'greta'] },
        { id: 'commerce', nom: 'Commerce d’opportunité', sous: 'Marchandage · Complexe (–10)', tenants: ['mira'], vise: true },
        { id: 'cartographie', nom: 'Cartographie', sous: 'Métier (Cartographe) · Complexe (–10)', tenants: ['aldric'] },
        { id: 'entrainement', nom: 'Entraînement d’équipage', sous: 'Commandement · Difficile (–20)', refus: 'L’équipage du navire de campagne est tenu par les PJ — aucun équipage PNJ à entraîner.', survol: true }],
      billet: { role: 'etendu', poste: 'commerce', aCumuler: 10, tentatives: 3, issues: [
        { issue: 'Succès de 6 DR', effet: 'la mise +20 %' }, { issue: 'Succès', effet: 'la mise +10 %' },
        { issue: 'Échec', effet: 'la moitié de la mise' }, { issue: 'Échec de 6 DR', effet: 'la mise perdue' }] },
      semaine: { activites: [
        { poste: 'commerce', qui: 'mira', reglage: { libelle: 'Mise', valeur: 4800 }, plafond: 20400, encLibre: 170 },
        { poste: 'cartographie', qui: 'aldric', reglage: { libelle: 'Planque gratuite', valeur: 0 } }], action: 'Valider la semaine' },
      retour: 'Revenir à la traversée',
      groupe: groupe({
        bjorn: { texte: 'Aucune Activité' },
        mira: { texte: 'Commerce d’opportunité, 20 CO de mise' },
        aldric: { texte: 'Cartographie, sans planque' },
        greta: { texte: 'Aucune Activité' },
      }, 'mira'),
    },
  ],
} satisfies Ecran;
