/**
 * La nuit (#4411) : un seul écran pour l'auberge et la halte du soir. À l'auberge, l'aubergiste et ses offres, les postes
 * de la soirée, la table de jeu de la maison ; à la halte, le campement. Un seul panneau dit qui dort où : les lits d'une
 * chambre ou les places sous une tente, ceux qui restent dehors à part (`../../lieux-et-nuit.md`, section `nuit`).
 * L'auberge, un état par qualité de l'établissement : prix LDB 66 l.5, l.12-16, l.28 ; voleurs LDB 66 l.26 ; quartiers
 * EDO 10 l.179, l.293, l.515-517.
 */
import { BOURSES, groupe, type Id } from './compagnie.ts';
import type { Ecran, HerosDeLaNuit, Nuit, PosteDuLieu, Rail } from './maquette.ts';

/** L'auberge de la Fin du Voyage, à Bögenhafen. */
const AUBERGE = { nom: 'La Fin du Voyage', sous: 'Auberge · Teuerberg, Bögenhafen · le soir' };
/** Les services de la maison, celui de `ouvert` ouvert. */
const services = (ouvert: string): Rail => ({
  titre: 'Services de la maison', ouvert, pied: 'Odelina Landau, l’aubergiste',
  services: [{ id: 'nuit', nom: 'La nuit et le repas' }, { id: 'salle', nom: 'La salle commune' }, { id: 'jeux', nom: 'Les jeux' }, { id: 'barbier', nom: 'Le barbier' }, { id: 'ecurie', nom: 'L’écurie' }],
});
/** Ce que mange chaque héros à la halte : une ration, sauf Greta. */
const vivres = (h: HerosDeLaNuit): HerosDeLaNuit => ({ ...h, nourriture: { valeurs: ['Ration', 'Rien'], tenue: h.id === 'greta' ? 1 : 0 } });
/** Les avis de la maison : les voleurs de la chambre commune, la Courante galopante de la piètre qualité. */
const VOLEURS = 'Chambre commune : méfiez-vous des voleurs';
const COURANTE = 'Repas, boisson : 10 % de Courante galopante';
const HEROS: Id[] = ['bjorn', 'mira', 'aldric', 'greta'];
/** Les postes de la soirée ; `boire` : ce qu'on boit et son prix ; `soigner` : le barbier de la maison. */
const postes = (boire: { sous: string; prix: number }, soigner: boolean): PosteDuLieu[] => [
  { id: 'boire', nom: 'Boire', ...boire, tenants: ['bjorn'] },
  { id: 'rumeurs', nom: 'Écouter les rumeurs', sous: 'Ragot', tenants: ['mira'] },
  { id: 'jouer', nom: 'Jouer', sous: 'Pari · une mise' },
  ...(soigner ? [{ id: 'soigner', nom: 'Se faire soigner', sous: 'Guérison · la visite', prix: 60, tenants: ['greta'] }] : []),
  { id: 'dormir', nom: 'Dormir', sous: 'Une bonne nuit', tenants: soigner ? ['aldric'] : ['aldric', 'greta'] }];
/** Le groupe à la soirée : Greta au barbier quand la maison en a un, sinon couchée. */
const soiree = (boit: string, soigner: boolean) => groupe({
  bjorn: { id: 'boire', texte: boit }, mira: { id: 'rumeurs', texte: 'tend l’oreille près de l’âtre' },
  aldric: { id: 'dormir', texte: 'monte se coucher tôt' },
  greta: soigner ? { id: 'soigner', texte: 'montre sa cuisse au barbier' } : { id: 'dormir', texte: 'garde sa bourse sous sa tête' } });
/** Les quatre dans la chambre `abri`, chacun sa `part` de la note. */
const dortoir = (abri: { nom: string; places: number }, part: number): NonNullable<Nuit['dortoir']> => ({
  abri: { id: 'chambre', ...abri }, dedans: HEROS, dehors: [],
  parts: HEROS.map((heros) => ({ heros, part, avoir: BOURSES[heros] })),
  action: 'Passer la nuit',
});

export default {
  etats: [{
    nom: 'nuit-a-l-auberge-pietre', gabarit: 'lieu-et-voyage', decor: 'auberge', qualite: 'pietre',
    titre: { nom: 'Une taverne d’Altstadt', sous: 'Piètre qualité · Altstadt · le soir' },
    hote: {
      icone: 'chope', nom: 'Le tenancier', qualite: 'Le patron', dit: 'Une paillasse et la soupe. Gardez la main sur votre bourse.',
      offres: [
        { id: 'commune', nom: 'Chambre commune', parTete: true, prix: 5, prise: true },
        { id: 'repas', nom: 'Repas', parTete: true, prix: 6, prise: true }],
      avis: [VOLEURS, COURANTE],
    },
    postes: postes({ sous: 'Bière, la pinte', prix: 3 }, false),
    dortoir: dortoir({ nom: 'Chambre commune', places: 4 }, 11),
    retour: 'Quitter la taverne',
    groupe: soiree('vide sa pinte au comptoir', false),
  }, {
    nom: 'nuit-a-l-auberge-normale', gabarit: 'lieu-et-voyage', decor: 'auberge', qualite: 'normale',
    titre: AUBERGE,
    hote: {
      icone: 'chope', nom: 'Odelina Landau', qualite: 'L’aubergiste', dit: 'Un lit chaud, un bon repas et pas de questions.',
      offres: [
        { id: 'commune', nom: 'Chambre commune', parTete: true, prix: 10 },
        { id: 'privee', nom: 'Chambre privée', lits: 2, prix: 120 },
        { id: 'grande', nom: 'Grande chambre', lits: 4, prix: 240, prise: true },
        { id: 'repas', nom: 'Repas', parTete: true, prix: 12, prise: true },
        { id: 'ecurie', nom: 'Écurie', parBete: true, prix: 10 }],
      avis: [VOLEURS],
    },
    postes: postes({ sous: 'Bière, la pinte', prix: 3 }, true),
    dortoir: dortoir({ nom: 'Grande chambre', places: 4 }, 72),
    retour: 'Quitter l’auberge',
    groupe: soiree('vide sa pinte au comptoir', true),
  }, {
    nom: 'nuit-a-l-auberge-grande', gabarit: 'lieu-et-voyage', decor: 'auberge', qualite: 'grande',
    titre: { nom: 'Une auberge de la Dreieckeplatz', sous: 'Grande qualité · Dreieckeplatz · le soir' },
    hote: {
      icone: 'chope', nom: 'Le maître d’hôtel', qualite: 'Le patron', dit: 'Vos chambres sont prêtes, et le souper vous attend.',
      offres: [
        { id: 'privee', nom: 'Chambre privée', lits: 2, prix: 240 },
        { id: 'grande', nom: 'Grande chambre', lits: 4, prix: 480, prise: true },
        { id: 'repas', nom: 'Repas', parTete: true, prix: 24, prise: true }],
    },
    postes: postes({ sous: 'Vin, bouteille', prix: 10 }, false),
    dortoir: dortoir({ nom: 'Grande chambre', places: 4 }, 144),
    retour: 'Quitter l’auberge',
    groupe: soiree('débouche une bouteille de vin', false),
  }, {
    nom: 'jeux-de-taverne', gabarit: 'lieu-et-voyage', decor: 'taverne',
    titre: AUBERGE,
    rail: services('jeux'),
    postes: [
      { id: 'brasseur', nom: 'Le brasseur', sous: 'Tient les dés', tenants: ['brasseur'] },
      { id: 'batelier', nom: 'Un batelier du Reik', sous: 'A misé', tenants: ['batelier'] },
      { id: 'cocher', nom: 'Un cocher', sous: 'A misé', tenants: ['cocher'] },
      { id: 'flechettes', nom: 'Les fléchettes', sous: 'Projectiles (Lancer)' },
      { id: 'bras-de-fer', nom: 'Le bras de fer', sous: 'Force' },
      { id: 'al-zahr', nom: 'L’Al-zahr', sous: 'La place de Bjorn', vise: true }],
    partie: {
      jeu: { id: 'al-zahr', nom: 'L’Al-zahr', sous: 'Jeu de dés · chacun met au pot', regle: 'Deux dés pour toucher le nombre cible. Le premier qui l’atteint emporte le pot.' },
      jeux: [{ id: 'al-zahr', nom: 'L’Al-zahr' }, { id: 'flechettes', nom: 'Les fléchettes' }, { id: 'bras-de-fer', nom: 'Le bras de fer' }],
      table: [{ qui: 'bjorn', nom: 'Bjorn', role: 'Votre héros' }, { qui: 'brasseur', nom: 'Le brasseur', role: 'La maison' }, { qui: 'batelier', nom: 'Un batelier', role: 'Habitué' }, { qui: 'cocher', nom: 'Un cocher', role: 'De passage' }],
      mise: { heros: 'bjorn', mise: 6, pot: 24, joueurs: 4, avoir: BOURSES.bjorn },
      action: 'S’asseoir et lancer les dés',
    },
    retour: 'Quitter la table',
    groupe: groupe({ bjorn: { id: 'al-zahr', texte: 'prend la place libre à la table de dés' } }, 'bjorn'),
  }, {
    nom: 'bivouac', gabarit: 'lieu-et-voyage', decor: 'bivouac',
    titre: { nom: 'La halte du soir', sous: 'troisième nuit', date: { jour: 14, mois: 'Pflugzeit' }, meteo: { temps: 'gel', ciel: 'ciel clair, gel' } },
    recit: { lieu: 'Dans le Reikwald, à l’écart du chemin', texte: 'La clairière est sèche et le bois mort ne manque pas.' },
    dortoir: {
      abri: { id: 'tente', nom: 'Petite tente', places: 2 },
      abris: [{ id: 'tente', nom: 'Petite tente' }, { id: 'belle-etoile', nom: 'Belle étoile' }, { id: 'fortune', nom: 'Abri de fortune', test: 'Survie en extérieur' }],
      dedans: ['mira', 'aldric'], dehors: ['bjorn', 'greta'],
      sac: { bonus: 20, porteurs: ['bjorn'] },
      temps: 'Gel cette nuit : il faudra tenir contre le froid.',
      jouera: [{ id: 'froid', nom: 'Le froid', jet: 'Résistance' }, { id: 'repos', nom: 'Le repos', jet: 'une nuit' }],
      action: 'Passer la nuit',
    },
    retour: 'Reprendre la route',
    groupe: groupe().map(vivres),
  }],
} satisfies Ecran;
