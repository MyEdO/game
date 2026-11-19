# Cible de finition de l'accueil (#3935), 2026-11-17

Maquette : `maquettes/accueil.png`, rendue à l'échelle 1 depuis sa source
`propositions/sources/maquettes/accueil.ts` (l'état écrit au format de `maquette.ts`, dessiné par `rendu.html`, le
décor dans `accueil-et-systeme/accueil.js`). Les cotes, polices, couleurs et
l'ordre des pièces se lisent à la source ; l'image ne sert qu'au côte à côte. Compte rendu :
`propositions/accueil-et-systeme.md`, section `accueil`. Choix de Laurent du 2026-11-17 : « Moi je veux la page
d accueil ».

## Ce que le joueur voit

1. **Une image plein écran**, la compagnie de dos sur une crête face à Altdorf au couchant, la comète à deux queues
   dans le ciel. Elle est le fond, rien ne l'encadre. Ses tracés sont ceux de `accueil.js`, repris au catalogue des
   dessins, jamais redessinés (Laurent, 2026-11-17 : « l illustration il ne va pas la réinventer non plus »).
2. **Le titre en haut à gauche** : un sur-titre en petites capitales espacées (« Jeu de rôle dans le Vieux Monde »),
   « Warhammer Fantasy » en gothique doré, un filet à losange, puis le sous-titre « L'Ennemi Intérieur » en gothique
   clair.
3. **Les entrées de jeu en plaques**, colonne à gauche sous le titre : « Continuer » en premier, plaque d'or armée,
   la dernière sauvegarde dite dessous (lieu, date du monde, heure) ; puis « Jouer » et « Jouer en ligne », plaques
   de chêne sombre. Chaque plaque porte son pictogramme à gauche et son libellé en petites capitales.
4. **Les outils en pastilles**, rangée en bas à droite : « Combat », « Atelier », « Éditeur », « Compendium »,
   « Options », chacun un médaillon cerclé d'or à pictogramme, le libellé dessous.

## Ce qui ne change pas

- Les entrées et leur geste sont celles que sert `src/hote/accueil.ts` (`ZonesDeLAccueil`) ; l'écran n'en invente
  aucune.
- « Options » ouvre le panneau des réglages, comme aujourd'hui.

## À valider

- « Continuer » charge la dernière sauvegarde ; l'entrée `reprendre` ouvre aujourd'hui le panneau des sauvegardes
  (`src/hote/elements.ts:93-95`) : l'hôte doit servir l'emplacement le plus récent.
- L'état « aucune sauvegarde » n'est pas dessiné.
