# Suivi de vague — épique #1816 (5e sélectionnable), session 60c2b9c9

> Emplacement : `.git/suivi/1816.md` (répertoire git commun), choisi par l'utilisateur le 2026-09-28. L'outil et les hooks naissent avec #2132.
> À RELIRE EN PREMIER après toute compaction ou reprise, et à mettre à jour à CHAQUE geste (dispatch, verdict, commit, publication).
> Le plan vit dans le corps de #1816, amendé le 2026-09-28 : Phase 2 = Atlas v2 (#1887).
> L'état se MESURE (`npm run ops:board -- --liste`, `git log`) : ce fichier dit où je vais, il ne remplace pas la mesure.
> Dernière mise à jour : 2026-09-28.

## Objectif
Épique #1816, « Tout le plan, dans l'ordre » (utilisateur, 2026-09-27). Deux phases en cours :
- Phase 2 = Atlas v2, #1887 ;
- Phase 3 = langue (ids, jamais libellés), #1988.

## En cours — dans l'ordre

0. **#2132 fichier de suivi de vague** : VITAL (utilisateur, 2026-09-28 : « Il faut absoluelement faire un truc pour ce fichier de suivis, c'est vital si on veux éviter la dérive »)
   - [x] ticket ouvert, session #2112 prévenue (même `scripts/hooks/`)
   - [x] fichier déplacé ici
   - [x] hooks **Bloqué par #2125**, répartiteur + registre des gardes de game-0e, non publié ; coordination envoyée à game-0e, attente de sa réponse. Ni `settings.json` ni `scripts/hooks/` avant son feu vert
   - [x] chantier `.wt-2132-suivi` (`chantier/2132-suivi`, base `eb3a49429`, port 5191)
   - [x] brief lot 1 (`ops:suivi` + skill + `CLAUDE.md:118` + #1750) : `scratchpad/suivi-2132/brief-2132-lot1-v1.md` ; cas canonique `mesurer()` de `board.mjs` + `arbrePrincipal()` + `ticketsCites`
   - [x] juge v1 : RÉFUTÉ, 4 bloquants (B1 `ticketsCites(1816.md)=[]` ; B2 26 s/appel dont 18,6 s d'issues ; B3 écriture concurrente ; B4 docs dérivés ne suivent pas `package.json`)
   - [x] brief v2 : `suivi-2132/brief-2132-lot1-v2.md` (grammaire = 1er `#N` des items de `## En cours` ; `mesurer({portee})` ; mesurer puis relire + `rename` atomique ; `build-reprise.mjs` + `agents:sync`)
   - [x] juge v2 : RÉFUTÉ, 2 bloquants. B2' : le budget ≤ 10 s est réfuté (10 à 23 s mesurés ; git non borné ; nombre de pages = âge du plus vieux ticket). B3' : `rename` lève EPERM dès que le fichier est tenu, et le temporaire reste. N1 à N9 dans le rendu, dont N5 : « aucun état saisi » est FAUX, les étapes `[x]` s'écrivent à la main
   - [x] brief v3 écrit (`suivi-2132/brief-2132-lot1-v3.md`) : git borné par la portée ; budget = mesure rendue ; EPERM → refus + temporaire supprimé ; listage `^\d+\.md$` ; grammaire écrite ; `Number` à la frontière ; issue `CITATION` hors lot
   - [x] juge v3 : RÉFUTÉ. B3' levé ; grammaire tenue.
     - B1 : `--sans-fetch` fait QUAND MÊME un fetch, via l'inventaire (`board.mjs:547` → `worktrees.mjs:137`), et une mesure sans ce drapeau fetche 2 fois. L'inventaire pèse 66 à 70 % du git. La classe « coût » est frappée pour la 3e passe → défaut de design : partir d'un PROFIL mesuré geste par geste. La borne git par portée est facultative (YAGNI).
     - B2 : `SKILL.md:13-22` (task-tracker, pilotage) reste une seconde source du prochain geste.
     - N1 à N13 : ordre de nettoyage (zone → commentaires → blocs de code) et point fixe ; marqueurs ancrés ; un ticket publié puis fermé est perdu (`construireLignes:230`) ; état de l'épique dans la forme de retour ; cliquet `ecrivainsAtteints` ; temporaires orphelins nommés ; `#00`.
   - [x] brief v4 écrit (`suivi-2132/brief-2132-lot1-v4.md`) : profil en tête ; un fetch par mesure ; `durees` rendues ; pas de borne git ; issues par portée ; régime entier (`SKILL.md:13-22`)
   - [x] juge v4 : FRAGILE, 3 bloquants de spécification (`juge-v4/`).
     - B1 : la forme à 3 états « fait/sans/faire » est ambiguë. → Booléen `sansFetch` sur `inventaire` (patron `board.mjs:521`) ; `mesurer` l'appelle avec `sansFetch: true`.
     - B2 : `durees` ne couvre pas le temps de `mesurer`. → Ne pas toucher son retour ; `ops:suivi` enveloppe les gestes injectables (`Object.keys(GESTES_DU_BOARD)` + `inv` + `issues`) ; critère : reste < 50 ms.
     - B3 : l'épique #665 coûte 14 s d'issues. → Retirer l'épique de la lecture ; l'en-tête ne porte que son numéro et son lien.
     - Cardinal mort : `toutes.mjs:158` écrit « six modules », la mesure en trouve 17 → à retirer.
     - N1 à N8 : profil corrigé ; « zone écrite intacte à l'octet » restaurée ; clôtures `~~~` et non fermées ; anomalies hors portée ; `Number` dans `ticketsCites` ; `SKILL.md:182-183` ; ordre des lignes après `construireLignes`.
   - [x] brief v5 écrit (`suivi-2132/brief-2132-lot1-v5.md`)
   - [x] juge v5 : **TIENT**, 0 bloquant ; 6 non-bloquants (N1 à N6) intégrés dans `suivi-2132/brief-2132-lot1-v5-final.md`
   - [ ] codeur EN COURS (diff non commité dans `.wt-2132-suivi` ; issue `CITATION` et commentaire #1750 rédigés dans `suivi-2132/codeur/`, pas postés)
   - [ ] puis juge sur le DIFF → commit → publication
   - [ ] hooks une fois #2125 publié (visé 2026-09-28 au soir ; game-0e prévient) :
     - rappel = garde `PostToolUse` `{ contexte }`, une ligne à `scripts/hooks/registre.mjs`, puis `npm run agents:sync` et `agents:check` ; JAMAIS de `settings.json` à la main ;
     - `SessionStart` : hors registre, extension du contrat `scripts/agents/compat-core.mjs` à juger, design soumis à game-0e avant codage ;
     - recette sur une compaction réelle.
     - AUCUN `ask` : arbitrage utilisateur 2026-09-28.

1. **#1988 train H** (`.wt-1988-ids`, `chantier/1988-ids`)
   - [x] commit `777e8ee08`, pas encore poussé
   - [x] fusion de main `3b1e64c64` : 4 conflits résolus, typecheck vert, 167/167, docs dérivés régénérés et stagés
   - [ ] commit de fusion (message : `scratchpad/phase3/lot2/commit-merge-main-3b1e64c64.txt`). Le hook exige `JUGE-VISION:` (le créateur, écran Possessions, et la fiche sont touchés) :
     - [x] vite relancé (port 5226, tâche de fond) ;
     - [x] captures CDP : `phase3/lot2/vision-fusion/captures/01..05` (script `captures-fusion.mjs`), aria-pressed 0 → 1, console 0 erreur ;
     - [x] juge de vision : TIENT. Costume luxueux = réf `{text}` ignorée (`character.ts:402-405`), antérieure, suivie par #659 ;
     - [x] 1er essai de commit REFUSÉ : les coutures `data/index.ts:<ligne>` de `RATCHET_EXCEPTIONS` (`labelLogic.mjs`) étaient périmées, main décale `index.ts` de 7 lignes → re-pointées, garde 56/56 ;
     - [x] fusion COMMITTÉE `f685edded` ;
   - [ ] repli branche 0 (trouvaille du juge de vision) : l'aperçu montre « Pinceau » alors que rien n'est choisi. Cause : `trappingChoices.ts:100` `?? 0`.
     - [x] mesure (`repli-branche/sonde-repli.mts`) : 0 prétiré, 0 héros de scénario et 0 semis de possessions ne dépendent du repli ; 5 carrières ont un `{choice}` au niveau 1 ;
     - [x] codeur : diff non commité dans `trappingChoices.ts`, ses tests et `integration-creation.test.ts` ; 719 tests verts ; mutation `?? 0` → 4 rouges. J'ai complété le commentaire de `buildInventory` (`items.ts:1011-1019`) ;
     - [x] recapture CDP : avant le choix, pas de Pinceau ; après le clic, Ciseau seul. Anciennes captures dans `vision-fusion/captures-avant-repli/` ;
     - [x] juge : TIENT (tsc 0 erreur ; 957 fichiers / 11 341 tests verts ; vision OK ; héros engagé = `["ciseau"]`). Seul bloquant : `docs/index-moteur.md` périmé → docs:build + raw:implemente ; la JSDoc de `data/index.ts:3361` est précisée ;
     - [x] COMMITTÉ `e5b671912`. Le pre-commit signale 4 sites NOUVEAUX, non bloquants, « revendication d'autorité sans trace » : `items.ts:1101/1113/1130/1158`. Ce sont des arbitrages munition du 2026-08-16, ANTÉRIEURS ; ils sont signalés parce que `items.ts` était stagé. À trancher : entrée de baseline nominative (`decisions-baseline.json`, keyée par ancre) ou réécriture
     - [x] vite arrêté : TaskStop ne tue pas l'enfant node sous Windows → `taskkill //PID <pid> //T //F`, pid via `Get-NetTCPConnection -LocalPort`
   - [ ] classe à corriger sur la branche : les coutures de `RATCHET_EXCEPTIONS` sont keyées par LIGNE et dérivent à chaque décalage ; les keyer par DÉCLARATION englobante (le test de légitimité juge déjà le site par sa déclaration)
   - [x] publication : ROUGE au rebase, main a bougé (4 commits #1806 R-M2, jusqu'à `27f8e426d`) → fusion de `origin/main` sans conflit (seul l'import `coupeAuMot` → `.mjs` change côté main) ; docs:build, raw:implemente et typecheck complet verts ; 22 docs dérivés stagés
   - [ ] tests du périmètre EN COURS (`phase3/lot2/fusion-27f8/tests.out`) → commit de fusion (JUGE-VISION ? le créateur n'est touché côté main que par l'import) → `ops:publier -- --detache --reprendre`
   - [ ] solde : les tickets #1988 cités restent ouverts (lot 2 non fini)

2. **#1887 lot 6a-2** (`.wt-1887-registre`) : v10 RÉFUTÉE (`atlas-v2/lot6a2/jds-v10-lisible.md`, 4 bloquants aux corrections données)
   - [x] `brief-6a2-v11.md` écrit : B1 aller-retour sur le TEXTE, adresse identique seulement si le rendu est unique au livre ; B2 patron b2c pour la migration neuve (`regles-migration-6a2-fidelite.test.ts`) ; B3 empreinte = texte d'origine, candidats de même forme, puis `emplacementsDe` ; B4 mesure base/tête + loi « égalité d'abord » + fixtures `careers`
   - [x] juge v11 : RÉFUTÉ. Trois CLASSES frappées plusieurs passes de suite : défaut de DESIGN, on remonte d'un niveau, pas de rustine :
     1. fidélité du SCRIPT d'une migration qui consomme `judge` et le `Source/` vivants (4 passes). Doctrine à écrire UNE fois (en-tête `replay.mjs` ou `docs/architecture.md`) : une migration injective suit le patron b2c ; sinon, preuve DATÉE à son commit + rejeu no-op + aller-retour des données ;
     2. l'équivalence de texte (2 passes) : UNE seule, `normText`/`verifier`. L'octet et l'identité d'adresse ne valent que si le rendu est unique. « exactement un run » disparaît ;
     3. le flux de `relocaliser` (3 passes) : les fragments d'origine sont calculés une fois (par `resoudreFragment`, sinon par l'empreinte) et consommés par `emplacementsDe` ET par la preuve (`reparer-adresses.mjs:135`).
     Autres points : exporter `montage()` ; `exporter` de `replay-head.mjs` est le canonique d'un arbre jetable ; cardinaux à corriger (19 fichiers, pas 25 familles ; SANS-SOURCE 129 ; ordre `reparer-adresses` → migration)
   - [x] brief v12 écrit (`lot6a2/brief-6a2-v12.md`) : `memeTexte` unique ; doctrine de fidélité dans l'en-tête de `replay.mjs` (la migration neuve, non injective → preuve datée) ; contrat « fragments d'origine » de `relocaliser` ; `montage` exporté
   - [x] juge v12 : RÉFUTÉ (`lot6a2/juge-v12/` q3-q6).
     - TIENT : le contrat de `relocaliser` (émulé : `regles.json:858` RECALÉE, 73 intactes ; c'est MDG 14 et non MSRC 7) ; B4 est une loi d'ordre, écart glouton/exhaustif nul.
     - B1, équivalence (3e passe) : 14 cibles ELARGI sur 14 échouent à `memeTexte` (l'inclusion est une 2e relation, sans nom). La preuve à l'octet de `reparer-adresses` contredit `sum`, qui hache `normText` (q6). → Remonter au CONTRAT DU VERDICT : `memeTexte` + `contientTexte` exportés ; `judge` rend sa relation et sa vérification ; les consommateurs lisent la vérification ; `reparer-adresses` prouve par `memeTexte`.
     - B2, fidélité : la doctrine « toute migration… » MENT sur 122 migrations (1 seul b2c). → La rendre descriptive, sans « toute » ; la migration neuve, avec perte, porte une PREUVE DE PERTE explicite avant écriture (inclusion + partie ajoutée nommée).
     - Non-bloquants : `secOcc` variable ; un mode « égalité seule » de `montage` ; la préparation du texte de `judge` exportée.
   - [x] brief v13 écrit (`lot6a2/brief-6a2-v13.md`) : contrat du verdict (`memeTexte` + `contientTexte`, `judge` rend relation et vérification `{ok, ajoute}`) ; preuve de PERTE avant écriture ; phrase descriptive dans `replay.mjs` ; `reparer-adresses` prouve par `memeTexte`
   - [x] juge v13 : RÉFUTÉ (`lot6a2/juge-v13/`, arbre `472b05fd9`).
     - TIENT : preuve de perte (décalé 9/9 et mauvaise cible 14/14 pris) ; `reparer-adresses` par `memeTexte`, cohérent avec `sum` ; aller-retour D1 ; aucune garde de synchro.
     - B1, équivalence, 4e passe (rustine renommée) :
       - `contientTexte` est FAUX sur le seul « intertitre ajouté » (`faire-fi-de-l-humeur-de-manann`) ;
       - `findAllRuns` n'est pas `memeTexte` (titres optionnels) ;
       - `ajoute` n'est nommable que 1 fois sur 14 ;
       - un élargi d'un bloc passe `ok` 9/9.
       → UNE relation d'ALIGNEMENT sur le fil (titre, bloc, rangée, cellule, reste de bloc) : son témoin EST `ajoute` ; la raison du verdict borne la classe d'unités admises ; le rendu est minimal (aucune unité de bord entièrement ajoutée, légende exceptée) ; `findAllRuns` rend son alignement ; verdict = f(fin, `ajoute`).
     - B2 : `verification` devient un objet → 3 lecteurs cassés (`psychology…mjs:99-100`, `regles-desc-vers-descref.mjs:80-81`, `derive-decoupes.mjs:156,164`), plus les textes `:11-13` et `:28`.
     - B3 : la phrase de `replay.mjs` quantifie encore (54 migrations sans sortie citée).
     - N : cardinal `replay.mjs:65` ; `ajouter-un-livre-source.md:739/795` (« à l'octet ») ; unicité sommée sur le LIVRE ; « adresse d'un kind admis qui RÉSOUT ».
   - [ ] brief v14 (remontée « alignement »)
   - [ ] codeur si TIENT

3. **#1887 lot 7** : bloqué par 6a-2 (brief `atlas-v2/lot7/brief-lot7-v3.md`, à rejuger après 6a-2)

4. **#1988 B4a** (saisie libre → id) : v1 RÉFUTÉE (`phase3/lot2/b4/jds-b4a-v1-lisible.md`, 5 bloquants)
   - [x] vérifié au livre (ZI 13 « Précieuses entrailles », l.251-430). Le tableau de prix est keyé par CRÉATURE (l.319-386). La quantité se compte en Enc (l.302-310). Le prix est coût de base × dangerosité × modificateur de conservation. Le degré de conservation (l.388-406) DÉCROÎT avec le temps : Frais le jour de la mort, Faisandé à 2 j, Pourri à 5 j, sans valeur à 7 j, Conservé via Survie en extérieur. Les Tests de Savoir admis sont Bêtes ou Remèdes, Métier (Empoisonneur) ou Savoir (Magie) (l.312-317).
     → une pièce de monstre = id de créature + quantité + date de mort ; le prix est DÉRIVÉ, jamais un libellé ni un prix figé.
     Écarts du code : `combatEffects.ts:287-303` pose un libellé `custom` et un prix figé « Frais », sans décroissance, avec la seule spécialisation `betes-sauvages`. Seul #1136 existait (cran par DR) → **#2137 ouvert** (décroissance, Tests admis, pièce en libellé ; prérequis partagé avec B4a)
   - [x] `phase3/lot2/b4/brief-b4a-v2.md` écrit :
     - fonction pure `objetsDuCatalogue(narratif|null)` ;
     - une portée par racine de document ;
     - `superRefine` projet ;
     - pas 17→18 ;
     - récolte = entrée de catalogue `pieces-de-creature` + `creatureId` sur l'instance, prix dérivé ;
     - `custom` et `customTrapping` meurent ;
     - migration roster et sauvegarde des instances héritées.
     **Constat** : `narratif.objets` est vide dans les 4 projets commités, jamais utilisé
   - [x] juge v2 : FRAGILE (`b4/juge-b4a-v2/`). La prémisse et l'architecture tiennent ; parité prix figé = dérivé ×2 Frais sur 108 paires, 0 écart. 4 bloquants de brief :
     - A : `GameOpEditor` et `TestFields` ne sont pas transportés ;
     - B : le pas 17→18 doit résoudre `custom` comme id avant de créer (sinon un doublon `-2` vide) ;
     - C : saves = bump `SAVE_VERSION` SEUL (arbitrage du 2026-08-17) ; roster = `ROSTER_MIGRATIONS[7]` + repli `rosterLoad` ;
     - D : l'Effet `giveTrapping` gagne `creatureId` ; 1 unité = 1 INSTANCE (pas de compte) ; `sellRefusal` ; purge de `giveTrapping.price` et `eff.harvestPart`.
     Lacune du livre : prix et Dispo d'une entrée générique → contournement actuel reconduit, nommé. Scission : **B4a-i** runtime (récolte), puis **B4a-ii** authoring
   - [x] #2137 amendé (2026-09-29) : constat 4 « Recherche d'un acheteur » (ZI 13 l.416-430, Test de Ragot selon la taille du lieu). Le livre définit la règle : ce n'est PAS une lacune, contrairement au verdict du juge ; critère ajouté au DoD, titre étendu
   - [x] brief B4a-i v3 écrit (`b4/brief-b4a-i-v3.md`) :
     - entrée `pieces-de-creature` hors commerce ;
     - `ItemInstance.creatureId` ;
     - l'Effet `giveTrapping` gagne `creatureId` + `count` ;
     - `valeurDUnePiece` / `valeurPropre` ;
     - `giveTrapping.price` et `eff.harvestPart` meurent ;
     - saves : bump seul ;
     - roster : rien (B4a-ii tranche toutes les instances custom héritées)
   - [ ] juge B4a-i v3 EN COURS (`b4/juge-b4a-i-v3/`)
   - [ ] B4a-ii : brief après B4a-i (A, B, n1, n2, n4, n6, n7 du juge v2)

5. **#1988 B4b / B4c / B4d** : à briefer après B4a. B4d est bloqué par B4a, B4b et B4c.

## Tickets ouverts par cette session (hors chemin, non travaillés ici)
#2130 (création perdue en quittant), #2131 (puce rognée, en-tête recouvert). Commentés : #1605, #2100, #1514.

## Coordination
- #2112 (hooks figés sur stdin) et #2125 (répartiteur de hooks + registre des gardes) : portés par la session **game-0e**, non publiés. Mes hooks #2132 attendent sa réponse et sa publication.

## Machine
- La mémoire était à ~90 % : un job lourd à la fois.
- `.wt-1998-solde` : propre et fusionné, supprimable.
