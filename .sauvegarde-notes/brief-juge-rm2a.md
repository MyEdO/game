# Juge de diff : R-M2 lot A reconstruit, couche Infobulle (#1806), 2026-09-28

## Règles
- Lecture seule stricte. Tu n'écris que sous `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/juge-rm2a/`. Aucune commande git mutante (l'index porte le lot : n'y touche pas), aucune mutation de fichier du dépôt, même temporaire : la preuve par mutation est au codeur, tu la VÉRIFIES par lecture et tu rejoues ses tests.
- Arbre `/home/user/game`, branche `chantier/1806`, HEAD `d3b9fdf6f`. Le lot est INDEXÉ : `git diff --cached` (47 chemins, dont 24 docs générés par `npm run docs:build`). Sondes navigateur permises (serveur de dev borné par `timeout`, tué par PID ; Chromium par Playwright, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Un recetteur travaille EN MÊME TEMPS sur le navigateur : vérifie `ps -eo pid,cmd | grep -E '[v]ite|[c]hrom'` avant d'en lancer un, prends un autre port (`--port 5199`), un seul Chromium à la fois de ton côté.
- Budget : 45 min d'horloge. Livrable UNIQUE : ta réponse finale (le verdict), recopiée dans `juge-rm2a/verdict.txt`. Verdict TIENT / À REPRENDRE en tête, puis chaque défaut avec `fichier:ligne`, preuve, correction retenue prête à recopier. Pas de score.

## Objet
- Brief du codeur : `scratchpad/brief-rm2-a-reprise.md` ; son rendu : `scratchpad/rendu-rm2-a-reprise.md` (sorties sous `scratchpad/rm2-a/`).
- Design v4 et verdicts antérieurs, verbatim : `scratchpad/comments/29_…` (design), `33_…`, `34_…`, `38_…`, `47_…` (X1, X2, I1, F13, Q4i, Q5r).

## Lentilles (une question = une réponse prouvée)
1. **Socle du focus** (`src/ui/focus.ts`) : `useFocusEmprunte` avec `origine` et la chaîne `originesDeBoite` — UN mécanisme ? Le cas « origine détachée → surface qui la contenait » est-il juste quand la surface contenante est elle-même fermée ? Fuite de la `WeakMap` ? Rejoue les tests promus X1 (trois entrées), X2, Q2DIAL, B2.
2. **La couche `Infobulle`** : aucune branche par consommateur ; ancrage au balisage, délégation au document ; `congediee` synchrone (X2) — prouve qu'aucun invariant ne tient par l'ordre des effets.
3. **`BoiteAncree`** : placement au rendu qui reçoit l'ancrage (B2), re-mesure après commit, ancrage détaché, aucun `useLayoutEffect` ; F10 « partiel » déclaré par le codeur — la raison (garde (xxii) de `ui-ratchets.test.ts`) tient-elle, citée ?
4. **Changement de comportement dans les tests d'hôte** : `CombatConsole.test.tsx` fait passer le pointeur sur `body` avant chaque survol, parce que X2 interdit désormais de re-survoler un ancrage non quitté après Échap. Est-ce le comportement JOUEUR voulu (APG Tooltip), ou un test tordu pour passer ? Tranche avec la citation.
5. **Observation non prouvée du codeur** : « un Échap pendant le chargement à froid de la fiche a ouvert le menu système ». Reproduis-la (throttling réseau CDP ou chunk froid) : défaut réel du lot, préexistant sur `d3b9fdf6f`, ou non reproduit. Sortie collée.
6. **Langue et primitives** : un concept, un terme (« popover » ne désigne plus la boîte de la couche) ; aucun élément nu ; `title` de `CodexRef` conservé — conforme au design (purgé au lot B) ? Commentaires à réf nue (règle 6) — les 6 signaux « revendication d'autorité sans trace » du pre-commit (`CombatConsole.tsx:52,277,594,616,1209`, `gallery/registry.tsx:1524`) : neufs de ce diff ou préexistants déplacés ? (`git diff --cached -U0 -- src/ui/CombatConsole.tsx src/ui/gallery/registry.tsx`).
7. **Docs générés** : les 24 docs du diff ne portent-ils que des conséquences du lot (empreintes, trois primitives neuves) ?
8. **Portes** : rejoue `npx vitest run --no-cache` sur les fichiers du périmètre (liste du rendu du codeur) et `src/comment-poison-guard.test.ts`, `src/ui/primitive-owners-guard.test.ts`, `src/ui/ui-ratchets.test.ts`, `src/vi-mock-isolate-guard.test.ts` ; sorties et codes collés sans pipe.
9. **Architecture à rebours** : si on partait de zéro, ces coutures existeraient-elles ?
