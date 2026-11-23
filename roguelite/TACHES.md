# Suivi des tâches du roguelite

L'état du travail, tenu à jour à chaque lot. Ce qui est décidé vit dans `CONCEPTION.md` (« Le jeu tel qu'il est
arrêté », puis les arbitrages) ; les idées non encore lancées dans `PISTES.md` ; les manques du noyau dans
`RETOURS.md`. Une tâche livrée sort de ce fichier : le commit en garde la trace.

## En cours

| Tâche | Où | Reste |
|---|---|---|
| Forge par Disponibilité, potions à l'Hospice | `jeu/boutiques.ts`, `jeu/valeurs.ts` | fait, non commité : attend les panoplies et l'interface |
| Panoplies d'armure (légère, moyenne, lourde : options, pas échelle) | `jeu/boutiques.ts` | codeur en cours |
| Une salle à choix plante si le héros saigne | `noyau/epreuve.ts` | codeur en cours |
| Fiche du héros et Salle d'armes : retour à la disposition d'avant (l'unification « catastrophe » est retirée) | `ui/fiche.ts`, `ui/services.ts` | Fable en cours ; l'unification attend la progression à la 5e (« Ca attendra le dev de la progression en V5 », 2026-11-23) |
| Sceaux de Collège et de dieu, tenues des nouvelles carrières, actions de la cache lisibles | `ui/`, `figures.ts` | fait par Fable, non commité : attend l'interface de la forge |
| Compagnon animal et montures dans le noyau (MyEdO/game#4804) | `.wt-4804-compagnon` | lot A (prédicat de monture unique) en cours ; lot B à rejuger (cavalier choisi hors combat) ; lot C (Blessures de la bête) |

## Ensuite, dans l'ordre

1. Forge : revenir à une sélection d'armes choisie (par Groupe utile au roster, une à trois par Groupe), ouverte par
   Disponibilité, au lieu des 92 armes du catalogue, filtrée pour le héros choisi par les Groupes que couvrent ses
   Compétences ; même tri pour les remèdes de l'Hospice. Puis brancher
   l'interface de la forge sur les panoplies et les potions ; commit commun forge + interface.
2. Catalogue : rassembler dans `valeurs.ts` tout ce que le jeu offre, sous des tables nommées, et produire
   `roguelite/CATALOGUE.md` par `roguelite/catalogue.ts` (carrières, voies et sorts, Compétences utiles, Talents,
   armes par Groupe, panoplies, remèdes, destinations et adversaires).
3. Sorts : une liste courte et choisie par voie (Collège, dieu), seulement des sorts que le noyau applique et qui
   servent en combat ou en salle, mesurés en combat simulé (l'IA les lance-t-elle, ont-ils un effet) ; au lieu des
   15 à 20 sorts de domaine.
4. Progression rapide « à la 5e » : plan conseillé en un clic, pas de +5, Compétences utiles seules ; c'est elle qui
   refait l'écran de progression, unique pour la fiche et la Salle d'armes, avec une seule marque des Augmentations.
   Le brief part de l'écran de la Salle d'armes que l'utilisateur connaît, et ne laisse pas carte blanche.
5. Auberge relais : chambre de repos (repos du noyau) et renvoi contre une prime.
6. Salles à choix, suite : le camp avec le soigneur (infirmerie du noyau), la rencontre sociale.
7. Choisir hors combat qui monte sa monture (après le lot B de #4804) ; le roguelite le propose avant la rencontre.
8. Placement du groupe, consigne par héros (doctrine de l'IA), cartes tactiques.
9. Corruption et maladies, en rencontres à choix.
10. Équilibrage : les hardes et le Minotaure trop durs avec le nouveau roster ; les Collèges au niveau 1 n'ont que
   leurs sorts mineurs ; plus de morts depuis les potions à l'Hospice.
11. Jouer une partie complète à 1829×1029, puis publier la v30 de l'artefact.

## Attend l'utilisateur

Rien.
