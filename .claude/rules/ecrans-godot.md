---
paths:
  - "hotes/godot/projet/ecrans/**"
  - "hotes/godot/projet/composants/**"
  - "hotes/godot/projet/cadres/**"
  - "hotes/godot/projet/art/**"
  - "hotes/godot/projet/scenes/Ecran.tscn"
  - "hotes/godot/etalons/**"
  - "hotes/godot/etalons.mjs"
  - "hotes/godot/recettes/ecran.ts"
  - "src/hote/ecran.ts"
  - "src/hote/elements.ts"
---

# Écrans de l'hôte Godot

- **La cible d'un écran est sa propre capture** (#3935) : jamais une maquette dessinée hors du jeu, qui ne vaut qu'intention de disposition. Chaque état d'écran a sa planche, un état de partie enregistré (`hotes/godot/etalons/planches/<nom>.json`, écrit par `node hotes/godot/etalons.mjs --enregistrer` depuis `figerLesPlanches` de `hotes/godot/recettes/ecran.ts`), que le vrai jeu montre à l'adresse `?planche=<nom>` (`projet/scripts/pont_de_planche.gd`), et son étalon, `hotes/godot/etalons/<nom>.png`, la capture de cette planche à la vue `bureau` de `scripts/recette/vues-recette.json`, monde caché.
- **Le banc (`npm run godot:etalons`) refuse tout pixel d'écart**, sans masque ni tolérance. Un écart voulu se pose (`--poser`) dans le commit qui change l'écran ; l'étalon reposé n'est plus validé.
- **Un écran est fini quand son étalon est validé** : le verbatim daté de l'utilisateur au ticket, et l'empreinte de l'image validée dans `hotes/godot/etalons/valides.json`, que seule sa validation écrit. Des recettes vertes ne finissent pas un écran.
- **Le rail d'un écran**, dans l'ordre : son intention depuis le genre (fiche `user-doctrine-reference-rt-par-defaut-deviation-validee`), ses planches, sa disposition avec le kit (un besoin neuf passe d'abord par le kit), les juges en aveugle contre la référence de genre, la porte de goût sur la capture du jeu, puis le branchement à la partie réelle. Jamais une passe de thème sur tous les écrans.
- **Le kit** : un élément montré autrement à un endroit prend une forme (`formes` de sa zone, `projet/scripts/zone.gd`), jamais un type neuf ; ce qui ne change que le style passe par un thème de portée de `art/`. Un type d'élément neuf (`src/hote/elements.ts`) ne porte que l'id de ce qui ne change pas d'une vue à l'autre : les dessins (`icone`, `fond`) sont déposés une fois dans le projet (`hotes/godot/asset/dessins.ts`).
