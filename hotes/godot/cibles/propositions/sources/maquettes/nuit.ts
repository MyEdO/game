/**
 * La nuit (#4411) : un seul écran pour l'auberge et la halte du soir. À l'auberge, l'aubergiste et ses offres, les postes
 * de la soirée, la table de jeu de la maison ; à la halte, le campement. Un seul panneau dit qui dort où : les lits d'une
 * chambre ou les places sous une tente, ceux qui restent dehors à part (`../../lieux-et-nuit.md`, section `nuit`).
 */
import { BOURSES, groupe } from './compagnie.ts';
import type { Ecran, HerosDeLaNuit, Rail } from './maquette.ts';

/** L'auberge de la Fin du Voyage, à Bögenhafen. */
const AUBERGE = { nom: 'La Fin du Voyage', sous: 'Auberge · Teuerberg, Bögenhafen · le soir' };
/** Les services de la maison, celui de `ouvert` ouvert. */
const services = (ouvert: string): Rail => ({
  titre: 'Services de la maison', ouvert, pied: 'Odelina Landau, l’aubergiste',
  services: [{ id: 'nuit', nom: 'La nuit et le repas' }, { id: 'salle', nom: 'La salle commune' }, { id: 'jeux', nom: 'Les jeux' }, { id: 'barbier', nom: 'Le barbier' }, { id: 'ecurie', nom: 'L’écurie' }],
});
/** Ce que mange chaque héros à la halte : une ration, sauf Greta. */
const vivres = (h: HerosDeLaNuit): HerosDeLaNuit => ({ ...h, nourriture: { valeurs: ['Ration', 'Rien'], tenue: h.id === 'greta' ? 1 : 0 } });

export default {
  etats: [{
    nom: 'nuit-a-l-auberge', gabarit: 'lieu-et-voyage', decor: 'auberge',
    titre: AUBERGE,
    hote: {
      icone: 'chope', nom: 'Odelina Landau', qualite: 'L’aubergiste', dit: 'Un lit chaud, un bon repas et pas de questions.',
      offres: [
        { id: 'commune', nom: 'Chambre commune', parTete: true, prix: 10 },
        { id: 'privee', nom: 'Chambre privée', lits: 2, prix: 120 },
        { id: 'grande', nom: 'Grande chambre', lits: 4, prix: 240, prise: true },
        { id: 'repas', nom: 'Repas', parTete: true, prix: 12, prise: true }],
    },
    postes: [
      { id: 'boire', nom: 'Boire', sous: 'Bière, la pinte', prix: 3, tenant: 'bjorn' },
      { id: 'rumeurs', nom: 'Écouter les rumeurs', sous: 'Ragot', tenant: 'mira' },
      { id: 'jouer', nom: 'Jouer', sous: 'Pari · une mise' },
      { id: 'soigner', nom: 'Se faire soigner', sous: 'Guérison · la visite', prix: 60, tenant: 'greta' },
      { id: 'dormir', nom: 'Dormir', sous: 'Une bonne nuit', tenant: 'aldric' }],
    dortoir: {
      abri: { id: 'chambre', nom: 'Grande chambre', places: 4 }, dedans: ['bjorn', 'mira', 'aldric', 'greta'], dehors: [],
      parts: (['bjorn', 'mira', 'aldric', 'greta'] as const).map((heros) => ({ heros, part: 72, avoir: BOURSES[heros] })),
      action: 'Passer la nuit',
    },
    retour: 'Quitter l’auberge',
    groupe: groupe({
      bjorn: { id: 'boire', texte: 'vide sa pinte au comptoir' }, mira: { id: 'rumeurs', texte: 'tend l’oreille près de l’âtre' },
      aldric: { id: 'dormir', texte: 'monte se coucher tôt' }, greta: { id: 'soigner', texte: 'montre sa cuisse au barbier' } }),
  }, {
    nom: 'jeux-de-taverne', gabarit: 'lieu-et-voyage', decor: 'taverne',
    titre: AUBERGE,
    rail: services('jeux'),
    postes: [
      { id: 'brasseur', nom: 'Le brasseur', sous: 'Tient les dés', tenant: 'brasseur' },
      { id: 'batelier', nom: 'Un batelier du Reik', sous: 'A misé', tenant: 'batelier' },
      { id: 'cocher', nom: 'Un cocher', sous: 'A misé', tenant: 'cocher' },
      { id: 'flechettes', nom: 'Les fléchettes', sous: 'Projectiles (Lancer)' },
      { id: 'bras-de-fer', nom: 'Le bras de fer', sous: 'Force' },
      { id: 'al-zahr', nom: 'L’Al-zahr', sous: 'La place de Bjorn', vise: true }],
    partie: {
      jeu: { id: 'al-zahr', nom: 'L’Al-zahr', sous: 'Jeu de dés · chacun met au pot', regle: 'Deux dés pour toucher le nombre cible. Le premier qui l’atteint emporte le pot.' },
      jeux: [{ id: 'al-zahr', nom: 'L’Al-zahr' }, { id: 'flechettes', nom: 'Les fléchettes' }, { id: 'bras-de-fer', nom: 'Le bras de fer' }],
      table: [{ qui: 'bjorn', nom: 'Bjorn', role: 'Votre joueur' }, { qui: 'brasseur', nom: 'Le brasseur', role: 'La maison' }, { qui: 'batelier', nom: 'Un batelier', role: 'Habitué' }, { qui: 'cocher', nom: 'Un cocher', role: 'De passage' }],
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
