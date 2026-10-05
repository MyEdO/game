/** Sites `chemin:ligne` d'un `.tsx` dont un élément interactif porte un `aria-label` littéral qui ne
 *  contient pas son texte visible littéral (WCAG 2.5.3, #2199). Contrat : en-tête de `nomVisibleDansNom.mjs`. */
export function sitesNomSansTexteVisible(f: { rel: string; text: string }): string[];
