/**
 * Les marques des États (#3834) : ce que chaque État montre sur son porteur, sa marque en donnée (`etats.json ›
 * marqueCouleur`, `marqueVisuel`, `marqueSon`). L’hôte dessine et joue ce qu’il reçoit, sans rien décider. Aucune
 * conséquence de règle.
 */
import { conditionLabel, findConditionById, type VisuelDeLumiere } from '../data';
import { sonDEffet, type SonDEffet } from '../data/sons/registre';
import { t as tr } from '../i18n';

/** La marque d'un État porté : son texte (son nom, et sa valeur au-delà d'un), sa teinte, son visuel et son son en
 *  boucle. */
export interface MarqueDEtat {
  id: string;
  texte: string;
  couleur: string;
  visuel: VisuelDeLumiere | null;
  son: SonDEffet | null;
}

/** Le texte de l'État d'id `id` porté à la valeur `valeur`. */
export const texteDeLEtat = (id: string, valeur: number): string =>
  valeur > 1 ? tr('fx.etatCumule', { etat: conditionLabel(id), n: valeur }) : conditionLabel(id);

/** Les marques des États `etats` (`{ id, valeur }`, ceux d'un combattant projeté), dans leur ordre. */
export function marquesDesEtats(etats: readonly { id: string; valeur: number }[]): MarqueDEtat[] {
  return etats.map(({ id, valeur }) => {
    const { marqueCouleur, marqueVisuel, marqueSon } = findConditionById(id)!;
    return { id, texte: texteDeLEtat(id, valeur), couleur: marqueCouleur, visuel: marqueVisuel ?? null, son: marqueSon ? sonDEffet(marqueSon.id) : null };
  });
}
