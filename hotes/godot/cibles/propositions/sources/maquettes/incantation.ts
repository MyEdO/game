/**
 * L'incantation (#4411) : la fenêtre `cascade/incantation` de `magie` telle que le jeu la sert, son jet tombé puis un
 * pas de Surincantation alloué (LDB 47 l.15-17), puis l'Incantation Critique d'Ilyanwe sur le dôme et son effet à
 * choisir (LDB 46 l.26-32), l'Incantation Imparfaite Mineure qu'elle impose, à tirer puis tirée (LDB 46 l.28, l.36-55),
 * sur la cour (`../../combat-suite.md`, sections `surincantation` à `incantation-imparfaite`).
 */
import { ligne } from '../../../../../../src/hote/elements';
import {
  apresLeDe,
  cartes,
  fenetreSurLeDome,
  geste,
  gesteDeJet,
  ILYANWE,
  jet,
  reglageDe,
  RESERVES,
  reserves,
  tirage,
  TOUR_D_ILYANWE,
  type TourDuDome,
} from './dome';
import type { Decor, Ecran, MaquetteCapturee } from './maquette';

/** Les bustes des combattants de `magie` (`src/scenes/test-scenarios/`) que l'ordre du tour montre. */
const BUSTES_DE_LA_MAGIE: Decor['bustes'] = Object.fromEntries([
  ['sc-elfe', 'ilyanwe'], ...[3, 4, 9].map((n) => [`enemy-enc-magie-${n}`, 'orc']), ...[0, 1, 2, 5, 6, 7, 8, 10, 11, 12].map((n) => [`enemy-enc-magie-${n}`, 'gobelin']),
  ...['pr-myrmidia', 'pr-rhya', 'pr-shallya', 'pr-verena'].map((id) => [id, 'greta']), ...['pr-ranald', 'pr-morr', 'pr-taal', 'pr-manann', 'pr-ulric', 'pr-sigmar', 'pr-flagellant', 'tueur-de-test'].map((id) => [id, 'aldric']),
]);
/** L'état `nom` de la planche `planche` de `magie`. */
const deLaMagie = (nom: string, planche: string): MaquetteCapturee => ({ nom, planche, gabarits: ['combat', 'fenetre-du-bas'], decor: { scene: 'cour', variante: 'incantation', bustes: BUSTES_DE_LA_MAGIE } });
/** Le tour d'Ilyanwe, dont le journal dit `dit` en dernier. */
const tour = (avant: string, dit: string): TourDuDome => ({ ...TOUR_D_ILYANWE, journal: ['Orc maîtrise sa psychologie (Animosité).', avant, dit] });
/** Le jet d'incantation critique d'Ilyanwe sur l'Orc, le double 33. */
const CRITIQUE = jet('jet', ILYANWE, 'Langue (Magick) · Fléchette sur Orc', '≤ 85', { resultat: '33', dr: '+5', reussite: true, verdict: 'critique' });

export default {
  etats: [
    deLaMagie('incantation', 'incantation-jet-tombe'),
    deLaMagie('surincantation', 'surincantation'),
    fenetreSurLeDome('incantation-critique', 'Incantation Critique, l’effet à choisir', 'incantation', tour('Tireur gobelin maîtrise sa psychologie (Animosité).', 'Ilyanwe la Voilée incante Fléchette : Critique (33) !'), {
      titre: 'Incantation Critique',
      corps: [CRITIQUE, ligne('issue', 'Les Vents s’emballent : l’Incantation Imparfaite Mineure suit, sauf Diction instinctive.')],
      reglages: [cartes(reglageDe('incantation', 'effetCritique'), 'Effet du Critique', [
        ['critique', 'Incantation Critique', 'Le Sort inflige aussi\nune Blessure Critique'],
        ['puissance', 'Puissance totale', 'Lancé quels que soient NI et DR\nPeut être Dissipé'],
        ['ineluctable', 'Force inéluctable', 'Ne peut pas être Dissipé'],
      ], 0)],
      gestes: apresLeDe('incantation', { reussi: true, chance: RESERVES.ilyanwe.chance, resilience: RESERVES.ilyanwe.resilience }), reserves: reserves(RESERVES.ilyanwe),
    }),
    fenetreSurLeDome('incantation-imparfaite-tirage', 'Incantation Imparfaite Mineure, à tirer', 'incantation', tour('Ilyanwe la Voilée incante Fléchette : Critique (33) !', 'Les Vents s’emballent autour d’Ilyanwe la Voilée.'), {
      titre: 'Incantation Imparfaite',
      corps: [{ ...jet('jet', ILYANWE, 'Incantation Critique', null, { resultat: '33', dr: '', reussite: false, verdict: 'Critique : 33' }), dr: 'du jet d’Incantation' }, ...tirage('Les Vents s’emballent', 'À moins que vous n’ayez le Talent Diction instinctive, effectuez un lancer sur le Tableau des Incantations Imparfaites Mineures lorsque la puissance dépasse votre contrôle.', 'Incantation Imparfaite Mineure', null)],
      gestes: [geste(gesteDeJet('lancer', 'cascadeTirage'), 'Lancer le dé', { focus: true })],
    }),
    fenetreSurLeDome('incantation-imparfaite', 'Incantation Imparfaite Mineure, tirée', 'incantation', tour('Ilyanwe la Voilée lance Fléchette sur Orc.', 'Les Vents s’emballent autour d’Ilyanwe la Voilée.'), {
      titre: 'Incantation Imparfaite',
      corps: [{ ...jet('jet', ILYANWE, 'Influence malfaisante', null, { resultat: '18', dr: '', reussite: false, verdict: '8 aux unités' }), dr: 'du jet d’Incantation' }, ...tirage('Rupture', 'Votre nez, vos yeux et vos oreilles saignent abondamment. Gagnez 1d10 États Hémorragique.', 'Incantation Imparfaite Mineure', '33')],
      gestes: [geste(gesteDeJet('valider', 'cascade'), 'Continuer', { focus: true })],
    }),
  ],
} satisfies Ecran;
