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

- **La cible d'un écran est sa propre capture** (#3935) : jamais une maquette dessinée hors du jeu, qui ne vaut qu'intention de disposition. Chaque état d'écran a sa planche, un état de partie figé par `figerLesPlanches` de `hotes/godot/recettes/ecran.ts`, dérivé de l'export et jamais commité (`construire.mjs --export` la dépose sous `<export>/planches/<nom>.json`, `hotes/godot/planches.mjs`), que le vrai jeu montre à l'adresse `?planche=<nom>` (`projet/scripts/pont_de_planche.gd` : chaque méthode que l'écran demande y est servie par la réponse que la planche enregistre sous son nom, une autre est une panne qui fait échouer le banc), et son étalon, `hotes/godot/etalons/<nom>.png`, la capture de cette planche à la vue `bureau` de `scripts/recette/vues-recette.json`, monde caché.
- **Le banc (`npm run godot:etalons` : l'export, puis la comparaison) refuse tout pixel d'écart**, sans masque ni tolérance, et tout étalon qu'aucune planche de l'export ne porte. Un étalon ne vaut que pour le Chromium épinglé sous Linux x86-64 : l'épingle a sa seule source, `EPINGLE` de `hotes/godot/planches.mjs`, et le banc refuse tout autre build et toute autre plateforme ; monter l'épingle, c'est reposer tous les étalons dans le même commit.
- **Le banc est une porte de la file de fusion** (job `migrations` de `.github/workflows/ci.yml`), pas de la course de branche : un écart fait refuser l'entrée de file. L'auteur d'un changement d'écran rejoue le banc et repose l'étalon avant la file, sur une machine Linux x86-64 qui porte le build épinglé : `node hotes/godot/etalons.mjs --web dist/godot --poser [--planche <nom>]` après l'export, dans le commit qui change l'écran ; l'étalon reposé n'est plus validé.
- **Un écran est fini quand son étalon est validé** : le verbatim daté de l'utilisateur au ticket, et l'empreinte de l'image validée dans `hotes/godot/etalons/valides.json`, que seule sa validation écrit. Des recettes vertes ne finissent pas un écran.
- **Le rail d'un écran**, dans l'ordre : son intention depuis le genre (fiche `user-doctrine-reference-rt-par-defaut-deviation-validee`), ses planches, sa disposition avec le kit (un besoin neuf passe d'abord par le kit), les juges en aveugle contre la référence de genre, la porte de goût sur la capture du jeu, puis le branchement à la partie réelle. Jamais une passe de thème sur tous les écrans.
- **Le kit** : un élément montré autrement à un endroit prend une forme (`formes` de sa zone, `projet/scripts/zone.gd`), jamais un type neuf ; ce qui ne change que le style passe par un thème de portée de `art/`. Un style à script (`projet/scripts/cadre.gd`) ne se déclare que dans un thème de portée (`art/ecran.tres`, `art/cartes.tres`) : le thème du projet retient son script à la fermeture, `godot:sonde` le refuse. Un type d'élément neuf (`src/hote/elements.ts`) ne porte que l'id de ce qui ne change pas d'une vue à l'autre : les dessins (`icone`, `fond`) sont déposés une fois dans le projet (`hotes/godot/asset/dessins.ts`).
