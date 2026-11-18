## Atterrissage — 2026-11-18, 20 h 45 (heure de Paris). Le lot est LIBRE : Statut et Tenu par sont vidés.

Laurent a demandé d'atterrir, parce que la limite d'usage hebdomadaire approche. Ce commentaire remplace l'état publié plus haut : https://github.com/MyEdO/game/issues/4411#issuecomment-6986987473. Il garde le même cap et les mêmes doctrines.

**Branche** `chantier/4411-kit`, HEAD `932cc1d35`, PR #4465 (brouillon). Hors `hotes/godot/cibles/` et `.claude/memory/`, le diff contre main se réduit au filtre de la garde `src/hote/derive-du-noyau.hors-store.test.ts`.

### Fait depuis le dernier état
- **Fable a tranché les 12 contradictions** du kit et des gabarits, dans `kit.md` et `dispositions.md` (f153f67d8).
- **Le code est conforme** à ces arbitrages (a368cd8b0) :
  - le canevas passe à 1280 × 720 ;
  - `cartouche()` existe en deux tailles ;
  - `signets()`, `apercu()` et `issue()` entrent au kit, avec une cinquième planche `kit/planche-annonces.html` ;
  - les cartes deviennent élastiques, de 200 à 262, et passent en liste au-delà ;
  - le journal suit la ligne basse ;
  - l'action de coin prend 136 de large.
- **Le reste du combat est migré** (932cc1d35) :
  - `tour-de-combat.ts` devient le gabarit combat, avec la barre de l'actif de 960 × 138 et ses états : rapides, liste, tour adverse, fiche au clic, journal ouvert, cibles, meubles, visée de siège ;
  - chacun des écrans suivants a sa maquette : bataille de masse, poursuite terrestre, course-poursuite en mer, fuite, désengagement, sauvetage par le destin, corruption-mutation ;
  - fin-victoire rejoint `fin-du-combat`.
  - Il reste à faire : le **dernier `test:perimetre` a été interrompu** à l'atterrissage, et seuls `tour-de-combat` et `bataille-de-masse` ont été rerendus. Au départ du repreneur : laisser trancher la CI de #4465, puis rendre toutes les maquettes en 16:9, sans erreur ni débordement.
  - À vérifier : l'agent du lot a aussi créé `maquettes/compagnie.ts` et `maquettes/interlude.ts`, et touché `lieux-et-nuit/interlude-en-ville.*` et `carte-de-la-ville.js`. Il faut vérifier que cela relève bien du combat (lien avec la bataille de masse), sinon le rattacher à la famille des lieux.
- **Le brief de migration est écrit** : `docs/plans/2026-11-18-kit-maquettes-brief-famille.md`. Il fixe les règles, les preuves et le rendu attendus ; une famille = un agent `codeur`, en séquence, parce que le rendu est partagé.

### Reste pour « kit terminé », dans l'ordre
1. Vérifier le lot combat, comme décrit plus haut.
2. Lieux, voyage et commerce : `lieux-et-nuit` (4 pages), `voyage` (21), `commerce` (10). Voir `docs/plans/2026-11-18-kit-maquettes-a-faire-lot-lieu.md`, qui demande un seul écran de nuit avec « Qui dort où ».
3. `exploration-et-recit` (14).
4. `heros`, la fiche (21).
5. `accueil-et-systeme` (12).
6. `outils` (9).
7. Page de jugement « Kit et dispositions » (https://claude.ai/artifact/ThzhpBo2Ksh91CoFY59Fjy) mise à jour à partir des rendus. Elle est privée à Laurent ; sa source vivait dans la session, donc il faut la refaire depuis le dépôt si besoin.

Points restés en suspens dans le code (rendu du lot de conformité) :
- les positions des pages HTML pas encore migrées datent de l'échelle 1707 ; elles disparaissent avec leur migration ;
- `voyage/voyage.js` garde son propre `viewBox 1707 × 780` ;
- sur une carte en liste, une phrase coupée par la donnée affiche « · » au milieu.

### Retours de Laurent, à traiter APRÈS le kit (file)
- **Charges réelles.** Un sorcier avec tous ses sorts dans la barre de l'actif, l'ordre d'un grand combat, des états cumulés : chaque écran reçoit un état « charge réelle » mesuré dans les données du jeu. La mesure a été arrêtée avant d'aboutir et reste à refaire.
- **Informations du jeu que les maquettes ne savent pas dire** : `docs/plans/2026-11-18-kit-maquettes-manques-des-maquettes-combat.md`, 12 manques importants.
- **Ticket à ouvrir** pour un poison hors périmètre : `src/hote/ecran.ts:380-382` annonce le NI de l'incantation, mais ne le projette pas.
- Après validation des écrans par Laurent : opposer la trame que produit le jeu à la trame cible, puis faire la migration Godot.

Fichiers de reprise dans le dépôt : `docs/plans/2026-11-18-kit-maquettes-*.md` (cet état, le brief de migration, les doublons, les écarts corrigés, les manques du combat, le lot des lieux, les éléments retirés par le moteur). Les rendus et la page de jugement se régénèrent : `sources/rendre.mjs` pour chaque maquette, `sources/kit/planche-*.html` pour les planches.
