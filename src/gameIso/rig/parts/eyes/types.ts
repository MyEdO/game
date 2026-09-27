/**
 * Un ŒIL peint = un fichier `defs/<id>.ts`. L'œil est un élément ADRESSABLE des têtes
 * (`<g data-eye="G/D" data-ec="x y">…</g>`) qu'on REMPLACE en place. Art CENTRÉ sur (0,0), orbite
 * de référence rx≈2.05 ry≈1.3. Consommé par blessures (œil de verre/perdu/cache), mutations (Œil
 * énorme) et l'éditeur/créatures (yeux d'animaux). Ajouter un œil = déposer un fichier.
 */
export interface EyeDef {
  id: string;             // 'chat','caprin','verre','perdu','cache-oeil','enorme'… — clé de référence
  label: string;          // libellé FR
  art: string;            // SVG (peut utiliser socle() + jetons @peau)
  catalogOrder?: number;  // présent = listé dans EYE_OPTIONS (sélecteur éditeur), à cet ordre
}
