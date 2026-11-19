---
name: ajouter-un-flux-de-jet
description: Ajouter ou modifier un Test, son jet différé, ses influences ou sa clôture dans le noyau et ses hôtes.
---

# Ajouter un flux de jet

Lis `docs/ajouter-un-flux-de-jet.md`. S'il manque, génère-le avec `npm run docs:flux-de-jet`.

- Réutilise le flux qui porte déjà la situation. Un Test ou une conséquence différée prend généralement une étape ou une rangée de la cascade. Déclare un flux dédié seulement si le jet a son propre état d'attente et son cycle de résolution. Sélectionne alors les verbes existants dans `FLOW_VERBS`.
- Fais passer tout jet surfaçable par les verbes du noyau. `surfaceOf` décide selon la tenue du porteur et la cadence. Le jet, ses influences et sa conséquence immédiate appartiennent à la même situation.
- Vérifie au `Source/` la résolution du Test et le coût en Action. Pour la 5e, le mouvement difficile qui exige un Test utilise l'Action, et un Test demandé par un acte de combat utilise généralement l'Action sous réserve d'une exception du livre. `CRB 034 l.17, l.39`
- Pour Godot, vérifie la projection typée et les gestes du pont. Applique la doctrine de recette de la migration aux écrans.
