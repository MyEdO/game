/**
 * Le bivouac (#4411) : la halte du soir en voyage, sous le paysage de la halte au campement. Chaque héros règle son
 * couchage et sa nourriture sur sa carte du bandeau ; le campement dit l'abri, le temps et ce que la nuit jouera
 * (`../../lieux-et-nuit.md`, section `bivouac`).
 */
import { bouton, choix, ligne, type Bouton, type Entite, type Ligne, type Puce } from '../../../../../../src/hote/elements';
import { SANS_JEU, reponsesDeLEcran, type Maquette } from './maquette';

const puce = (id: string, libelle: string, valeur: string): Puce => ({ type: 'puce', id, ton: 'neutre', libelle, valeur, detail: null, jeu: null });
/** La valeur `n` d'un réglage, pressée quand le héros l'a choisie. */
const valeur = (n: number, libelle: string, choisie: boolean): Bouton => bouton(String(n), libelle, SANS_JEU, choisie);
const heros = (id: string, nom: string, carriere: string, courant: number, max: number, ration: boolean): Entite => ({
  type: 'entite', id: `heros/${id}`, ton: 'neutre', nom,
  elements: [
    { type: 'portrait', id: 'portrait', combattant: id },
    ligne('carriere', carriere),
    { type: 'jauge', id: 'blessures', ton: 'neutre', libelle: 'Blessures', courant, max, texte: `${courant} / ${max}` },
    bouton(`fiche/${id}`, 'Fiche', { fiche: { porteur: id } }),
    choix('couchage', 'Couchage', [valeur(0, 'Dehors', true)]),
    choix('pitance', 'Nourriture', [valeur(0, 'Ration', ration), valeur(1, 'Rien', !ration)]),
  ],
});
const pastille = (id: string, nom: string, icone: string): Entite => ({ type: 'entite', id, ton: 'neutre', nom, elements: [{ type: 'icone', id: 'icone', icone }] });
const titre: Ligne = { ...ligne('titre', 'La halte du soir'), icone: 'temps/nuit' };

export default {
  nom: 'bivouac',
  titre: 'bivouac, la nuit à régler',
  gabarits: ['lieu-et-voyage'],
  decor: null,
  reponses: reponsesDeLEcran({
    disposition: 'repos',
    zones: {
      'fenetre.titre': [titre],
      'fenetre.corps': [
        { type: 'paysage', id: 'scene/paysage', paysage: ['ciel-nuit', 'relief-montagnes-ombre', 'brume-haute-nuit', 'relief-collines-ombre', 'brume-basse-nuit', 'relief-lisiere-ombre', 'relief-route-ombre', 'halte-feu', 'avant-foret-ombre', 'voile-coins'] },
        ligne('scene/date', '14 Pflugzeit 2512 CI'),
        { type: 'icone', id: 'scene/meteo', icone: 'meteo/neige' },
        ligne('scene/moment', 'troisième nuit · ciel clair, gel'),
        ligne('repos/lieu', 'Dans le Reikwald, à l’écart du chemin'),
        ligne('repos/description', 'La clairière est sèche et le bois mort ne manque pas.'),
        puce('repos/abri', 'Abri', 'Tente · quatre dormeurs sous la toile'),
        { ...ligne('repos/temps', 'Gel cette nuit : il faudra tenir contre le froid.', 'alerte'), icone: 'repos/froid' },
        { type: 'entite', id: 'repos/nuit', ton: 'neutre', nom: 'Ce que la nuit jouera', elements: [puce('froid', 'Le froid', 'Résistance'), puce('repos', 'Le repos', 'une nuit')] },
      ],
      'fenetre.gestes': [{ ...bouton('passer-la-nuit', 'Passer la nuit', SANS_JEU), focus: true, icone: 'temps/nuit' }],
      'groupe.heros': [
        heros('bjorn', 'Bjorn', 'Chasseur', 16, 16, true),
        heros('mira', 'Mira', 'Éclaireuse', 11, 11, true),
        heros('aldric', 'Aldric', 'Érudit', 12, 12, true),
        heros('greta', 'Greta Hartmann', 'Soldate', 8, 14, false),
      ],
      'journal.titre': [pastille('journal', 'Chronique', 'navigation/carnet')],
      'partie.menu': [pastille('menu', 'Menu de la partie', 'interface/reglages')],
    },
    journal: [],
    projection: {
      fenetre: { cle: 'repos', proprietaire: { genre: 'tous' }, gestes: [], fermes: {}, pid: null },
      combat: null,
      exploration: null,
    },
  }),
} satisfies Maquette;
