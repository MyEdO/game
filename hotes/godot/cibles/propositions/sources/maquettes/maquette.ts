/**
 * LES MAQUETTES EN DONNÉE (#4411) : une maquette est une planche (`Planche`, `hotes/godot/recettes/ecran.ts`), les
 * réponses du pont par méthode telles que Godot les reçoit, et, à côté du contrat, les gabarits qu'elle empile et le
 * décor illustré que le jeu dessine en 3D. La page de rendu (`../rendu.html`, `../rendu.js`) la dessine avec les pièces
 * du kit (`../gestes.js`), `../rendre.mjs` la capture. Gabarits : `../../dispositions.md` § « Par type d'écran ». Une
 * maquette d'un état que le jeu fige (`figerLesPlanches`) le nomme (`MaquetteCapturee`) : elle ne le recopie pas. Un
 * fichier de `maquettes/` est un écran (`Ecran`) : la liste de ses états, chacun une maquette nommée.
 */
import type { Planche, PlancheDeLEcran } from '../../../../recettes/ecran';
import type { Suite, VueDuPont } from '../../../../pont/pont';
import type { Projection } from '../../../../../../src/hote/projection';
import { ZONES_VIDES } from '../../../../recettes/ecran';
import type { ZonesDeLEcran, ZonesDeLaSuite } from '../../../../../../src/hote/ecran';
import type { Jeu } from '../../../../../../src/hote/elements';

/** Le jeu d'un geste de maquette : aucun appel. Une maquette se regarde, elle ne se joue pas : ses gestes ne nomment
 *  aucun verbe du noyau, que seul le noyau sert. */
export const SANS_JEU: Jeu = { suite: [] };

/** Les huit types d'écran de `../../dispositions.md`, dans l'ordre de la page. */
export type Gabarit = 'ouverture' | 'gestion' | 'fiche' | 'lieu-et-voyage' | 'combat' | 'fenetre-du-bas' | 'recit' | 'edition';

/** Le décor illustré que le contrat ne nomme pas : la cour du combat (`../combat/cour.js`), à l'état qu'elle dessine,
 *  et par combattant de la planche le buste qui le dessine (`BUSTES`, `../gestes.js`) : le jeu tire le portrait du corps
 *  3D, la maquette d'un dessin. */
export interface Decor {
  /** `cour-videe` : la cour sans son voile de fin, ses adversaires tombés, pour ce qui suit le combat. */
  scene: 'cour' | 'cour-videe';
  /** L'état de la cour (`NEUFS`, `../combat/cour.js`). */
  variante: string;
  bustes: Record<string, string>;
}

/** Les bustes des combattants du dôme (`src/scenes/test-scenarios/22-dome.ts`), que ses planches de combat
 *  partagent. */
export const BUSTES_DU_DOME: Decor['bustes'] = { sorciere: 'ilyanwe', protegee: 'berta', 'enemy-enc-dome-1': 'orc', 'enemy-enc-dome-0': 'gobelin' };

/** Ce qu'une maquette pose à côté du contrat : ses gabarits de dessous en dessus, son décor ; `null` quand le contrat
 *  porte le fond (`Paysage`, `Fond`) ou qu'il n'y a que la matière. */
interface AcoteDuContrat {
  gabarits: [Gabarit, ...Gabarit[]];
  decor: Decor | null;
}

/** Une maquette écrite : une planche, pour un état que le jeu ne fige pas. */
export type Maquette = Planche & AcoteDuContrat;

/** Une maquette capturée : l'état `nom`, la planche que `figerLesPlanches` fige sous le nom `planche`, lue au rendu
 *  (`../rendre.mjs`). */
export type MaquetteCapturee = { nom: string; planche: string } & AcoteDuContrat;

/** Un écran : ses états, chacun une maquette écrite ou capturée, à son nom. */
export interface Ecran {
  etats: [Maquette | MaquetteCapturee, ...(Maquette | MaquetteCapturee)[]];
}

/** La part d'une vue qu'une maquette écrit : ses zones non vides, sa disposition, et ce que la projection dit du
 *  combat, de l'exploration et de la fenêtre. */
export interface EcranDeMaquette {
  disposition: string | null;
  zones: Partial<ZonesDeLEcran>;
  journal: ZonesDeLaSuite['journal.lignes'];
  projection: Pick<Projection, 'combat' | 'exploration' | 'fenetre'>;
}

/** Les réponses d'une planche de l'écran (`PlancheDeLEcran`) pour `ecran` : la suite d'un état sans jeton ni effet,
 *  ses autres zones vides, sans corps ni plateau. */
export const reponsesDeLEcran = ({ disposition, zones, journal, projection }: EcranDeMaquette): PlancheDeLEcran['reponses'] => {
  const vue: VueDuPont = {
    projection: { pas: 0, ecran: 'campaign', scene: null, jets: [], refus: null, journal: 0, ...projection },
    corps: { refus: null, combattants: {}, vehicules: {}, navires: {}, decors: {} },
    disposition,
    zones: { ...ZONES_VIDES, ...zones },
    cases: [],
    plateau: null,
    lumiere: null,
    musique: null,
    zonesQuiDurent: [],
    marques: {},
    champ: null,
    occupants: {},
    casesDesCibles: {},
    vision: null,
  };
  const suite: Suite = { vue, programmes: [], journal: [], zones: { 'journal.lignes': journal }, effets: [] };
  return { demarrer: { ok: true, ...suite } };
};
