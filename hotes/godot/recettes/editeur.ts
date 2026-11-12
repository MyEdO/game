/**
 * L'ÉDITEUR FIGÉ DU NAVIRE (#3772) : ce que la recette native de l'éditeur (`projet/recettes/editeur-navire.gd`) lit,
 * figé par la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. L'atelier figé sur les véhicules
 * et les pièces d'Amélioration du dossier des modèles (`figerLAtelier`), la campagne de l'adresse (`parametres`), et sur
 * son pont, l'Arène ouverte et la caraque posée comme Godot la joue (`GESTES`) : chaque entrée de `editer` sous la clé
 * que la recette en calcule, sa réponse ; après chaque réponse qui sert un manifeste, l'entrée de `morceaux` que
 * l'éditeur envoie alors (source `edition`, les clés dont l'empreinte posée diffère, `VolumeDeScene.manquants`) sous sa
 * clé, sa réponse ; puis les cases du pont du dessus que les morceaux posés au dernier manifeste touchent sans les
 * peindre (`touches`), où la recette lâche son rayon.
 */
import type { Bouton, Choix } from '../../../src/hote/elements';
import type { MorceauDuMonde } from '../../../src/noyau/index';
import type { MondeDuPont } from '../pont/pont';
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
  monde?: NonNullable<MondeDuPont['monde']>;
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

/** Les cases `{ x, y, z }` du pont du dessus du navire servi dans `morceaux` : celles d'un triangle de ce navire tourné
 *  vers le ciel à sa couche la plus haute, hors des colonnes où se tient un décor, que le rayon toucherait d'abord. */
function casesDuPontDuDessus(morceaux: readonly MorceauDuMonde[]) {
  const triangles = morceaux.flatMap(({ surfaces, cases, normales }) => surfaces.flatMap(({ debut, fin, navire, matiere }) =>
    Array.from({ length: (fin - debut) / 3 }, (_, i) => ({ case: cases.slice(debut + 3 * i, debut + 3 * i + 3), haut: normales[(debut + 3 * i) * 3 + 1] > 0.99, navire, decor: matiere.startsWith('prop--') }))));
  const du = triangles.filter(({ navire }) => navire !== undefined);
  const haut = Math.max(...du.map((t) => t.case[2]));
  const decors = new Set(triangles.filter(({ decor }) => decor).map((t) => `${t.case[0]},${t.case[1]}`));
  const cles = new Set(du.filter((t) => t.case[2] === haut && t.haut).map((t) => t.case.join(',')));
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
  /** Les morceaux posés, par clé, et les réponses de `morceaux` par clé d'entrée. */
  const poses = new Map<string, MorceauDuMonde>();
  const morceaux: Record<string, unknown> = {};
  /** La réponse `r` jouée comme l'éditeur la suit : un manifeste servi, il demande les morceaux dont l'empreinte posée
   *  diffère, s'il en manque, et pose le manifeste. */
  const suivre = (r: Reponse): Reponse => {
    if (!r.monde) return r;
    const entree = { source: 'edition', volume: r.monde.morceaux.filter(({ cle, empreinte }) => poses.get(cle)?.empreinte !== empreinte).map(({ cle }) => cle), toits: [], couronnes: [] };
    const recus = entree.volume.length ? appel('morceaux', entree) as unknown as { ok: boolean; volume: MorceauDuMonde[] } : { ok: true, volume: [] };
    if (!recus.ok) throw new Error(`éditeur figé : morceaux ${JSON.stringify(entree)} : ${JSON.stringify(recus)}`);
    const cle = cleDEntree(entree);
    if (entree.volume.length && cle in morceaux && JSON.stringify(morceaux[cle]) !== JSON.stringify(recus)) throw new Error(`éditeur figé : deux réponses de morceaux sous ${cle}`);
    if (entree.volume.length) morceaux[cle] = recus;
    const recu = new Map(recus.volume.map((m) => [m.cle, m]));
    const gardes = r.monde.morceaux.map(({ cle }) => recu.get(cle) ?? poses.get(cle)!);
    poses.clear();
    for (const m of gardes) poses.set(m.cle, m);
    return r;
  };
  const ouvrir = { ouvrir: 'arene' };
  const reponses: [string, Reponse][] = [[cleDEntree(ouvrir), suivre(jouer(ouvrir))]];
  for (const geste of GESTES) {
    const jeu = typeof geste === 'string' ? boutonDe(reponses[reponses.length - 1][1], geste).jeu : null;
    reponses.push(jeu ? [cleDUnJeuLu(jeu), suivre(jouer(jeu))] : [cleDEntree({ edition: geste }), suivre(jouer({ edition: geste }))]);
  }
  const servis = reponses.flatMap(([, r]) => (r.navires && Object.keys(r.navires).length ? [r.navires] : []));
  const [id] = Object.keys(servis[0]);
  if (!reponses[reponses.length - 1][1].monde) throw new Error('éditeur figé : le pont du dessus choisi sans monde servi');
  return {
    ...fige,
    parametres: { campagne: 'arene' },
    editer: Object.fromEntries(reponses),
    morceaux,
    pointes: GESTES.filter((g) => typeof g !== 'string'),
    navire: { id, pose: servis[0][id].centre, deplace: servis[servis.length - 1][id].centre },
    touches: casesDuPontDuDessus([...poses.values()]),
  };
}
