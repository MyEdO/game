# Rendu R-M2 lot A, train de corrections (#1806), 2026-09-28

Worktree `/home/user/game/.wt-1806-L1`, base HEAD `395e1d4c4`. Rien commité. `git -C /home/user/game status --short` : vide, aucune fuite dans l'arbre principal.

## Diff stat
```
 docs/{ajouter-une-icone,codex-relations,consommateurs-de-champs,donnees,orphelines-donnees,
      raw/reconciliation,registre-jets,structures-donnees,systemes,usages-jets,vocabulaire-mecanique}.md | 1 ligne chacun (empreinte `sources-empreinte` seule, corps inchangé)
 docs/primitives.md                  |   8 +-   (régénéré depuis le manifeste)
 src/data/primitives.manifest.json   |   8 +-
 src/ui/BoiteAncree.test.tsx         |  25 ++++--
 src/ui/BoiteAncree.tsx              |  12 ++-
 src/ui/Infobulle.test.tsx           |  38 ++++++++-
 src/ui/Infobulle.tsx                | 159 ++++++++++++++++++++----------------
 src/ui/compendium/CodexRef.test.tsx |  46 ++++++++++-
 src/ui/compendium/CodexRef.tsx      |  16 +++-
 src/ui/editor/AddMenu.test.tsx      |  14 ++--
```

## Point 1 : placement horizontal
- `src/ui/BoiteAncree.tsx:52-56` : `left` = bord gauche de l'ancrage s'il tient ; sinon `rect.right - width` s'il tient ; sinon l'ancien bornage (la marge de fenêtre la plus proche). Le type `rect` gagne `right` ; l'en-tête du fichier décrit la règle.
- Tests : `src/ui/BoiteAncree.test.tsx:45-58` (trois cas). Les littéraux de rect existants dans `BoiteAncree.test.tsx` et `editor/AddMenu.test.tsx` reçoivent `right` (le type l'exige).
- Mutation (ancienne formule `max(MARGE, min(rect.left, vw - width - MARGE))`) : ROUGE, `1 failed | 11 passed`, le cas « bord DROIT » (`p1-mut.txt`). Hash : avant `0eb0b0200cc0f2274ba0d0c00979ed0dc1bd3906`, muté `1108b8006bf1134648f63ce8f6fb6eafd6b10138`, après `0eb0b0200cc0f2274ba0d0c00979ed0dc1bd3906`. Remise en état par copie de sauvegarde, identité prouvée par le hash. Rebranché : VERT, 12/12 (`p1-revert.txt`).
- Recette 900×780, refus « Lumière » de Wilhelmina (`rm2a2/recette.mjs`, pointeur CDP réel) :
  - avant (ancienne formule posée temporairement) : bulle x 572-892, Lumière x 600-652, « Fin du tour » x 826-890 → recouvre = true. Capture `rm2a2/refus-lumiere-900x780-avant.png` sha256 `9d2b3f68a72512f6b53a335e70498217e96876deb497e94ac8d90f1374ffad34`.
  - après : bulle x 332-652 (alignée sur le bord droit de Lumière), recouvre = false. Capture `rm2a2/refus-lumiere-900x780-apres.png` sha256 `12aeb04e334decc4615977705320848b9410e1a5be9dba148a7c2f7dfbac227b`.
  - Console : 0 erreur sur les deux passes.

## Point 2 : coupe à la frontière de mot
- `src/ui/compendium/CodexRef.tsx:16-33` : `truncate` est exporté. Il rend le texte entier s'il tient ; sinon le plus long préfixe de mots coupé à une espace sécable, sans espace finale, suivi de « … ». Une espace insécable (U+00A0, U+202F) ne coupe pas. Un premier mot plus long que `n` se rend entier. Les deux appelants (corps :164, ligne méta :167) passent par lui, sans autre changement.
- Tests : `src/ui/compendium/CodexRef.test.tsx:85-` : les données réelles (tous les sorts de plus de 400 caractères, oracle « préfixe du texte suivi d'une espace ») rendent 0 id tranché. S'y ajoutent des cas unitaires : texte qui tient, préfixe maximal, espaces multiples, ponctuation et trait d'union, insécable, mot unique plus long que n.
- Mutation (ancienne coupe au caractère, sortie anticipée insérée) : ROUGE, `4 failed | 10 passed`, dont 164 ids de sorts tranchés (l'oracle compte aussi les coupes après ponctuation ; la sonde du juge en comptait 151 avec un critère lettre/lettre). Hash : avant `124e1d7b8395cfa78389f78d77d2243c3a60384a`, muté `f8aa316fb573228f480d72f96446469bd543da57`, après `124e1d7b8395cfa78389f78d77d2243c3a60384a`. Rebranché : VERT, 14/14 (`p2-vert.txt`).

## Point 3 : délégation unique
- Cas canonique : `src/ui/useDismissLayer.ts:32` (`let montees`) et `:49-57` (`brancherPorte`/`debrancherPorte`). Des écouteurs de module sont posés au premier inscrit et retirés au dernier, et routent vers ce qui est enregistré. La couche en est une INSTANCE, avec la même forme : `src/ui/Infobulle.tsx:74` (`inscrites`, une Map dont la taille sert de compteur de références, sans second compteur), `:76` (`deleguer`, une résolution `ancrageDe` par événement, puis l'instance propriétaire par `inscrites.get(a.getAttribute('data-infobulle'))`), `:86` (`inscrire`, 7 types posés à 0→1 et retirés à 1→0, `keydown` à la capture comme avant).
- ÉCART au brief, à trancher : le registre est clé par la VALEUR `data-infobulle` de l'ancrage (l'`useId` de l'instance), pas par l'élément. La couche ne détient jamais l'élément d'ancrage (c'est l'appelant qui étale `ancrage`, et P2 dit « n'écoute jamais un élément qu'elle ne rend pas ») ; la valeur d'attribut désigne l'ancrage de façon unique.
- Comportement conservé : chaque instance reçoit `ici` (l'ancrage résolu est le sien : mouseover, mouseout, focusin, focusout, click, keydown) ou `ailleurs` (mouseover et focusin rendent `pointeur`/`focus` hors de sa boîte, mousedown ferme). C'est la transcription, branche par branche, des anciens `if (!mien(a))`. L'ordre des instances est celui d'inscription, comme l'était l'ordre des écouteurs.
- Mesure jsdom (`rm2a2/mesure/`, harnais du rendu précédent repointé sur le worktree), écouteurs document nets :

| N CodexRef | avant | après |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 7 | 7 |
| 10 | 70 | 7 |
| 50 | 350 | 7 |

  Les chiffres sont identiques en `wrap`. Sorties : `rm2a2/mesure/avant.txt`, `rm2a2/mesure/apres.txt`, exit 0 toutes deux.
- Test neuf : `src/ui/Infobulle.test.tsx:146-` monte 1, 10 et 50 ancrages. Le nombre d'écouteurs posés est constant et strictement positif, et le démontage les retire tous.
- Mutation (un jeu d'écouteurs par instance dans `inscrire`) : ROUGE, `[7, 70, 350]` attendu `[7, 7, 7]`. Hash : avant `8b9e9215d45ea43dbe56c773d6eca828f290091e`, muté `b75585b6c738a6c57b7f00fe6aa327ee024c83aa`, après `8b9e9215d45ea43dbe56c773d6eca828f290091e`. Rebranché : VERT, 6/6.
- Aucune suite citée n'a été réécrite ; elles sont toutes vertes (voir Portes).
- Recette du cycle survol → Échap → survol sans sortie → sortie → re-survol (pointeur et clavier CDP réels), sur 2 ancrages :
  - Lumière (refus) : `{ouverte1:true, apresEchap:false, survolSansSortie:false, reSurvol:true}`
  - Bâton de combat : même résultat.
  - Console : 0 erreur (`rm2a2/recette-apres.txt`).

## Référence vivante
- `src/data/primitives.manifest.json`, lignes BoiteAncree (règle horizontale), CodexRef (« méta et corps coupés au mot (`truncate`) », test « coupe au mot ») et useInfobulle (« un seul jeu d'écouteurs pour toute la couche »). `npm run docs:build` a été relancé, exit 0 : `docs/primitives.md` a été régénéré ; les 11 autres docs ne changent que par leur ligne d'empreinte.

## Portes (sorties brutes dans `rm2a2/`)
- `npm run typecheck:fast` : exit 0, 0 erreur (`tc2.txt`).
- `npx vitest run --no-cache` sur 23 fichiers (BoiteAncree, AddMenu, Infobulle, CodexRef, CodexRef.hooks, App.surcouche-codex, CombatConsole, echap-pile-lifo, 10 × dialogue-*, wrap-keyboard-vs-cursor, comment-poison-guard, ui-ratchets, primitive-owners-guard, vi-mock-isolate-guard) : exit 0, 23 fichiers, 444 tests (`vitest-portes.txt`). Après l'édition du manifeste, primitive-owners-guard, ui-ratchets et comment-poison-guard rejoués : exit 0, 140 tests (`vitest-guards2.txt`).
- eslint sur les 7 fichiers `src` touchés : exit 0, sortie vide.
- `regenStock.mts cssCouchesAudit.ts --check` : exit 0, « Stock à jour ».

## Hors périmètre (même classe : coupe au caractère)
- `src/ui/editor/EffectList.tsx:140` (`cut`), `src/ui/editor/GameOpEditor.tsx:735`, `src/ui/creator/CharacterCreator.tsx:211`. Non touchés : le brief borne ce train à la coupe de `CodexRef`, et `Clamp` arrive au lot B.

## Processus
- Serveur de dev : `setsid timeout 2700 npm run dev` (PGID 4794, port 5224), tué par `kill -TERM -4794` ; `ps` vide ensuite.
- Chromium : 2 sessions headless ouvertes par `openApp`, fermées par `session.close()` dans les deux passes ; aucun chrome dans `ps`.
- Tous les runners (vitest ×9, typecheck ×2, eslint, regenStock, docs:build ×2) ont tourné au premier plan, bornés par `timeout`, et sont terminés.
- Copies de garde hors dépôt : `rm2a2/{BoiteAncree,CodexRef,Infobulle}.garde`.
