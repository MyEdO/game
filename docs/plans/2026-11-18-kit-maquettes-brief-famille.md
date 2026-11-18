# Brief type : migrer une famille de pages HTML vers les maquettes JSON (#4411)

Ticket: #4411


Dépôt /home/user/game, branche `chantier/4411-kit`. Ne committe pas : l'orchestrateur relit et enregistre.

## Invariant (verbatims utilisateur 2026-11-18)
« Mes retours sont importants mais pourront être traités une fois notre kit terminé, après quoi il sera très simple de modifier nos maquettes » ; « pas de brancher directement au noyau ». Fiches `.claude/memory/user-doctrine-maquettes-font-foi-godot-s-adapte.md`, `user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage.md`, `user-doctrine-maquettes-jugees-cedent-aux-arbitrages-de-design.md`. Aucune maquette n'est validée : écrire « premières maquettes », jamais « validée ».

## Règles
- Périmètre : `hotes/godot/cibles/propositions/` seulement ; rien sous `src/` ni `hotes/godot/projet|recettes|pont`.
- Une maquette par ÉCRAN (`sources/maquettes/<ecran>.ts`), ses variantes en états ; doublons fusionnés au critère « même gabarit, mêmes pièces, données différentes » (`docs/plans/2026-11-18-kit-maquettes-doublons.md`).
- Le JSON porte les DONNÉES (valeurs typées, ids, états, mots), jamais la disposition ni un texte composé de valeurs (« ≤ 48 », « tour 1 sur 4 ») ; il nomme son gabarit (`dispositions.md`). Types nés écran par écran dans `maquettes/maquette.ts`, aucun import du jeu, même de type.
- Le rendu (`sources/rendu.js`, `rendu.css`) porte seul la disposition, par rôle joueur ; toute pièce vient du kit (`gestes.js`/`gestes.css`, cotes de `kit.md`). Une pièce qui manque s'ajoute AU KIT (une définition), jamais localement.
- Référence de contenu : la page HTML d'origine (premières maquettes), sauf ce que `kit.md` / `dispositions.md` tranchent autrement (ils priment). Les pages migrées sont supprimées, ainsi que leurs .js/.css devenus morts. Zéro dette, aucune pierre tombale.
- Aucune réf de livre dans un texte joueur (garde `src/book-ref-guard.test.ts`).
- Ce qui demande un vrai choix de design non tranché : le lister, ne pas l'inventer.

## Preuve
`npm run typecheck:fast` (0 erreur, sortie complète) ; `npm run test:perimetre` seul dans son appel (exit 0) ; rendu 16:9 de tous les états de la famille et des 15 maquettes existantes : `NODE_PATH=/opt/node-tools/node_modules flock /tmp/wfrp-lourd.lock node hotes/godot/cibles/propositions/sources/rendre.mjs <maquette> <sortie.png> --format 16:9` : 0 erreur, rien en hors/croise/deborde/recouvert ; regarder soi-même 3 rendus. Un Chromium à la fois.

## Rendu
Écrans créés (états), pages supprimées, pièces ajoutées au kit, choix non tranchés, preuves, `git status --short` (jamais `git add -A`).
