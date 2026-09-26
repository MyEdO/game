/**
 * SOURCE ASCII de la carte de l'opéra (généré une fois depuis l'ancienne géométrie, puis ÉDITABLE ici).
 * 1 char = 1 case ; format box-drawing de `parseWalledAscii` (lignes/colonnes paires = ARÊTES).
 * Légende cases : ' '=vide (hors bâtiment / PUITS de rampe) · ','=salle (dalle) · 'P'=parterre (parquet) ·
 *   'M'=foyer (marbre) · 'S'=scène (planches, +1 m) · 's'=fosse (planches, −1 m) · '#'=masse de maçonnerie
 *   (le glyphe `ascii` de `terrains.json` ; à l'étage, le MUR DE FOND DE SCÈNE qui ferme la cage de scène sous le
 *   mur nord — au rez, la rangée 1 est celle des COULISSES, au NORD de la scène — NADJ 08 folio 39 : le
 *   puits touche le mur nord, rien ne relie les deux flancs par le haut).
 *   Arêtes : '-'=mur (N) ·
 *   '|'=mur (E) · ':'=PORTE · 'w'=cloison de bois (`OPERA_WALL_LEGEND` de `floorplan.ts` : mur SANS
 *   structure, apparence seule — les refends entre loges voisines des deux flancs de l'étage) ·
 *   'g'=GARDE-CORPS (structure `garde-corps`, même table) sur chaque arête rive|puits de l'étage.
 *   Les 2 PUITS de rampe (angles du foyer, où la couche 0 monte 0→4 m rejoindre la
 *   galerie) sont TROUÉS ici même à l'étage (cases ' ' aux cols 6-8 / 35-37, rangées 46-49) — plus aucun
 *   perçage en code. Seule l'ÉLÉVATION MÉTRIQUE (S/s + rampes + galerie à 4 m) est posée par `floorplan.ts`
 *   (via `MapSpec.relief`), la donnée non exprimable en 1 char.
 * Largeur de grille = 89 (= 2·44+1) ; les espaces de fin sont retirés → `MapSpec.walled` re-complète.
 */
export const REZ_ASCII = String.raw`


   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  |, , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , , , , ,|, , , , ,:

  |, , , , , , , , , , , , , , , , , , , , , , , , , , , , ,:, , , , , , , ,|, , , , ,|

  |, , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , , , , ,|, , , , ,|

  |, , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , , , , ,|, , , , ,|
   - - : - - - - - - - - - - - - - - - - - - - - - - - - - - -               - - : - -
  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S:, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,:, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,:, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|
                                                                             : - - - -
  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,:, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|
   - - : - - - - - - - - - - - : - - - - - - - - - - - - : - - - - - - - - - - - : - -
  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|
   - - : - - - - - - - - - - - - -
  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|
                                   - - - - - : - - - - -
  |, , , , , , , , , , , , , , , ,|P P P P P P P P P P P|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|P P P P P P P P P P P|, , , , , , , , , , , , , , ,|
                                 -                       -
  |, , , , , , , , , , , , , , ,|P P P P P P P P P P P P P|, , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , ,|P P P P P P P P P P P P P|, , , , , , , , , , , , , ,|
   - - : - - - - - - - - - - - -                           - - - - - - - - - - - : - -
  |, , , , , , , , , , , , , , ,|P P P P P P P P P P P P P|, , , , , , , , , , , , , ,|
                               -                           -
  |, , , , , , , , , , , , , ,|P P P P P P P P P P P P P P P|, , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , ,|P P P P P P P P P P P P P P P|, , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , ,|P P P P P P P P P P P P P P P|, , , , , , , , , , , , ,|
                             -                               -
  |, , , , , , , , , , , , ,|P P P P P P P P P P P P P P P P P|, , , , , , , , , , , ,|

  |, , , , , , , , , , , , ,|P P P P P P P P P P P P P P P P P|, , , , , , , , , , , ,|

  |, , , , , , , , , , , , ,|P P P P P P P P P P P P P P P P P|, , , , , , , , , , , ,|
                           -                                   - - - - - - - - - : - -
  |, , , , , , , , , , , ,:P P P P P P P P P P P P P P P P P P P:, , , , , , , , , , ,|

  |, , , , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P|, , , , , , , , , , ,|
                         -                                       -
  |, , , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , , ,|
   - - : - - - - - - - -
  |, , , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , , ,|
                                                                   - - - - - - - : - -
  |, , , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , , ,|
                       -                                           -
  |, , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , ,|

  |, , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , ,|

  |, , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , ,|
                     -                                               -
  |, , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , ,|
   - - : - - - - - -
  |, , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , ,|

  |, , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , ,|
                   -                                                   -
  |, , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , ,|

  |, , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , ,|
   - - : - - - - - : - - - - - - - - - - - - - - - - - - - - - - - - - : - - - - : - -
  |, , , , , , , , , , , ,|, , , , , , , , , , , , , , , , , ,|, , , , , , , , , , , ,|

  |M M M M M M M M M M M M|M M M M M M M M M M M M M M M M M M|M M M M M M M M M M M M|
             - : -                                                     - : -
  |M M M M M|M M M|M M M M|M M M M M M M M M M M M M M M M M M|M M M M|M M M|M M M M M|

  |M M M M M|M M M|M M M M:M M M M M M M M M M M M M M M M M M:M M M M|M M M|M M M M M|

  |M M M M M|M M M|M M M M|M M M M M M M M M M M M M M M M M M|M M M M|M M M|M M M M M|

  |M M M M M|M M M|M M M M|M M M M M M M M M M M M M M M M M M|M M M M|M M M|M M M M M|

  |M M M M M|M M M|M M M M|M M M M M M M M M M M M M M M M M M|M M M M|M M M|M M M M M|
             - : -         - : - -                       - : - -       - : -
  |M M M M M M M M M M M M|M M M M|M M M M M M M M M M M|M M M M|M M M M M M M M M M M|

  |M M M M M M M M M M M M|M M M M|M M M M M M M M M M M|M M M M|M M M M M M M M M M M|

  |M M M M M M M M M M M M|M M M M|M M M M M M M M M M M|M M M M|M M M M M M M M M M M|
                           - - - -                       - - - -
  |M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|

  |M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|
     - : -                                                                     - : -
  |M|M M M|M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|M M M|M|

  |M|M M M|M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|M M M|M|
   - - - -                                                                     - - - -
          |M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|
           - - - - - - - - - - - - : - - - - - - - - - : - - - - - - - - - - -


`;

export const ETAGE_ASCII = String.raw`


   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  |P P P PwM M M M M M M M M # # # # # # # # # # # # # # # # P P P P P P P P P P P P P|

  |P P P PwM M M M M M M M Mg                               gP P P P P P P P P P P P P|

  |P P P P:M M M M M M M M Mg                               gP P P P P P P P P P P P P|

  |P P P PwM M M M M M M M Mg                               gP P P P P P P P P P P P P|
                           g                                 g
  |P P P PwM M M M M M M Mg                                   gP P P P P P P P P P P P|
           w w w w w w w w                                     w w w w w w w w w w : w
  |P P P PwP P P P P P P Pg                                   gP P P P P P P P P P P P|
   w : w w               g                                     g
  |P P P P P P P P P P Pg                                       gP P P P P P P P P P P|

  |P P P P P P P P P P Pg                                       gP P P P P P P P P P P|
                       g                                         g
  |P P P P P P P P P Pg                                           gP P P P P P P P P P|

  |P P P P P P P P P Pg                                           gP P P P P P P P P P|
       w w w w w w w w                                             w w w w w w w w
  |P P|P P P P P P P Pg                                           gP P P P P P P P|P P|

  |P P|P P P P P P P Pg                                           gP P P P P P P P|P P|
                     g                                             g
  |P P:P P P P P P Pg                                               gP P P P P P P:P P|

  |P P|P P P P P P Pg                                               gP P P P P P P|P P|

  |P P|P P P P P P Pg                                               gP P P P P P P|P P|
       w w w w w w w                                                 w w w w w w w
  |P P|P P P P P P Pg                                               gP P P P P P P|P P|

  |P P|P P P P P P Pg                                               gP P P P P P P|P P|

  |P P:P P P P P P Pg                                               gP P P P P P P:P P|

  |P P|P P P P P P Pg                                               gP P P P P P P|P P|

  |P P|P P P P P P Pg                                               gP P P P P P P|P P|
       - - - - - - g                                                 g - - - - - -
  |P P|P P P P P Pg                                                   gP P P P P P|P P|

  |P P|P P P P P Pg                                                   gP P P P P P|P P|

  |P P|P P P P P Pg                                                   gP P P P P P|P P|

  |P P|P P P P P Pg                                                   gP P P P P P|P P|
                   g                                                 g
  |P P|P P P P P P Pg                                               gP P P P P P P|P P|

  |P P|P P P P P P Pg                                               gP P P P P P P|P P|

  |P P|P P P P P P Pg                                               gP P P P P P P|P P|
                     g                                             g
  |P P|P P P P P P P Pg                                           gP P P P P P P P|P P|

  |P P|P P P P P P P Pg                                           gP P P P P P P P|P P|
                       g                                         g
  |P P|P P P P P P P P Pg                                       gP P P P P P P P P|P P|
                         g                                     g
  |P P|P P P P P P P P P Pg                                   gP P P P P P P P P P|P P|

  |P P|P P P P P P P P P Pg                                   gP P P P P P P P P P|P P|
                           g                                 g
  |P P|P P P P P P P P P P Pg                               gP P P P P P P P P P P|P P|
                             g g                         g g
  |P P|P P P P P P P P P P P P Pg                       gP P P P P P P P P P P P P|P P|
                                 g                     g
  |P P|P P P P P P P P P P P P P Pg                   gP P P P P P P P P P P P P P|P P|
                                   g g g         g g g
  |P P|P P P P P P P P P P P P P P P P Pg       gP P P P P P P P P P P P P P P P P|P P|
                                         g g g g
  |P P|P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|P P|

  |P P|P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|P P|

  |P P|P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|P P|

  |P P|P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|P P|

  |P P|P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|P P|
       - - - - - - - - - - - - - - - - : : : : : : - - - - - - - - - - - - - - - -
  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|
   - - - - - - - - - - - -                                     - - - - - - - - - - - -
  |P P P P P       P P P P|P P P P P P P P P P P P P P P P P P|P P P P       P P P P P|

  |P P P P P       P P P P|P P P P P P P P P P P P P P P P P P|P P P P       P P P P P|

  |P P P P P       P P P P|P P P P P P P P P P P P P P P P P P|P P P P       P P P P P|

  |P P P P P       P P P P|P P P P P P P P P P P P P P P P P P|P P P P       P P P P P|
   - - - - - - - - - - : - - - - - - - : : : : : : - - - - - - - : - - - - - - - - - -
  |P P P P P P P P P P P P|P P P P P P P P P P P P P P P P P P|P P P P P P P P P P P P|

  |P P P P P P P P P P P P|P P P P P P P P P P P P P P P P P P|P P P P P P P P P P P P|

  |P P P P P P P P P P P P|P P P P P P P P P P P P P P P P P P|P P P P P P P P P P P P|

  |P P P P P P P P P P P P:P P P P P P P P P P P P P P P P P P:P P P P P P P P P P P P|

  |P P P P P P P P P P P P|P P P P P P P P P P P P P P P P P P|P P P P P P P P P P P P|

  |P P P P P P P P P P P P|P P P P P P P P P P P P P P P P P P|P P P P P P P P P P P P|

  |P P P P P P P P P P P P|P P P P P P P P P P P P P P P P P P|P P P P P P P P P P P P|

  |P P P P P P P P P P P P|P P P P P P P P P P P P P P P P P P|P P P P P P P P P P P P|
   - - - -                                                                     - - - -
          |P P P P P P P P|P P P P P P P P P P P P P P P P P P|P P P P P P P P|
           - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


`;
