// Stock nominatif des trois couches CSS (#1800), lu par la comparaison des images Git.
//
// Trois collections, une par CLASSE de défaut (la MESURE vit dans `cssCouchesAudit.ts`, partagée
// avec le régénérateur) :
//   CSS_IDENTITE_ECRAN_RATCHET   une déclaration qui PEINT dans un module d'ÉCRAN — elle appartient
//                                à une primitive. Réf : `<sélecteur> :: <prop>`.
//   CSS_ESPACEMENT_RATCHET       un `gap`/`padding`/`margin` en littéral px/rem/em au lieu d'un pas
//                                `var(--sp-*)`. Réf : `<sélecteur> :: <prop> :: <valeur>`.
//   STYLE_INLINE_RATCHET         un `style=` hors de l'unique forme légale (objet dont TOUTES les
//                                clés sont des variables CSS, arbitrage user A2 du 2026-09-18).
//                                Réf : `<balise>[.<1re classe>] :: <clés triées>` (`expr` pour une
//                                valeur non littérale, `vide` pour `style={{}}`).
//
// Corps GÉNÉRÉ par `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/cssCouchesAudit.ts`
// (politique `decroissantSaufRetourne`) — jamais édité à la main. FORME : une ENTRÉE par occurrence,
// `{ fichier, ref, occurrence }`, celle de TOUT stock nominatif du dépôt (`cleDeSite`/`sitesEnEntrees`,
// `stock.mjs`) ; le `fichier` est ce que la porte de plage voit (`croissanceDesStocks`,
// `stocksNominatifs.mjs`), et ce que le codeur doit ouvrir pour solder.
//
// CLIQUET, pas absolution : la garde échoue (a) sur tout site NEUF — un écran neuf ne peint pas, ne
// pose pas de pixel hors échelle, n'écrit pas de style inline ; (b) sur toute entrée dont le site a
// disparu (soldée, à retirer par le régénérateur). Aucun PLAFOND : ce qu'une dette ne peut pas
// faire, c'est CROÎTRE sans se déclarer.
//
// Un site d'IDENTITÉ se solde en DÉPLAÇANT l'aspect vers le module de sa primitive (champ `css` du
// manifeste), jamais en l'effaçant : le stock rend visible une primitive planquée en module d'écran,
// il ne demande pas de dépeindre l'écran.
//
// ⚠ Angles morts DITS : la SUBSTITUTION à compte égal (un site fautif remplacé par un autre, même
// réf, même ordre) reste muette ; la RÉ-ORDINALISATION (corriger la 1re de deux occurrences
// homonymes) rend une périmée ET une neuve pour un seul geste ; le RENOMMAGE d'un sélecteur rend un
// faux neuf + un faux périmé — les trois se soldent par un `regen`, net 0 pour la porte de plage.
//
// FRONTIÈRE (#1806 L1) : un module de primitive n'est exempté que si l'un de ses propriétaires est
// RÉUTILISÉ (`modulesExemptes`, `cssCouches.mjs`) ; le module d'un composant à un seul hôte est au
// stock. Un module qui QUITTE la zone exempte y ramène ses sites RETOURNÉS — la seule croissance que
// la régénération admet (`decroissantSaufRetourne`, `cssCouchesAudit.ts`) — et le commit les déclare
// par une ligne `CLIQUET:` du porteur ; un module qui y ENTRE se déclare par `RECLASSEMENT: <module>
// +N — <motif #ticket>` (`reclassementCss.mjs`, chaque commit contre son parent).
// `npx tsx scripts/ui/ventilation-css-couches.mts <ref>` (`ventilationDeGit`, `cssImages.mjs`) rend
// par volet SORTI = RECLASSÉ + PRIMITIVISÉ + DISPARU, APPARU et RETOURNÉ.

/** @type {import('./stock.mjs').EntreeDeSite[]} */
export const CSS_IDENTITE_ECRAN_RATCHET = [];

/** @type {import('./stock.mjs').EntreeDeSite[]} */
export const CSS_ESPACEMENT_RATCHET = [];

/** @type {import('./stock.mjs').EntreeDeSite[]} */
export const STYLE_INLINE_RATCHET = [];
