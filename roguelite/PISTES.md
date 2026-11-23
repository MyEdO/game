# Pistes d'amélioration du roguelite

Les améliorations proposées à l'utilisateur, avec leur état. Une piste validée passe en tâche, puis en lot ; une
piste livrée sort de ce fichier (le commit en garde la trace). Les décisions de l'utilisateur vivent dans
`CONCEPTION.md`, les manques du noyau dans `RETOURS.md`.

Ordre recommandé une fois le travail en cours terminé : 1 et 2 ensemble, puis 3, puis 4.

## 1. Des choix en expédition

Engager, rentrer, boire une potion : l'expédition offre peu de décisions. Darkest Dungeon y met la lumière, la faim
et le stress.

- **Événements entre les salles, avec un choix.** La cache piégée est jouée par le noyau (Test de Perception du
  groupe, piège en effet de scène), mais le Test se joue seul. À faire : le choix « fouiller ou passer » ; le camp où
  le soigneur du groupe passe par l'infirmerie du noyau (Guérison, Chirurgie) ; une rencontre qui se résout en
  partie en social (Charme, Intimidation) ; d'autres pièges sur d'autres Compétences.
- **Un risque à doser** : choix de chemin entre deux salles, ressource qui s'use au fil de l'expédition.

## 2. Une prise sur le combat automatique

Le joueur ne peut ni placer son groupe ni lui donner de consigne.

- Placement : ligne de front, tireurs derrière.
- Une consigne par héros : « focaliser », « protéger le soigneur », « fuir sous la moitié ».

À vérifier d'abord : ce que l'IA du noyau accepte comme directive. Si elle n'en accepte aucune, c'est un ticket du
noyau, passé par le circuit des tickets du projet.

## 3. Les états de longue durée

Le noyau joue déjà la Corruption et les maladies : elles donneraient du poids au retour d'expédition (soins,
séquelles, choix de qui repart).

## 4. Une progression qu'on sent

Montrer l'effet d'un achat en combat (« +5 % de chances de toucher »). À intégrer à la progression « à la 5e »
validée le 2026-11-23 (`CONCEPTION.md`).

## 5. L'économie sur une campagne entière

À mesurer pendant une partie complète : le péage et les petites routes suffisent-ils à tout financer ? Le hameau
se bâtit-il trop vite quand on rentre souvent ?
