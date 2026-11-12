/**
 * Les marques des États (#3834) : ce que chaque État montre sur son porteur, sa marque en donnée (`etats.json ›
 * marqueCouleur`, `marqueVisuel`, `marqueSon`). L’hôte dessine et joue ce qu’il reçoit, sans rien décider. Aucune
 * conséquence de règle.
 */
import { conditionLabel, findConditionById, type VisuelDeLumiere } from '../data';
import { sonDEffet, type SonDEffet } from '../data/sons/registre';
import { t as tr } from '../i18n';

/**
 * Une marque d'État (`vue.marques`, #3834) montre un État porté au-dessus de son porteur, tant qu'il le porte : son nom
 * à sa teinte, son visuel et son son en boucle, en donnée (`etats.json › marqueCouleur`, `marqueVisuel`, `marqueSon`).
 * @contrat Effets
 */
export interface MarqueDEtat {
  /** l'id de l'État. */
  id: string;
  /** son nom, suivi de sa valeur au-delà d'un (« Hémorragique 3 »). */
  texte: string;
  /** sa teinte `#rrggbb`. */
  couleur: string;
  /** le visuel de lumière qui entoure le porteur (`res://effets/flammes/<visuel>.tscn`) ; `null` : son nom seul. */
  visuel: VisuelDeLumiere | null;
  /** le son joué en boucle sur le porteur ; `null` : aucun. */
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
