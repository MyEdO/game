/**
 * La course-poursuite en mer (#4411) : une cogue pirate en chasse pendant la traversée. La manche du jour, le Test
 * d'équipage poste après poste, la sommation et le tribut à Stromfels (MDG 13 l.354-403, l.420 ; MDG 14 l.19-39,
 * l.67-71 ; MDG 15 l.171-173 ; le pillage, valeur maison `pirate-pillage-pct`) (`../../combat-suite.md`, sections
 * `course-poursuite-en-mer*`).
 */
import { avantLeDe, apresLeDe, reserves } from './dome.ts';
import { combattants, groupe, RESERVES } from './compagnie.ts';
import type { Dit, Ecran, Fenetre, LigneDeTest, Poursuite } from './maquette.ts';

/** Ce que chaque héros tient à bord, ce qu'il y fait. */
const POSTES: Record<'bjorn' | 'mira' | 'aldric' | 'greta', Dit> = {
  bjorn: { id: 'mousse', texte: 'Mousse : borde la toile avec les marins' },
  mira: { id: 'timonier', texte: 'Timonier : serre le vent au plus près' },
  aldric: { id: 'navigateur', texte: 'Navigateur : coupe par les hauts-fonds' },
  greta: { id: 'capitaine', texte: 'Capitaine : presse l’équipage à la manœuvre' },
};
const ISSUES = [{ distance: 100, issue: 'semés', condition: 'Temps dégagé' }, { distance: 0, issue: 'collision et abordage' }];

/** Le Test d'équipage, rôle après rôle (MDG 14 l.67-71) ; le Mousse compte double. */
const equipage = (bjorn: Partial<LigneDeTest>, aldric: Partial<LigneDeTest>, mira: Partial<LigneDeTest>): LigneDeTest[] => [
  { qui: 'greta', poste: 'Capitaine', test: 'Commandement', seuil: 41, dr: 1 },
  { qui: 'bjorn', poste: 'Mousse', test: 'Voile', seuil: 45, double: true, ...bjorn },
  { qui: 'aldric', poste: 'Navigateur', test: 'Orientation', seuil: 38, ...aldric },
  { qui: 'mira', poste: 'Timonier', test: 'Voile', seuil: 36, ...mira },
];

/** Un jour de la traversée sous la chasse : la Distance, ce que la manche joue, le récit, la fenêtre, ou le groupe à ses
 *  postes. */
const enChasse = (nom: string, distance: number, manche: Poursuite['panneau'], recit: string, fenetre?: Fenetre, dits: Partial<typeof POSTES> = POSTES): Poursuite => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'mer',
  titre: { jour: 'Wellentag', date: { jour: 21, mois: 'Sigmarzeit' }, enMer: 3, meteo: 'Temps dégagé, bon vent', ciel: 'jour' },
  recit: { rubrique: manche.role === 'sommation' ? 'En mer · Cogue pirate' : 'En mer · Course-poursuite', texte: recit },
  trajet: { titre: 'La mer des Griffes', de: 'Salzenmund', vers: 'Erengrad', part: 0.3 },
  panneau: manche,
  ...(fenetre ? {} : { frise: { distance, sur: 100, depart: 50, ecart: 1 } }),
  combattants: combattants(),
  ...(fenetre ? { fenetre } : { groupe: groupe(dits) }),
});
const chasse = (distance: number, manche: { libelle: string; dr: number } | { libelle: string; test: string }) =>
  ({ role: 'poursuite', poursuivant: 'Cogue pirate', distance, sur: 100, manche, issues: ISSUES }) as const;
const sommation = (cargaison: number | null) => ({ role: 'sommation', navire: 'Cogue pirate', forbans: 25, cargaison, pillage: 100 }) as const;

export default {
  etats: [
    {
      ...enChasse('course-poursuite-en-mer', 51, chasse(51, { libelle: 'Manche du jour', dr: 1 }),
        'Une voile noire grossit dans le sillage : la Cogue pirate a pris la chasse. L’équipage borde la toile, le navire creuse l’écart.', ),
      apercu: { nom: 'Poursuite', test: 'Test d’équipage', lignes: [
        { qui: 'bjorn', poste: 'Mousse', dr: 1, double: true }, { qui: 'greta', poste: 'Capitaine', dr: 1 },
        { qui: 'mira', poste: 'Timonier', dr: 1 }, { qui: 'aldric', poste: 'Navigateur', dr: 1 }] },
      postes: 'Postes de bord',
    },
    enChasse('course-poursuite-en-mer-test', 50, chasse(50, { libelle: 'Manche du jour', test: 'Test d’équipage' }),
      'Une voile noire grossit dans le sillage : la Cogue pirate a pris la chasse. L’équipage court à ses postes.', {
        titre: 'Poursuite',
        heros: { role: 'testeur', qui: 'bjorn', test: 'Voile · Mousse', seuil: 45 },
        centre: { role: 'tests', nom: 'Test d’équipage', test: 'poste après poste', somme: true,
          lignes: equipage({ attente: 'à lancer', courant: true }, { attente: 'à venir' }, { attente: 'à venir' }) },
        gestes: avantLeDe(RESERVES.bjorn), reserves: reserves(RESERVES.bjorn),
      }),
    enChasse('course-poursuite-en-mer-test-tombe', 50, chasse(50, { libelle: 'Manche du jour', test: 'Test d’équipage' }),
      'Une voile noire grossit dans le sillage : la Cogue pirate a pris la chasse. L’équipage court à ses postes.', {
        titre: 'Poursuite',
        heros: { role: 'testeur', qui: 'mira', test: 'Voile · Timonier', seuil: 36, jet: { des: [50, 2], dr: -2, reussite: false } },
        centre: { role: 'tests', nom: 'Test d’équipage', test: 'poste après poste', somme: true,
          lignes: equipage({ de: 25, dr: 2 }, { de: 27, dr: 1 }, { de: 52, dr: -2, courant: true }) },
        gestes: apresLeDe(RESERVES.mira, { echec: true, valider: 'Continuer' }), reserves: reserves(RESERVES.mira),
      }),
    enChasse('course-poursuite-en-mer-sommation', 51, sommation(12),
      'Cogue pirate. Une cogue avec un équipage de 25 personnes et 6 grands canons apparaît à l’horizon.', {
        titre: 'Cogue pirate',
        heros: { role: 'heros', qui: 'bjorn', mise: { decidePour: 'le bord' } },
        centre: { role: 'choix', groupes: [{ cartes: [
          { nom: 'Prendre la fuite', detail: ['Course-poursuite :', 'distancer la cogue'], choisie: true },
          { nom: 'Combattre', detail: ['Refuser l’abordage et se défendre', 'Abordage immédiat'] },
          { nom: 'Se soumettre', detail: ['La cale fouillée, 100 % pillée', 'puis un tribut à Stromfels'] }] }] },
        gestes: [{ libelle: 'Prendre la fuite', principal: true }], reserves: [],
      }),
    enChasse('course-poursuite-en-mer-tribut', 51, sommation(null),
      'Les forbans fouillent la cale et emportent 12 Enc de cargaison (100 %).', {
        titre: 'Un prisonnier à sacrifier à Stromfels',
        heros: { role: 'heros', qui: 'bjorn', mise: { decidePour: 'le bord' } },
        centre: { role: 'choix', groupes: [{ cartes: [
          { nom: 'Livrer un membre d’équipage', detail: ['Un marin est emmené', 'L’équipage est ébranlé : Moral −2d10'], choisie: true },
          { nom: 'Refuser', detail: ['Les forbans passent à l’abordage'] }] }] },
        gestes: [{ libelle: 'Livrer un membre d’équipage', principal: true }], reserves: [],
      }),
  ],
} satisfies Ecran;
