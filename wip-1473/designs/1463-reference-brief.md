# #1463 · concept RÉFÉRENCE — brief du lot R0, v2.1 (socle : jointure DÉCLARÉ × OBSERVÉ du registre des slots)

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par
#1466 ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept
(L2/L3) et gameOpRefFk.mjs ». Épique : #1463.
Grounding : `main` `b027d548d`, 2026-09-23, lecture seule, aucun code modifié.
Choix de l'utilisateur, carte de décision du 2026-09-23 : le premier concept de #1463 est « Référence ».
Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour
une structure plus adapté ».
Historique du design : la v1 (jointure par un nom de champ recalculé depuis le path) a été RÉFUTÉE par le
run `wf_8d757cee-7fe`. La v2 (jointure par occurrence) a été jugée FRAGILE par le run `wf_11e5e961-e29`,
sans bloquant structurel. Ses 7 corrections sont intégrées dans cette v2.1.

## Invariant

1. Verbatim : « Ce volet est le REMPLAÇANT committé du « test FK générique » re-scopé au commentaire
   #1466 du 2026-08-23 : « le registre des SLOTS pour `docs/structures-donnees.md` (déclaré × observé) ». »
   Source : `scripts/docs/lib/structures-lexique.mts:136` (`MANDAT_SLOTS`).
   Question : que doit mesurer le volet SLOTS ? La jointure DÉCLARÉ × OBSERVÉ.
2. Verbatim : « Référence portée par un CHAMP SCALAIRE d'un document (`species: "humain"`). »
   Source : `scripts/docs/lib/structures-scan.mts:843`. Les autres branches du même bloc ont chacune leur
   règle de champ : `:828-835` pour un objet non-document qui résout (champ = clé du parent), `:836-841`
   pour une graphie sans id sous un champ porteur mesuré, `:852-864` pour une liste d'ids nus (champ =
   clé de la liste). Pour une entrée de racine, le champ vaut `champ || '(racine)'` (`:729`). Le tri
   document / non-document se fait à `:776`, à partir de la passe 3 (`:577-587`), mesurée sur la donnée.
   Question : sous quel champ le scan range-t-il UNE occurrence de référence ? Cela dépend de
   l'occurrence : aucune fonction du path seul ne reproduit ce choix (mesuré, run `wf_8d757cee-7fe`).
3. Verbatim des deux angles morts visés, `scripts/docs/lib/structures-lexique.mts` :
   `:145` « deux paths distincts qui finissent sur la même clé se joignent au même champ observé, et la
   couverture y est SUR-estimée » ; `:146` « la ligne de `SLOTS_SANS_DECLARATION` du champ porteur NE SE
   SOLDE PAS par l'adoption de la fabrique : elle survit à la migration qui la rendait caduque ».
   Question : pourquoi le stock ne mesure-t-il ni l'adoption réelle ni la couverture réelle ?

Invariant de ce lot, déduit de 1 à 3 : **la jointure se fait par OCCURRENCE**. Le scan inscrit, pour
chaque occurrence de référence qu'il range, le COUPLE `(dataset, champ)` qu'il lui attribue. Le côté
déclaré ne choisit rien : pour chaque VALEUR lue à un path déclaré, il retrouve l'occurrence qui la
contient et lit ce couple. Il n'y a qu'une source de vérité, le scan, et plus aucune fonction path → champ.
Un couple ne quitte `SLOTS_SANS_DECLARATION` que si TOUTES ses occurrences sont atteintes.

## Vocabulaire (un concept, un terme)

- **Occurrence** : l'unité que compte le scan, qui est aussi celle du champ `occurrences` du stock.
  C'est l'objet pour `:828` et `:836`, la paire (document, clé) pour `:843`, la LISTE entière pour `:864`.
- **Valeur** : une chaîne lue à un path déclaré par `valeursAuPath` (`slots-registre.mts:54`).
- **Atteinte** : une occurrence est atteinte si une valeur déclarée tombe dessus. Pour `:828`, la valeur
  est une clé résolvante de l'objet (dont `.id`). Pour `:843`, c'est la clé `k` du document. Pour `:864`,
  c'est un élément `[j]` de la liste. La table exposée par le scan est donc keyée par (objet parent, clé).
- **Couple** : `(dataset, champ)`, l'entrée du stock et la case du doc. Le mot « ligne » reste réservé
  aux formes du scan (`FormeObservee`, `ligneForme`).
- **Projection** : ce mot ne désigne plus que la signature de valeur (`structures-lexique.mts:115`,
  `structures-scan.mts:267-288`), qui reste vivante. Le sens « path → champ » disparaît avec ce lot.

## Cas canonique déjà couvert, et les nouveaux cas comme instances

- Couvert : `merchants.json › curated`. Le schéma porte `curated: refs('trapping').optional()`
  (`src/data/schemas/defs/merchants.ts:32`), branche `:864`, slot `[].curated[]`, 3 occurrences sur 3
  atteintes (19 valeurs). Verrouillé par `src/data/slots-contrat.test.ts:226-247`.
- Instance `:828` : `creatures.json › skills` (`src/data/schemas/defs/creatures.ts:72`, `:43`), slot
  `[].skills[].id`. De même `careerLevels.json › skills` (2237) et `› talents` (1724), déclarés
  (`[].skills[]|0.id`, `[].talents[]|0.id`) mais pas joints aujourd'hui.
- Instance `:843` : `buildings.json › roofMaterial` (`idDe('material', 'roof')`,
  `src/data/schemas/defs/buildings.ts:34`), slot `[].roofMaterial`, 7 sur 7. Jointe AUJOURD'HUI, elle
  doit le rester.
- La règle est la même pour tous : le côté déclaré demande au scan le couple de l'occurrence atteinte.
  Une nouvelle branche de classement coûte une inscription dans le scan, au site de son `ligneForme`.

## Ce que le lot doit établir (questions posées, réponse citée au rendu)

1. La CLÉ commune d'une occurrence. `parcourir` (`structures-scan.mts:406-413`) n'écrit pas l'indice de
   tableau dans `chemin`, alors que `valeursAuPath` l'écrit (`slots-registre.mts:65`). Deux options :
   une identité d'objet (le scan expose les documents qu'il a parsés, une seule lecture), ou un chemin
   indexé des deux côtés. Choisir en tenant compte des autres lectures du corpus, avec `fichier:ligne`.
2. L'enveloppe `:836` : les feuilles de `{choice:{…}}` ont pour parent `o.choice`, visité comme un objet
   distinct (`careerLevels.json | trappings`, 14). Dire si l'occurrence extérieure est atteinte par ses
   feuilles, et comment, sans branche côté déclaré. Si elle ne l'est pas, le couple reste au stock et
   l'angle mort est écrit.
3. La liste EXHAUSTIVE des couples qui SORTENT et qui ENTRENT, calculée par une sonde et rendue avec
   leurs comptes atteints / observés. Collisions connues, qui ENTRENT : les 4 `<projet> | ref` et
   `activities.json | rule` (`[60].rule`, `rule: z.string().optional()` à
   `src/data/schemas/defs/activities.ts:200`). Sorties attendues, entre autres : `activities.json | mod`
   et `| cible`, `creatures.json | skills`, `careerLevels.json | skills` et `| talents`.
   Seule la LISTE littérale des jointures d'aujourd'hui (21 couples) se promeut en test. Le mécanisme
   `parentDe(path)` des sondes du juge, lui, ne se promeut pas.

## Décisions d'ingénierie prises par défaut (révisables)

- **Les 4 `<projet> | ref` entrent au stock.** Le rendu donne leur compte par `kind`
  (au 2026-09-22 : 314 `prop` et 130 `personnage`). Deux causes, écrites telles quelles dans le motif
  du `CLIQUET:` et dans `ANGLES_MORTS_SLOTS`. Pour `prop`, la fabrique est adoptée par le `superRefine`
  par `kind` de `sceneEntitySchema` (`idDe('prop')`, #877), mais `slotsDe` ne la voit pas : c'est un
  angle mort RESTANT de la mesure. Pour `personnage`, il n'y a aucun slot (dette réelle, commentaire de
  #1473 du 2026-09-22). Le paragraphe `scripts/guards/lib/slotsStock.mjs:31-36` et la mesure du
  2026-09-22 à `:145` sont retirés.
- **`activities.json | rule` entre au stock** (1 occurrence, dette réelle, sans fabrique). Le commit
  `a6c963419` l'avait soldée à tort (« le slot de formulaSchema le couvre ») : le motif le cite. Le
  commentaire orphelin `slotsStock.mjs:64` est retiré.
- **Un couple atteint en partie** garde au stock son compte d'occurrences OBSERVÉ total (`CLE_DETTE`,
  `slots-contrat.test.ts:55-56`). La part atteinte s'affiche au doc.
- **`DETTE_ADOPTION_MAX`** (`slots-contrat.test.ts:198`, 348 aujourd'hui, soit 4 crans de mou) descend
  au compte mesuré au commit.
- **Angles morts** : `:146` est retiré. `:145` est retiré pour sa partie jointure. `:147` (union `|N`)
  est RÉÉCRIT, pas retiré : le volet RÉSOLUTION (`build-structures.mts:594-605`) compte toujours une
  valeur par branche. Le superRefine devient un angle mort restant. Le plancher `angleMort.length >= 4`
  (`slots-contrat.test.ts:206`) prend le nouveau compte, avec sa raison.
- **Mauvaise décision corrigée au passage** : la recopie des angles morts dans l'en-tête de
  `slotsStock.mjs:38-46`, tenue égale au lexique par le test `slots-contrat.test.ts:208-214`, est une
  garde de synchronisation. Elle est remplacée par un renvoi à `ANGLES_MORTS_SLOTS`, source unique.
- **Colonne du doc §6.1** (`build-structures.mts:603`) : elle devient « Champs joints », un ENSEMBLE de
  couples par slot. Un slot qui n'atteint aucune occurrence observée affiche « — ». Exemple :
  `ship-criticals.json tablesDeChute[].bandes[].hauteurs{}|10.rule`, testé sur une fixture parce que la
  donnée n'en porte aucune.

## Périmètre

- Code : `scripts/docs/lib/structures-scan.mts`. Le scan expose le couple attribué à chaque occurrence,
  au site de chaque `ligneForme` de référence, sans changer aucun classement.
  `scripts/docs/lib/slots-registre.mts` : `champDuPath` disparaît, `champsSansSlot` et `champsJoints`
  joignent par occurrence. `scripts/docs/build-structures.mts:594-622` : colonne et volet §6.1.
- Stock et garde : `scripts/guards/lib/slotsStock.mjs` (couples entrés et sortis, clause `:19-37`,
  en-tête `:38-46`, commentaires de ligne qui citent la projection, commentaire faux `:418` sur
  `valeursAuPath`). `src/data/slots-contrat.test.ts` : assertions `:237-247` réécrites en jointures sur
  données réelles, un cas par branche (`:828`, `:843`, `:864`, entrée de racine) plus `merchants.curated` ;
  test de synchronisation `:208-214` retiré ; plancher `:206` ; bloc de crans `:57-197` réduit à une
  réf nue au ticket.
- Lexique : `scripts/docs/lib/structures-lexique.mts:142-148` (`ANGLES_MORTS_SLOTS`).
- Doc régénéré : `docs/structures-donnees.md`, par `npm run docs:structures`, jamais à la main.
- Primitives réutilisées : `valeursAuPath`, `slotsDeclares` (`slots-registre.mts`), `scannerDonnees` et
  `scanDuCorpus` (`structures-scan.mts:426`, `:1066`), `ecartsDeStock` (`scripts/guards/lib/stock.mjs:42`).
- Hors lot : les classements du scan (`STRUCTURES_FORMES` et `HORS_STRATE_RATCHET` identiques à
  l'octet), les schémas `src/data/schemas/**`, toute donnée JSON. Aucun nouveau stock, garde ou générateur.

## DoD

- [ ] Plus aucune fonction path → champ. Sur les fichiers du périmètre,
      `grep -niE "champDuPath|dernier segment|projection path|projette sur|champ projeté"` ne rend rien.
- [ ] `STRUCTURES_FORMES` et `HORS_STRATE_RATCHET` inchangés ; `structures-contrat.test.ts` vert sans
      retouche de stock.
- [ ] `SLOTS_SANS_DECLARATION` : liste exhaustive des couples sortis et entrés au rendu, avec comptes ;
      compte de clôture `344 → N` ; `DETTE_ADOPTION_MAX = N`. Message de commit : `CLIQUET:` pour les 5
      entrées, avec leurs motifs.
- [ ] Les 21 jointures d'aujourd'hui sont listées littéralement dans un test : toutes conservées sauf
      les 5 collisions nommées.
- [ ] Tests neufs ou réécrits, chacun avec sa preuve par mutation (rouge débranché, vert rebranché,
      `git hash-object` avant et après).
- [ ] Portes du périmètre, sortie brute jointe :
      `npx vitest run src/data/slots-contrat.test.ts src/data/structures-contrat.test.ts`, `npm run typecheck:fast`.
      Les gates complètes sont jouées par le run CI de la branche.

## Exécution

- Worktree `/home/claude/game/.wt-1473-r0` sur `origin/main`, branche `chantier/1473-r0`.
- Codeur (`codeur`, opus, medium), budget 2 h, un livrable (diff et rendu brut). Interdit : tout
  `git checkout/restore/reset/stash/add/commit`.
- L'orchestrateur relit le diff, rejoue les portes, committe et pousse la branche. Un juge de diff tourne
  pendant le run CI. `main` n'est touché que par `ops:publier`, avec l'accord de Clément.

## Design jugé :

**FRAGILE** — workflow `juge-design-socle`, run `wf_11e5e961-e29`, 2026-09-23. Aucun bloquant structurel,
7 bloquants non structurels survivants, 1 écarté par réfutation. Les 7 corrections sont portées plus haut :
1. `activities.json | rule` est une 5e collision → « Décisions », « Ce que le lot doit établir » §3, DoD.
2. La liste des entrées tirée de la mesure du 2026-09-22 était incomplète → sonde exhaustive exigée (§3),
   faux solde `a6c963419` et commentaire orphelin `slotsStock.mjs:64`.
3. Le grep de la DoD débordait du périmètre → restreint aux fichiers du périmètre.
4. « Occurrence » désignait deux unités → section « Vocabulaire ».
5. Le vocabulaire de la projection survivait → grep élargi, colonne renommée, bloc de crans `:57-197` purgé.
6. Le retrait d'angles morts cassait le plancher `:206` et la copie `slotsStock.mjs:38-46` → plancher au
   périmètre, copie remplacée par un renvoi, `:147` réécrit et non retiré.
7. Le motif des 4 `<projet> | ref` était faux → deux causes nommées (superRefine invisible pour `prop`,
   aucun slot pour `personnage`), compte par `kind` au rendu.
Écarté par réfutation : « la clé de l'occurrence n'est pas choisie ». La question reste posée au codeur (§1).
Texte intégral du bloc : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/bloc-v2.md`.
