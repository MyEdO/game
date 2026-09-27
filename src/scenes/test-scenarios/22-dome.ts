import { pregen, PREGEN } from '../../data/pregens';
import { makeSorceress } from './_casters';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * DÔME (`LDB 47 l.410`) — la sauvegarde qu'une ZONE octroie, sous la main du joueur.
 *
 * Trois choses à VOIR ici, qu'aucune autre scène ne mettait sous la main :
 *  - un TIR venu de l'EXTÉRIEUR sur la protégée → la sauvegarde tombe et le journal la NOMME ;
 *  - un coup de MÊLÉE sur la même protégée → aucune sauvegarde (le dôme ne couvre pas la mêlée) ;
 *  - l'Indice affiché est celui de la DONNÉE du sort (`spells.json › dome › ops[].indice`), pas un
 *    nombre du moteur.
 *
 * ARSENAL COURT, et c'est le point : la console de combat porte 12 alvéoles ; un lanceur à l'arsenal
 * complet (211 sorts) ne montre que ses premiers sorts alphabétiques et le Dôme n'est PAS cliquable.
 * La scène fixe donc les sorts d'Ilyanwe en DONNÉE, pour que le geste de recette existe à l'écran.
 *
 * L'ARCHER porte son arc en DONNÉE (`weapon: 'arc'`, patron `ecuries-clayonnage`) : la créature
 * `archer-gobelin` n'a AUCUNE arme à distance dans son statbloc (trait `arme` = mêlée, aucun
 * `trappings`), et sans arc l'IA n'a que la Course — la condition « provenant de l'extérieur » ne se
 * produisait jamais. Les trois gestes de recette sont dans `docs/recette-navigateur.md`.
 */

const HERO_START = { x: 3, y: 5 };

/** L'arsenal d'Ilyanwe, en DONNÉE de la scène : le Dôme qu'on vient voir, et de quoi jouer autour. */
const SORTS_ILYANWE = ['dome', 'bouclier-anti-fleches', 'flechette', 'lumiere'];

/** La Sorcière (lanceuse du Dôme) et la protégée qu'on vient voir encaisser — ou pas. */
function groupe() {
  const sorciere = makeSorceress('sorciere', 'Ilyanwe la Voilée', { ...HERO_START });
  sorciere.spells = [...SORTS_ILYANWE];
  const protegee = pregen(PREGEN.soldat);
  protegee.id = 'protegee';
  // Un nom, rien de plus : la couverture par le dôme est CALCULÉE par le moteur au moment du coup, un
  // nom qui l'écrirait la peindrait avant le lancer.
  protegee.label = 'Berta';
  return [sorciere, protegee];
}

function construireScene(): Scene {
  const scene = arena({ id: 'test-dome', label: 'Dôme — la sauvegarde d’une zone', w: 20, h: 10, heroStart: HERO_START });
  scene.startMessage =
    'Ilyanwe lance le Dôme sur elle-même (console : alvéole « Dôme », cible « Vous ») : Berta, à côté, '
    + 'gagne le Trait Protection (6+) contre ce qui vient du DEHORS. Le tireur gobelin tire de loin — la '
    + 'sauvegarde tombe et le journal la nomme. L’orc, lui, entre sous la voûte et frappe au corps à '
    + 'corps : là, le dôme ne protège de rien.';
  setEncounters(scene, [
    {
      id: 'enc-dome',
      enemies: [
        // TIREUR, volontairement LOIN et ARMÉ d'un arc : le dôme ne couvre que ce qui vient de
        // l'extérieur, donc l'attaquant doit rester hors du rayon pour que la sauvegarde s'offre — et il
        // n'y reste que s'il a de quoi TIRER (sans arme à distance, l'IA ferme la distance).
        { ref: 'archer-gobelin', pos: { x: 17, y: 5 }, facing: 'O', weapon: 'arc', label: 'Tireur gobelin' },
        // FRAPPEUR de mêlée : il vient AU CONTACT, donc sous la voûte — aucune sauvegarde ne lui répond.
        { ref: 'orc', pos: { x: 7, y: 5 }, facing: 'O' },
      ],
    },
  ]);
  return scene;
}

export const scenario: TestScenario = {
  id: 'dome',
  order: 20,
  category: 'magie',
  icon: 'scenario/magic',
  title: 'Dôme — la sauvegarde octroyée par une zone (LDB 47 l.410)',
  tests:
    'Le Dôme OCTROIE un Trait (`LDB 47 l.410`), il n’est pas une sauvegarde à part : son Indice vient de '
    + 'la DONNÉE du sort et rejoint le collecteur unique des sauvegardes « 1d10 ≥ Indice » '
    + '(`wardSaves`), au même site que Démoniaque/Protection. À voir : un TIR de l’extérieur ouvre la '
    + 'sauvegarde et le journal nomme le Trait qui a sauvé ; un coup de MÊLÉE sous la voûte n’en ouvre '
    + 'aucune ; deux dômes (ou un dôme sur qui porte déjà le Trait) ne donnent qu’UN dé.',
  partyNote: 'Ilyanwe (Haute Sorcière, 4 sorts posés par la scène — le Dôme en tête) · Berta (Soldat), la protégée',
  construire: () => ({ party: groupe(), scene: construireScene() }),
  autoCombat: 'enc-dome',
};
