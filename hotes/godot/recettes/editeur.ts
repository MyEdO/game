/**
 * L'ÉDITEUR FIGÉ DU NAVIRE (#3772) : ce que la recette native de l'éditeur (`projet/recettes/editeur-navire.gd`) lit,
 * figé par la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. L'atelier figé sur les véhicules
 * et les pièces d'Amélioration du dossier des modèles (`figerLAtelier`), la campagne de l'adresse (`parametres`), et sur
 * son pont, l'Arène ouverte et la caraque posée comme Godot la joue (`GESTES`) : chaque entrée de `editer` sous la clé
 * que la recette en calcule, sa réponse ; puis les cases du pont du dessus que le monde servi touche sans les peindre
 * (`touches`), où la recette lâche son rayon.
 */
import type { Bouton, Choix } from '../../../src/hote/elements';
import type { VolumeDuMonde } from '../../../src/noyau/index';
import { estObjet } from '../../../src/lib/objet.mjs';
import { figerLAtelier, type Listage } from './atelier';
import { cleDEntree } from './vehicule';

/** Un geste du pointeur `geste` sur la case `x`, `y`, au point de la carte `fx`, `fy`, hors des cases entières comme le
 *  monde touche. */
const pointe = (geste: string, x: number, y: number, fx: number, fy: number) => ({ geste, point: { case: { x, y }, f: { x: fx, y: fy } } });

/** Les gestes de la recette après l'ouverture de l'Arène, dans l'ordre : l'outil Navire, qui offre la caraque en tête,
 *  le cap à l'est, l'appui qui la pose, l'outil de sélection, la caraque glissée de deux cases vers l'est par la case de
 *  son ancre, puis le pont du dessus, sa couche la plus haute. Un geste nommé est le `jeu` du bouton de cet id dans la
 *  réponse d'avant, que Godot a lu ; `couche/haute`, le dernier bouton du choix des couches. */
const GESTES: readonly (string | ReturnType<typeof pointe>)[] = [
  'outil/navire',
  'navire/cap/E',
  pointe('appui', 10, 6, 10.25, 6.25),
  'outil/select',
  pointe('appui', 10, 6, 10.125, 6.125),
  pointe('glisse', 12, 6, 12.125, 6.125),
  pointe('relache', 12, 6, 12.125, 6.125),
  'couche/haute',
];

interface Reponse {
  ok: boolean;
  vue: { zones: Record<string, (Bouton | Choix | { type: string; id: string })[]> };
  monde?: VolumeDuMonde;
  navires?: Record<string, { centre: { x: number; y: number } }>;
}

/** `jeu` en JSON comme `JSON.stringify` de Godot écrit un jeu qu'il a lu d'une réponse (`JSON.parse_string`) : les
 *  clés triées, chaque nombre flottant. */
const cleDUnJeuLu = (jeu: unknown): string =>
  typeof jeu === 'number' ? (Number.isInteger(jeu) ? `${jeu}.0` : String(jeu))
    : Array.isArray(jeu) ? `[${jeu.map(cleDUnJeuLu).join(',')}]`
      : estObjet(jeu) ? `{${Object.keys(jeu).sort().map((k) => `${JSON.stringify(k)}:${cleDUnJeuLu(jeu[k])}`).join(',')}}`
        : JSON.stringify(jeu);

/** Le bouton d'id `id` de `r`, seul ou parmi les valeurs d'un choix ou d'une liste. */
function boutonDe(r: Reponse, id: string): Bouton {
  const boutons = Object.values(r.vue.zones).flat().flatMap((el) => (el.type === 'bouton' ? [el as Bouton] : el.type === 'choix' || el.type === 'liste' ? (el as Choix).valeurs : []));
  const trouves = id === 'couche/haute' ? boutons.filter((b) => /^couche\/\d+$/.test(b.id)).slice(-1) : boutons.filter((b) => b.id === id);
  if (trouves.length !== 1) throw new Error(`éditeur figé : aucun bouton ${id}`);
  return trouves[0];
}

/** Les cases `{ x, y, z }` du pont du dessus du navire servi dans `monde` : celles d'un triangle de ce navire tourné
 *  vers le ciel à sa couche la plus haute, hors des colonnes où se tient un décor, que le rayon toucherait d'abord. */
function casesDuPontDuDessus(monde: VolumeDuMonde) {
  const triangles = monde.surfaces.flatMap(({ debut, fin, navire, matiere }) =>
    Array.from({ length: (fin - debut) / 3 }, (_, i) => ({ t: debut / 3 + i, navire, decor: matiere.startsWith('prop--') })));
  const du = triangles.filter(({ navire }) => navire !== undefined);
  const haut = Math.max(...du.map(({ t }) => monde.cases[t][2]));
  const decors = new Set(triangles.filter(({ decor }) => decor).map(({ t }) => `${monde.cases[t][0]},${monde.cases[t][1]}`));
  const cles = new Set(du.filter(({ t }) => monde.cases[t][2] === haut && monde.normales[t * 9 + 1] > 0.99).map(({ t }) => monde.cases[t].join(',')));
  return [...cles].filter((c) => !decors.has(c.split(',').slice(0, 2).join(','))).map((c) => {
    const [x, y, z] = c.split(',').map(Number);
    return { x, y, z };
  });
}

/** L'éditeur figé sur les véhicules et les pièces d'Amélioration de `listage`. */
export function figerLEditeurDuNavire(listage: Listage) {
  const { fige, appel } = figerLAtelier(listage, (_id, { categorie }) => categorie === undefined || ['vehicule', 'amelioration'].includes(categorie));
  const jouer = (entree: unknown): Reponse => {
    const r = appel('editer', entree) as unknown as Reponse;
    if (!r.ok) throw new Error(`éditeur figé : editer ${JSON.stringify(entree)} : ${JSON.stringify(r)}`);
    return r;
  };
  const ouvrir = { ouvrir: 'arene' };
  const reponses: [string, Reponse][] = [[cleDEntree(ouvrir), jouer(ouvrir)]];
  for (const geste of GESTES) {
    const jeu = typeof geste === 'string' ? boutonDe(reponses[reponses.length - 1][1], geste).jeu : null;
    reponses.push(jeu ? [cleDUnJeuLu(jeu), jouer(jeu)] : [cleDEntree({ edition: geste }), jouer({ edition: geste })]);
  }
  const servis = reponses.flatMap(([, r]) => (r.navires && Object.keys(r.navires).length ? [r.navires] : []));
  const [id] = Object.keys(servis[0]);
  const monde = reponses[reponses.length - 1][1].monde;
  if (!monde) throw new Error('éditeur figé : le pont du dessus choisi sans monde servi');
  return {
    ...fige,
    parametres: { campagne: 'arene' },
    editer: Object.fromEntries(reponses),
    pointes: GESTES.filter((g) => typeof g !== 'string'),
    navire: { id, pose: servis[0][id].centre, deplace: servis[servis.length - 1][id].centre },
    touches: casesDuPontDuDessus(monde),
  };
}
