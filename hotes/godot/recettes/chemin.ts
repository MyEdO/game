/**
 * LE CHEMIN FIGÉ DU GROUPE (#3822) : ce que la recette native du chemin (`projet/recettes/chemin-du-groupe.gd`) lit, figé
 * par la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. L'atelier figé sur chaque modèle du
 * dossier, sa partie rendue au noyau (`figerUnePartie`), puis, sur son pont, « La porte close » jouée comme Godot la
 * joue : chaque fenêtre de l'entrée par son geste en focus, la porte ouverte par son bouton, seul geste d'exploration, le manifeste du monde de la scène
 * (`monde`), la géométrie de toutes ses clés (`morceaux`, source `partie`), la suite d'avant le clic (`avant`), puis
 * celle du clic de `CASE_DU_REDUIT`, au-delà de la porte et hors de l'axe du groupe (`apres`).
 */
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton } from '../../../src/hote/elements';
import type { MondeDuPont, Suite } from '../pont/pont';
import { figerUnePartie, type Listage } from './atelier';
import { toutesLesCles } from './ecran';

/** La case du réduit que le groupe gagne : son chemin passe la porte, puis tourne. */
export const CASE_DU_REDUIT = { x: 4, y: 0 };

/** Le chemin figé sur les modèles de `listage`. */
export function figerLeChemin(listage: Listage) {
  return figerUnePartie(listage, () => true, ({ fige, appel }) => {
    const jouer = (methode: string, entree: unknown): Suite => {
      const r = appel(methode, entree) as unknown as { ok: boolean } & Suite;
      if (!r.ok) throw new Error(`${methode} ${JSON.stringify(entree)} : ${JSON.stringify(r)}`);
      return r;
    };
    let s = jouer('demarrer', { scenario: 'porte-close', graine: 7 });
    for (let pas = 0; s.vue.projection.fenetre; pas++) {
      if (pas > 10) throw new Error(`fenêtres sans fin : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
      s = jouer('jouer', s.vue.zones['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.focus)!.jeu);
    }
    const [porte, ...autres] = s.vue.zones['exploration.gestes'];
    if (!porte || autres.length) throw new Error(`la porte fermée, seul geste d’exploration attendu : ${JSON.stringify(s.vue.zones['exploration.gestes'])}`);
    const avant = jouer('jouer', porte.jeu);
    const monde = appel('monde') as unknown as MondeDuPont;
    const morceaux = appel('morceaux', toutesLesCles(monde));
    return { ...fige, monde, morceaux, avant, apres: jouer('jouer', { type: CLIC_DU_CHAMP, args: [CASE_DU_REDUIT] }) };
  });
}
