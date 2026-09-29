# Brief du codeur : R-M2 lot A, train de corrections (placement, coupe au mot, délégation unique) (#1806), 2026-09-28

## Worktree et interdits
- Worktree : `/home/user/game/.wt-1806-L1`, branche `wt/1806-L1`, HEAD `395e1d4c4` (= `origin/chantier/1806`, le lot A commité). Chemins ABSOLUS sous ce worktree ; rien dans `/home/user/game` hors de `.wt-1806-L1` (sonde `git -C /home/user/game status --short` au rendu : vide attendu). `node_modules` installé par `npm ci` dans le worktree.
- Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, toute écriture dans `node_modules`. Processus bornés, arrêtés par PID, listés au rendu. Serveur de dev et Chromium permis (un à la fois).
- Budget : **1 h 45**. Dans l'ordre ; le reste NOMMÉ à l'échéance.

## Sources
- Design v4 : `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/comments/29_2026-09-24T02:24:45Z.txt`.
- Verdicts de ce lot : juge de diff `scratchpad/juge-rm2a/verdict.txt` ; juge d'écran (JUGE-VISION), défauts 1 et 2 recopiés ci-dessous ; mesure des écouteurs `scratchpad/rendu-rm2a-corrections.md` (section « Mesure »).

## Invariant
- Design v4, P2, verbatim : « **Déclenchement par délégation au document**, possédée par la couche : survol, focus (y compris d'un descendant), toucher et Échap résolvent l'ancrage au moment de l'événement, sur le patron d'écoute au document déjà en place (`CodexRef.tsx:254`). La couche n'écoute jamais un élément qu'elle ne rend pas. » ; critère N+1 : « Un texte borné neuf coûte `<Clamp role="…">{texte}</Clamp>` dans une piste de largeur définie, zéro ligne de CSS de troncature, et zéro câblage d'infobulle. »
- Question : combien d'écouteurs une infobulle de plus coûte-t-elle ? Mesure actuelle (jsdom) : 7 écouteurs document PAR `CodexRef` monté (1 → 7, 10 → 70, 50 → 350) ; 8 ancrages en combat = 56.
- Spec HUD, `docs/plans/2026-08-16-spec-hud-combat.md:71-74`, R-M2, verbatim : « un libellé se rend en entier, ou s'ellipse à la FRONTIÈRE DE MOT […] ».
- Credo : « Règles GÉNÉRALES, jamais spécifiques. »

## Cas canonique déjà couvert
Une écoute au document UNIQUE qui route vers ce qui est enregistré : cherche-la dans le code (ex. la pile de congédiement `useDismissLayer`/`dismissStack`, le clavier global `useGameKeyboard`) et cite `fichier:ligne`. La délégation de la couche en est une INSTANCE : un jeu d'écouteurs par document (compté par référence, posé au premier ancrage monté, retiré au dernier), qui résout l'ancrage par `closest('[data-infobulle]')` puis l'instance par un registre clé par élément d'ancrage. Rends la preuve d'instance, ou sa réfutation citée.

## Design jugé :
- Délégation : design v4 (signé après trois passes de juge de design), clause citée ci-dessus ; le juge de diff du 2026-09-28 (lentille 9) : « la délégation vit dans chaque instance (7 écouteurs de document par CodexRef monté, :175-181), pas une fois pour la couche ».
- Placement, JUGE-VISION du 2026-09-28, verbatim : « La case 8 (Lumière) est à x≈600-652 […] La boîte occupe x≈572-892 […] Le panneau « Fin du tour » est à x≈826-890 […] son icône […] est cachée par le pied de la boîte. Cause, dans `src/ui/BoiteAncree.tsx:51` : `left = max(MARGE, min(rect.left, vw - width - MARGE))`. Quand la boîte déborde à droite, elle glisse vers l'intérieur au lieu de s'aligner par le bord droit de son ancrage (x≈332-652), ce qui aurait laissé la commande dégagée. »
- Coupe, JUGE-VISION, verbatim : « `src/ui/compendium/CodexRef.tsx:16` : `const truncate = …` […] La coupe tombe au caractère près, pas à une frontière de mot. […] 151 des 227 sorts longs affichent donc un mot coupé au milieu (« contr… »). La sonde peut devenir un test : `truncate` doit couper à une frontière de mot. » Sonde : `scratchpad/juge-vision-rm2a/sonde-truncate.mts`. Le design v4 range la coupe dans `Clamp` au lot B ; ce train pose la frontière de mot sur la coupe existante (forme R-M2 : « le plus long préfixe de mots, coupé à une ESPACE, suivi de « … » », design v4 P1 « Forme »), sans anticiper `Clamp`.

## Travail, dans cet ordre
1. **Placement horizontal** (`BoiteAncree.tsx`, `placerAncre`) : si la boîte alignée sur le bord GAUCHE de l'ancrage déborde à droite, elle s'aligne sur son bord DROIT ; si les deux débordent, marge de la fenêtre. Test des trois cas ; recette : à 900×780, refus de la case « Lumière » de Wilhelmina (scénario et geste de la recette : `scratchpad/recette-rm2a/` scripts) — la boîte ne recouvre pas « Fin du tour » ; capture avant/après avec `sha256sum`.
2. **Coupe à la frontière de mot** (`CodexRef.tsx`, `truncate`, corps et ligne méta) : la sonde devient un test sur les données réelles (0 mot tranché sur les sorts longs), plus des cas unitaires (mot unique plus long que n, espaces multiples, ponctuation). Mutation : l'ancienne coupe au caractère rougit le test.
3. **Délégation unique** (`Infobulle.tsx`) : un jeu d'écouteurs document pour la couche, quel que soit le nombre d'ancrages ; aucun comportement ne change (les suites `Infobulle`, `CodexRef*`, `App.surcouche-codex`, `CombatConsole`, `echap-pile-lifo`, `dialogue-*`, `wrap-keyboard-vs-cursor` restent vertes SANS réécriture). Test neuf : N ancrages montés → nombre d'écouteurs document constant ; mutation (un jeu par instance) rougit. Rends la mesure 1/10/50 avant/après.

Dans chaque zone touchée : un concept, un terme ; morts purgés ; commentaires à réf nue (règle 6).

## Portes (sortie brute, code sans pipe)
- `npm run typecheck:fast` ; `npx vitest run --no-cache` sur tes fichiers et les suites citées au point 3, plus `src/comment-poison-guard.test.ts`, `src/ui/ui-ratchets.test.ts`, `src/ui/primitive-owners-guard.test.ts`, `src/vi-mock-isolate-guard.test.ts` ; eslint sur tes fichiers ; `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/cssCouchesAudit.ts --check` ; si un doc généré bouge, `npm run docs:build`.
- Recette navigateur en joueur (souris + clavier réels, console 0 erreur) : point 1, et un cycle survol → Échap → re-survol après sortie sur 2 ancrages différents (point 3).

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-rm2a2.md` (+ `scratchpad/rm2a2/`) : diff stat, chaque point avec preuve, mutations, portes, captures + sha256, processus.
