/**
 * PORTEUR d'une prose du Codex — l'ADRESSE du champ d'où sort un texte rendu, que tout hôte passe au
 * tokeniseur d'auto-liage (`tokenizeLinks`, `./relations.ts`). Le périmètre des sites qui en portent un
 * reste à l'écran (`SITES_PROSE`, `src/ui/liage.ts`). PUR. #1392 #3059
 */

/**
 * PORTEUR d'une prose rendue : le champ d'où sort le texte, VERBATIM.
 *
 * `type` = la clé de CATÉGORIE Codex de l'entrée quand elle en a une (elle tranche les homonymes, cf.
 * `PRIORITY_CAT_ORDER`), sinon le `type` du dataset (`lieux-services`…). `id` = l'id STABLE de l'entrée.
 * `chemin` = chemin de clés jusqu'au champ, en notation `scripts/source/adresses.mjs:66-76` (clés par `.`,
 * index accolés : `rows[3].text`, `details.texts.age.bySpecies.humain`).
 *
 * Un texte qui n'existe verbatim dans AUCUN champ (synthèse, gabarit substitué, chaîne d'UI) n'a pas
 * de porteur — et ne lie donc rien.
 *
 * `chemin` n'est lu par AUCUN renderer : `<Prose>` ne consulte que `type`/`id` (ils arment
 * `tokenizeLinks`). Ses lecteurs sont les GARDES (`liens-du-catalogue.test.tsx` confronte le chemin
 * émis à `CHEMINS_ADRESSES`). Il est donc l'ADRESSE du champ, à
 * garder juste même si l'écran ne change pas quand il ment.
 */
export interface Porteur {
  type: string;
  id: string;
  chemin: string;
}

/**
 * PORTEUR d'une rangée de prose : le champ d'où sort son texte, VERBATIM — un `Porteur` dont `type`/`id`
 * ne sont posés que quand la rangée rend le champ d'une AUTRE entrée que la fiche qui l'affiche (fiche de
 * Race rendant les textes d'âge/taille/nom de `details.json`) ; absents, `porteurDeRangee` les complète
 * avec l'entrée affichée. Un porteur désigne le champ RÉEL, jamais la fiche où on le lit.
 */
export type PorteurDeRangee = Pick<Porteur, 'chemin'> & Partial<Pick<Porteur, 'type' | 'id'>>;

/**
 * Porteur d'une rangée : la rangée dit SON `chemin` (et, si le champ vit dans une AUTRE entrée, son
 * `type`/`id`) ; la fiche dit QUI elle rend. Ni l'un ni l'autre seul ne suffit — sans les deux, la
 * rangée est nue et ne lie rien (#1392 Lot E).
 */
export function porteurDeRangee(
  row: { t: string; porteur?: PorteurDeRangee },
  entree?: { type: string; id: string },
): Porteur | undefined {
  if (row.t !== 'text' || !row.porteur) return undefined;
  const type = row.porteur.type ?? entree?.type;
  const id = row.porteur.id ?? entree?.id;
  return type && id ? { type, id, chemin: row.porteur.chemin } : undefined;
}
