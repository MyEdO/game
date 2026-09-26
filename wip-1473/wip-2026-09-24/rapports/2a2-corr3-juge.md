## Juge de diff — train 2a2 après corrections 3 (M1-M4), 2026-09-24

Arbre épinglé : `/home/claude/game/.wt-1473-t2`, HEAD `6a55a5d7c`. Contrôle positif : 38 fichiers modifiés et 8 non suivis (`memeRef.mjs`, `meme-ref-guard.test.ts`, `niveau-complet*.ts`…). Les empreintes actuelles sont celles du rendu : talents.json `249ad649…`, state/advancement.ts `bf84848f…`, partyFlow.ts `04772083…`, memeRef.mjs `4e80aea8…` (`cmp memeRef.mjs.orig` = 0).

**Verdict : FRAGILE.** Les trois bloquants du verdict cumulé sont levés sur le plan MÉCANIQUE (sondes rejouées ci-dessous). Deux bloquants neufs :
- les commentaires attribuent au livre la fermeture d'une liste que le livre laisse ouverte ;
- la garde « même référence » laisse passer 8 sites d'identité recodée, présents dans `src/`.

### Q1 — bloquants du verdict cumulé (sondes rejouées, `juge-2a2-corr3/rejeu-*.log`, exit=0 ×3)
- **B1 (K1) : LEVÉ mécaniquement.** `rejeu-sonde-k1-contrat.log` :
```
haine|Nains resout=false ouverte=false designe=- => REFUSE
haine|Peaux-Vertes (Orques) resout=false ouverte=false designe=- => REFUSE
savoir-vivre|Vagabonds fantômes ... => REFUSE ; sans-peur|Skavens => REFUSE ; bon-marcheur|Jungle => REFUSE
destinee|La mort n’est pas la fin resout=false ouverte=true designe=la-mort-n-est-pas-la-fin => REFUSE
```
  `designee` lit `resolveSpecId` (`refs-migrated.test.ts:721-724`), et `slugId` n'est plus recopié. Ce qui RESTE, c'est la justification au livre : voir le bloquant 1.
- **Compétence ajoutée sans rangée : LEVÉ.** `rejeu-sonde-competence-ajoutee.log` : deux rangées `metier`, `imprimerie` (l'emplacement Agitateur N1) et `forgeron` avec `ajout` maitre-artisan|forgeron, 10 PX ; après l'achat, `advances:1`, xp 990.
- **Prédicat dupliqué : LEVÉ pour la définition.** `memeRef` unique (`careerSlots.ts:146`). 0 occurrence de `ajoutDesigne`, `poolsACompter`, `ajoutDeRangee` ou `deplierAjouts` dans `src`. Ce qui RESTE, c'est la classe : voir le bloquant 2.

### BLOQUANTS
1. **La fermeture « liste d'exemples = catalogue FERMÉ » est attribuée au livre, qui ne la dit pas.** Sites :
   - `src/data/refs-migrated.test.ts:487` : « Une liste d'exemples (LDB 10 l.117) est un catalogue FERMÉ » ;
   - `:775` : « Haine : liste d’exemples, LDB 10 l.548 », qui soutient `entreeOuverte(...)=false` ;
   - `src/engine/careerSlots.test.ts:241` : « à liste d’exemples (Haine, LDB 10 l.548) n’est couvert que par son catalogue » ;
   - `grammaire.test.ts:1261` : « Talent FERMÉ (liste d’exemples) ».

   Paires question/réponse, au Source :
   - LDB 10 l.117 : « Les spécialisations courantes incluent : Littoral, … ». Question à laquelle la phrase répond : lesquelles sont COURANTES. « incluent » dit une liste non exhaustive.
   - LDB 10 l.548 : « Chaque fois que vous prenez ce Talent, vous développez une certaine haine envers un nouveau groupe. Voici quelques exemples de groupes que vous pouvez haïr ». Question : l'illustration. « quelques exemples » ouvre la liste.
   - Même lecture pour LDB 10 l.1051 « Les ennemis courants comprennent », l.1070 « Voici des exemples de groupes sociaux », et ADE II 02 l.265 « Voici quelques exemples : alcool, … ».
   - Ce que le code leur fait porter : « le livre ferme la liste ». C'est ÉTIRÉ, jusqu'à l'inversion. La distinction des cas 1 et 3 (rendu M1.1) ne tient pas au livre : Destinée l.319 dit aussi « Voici des exemples ». Seul l.315 ajoute explicitement « proposez ».

   **Le retrait de `specsOpen` restreint-il le joueur ?**
   - AU MOMENT DE L'ACHAT, non, et c'était déjà le cas avant : la rangée « Au choix » d'un Talent ne propose que le catalogue, ouvert ou non (`src/state/advancement.ts:211` `wildcardSpecs(o,'talent')` → `specPoolOf`, `careerSlots.ts:117-121`).
   - Ce qui se ferme, c'est la saisie libre en données et à l'éditeur : `refusDeSpec` rend `'horsCatalogue'`, `RefField.tsx:159`, `slotCovers` (`careerSlots.ts:231`).
   - Un groupe neuf (Nains pour la Haine) devient donc une ENTRÉE de catalogue. C'est une voie légitime de la règle 7 (« donnée éditable taguée maison »), mais c'est un ARBITRAGE, et non une lecture du livre.

   **Correction attendue :** réécrire les 4 sites pour dire le vrai. Le livre donne des exemples (liste ouverte). La règle 7 est tranchée par le catalogue éditable, et une entrée neuve est taguée `maison`. Retirer « catalogue FERMÉ » et « Talent FERMÉ (liste d’exemples) » comme attribution au livre.

   Le critère de la garde (« OUVERT = le livre fait créer la spec au joueur ») doit s'appuyer sur un texte qui le dit. Sinon, il se consigne comme évaluation d'ingénierie, et non comme RAW. La consigne de Clément du 2026-09-24 (« Tu sais le RAW prime… ») interdit précisément de faire parler le livre à rebours.

2. **La garde `memeRef` laisse passer la même classe sous une autre graphie, à 8 sites existants.** Son angle mort est déclaré (`src/engine/meme-ref-guard.test.ts` : « `a.spec === b.spec` … n’est pas vue »). Sonde `juge-2a2-corr3/sonde-identite-sans-normalisation.log`, exit(grep)=0 :
```
src/engine/menace.ts:44:    (t) => t.talentId === 'resistance' && t.spec === menaceId,
src/engine/seaNavigation.ts:80:  ... s.id === 'savoir' && s.spec === 'oceans' ...
src/engine/riverNavigation.ts:130:  ... s.id === 'savoir' && s.spec === 'voies-fluviales' ...
src/scenes/test-scenarios/voyage.ts:19 / 15-commerce-fluvial.ts:31 / 14-voyage-maritime.ts:22 / 21-chute-du-greement.ts:30:
      const ex = c.skills.find((s) => s.id === skillId && s.spec === spec);
src/scenes/test-scenarios/siege-enceinte.ts:291: ... s.id === ref.id && s.spec === ref.spec
```
   - Les 8 sites comparent une identité (id, spec). Leur seule différence avec `memeRef` porte sur `''` contre `undefined`, précisément la divergence que `memeRef` est censé trancher.
   - Le helper des scénarios est en plus dupliqué 4 fois : duplication, credo.
   - Les autres formes vues par la sonde (`combatFeatures/dispatch.ts:352`, `reverseToken.ts:29`, `flowCore.ts:350,358`, `shipCrew.ts:41` : `spec == null ||`) sont des COUVERTURES par joker, de sémantique différente : elles restent légitimement hors de la garde.
   - **Correction :** migrer les 8 sites vers `memeRef` et étendre `MEME_SPEC_RX`, ou un second motif, à `\bid\s*===[^&]*&&\s*[\w.?]*\.spec\s*===`. Le cas se prouve au `memeRef.test.mjs`. L'angle mort déclaré se retire.

### Q3 — prédicat et garde
- **Emplacement : CONFIRMÉ acceptable.** `memeRef` est à côté de `refKey` (`careerSlots.ts:141-149`), comme l'ordonnait le brief. `RefDesignee` vit en `data/schemas/grammaire/ref.ts:425`. Tous les importeurs neufs importaient déjà `./careerSlots` (diff des imports : `character`, `activities`, `talentEffects`, `advancement`), donc aucun cycle nouveau.
- **Équivalence `refKey` : CONFIRMÉE.** `refKey` = `spec ? id|spec : id`, et un id ne porte pas de `|`. Test `meme-ref-guard.test.ts` vert.
- **Branchement : CONFIRMÉ conforme aux voisines.**
  - `.mjs` + `.d.mts` + `.test.mjs`, comme `codeSeul`/`cssCouches`.
  - Le node:test est ramassé PAR RÉPERTOIRE (`scripts/gates/testsParGate.mjs:36`, `'scripts/guards'`).
  - L'enveloppe vitest `GARDE = {…}` suit le patron de `src/comment-poison-guard.test.ts:34` et `src/scripts-nul-guard.test.ts:12`.
  - `readCorpus` suit `src/data/char-key-legacy-guard.test.ts`.
- **`hasMeleeSpec` (`combat.ts:847`) : équivalence CONFIRMÉE.**
  - Avant : `(s.spec ?? '') === spec`. Après : `s.spec === spec`, avec `spec: string`.
  - Les deux ne diffèrent que si `spec === ''` et que `s.spec` est absent. Le seul appelant passe `'parade'` (`combat.ts:855`, grep).

### Q4 — M2 : projection contre store (`juge-2a2-corr3/sonde-m2-coherence.log`, exit=0)
```
[imprimerie] PROJECTION [{"spec":"imprimerie","inCareer":true,"known":false,"cost":5,"ajout":"maitre-artisan|imprimerie"}]
[imprimerie] STORE achat metier|imprimerie : paye=5 projete=5 adv=1
[forgeron] PROJECTION [{"spec":"imprimerie",...,"cost":10,"ajout":"-"},{"spec":"forgeron",...,"cost":10,"ajout":"maitre-artisan|forgeron"}]
[forgeron] STORE achat metier|imprimerie : paye=10 projete=10 adv=1
[forgeron] STORE achat metier|forgeron : paye=10 projete=10 adv=1
```
- **CONFIRMÉ.** La projection et le store disent la même chose sur le statut, le coût et la provenance, dans les deux cas, puisqu'ils lisent la même `competenceEnCarriere` (`talentEffects.ts:220-230`, `state/advancement.ts:160-172`, `partyFlow.ts:401`).
- Au Source : LDB 10 l.745, « Si la Compétence Métier est déjà incluse dans votre Carrière, vous pouvez à la place acheter la Compétence pour 5 PX de moins par Augmentation » (remise quand l'ajout recouvre un emplacement : 5 PX). LDB 07 l.76, « Vous pouvez Augmenter les Compétences indiquées par votre niveau de Carrière » (hors recouvrement : coût de carrière, 10 PX, et non le double de l.91).

### Q2 (suite) — autres citations
- **`LDB 09 l.40` pour les Talents (Métier)/(Savoir)** (`refs-migrated.test.ts:484-486, 714-715`) : étirée à moitié.
  - La phrase répond à l'allocation d'une Augmentation dans une Compétence Groupée « Au choix ». Elle ne vaut pour le texte d'un TALENT que si sa spec EST celle de la Compétence.
  - Aucun champ ne porte ce lien : le rendu le déclare (M1.1, « ÉCART »). Les `specs[]` des Talents sont des copies divergentes.
  - Défendable, parce que `metier`/`savoir` sont `specsOpen` dans skills.json (sonde node : `metier specsOpen=true`, `savoir specsOpen=true`). L'écart est nommé.
- **LDB 10 l.315 (Destinée) : juste.** « En accord avec votre MJ, proposez une Destinée appropriée ».
- **LDB 10 l.741, LDB 11 l.126, LDB 10 l.1059 : justes.** Ce sont des titres, vérifiés.
- **`LDB 10 l.17` subsiste ailleurs**, alors que M1 l'a corrigée dans refs-migrated : voir NB1.

### NON BLOQUANTS
- **NB1.** `src/engine/careerSlots.ts:223` (« Talent `LDB 10 l.17` ») et `src/engine/careerSlots.test.ts:203` (describe « (LDB 10 l.17) ») citent l.17 pour « un joker exige une spec ». Or l.17 définit la parenthèse (« le mot à l'intérieur décrit une utilisation »), et le fichier est touché par le diff. Correction : citer ce qui fonde le propos, ou retirer la citation.
- **NB2 (hors périmètre, préexistant, règle 7).** Destinée, LDB 10 l.315 (« proposez une Destinée ») : aucune surface joueur ne permet de la PROPOSER, puisque l'achat ne lit que le catalogue (`state/advancement.ts:211`). Même chose pour LDB 09 l.40 côté Compétences (`state/advancement.ts:180`). `specsOpen` ne sert que l'édition. Issue à ouvrir.
- **NB3.** Le cliquet `PLAFOND = 24` des textes d'instance (HEAD `refs-migrated.test.ts:760-766`) est SUPPRIMÉ sans être nommé au rendu, contre la grille 5.
  - Mesure `juge-2a2-corr3/sonde-textes-libres.log` : `seen 420 non resolues 26 [["bon-marcheur(FERMEE)",5],["destinee(ouverte)",21]]`.
  - Le retrait est défendable (Destinée est libre au RAW), mais il doit se dire.
- **NB4.** `talentMax` (`src/engine/careerSlots.ts:386`) est toujours mort : seul son test le lit (`careerSlots.test.ts:174,181`). Il est dans un fichier touché. Le rendu dit « pas d'issue ouverte », or le credo exige l'issue immédiate. Non vérifié côté GitHub : la recherche REST et GraphQL renvoie 403 dans cette session.
- **NB5.** `horsStrateStock.mjs:1003`, +1 signature `passive | commeEnCarriere,op,talent` : c'est une CROISSANCE, déclarée et héritée de K3 (acceptée au cumul). `structuresStock.mjs` change une signature, sans croissance. `BORNES_EN_TEXTE_LIBRE` : 5 contre 5. Le plafond des sentinelles reste à 12.
- **NB6.** `CharacterSheet.tsx:717` fabrique une `TalentInstance` (`times: 1`) pour une PROVENANCE. Le chip est juste à l'écran (`×N` seulement si N > 1, `EntityChip.tsx:110`), mais le type ment.
- **NB7 (langue).** « exigence » (`engine/advancement.ts:145-159`) est absent du lexique (`structures-lexique.mts` : 0 occurrence), et voisin du `exiges` de la grammaire de schéma (`schemas/grammaire/document.ts:66`, « porteur exigible »). La collision est faible, dans une autre couche. `aApprendre` et `AjoutDeplie` n'entrent en collision avec rien (grep).
- **NB8.** `refs-migrated.test.ts:726` et `:755` portent une promesse datée par lot (« quand … (E4, train 2b de #1473) », « Lot de mort : E4 »). C'est à la lisière de la famille « excuse ». La garde des commentaires est verte.
- **NB9 (hors classe).** Même forme d'identité sur un autre qualificatif : `(x.cible ?? '') === (op.cible ?? '')` (`corruption.ts:243`, `grantedTraits.ts:70`), dans `sonde-angles-morts.log`.
- **NB10.** `docs/test-scenarios.md` n'est pas régénéré (nommé au rendu). `docs:check` sera rouge au commit sans `docs:build`.

### Q6 — stocks et preuves
- **Mutations : CONFIRMÉES.** Les journaux `mut-m1|m2|m3|mut-garde-node.log` portent AVANT = APRES = arbre actuel (sha256 ci-dessus), avec un rouge puis un vert :
  - M1 : 3 échecs puis 114 verts ;
  - M2 : 1 échec puis 21 verts ;
  - M3 : 1 échec puis 2 verts ;
  - node : fail 2 puis pass 2.
- **Rejeu du périmètre** (`juge-2a2-corr3/v.log`, `node.log`) : 24 fichiers, soit les 23 du rendu plus `GameOpEditor.champs-a-choix`.
```
vitest exit=0 ; Test Files  24 passed (24) ; Tests  709 passed (709)
node --test scripts/guards/lib/memeRef.test.mjs : node exit=0 ; # pass 2 # fail 0
```

### Q7 — non bloquants du verdict cumulé
- **Soldés :**
  - NB-a : contre-témoin dans `niveau-complet.test.ts` ;
  - NB-b : `TalentChip`/`TraitChip`, avec la réserve NB6 ;
  - NB-c : `ajoutDeRangee` et son union sont supprimés ;
  - NB-d : « exigence » ;
  - NB-e : `state/advancement.ts` n'importe plus la grammaire ;
  - la section `progression` (`_shared.ts:24`, `niveau-complet.ts:63`) ;
  - la citation l.17 dans refs-migrated.
- **Nommés comme non faits :** `docs/test-scenarios.md`, NB1 et NB2 du premier verdict, `talentMax`.
- **Non traité et non nommé :** la même citation l.17 dans `careerSlots.ts:223` et `careerSlots.test.ts:203` (NB1).

### Non jugé
- Recette navigateur : un recetteur est en parallèle, et le brief l'interdit.
- Typecheck, suite complète, `docs:check`.
- L'existence d'une issue `talentMax` : l'API de recherche GitHub est inaccessible.

### Sondes (`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-2a2-corr3/`)
`rejeu-sonde-*.log`, `sonde-textes-libres.mts|.log`, `sonde-m2-coherence.mts|.log`, `sonde-angles-morts.log`, `sonde-identite-sans-normalisation.log`, `v.log`, `node.log`. Aucun processus laissé : les runs sont synchrones et terminés.
