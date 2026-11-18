/**
 * L'attaque avant le dé (#4411) : la fenêtre `cascade/attaque` du dôme telle que le jeu la sert, puis Berta qui règle
 * son arme et ses deux armes (LDB 10 l.767-773), son empoignade à mains nues (LDB 14 l.159), son tir au lance-harpon
 * (ADE II 02 l.677), et la localisation qu'elle choisit pour son Critique (LDB 17 l.68 ;
 * `src/noyau/fenetreDAttaque.ts:166-291`), sur la cour (`../../combat.md`, sections `jet-avant-le-de`).
 */
import { ligne } from '../../../../../../src/hote/elements';
import { apresLeDe, avantLeDe, BERTA, fenetreSurLeDome, jet, ORC, reglage, RESERVES, reserves, TOUR_DE_BERTA, visee } from './dome';
import { BUSTES_DU_DOME, type Ecran } from './maquette';

/** Les six localisations d'une attaque, « Au hasard » pressé (`reglage.attaque.localisation`). */
const LOCALISATION = reglage('attaque', 'localisation', 'Localisation', [[null, 'Au hasard'], ['tete', 'Tête (-20)'], ['corps', 'Corps (-20)'], ['brasD', 'Bras droit (-20)'], ['brasG', 'Bras gauche (-20)'], ['jambeD', 'Jambe droite (-20)'], ['jambeG', 'Jambe gauche (-20)']], 0);
/** Un réglage qui s'allume, éteint. */
const eteint = (cle: Parameters<typeof reglage>[1], libelle: string) => reglage('attaque', cle, libelle, [[true, 'Oui'], [false, 'Non']], 1);
const PARADE_DE_L_ORC = jet('defense', ORC, 'Parade', '≤ 35');

export default {
  etats: [
    { nom: 'jet-avant-le-de', planche: 'attaque', gabarits: ['combat', 'fenetre-du-bas'], decor: { scene: 'cour', variante: 'jet-avant-le-de', bustes: BUSTES_DU_DOME } },
    fenetreSurLeDome('jet-avant-le-de-armes', 'attaque avant le dé, l’arme et les deux armes', 'jet-avant-le-de-armes', TOUR_DE_BERTA, {
      titre: 'Attaque',
      corps: [ligne('arme', 'Épée'), ligne('cible', 'Cible : Orc'), jet('jet', BERTA, 'Corps à corps (Base)', '≤ 41'), PARADE_DE_L_ORC],
      reglages: [reglage('attaque', 'arme', 'Arme', [['epee', 'Épée'], ['bouclier', 'Bouclier (2nde −20)']], 0), LOCALISATION, eteint('deuxArmes', 'Des deux armes'), eteint('retenirSesCoups', 'Retenir ses coups')],
      gestes: avantLeDe('attaque', { annuler: true }), reserves: reserves(RESERVES.berta),
    }),
    fenetreSurLeDome('jet-avant-le-de-empoigner', 'attaque avant le dé, l’empoignade à mains nues', 'jet-avant-le-de-empoigner', TOUR_DE_BERTA, {
      titre: 'Attaque',
      corps: [ligne('arme', 'Mains nues'), ligne('cible', 'Cible : Orc'), jet('jet', BERTA, 'Corps à corps (Bagarre)', '≤ 41'), ligne('empoigner/note', 'Sur une touche : aucun Dégât ; Empoignade + Empêtré (cible).'), PARADE_DE_L_ORC],
      reglages: [LOCALISATION, reglage('attaque', 'empoigner', 'Empoigner', [[true, 'Oui'], [false, 'Non']], 0)],
      gestes: avantLeDe('attaque', { annuler: true }), reserves: reserves(RESERVES.berta),
    }),
    fenetreSurLeDome('jet-avant-le-de-harpon', 'attaque avant le dé, le tir au lance-harpon', 'jet-avant-le-de-harpon', TOUR_DE_BERTA, {
      titre: 'Attaque',
      corps: [ligne('arme', 'Lance-harpon'), ligne('cible', 'Cible : Orc'), jet('jet', BERTA, 'Projectiles (Arbalète)', '≤ 33'), ligne('sansLaCorde/note', 'Corde tenue : Immobilisante, Portée 20.'), visee(ORC, 'Cible du tir')],
      reglages: [LOCALISATION, eteint('sansLaCorde', 'Tirer sans la corde (60 m, sans Immobilisante)')],
      gestes: avantLeDe('attaque', { annuler: true }), reserves: reserves(RESERVES.berta),
    }),
    fenetreSurLeDome('localisation-du-critique', 'attaque tombée, la localisation du Critique choisie', 'localisation-du-critique', TOUR_DE_BERTA, {
      titre: 'Attaque',
      corps: [ligne('arme', 'Épée'), ligne('cible', 'Cible : Orc'), jet('jet', BERTA, 'Corps à corps (Base)', '≤ 41', { resultat: '11', dr: '+3', reussite: true }, [['Résultat choisi', '']]),
        jet('defense', ORC, 'Parade', '≤ 35', { resultat: '62', dr: '−3', reussite: false })],
      reglages: [reglage('attaque', 'localisationDuCritique', 'Localisation du Critique', [[null, 'Au hasard'], ['tete', 'Tête'], ['corps', 'Corps'], ['brasD', 'Bras droit'], ['brasG', 'Bras gauche'], ['jambeD', 'Jambe droite'], ['jambeG', 'Jambe gauche']], 1)],
      gestes: apresLeDe('attaque', { reussi: true, chance: RESERVES.berta.chance, resilience: 0 }), reserves: reserves({ ...RESERVES.berta, resilience: 0 }),
    }),
  ],
} satisfies Ecran;
