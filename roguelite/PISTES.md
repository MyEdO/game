# Pistes d'amélioration du roguelite

Les améliorations proposées à l'utilisateur, avec leur état. Une piste validée passe en tâche, puis en lot ; une
piste livrée sort de ce fichier (le commit en garde la trace). Les décisions de l'utilisateur vivent dans
`CONCEPTION.md`, les manques du noyau dans `RETOURS.md`.

Ordre : 1, puis 2 et 3 ensemble, puis 4.

## 1. Rien d'automatique dans les salles — validé le 2026-11-23

« rien ne doit etre automatique, on doit choisir nos actions dans les salles ».

- **Chaque salle hors combat propose des actions** entre lesquelles le joueur choisit, chacune jouée par le noyau
  (Test du héros choisi ou du meilleur du groupe, conséquences en effets de scène). La cache piégée se joue
  aujourd'hui seule : elle passe au choix (« fouiller », « désarmer d'abord », « passer »).
- **Le camp** : le soigneur du groupe passe par l'infirmerie du noyau (Guérison, Chirurgie) ; qui veille, qui soigne.
- **Rencontres à choix** : en partie sociales (Charme, Intimidation, Commandement) ; pièges sur d'autres Compétences.
- **Un risque à doser** : choix de chemin entre deux salles, ressource qui s'use au fil de l'expédition.
- **Provisions de route à l'Auberge relais** (« Rations, torches, cordes, clairement ca peut servir pour plus tard »,
  2026-11-23) : objets du noyau achetés avant de partir, qui ouvrent ou facilitent des actions de salle (corde pour
  descendre, torche contre l'obscurité des tertres, rations au camp). Les potions et remèdes passent à l'Hospice.

## 2. Une prise sur le combat — validé le 2026-11-23

- **Placement du groupe** avant la rencontre : ligne de front, tireurs derrière.
- **Une consigne par héros**, par la doctrine tactique de l'IA du noyau : `Combatant.aiDoctrine` force une des
  `DOCTRINES` de `src/noyau/monde/ai.ts` (`soldats`, `tirailleurs`, `artillerie`, `meute`, `standard`…), qui module
  les poids du choix de l'IA sans toucher aux gardes du livre. À mesurer : que la cadence auto l'applique aux héros
  comme aux ennemis, et quelles doctrines ont un sens pour un héros (tenir la ligne, rester à distance, achever).

## 3. Des cartes tactiques — proposé par l'utilisateur le 2026-11-23

« si tu veux rendre les choses tactiques, faudrait des maps qui le soient un peu plus ». Aujourd'hui chaque combat se
joue sur une arène nue (`arena`). Des salles écrites au schéma de scène du noyau (`docs/map-authoring.md`) : couverts,
goulets, obstacles, hauteur, par destination (lisière, tertres, clairière, autel). Le placement (2) n'a de sens
qu'avec elles.

## 4. Corruption et maladies — validé le 2026-11-23

« je valide la corruption et les maladies. Ca peut même faire des rencontres avec des choix a faire ». Le noyau les
joue déjà : elles marquent le retour d'expédition (soins, séquelles, qui repart) et nourrissent des rencontres à
choix (un autel profané, un puits souillé, un blessé contagieux).

## 5. Une progression qu'on sent

Montrer l'effet d'un achat en combat (« +5 % de chances de toucher »). À intégrer à la progression « à la 5e »
validée le 2026-11-23 (`CONCEPTION.md`).

## 6. L'économie sur une campagne entière

À mesurer pendant une partie complète : le péage et les petites routes suffisent-ils à tout financer ? Le hameau
se bâtit-il trop vite quand on rentre souvent ?
