/**
 * Le bivouac (#4411) : la halte du soir en voyage. Chaque héros règle son couchage et sa nourriture sur sa carte du
 * bandeau ; le campement dit l'abri, le temps et ce que la nuit jouera (`../../lieux-et-nuit.md`, section `bivouac`).
 */
import type { Ecran, HerosDuBivouac } from './maquette.ts';

const heros = (id: string, nom: string, carriere: string, blessures: number, max: number, ration: boolean): HerosDuBivouac => ({
  id, nom, carriere, blessures, max, couchage: 'Dehors', nourriture: { valeurs: ['Ration', 'Rien'], tenue: ration ? 0 : 1 },
});

export default {
  etats: [{
    nom: 'bivouac',
    gabarit: 'lieu-et-voyage',
    titre: 'La halte du soir',
    date: { jour: 14, mois: 'Pflugzeit' },
    moment: 'troisième nuit',
    meteo: { temps: 'gel', ciel: 'ciel clair, gel' },
    lieu: 'Dans le Reikwald, à l’écart du chemin',
    recit: 'La clairière est sèche et le bois mort ne manque pas.',
    abri: { nom: 'Tente', detail: 'quatre dormeurs sous la toile' },
    temps: 'Gel cette nuit : il faudra tenir contre le froid.',
    nuit: [{ id: 'froid', nom: 'Le froid', jet: 'Résistance' }, { id: 'repos', nom: 'Le repos', jet: 'une nuit' }],
    action: 'Passer la nuit',
    retour: 'Reprendre la route',
    groupe: [
      heros('bjorn', 'Bjorn', 'Chasseur', 16, 16, true),
      heros('mira', 'Mira', 'Éclaireuse', 11, 11, true),
      heros('aldric', 'Aldric', 'Érudit', 12, 12, true),
      heros('greta', 'Greta Hartmann', 'Soldate', 8, 14, false),
    ],
  }],
} satisfies Ecran;
