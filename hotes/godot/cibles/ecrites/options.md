# Cible de finition des options (#3935), 2026-11-18

Maquettes : `maquettes/options.png`, `options-chance.png`, `options-verrou.png`, rendues à l'échelle 1 depuis leur
source : `propositions/sources/maquettes/options.ts` (les zones des réglages du noyau, dessinées par `rendu.html`) pour
la première, `propositions/sources/accueil-et-systeme/options-*.html` (`options.css`, `options.js`) pour les deux autres. Les cotes, polices,
couleurs et l'ordre des pièces se lisent à la source ; l'image ne sert qu'au côte à côte. Compte rendu :
`propositions/accueil-et-systeme.md`, section `options`. Choix de Laurent du 2026-11-18 : « Ok le suivant c est la
page d option alors ».

## Ce que le joueur voit

1. **Le titre en haut à gauche** : le cartouche « Options », sous-titre « Préférences et règles maison », médaillon à
   pictogramme. La croix ferme l'écran, en haut à droite.
2. **Le volet des préférences**, à gauche, toujours visible : ruban « Préférences », puis une ligne par préférence
   (couper le son, les quatre volumes en curseur avec leur pourcentage, la cadence de combat, les dés fixés), le
   choix en segments Non/Oui ou à plusieurs valeurs, une ligne d'aide en italique sous ce qui en a une.
3. **Le registre des règles maison**, au centre : un livre ouvert sur deux pages de parchemin. En tête de la page de
   gauche, le domaine en gothique et son compte ; la page de droite dit la suite et la plage montrée. Chaque règle
   est une ligne : son nom, sa référence nue dessous, son contrôle à droite (segments, curseur à valeur, liste à
   flèches). Une règle modifiée passe au rouge, avec une pastille et « Défaut » qui la remet. La règle pointée
   déplie son aide sur un billet plus clair.
4. **Le pied du livre** : flèches de feuillet, « Feuillet 1 sur 2 », le compte des règles modifiées.
5. **Les signets**, à droite du livre : un par domaine, son nom et son compte, le signet ouvert en laiton, une
   pastille rouge s'il porte une règle modifiée.

## États

- `options-verrou` : en combat, chaque contrôle de règle est fermé, la raison du noyau au survol ; les préférences
  restent ouvertes.
- `options-chance` : la règle `chance-en-cours-de-session` sur `manual` porte sa plaque « Regagner la Chance
  maintenant ».

## Ce qui ne change pas

- Les préférences et les règles, leurs valeurs, leurs refus et leurs gestes sont ceux que sert `src/hote/reglages.ts`
  (`ZonesDesReglages`) ; l'écran n'en invente aucun.

## À valider

- Un signet par domaine ; douze règles par feuillet ; libellés lisibles des options de liste ; volumes en
  pourcentage.
