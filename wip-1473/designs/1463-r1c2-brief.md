# #1463 · concept RÉFÉRENCE — brief du lot R1, COMMIT 2 (démolition de la marche des slots, descente canonique, API dépréciée)

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par
#1466 ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept
(L2/L3) et gameOpRefFk.mjs ». Épique : #1463.
Brief parent : `/mnt/project-files/dettes/1463-r1-brief.md` (v1.1), décisions 8, 9 et 10, section « DoD, commit 2 ».
Base : `chantier/1473-r1` à `b9eabfad4` (commit 1 `662fd7ad0` + corrections du juge), 2026-09-23.
Worktree : `/home/claude/game/.wt-1473-r1`.
Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour
une structure plus adapté ».
Travail en cours du sujet : sonde du 2026-09-23 sur toutes les branches `origin` non fusionnées dans `main`
(`git diff --name-only origin/main...<branche>` sur `slots.ts`, `zod-introspect.mts`, `validate.ts` et les
trois tests de la décision 10) : seule `origin/chantier/1473-r1` les touche. Rien à intégrer.

## Invariant

1. Verbatim : « Marche UNIQUE d'un schéma composé : visite chaque nœud MARQUÉ avec son path. Les cycles sont
   coupés par la PILE D'ANCÊTRES, jamais par un ensemble global de nœuds vus — une instance partagée par 3
   champs vaut 3 slots, pas 1. » Source : `src/data/schemas/grammaire/slots.ts:132-134`.
   Question à laquelle elle répondait : comment énumérer les nœuds d'un schéma composé sans boucler sur un
   `z.lazy` ni fusionner une instance partagée. Depuis le commit 1, plus aucun slot n'en sort : la moitié
   « nœud MARQUÉ » meurt, la moitié « descente bornée par la pile d'ancêtres » survit dans la primitive.
2. Verbatim (invariant du lot, brief v1.1) : « Le côté DÉCLARÉ est ce que le PARSE valide. » Conséquence :
   toute marche du SCHÉMA qui produit un slot est du code mort depuis `662fd7ad0`.
3. Constat du commit `b9eabfad4` (message, section « Reste pour le commit 2 ») : « `enfantsDe` ne visite ni
   `keyType`, ni `catchall`, ni `left`/`right`, ni `rest`, et rappelle le getter d'un `z.lazy` au lieu de son
   `innerType` exécuté ; la garde les ajoute localement (`ENFANTS_HORS_DESCENTE`), la descente canonique doit
   les absorber. » Preuve : la mutation M5 du codeur (ligne du `lazy` débranchée dans
   `parse-de-mesure.test.ts:117`) rend le corpus rouge en COUVERTURE (`careerLevels.json` 3972 repères rendus
   pour 3961 émis, `species.json` 497/419, `talents.json` 127/118).
   Invariant déduit : **la descente canonique visite chaque enfant que le parse exécute, et un `z.lazy` y
   descend par l'instance que le parse exécute.**

## Cas canonique et instances

- Cas canonique : `enfantsDe` (`slots.ts:50`) et `descendreArbre` (`slots.ts:141`, pile d'ancêtres).
- Instances qui re-codent la même descente (sonde `git grep -n "enfantsDe(" -- src scripts`, le 2026-09-23,
  hors homonyme `scripts/guards/lib/importGraph.mjs`) :
  - `src/data/grammaire-guard.test.ts:113-130`, `src/data/schemas/grammaire/records-de-libelles.test.ts:50-62`,
    `src/data/schemas/grammaire/valeurs-de-champ.test.ts:50-66` (pile d'ancêtres + `PROFONDEUR_MAX`) ;
  - `src/data/schemas/grammaire/parse-de-mesure.test.ts:103-120` (`noeudsAtteints`, file + ensemble de vus) ;
  - `src/data/schemas/validate.ts:70-85` (`noeudObjet`, largeur d'abord, ensemble de vus, profondeur < 8) ;
  - `scripts/docs/lib/zod-introspect.mts:40` (`marcherMemoise`, mémo par identité, `PROFONDEUR_MEMO = 12`)
    et `:21` ; `scripts/docs/build-structures.mts:58` (premier enfant d'un `lazy`).
- Question (réponse citée au rendu) : parmi ces règles d'arrêt (pile d'ancêtres, mémo par identité, largeur
  d'abord), lesquelles sont des sémantiques réellement différentes, et lesquelles des copies ? La primitive
  prend-elle la règle d'arrêt en paramètre, ou y a-t-il deux primitives ? Chaque consommateur cite la sienne.

## Design jugé :

**FRAGILE** — workflow `juge-design-socle`, run `wf_1fcddf84-798`, 2026-09-23, corrigé en v1.1 (décisions 8 à
10 du brief parent, bloquant 8 : « Duplication de la descente laissée au ticket → décision 10, inventaire
complet et socle désigné »). Juge de diff du commit 1 : FRAGILE, ses deux bloquants corrigés à `b9eabfad4`.

## Trois erreurs du brief parent, relevées en préparant ce commit

1. Décision 10 : « Les consommateurs de `PROFONDEUR_MAX` suivent (`scripts/hooks/segments-profonds.test.mjs`,
   `scripts/hooks/solde-ticket-guard.mjs`) ». FAUX : ces deux fichiers lisent `PROFONDEUR_MAX_ENROBEURS`
   (`solde-ticket-guard.mjs:458`, `= 4`), une autre constante. Consommateurs réels (sonde `git grep -n
   PROFONDEUR_MAX -- src scripts`) : `grammaire-guard.test.ts:29`, `records-de-libelles.test.ts:48`,
   `valeurs-de-champ.test.ts:17`, `slots.test.ts:11`.
2. Décision 10 : « `marcherMemoise` reste à part, pour sa raison : [...] son défaut est porté par #1687 ».
   FAUX : #1687 « Décor STATIQUE ou UTILISABLE — identité, nom au survol, surbrillance et ACTIONS du décor
   (ligne 13 de #1680, état de l'art NWN / BG3 / RT) » est FERMÉ (solde du 2026-09-11). Le défaut de
   `PROFONDEUR_MEMO` (`zod-introspect.mts:57-66`, « sa levée est #1687 », et
   `scripts/guards/lib/horsStrateStock.mjs:26-37`) n'a donc aucun ticket ouvert. Voir la question 2.
3. L'inventaire de la décision 10 omettait `noeudObjet`, `noeudsAtteints` et `build-structures.mts:58`.

## Périmètre et gestes, dans cet ordre

**A. Démolition (décision 9).** Meurent : `slotsDe`, `slotsDeclares` (`scripts/docs/lib/slots-registre.mts:28`),
le type `Slot` au sens du path de schéma, `marque`, `marqueDe`, `marquesPosées`, `marquesRetrouvées`, l'espèce
`acteur` (`actorRefSchema`, `src/data/schemas/grammaire/mecanique.ts:226-227`, redevient un `enumNomme` nu),
`profondeurDe` et son test de marge, `CAP_MESURE_PROFONDEUR`, le stock `SLOTS_INTERNES`
(`scripts/guards/lib/slotsStock.mjs` et `.d.mts`) et son test (`src/data/slots-contrat.test.ts:231`), les
angles morts 1 et 2 d'`ANGLES_MORTS_SLOTS` (`scripts/docs/lib/structures-lexique.mts`), l'usage de `slotsDe`
dans `src/data/schemas/grammaire/grammaire.test.ts:25`. `idDe` (`grammaire/ref.ts`) ne garde que
`FEUILLES_D_ID` : la double reconnaissance (marque + WeakSet) disparaît. `SlotDuParse` se renomme `Slot` (un
concept, un terme). Homonymes NON visés : `marque(` et `marqueDe` de `scripts/ops/*.mjs` et
`src/gameIso/stage/*.test.tsx`.

**B. API dépréciée (décision 8).** `z.ZodIssueCode.custom` → `'custom'` sur les 22 sites de `src/` (sonde
`git grep -c ZodIssueCode -- src` du 2026-09-23 : `defs-scenes/scene.ts` 3, `defs/actions.ts` 13,
`defs/activities.ts` 4, `defs/river-perils.ts` 1, `grammaire/mecanique.ts` 1). Dépréciation :
`node_modules/zod/v4/classic/compat.d.ts:10-11`. Garde : étendre la garde canonique d'API interdites si elle
existe sous `scripts/guards/lib/`, sinon en poser une ; preuve par mutation.

**C. Descente canonique (décision 10).** `DefZod`, `defDe`, `EnfantZod`, `enfantsDe` et la descente bornée à
pile d'ancêtres vont dans un module nommé pour la descente, sous `src/data/schemas/grammaire/` (nom au choix,
sans « slot ») ; `slots.ts` et `slots.test.ts` disparaissent s'il n'en reste rien, les tests de `enfantsDe`
suivent la primitive. `enfantsDe` tient l'invariant 3 : `keyType`, `catchall`, `left`/`right`, `rest`, et
l'`innerType` exécuté d'un `lazy` ; la syntaxe de segment de chaque nouvel enfant est écrite dans sa JSDoc.
Tous les consommateurs de l'inventaire composent la primitive, `ENFANTS_HORS_DESCENTE` meurt, imports
recalés (dont `src/ui/compendium/editFields.ts:9` et `src/ui/compendium/libelles-de-champs.test.tsx:29`).

Hors lot : toute donnée JSON ; R1-bis (`OPS_NON_TYPEES`, `sea-weather.ts:65`, `sea-events.ts:35`,
`corruptionExposure`).

## Ce que le rendu doit établir (réponse citée, sortie de sonde collée)

1. La question des règles d'arrêt (section « Cas canonique »).
2. Les bornes : une fois le `lazy` descendu par son `innerType`, `PROFONDEUR_MAX` (31), `PROFONDEUR_MEMO` (12),
   la borne 8 de `noeudObjet` et `PROFONDEUR_RELEVE` (6) mordent-elles encore ? Mesure pour chacune (par
   exemple nœuds visités sur `arene-projet.json` à la borne et sans borne, comme `zod-introspect.mts:58-60`).
   Une borne qui ne mord plus meurt avec son commentaire. Si `PROFONDEUR_MEMO` ne mord plus, le paragraphe
   « DÉFAUT D'INSTRUMENT » de `horsStrateStock.mjs` et `zod-introspect.mts:57-66` meurt, et
   `HORS_STRATE_RATCHET` se régénère. Si elle mord encore, ne rien inventer : le rendu le dit avec la mesure,
   et je rouvre le défaut en ticket.
3. L'effet de l'élargissement d'`enfantsDe` sur chaque consommateur : docs régénérés (`npm run
   docs:structures`, puis `npm run docs:build`), tout écart hors pied d'empreinte expliqué ligne à ligne ;
   stocks `STRUCTURES_FORMES`, `HORS_STRATE_RATCHET`, `SLOTS_SANS_DECLARATION`, `SLOTS_INATTEIGNABLES`
   identiques, ou en baisse avec chaque sortie nommée. Une ENTRÉE dans un stock arrête le geste C : rendre
   la mesure, ne pas cliqueter.
4. Les lecteurs de l'espèce `acteur` avant démolition, et ce qui disparaît du §6 de `docs/structures-donnees.md`.
5. La garde d'API interdites : existante (fichier:ligne) ou posée.

## DoD

- [ ] `git grep -nE "slotsDe|slotsDeclares|marquesPosées|marquesRetrouvées|valeursAuPath|typedRef|SlotDuParse|SLOTS_INTERNES|profondeurDe|ENFANTS_HORS_DESCENTE"`
      ne rend rien hors `docs/plans/`.
- [ ] Une seule descente, composée par tous les consommateurs de l'inventaire ; toute règle d'arrêt distincte
      nommée avec sa raison mesurée.
- [ ] `git grep -c "ZodIssueCode" -- src` rend 0 ; la garde est rouge sur une mutation.
- [ ] Aucun sens ancien de « slot » dans les fichiers du périmètre (grep joint) ; commentaires en réf nue.
- [ ] Chaque test neuf ou réécrit a sa preuve par mutation : rouge débranché, vert rebranché, `git hash-object`
      avant et après.
- [ ] Portes, sortie brute jointe : `npm run typecheck:fast`, `npx vitest run` sur les tests du périmètre
      (les fichiers touchés, `src/data/slots-contrat.test.ts`, `src/data/schemas/grammaire/`,
      `src/comment-poison-guard.test.ts`, `src/ui/compendium/`), `node scripts/docs/build-all.mjs --empreinte`
      (elle exige les nouveaux fichiers suivis : dis-moi lesquels, je les ajoute).

## Exécution

- Un codeur (`codeur`, opus, medium), budget d'horloge 2 h, un livrable : le diff dans le worktree et le rendu
  brut. Ordre A, B, C : à l'échéance, rendre ce qui est fait et NOMMER le reste.
- Interdit : `git checkout/restore/reset/stash/add/commit`, toute édition de donnée JSON, le tag `[entériné]`,
  toute suppression récursive hors `CIBLES_JETABLES` de `scripts/hooks/git-destructive-guard.mjs`.
- L'orchestrateur relit le diff, rejoue les portes et le typecheck complet, committe, pousse, fait juger le
  diff cumulé des commits 1 et 2 pendant le run CI.
