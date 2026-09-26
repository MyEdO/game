## Rendu — train 2a2, corrections 4 (#1473, #1463, #1955), 2026-09-24

Arbre : `/home/claude/game/.wt-1473-t2`, HEAD `6a55a5d7c`, rien committé. Horloge : 12:53 → 13:06 UTC.
Porte d'entrée : aucun socle touché ; les trois sections du design v3.1 existent (`## Invariant` l.37, `## Cas canonique déjà couvert` l.59, `## Design jugé :` l.82 de `/mnt/project-files/dettes/1463-train2-talent-brief-v3.1.md`).
Arbre principal `/home/claude/game` : `git status --short` vide, aucune fuite.

### N1 — ouverture (livre) et catalogue éditable (arbitrage)
Vérifié au Source : LDB 10 l.315 « En accord avec votre MJ, proposez une Destinée appropriée. » ; LDB 09 l.40 (la phrase d'allocation dans une Compétence Groupée, lue) ; LDB 10 l.548 « Voici quelques exemples de groupes que vous pouvez haïr ». Fiche doctrine : `.claude/memory/user-doctrine-ids-stables-labels-affichage.md:12` (« aucun `Map`/`Record`/comparaison par label dans `src/engine` ou `src/state` »). Le verbatim est à :8.
1. Les quatre sites sont réécrits. Aucune phrase n'y dit « le livre ferme ».
   - `src/data/refs-migrated.test.ts:484-489` : le commentaire fonde `specsOpen` sur LDB 10 l.315 et LDB 09 l.40 (Maître artisan l.741, Travailleur qualifié LDB 11 l.126, Savant l.1059). Le reste s'écrit « groupe neuf = ENTRÉE de `specs[]` (catalogue éditable), arbitrage d'ingénierie, CLAUDE.md règle 7 », avec la fiche :12. Le titre de l'`it` devient « Talents `specsOpen` : Destinée et les Talents dont la spécialisation est celle d'une Compétence Groupée ».
   - `src/data/refs-migrated.test.ts:776` : le message d'`expect` devient « Haine : groupe neuf = entrée de specs[], CLAUDE.md règle 7 » (avant : « liste d'exemples, LDB 10 l.548 »).
   - `src/engine/careerSlots.test.ts:241` : « un joker de Talent sans `specsOpen` (Haine) n'est couvert que par son catalogue éditable (CLAUDE.md règle 7) ; … ». Même zone, la graphie « catalogue FERMÉ » est retirée des titres : `:219` Béni « (sans `specsOpen`) », `:229` « joker de Compétence sans `specsOpen` ».
   - `src/data/schemas/grammaire/grammaire.test.ts:1260-1261` : « Talent `specsOpen` : spéc hors catalogue » et « Talent sans `specsOpen` : spéc hors catalogue (groupe neuf = entrée de specs[], CLAUDE.md règle 7) ». Avant : « Talent OUVERT » / « Talent FERMÉ (liste d'exemples) ».
   - Aucune citation de LDB 10 l.117 ni de l.548 ne subsiste comme fondement (grep).
   - Restent, comme termes d'ingénierie non attribués au livre : `refs-migrated.test.ts:462` « domaines FERMÉS inline », `grammaire.test.ts:1128`, `:1267` « entrée FERMÉE », `careerSlots.ts:225`.
2. **Écart : le tag `maison` MANQUE à une entrée de `specs[]`. Je ne l'ai PAS codé.**
   - Schéma : `specEntrySchema` (`src/data/schemas/grammaire/valeurs.ts:295-301`) est un `z.strictObject({ id, label, source?, alsoIn?, pool? })`. Il n'a pas de clé `maison`, donc une entrée de `specs[]` qui porterait `maison` est REFUSÉE. Le tag `maison` est une clé d'ENVELOPPE de document (`document.ts:27`, `:308`, refine `source ∨ maison` `:469-482`) et ne s'applique pas à une sous-entrée.
   - Chemin d'ajout au Compendium : il EXISTE. `CodexEdit.tsx:328` (`add('specs')` pour skills/talents), puis `:736` `<SpecsField …>`, puis `StructFields.tsx:596` `SpecsField`, bouton « + Ajouter » `:625`. L'id est dérivé du libellé par `slugId` (`:602`). Ce champ ne saisit ni `source` ni `maison`.
   - Conséquence : la forme « entrée neuve taguée `maison` » de la règle 7 n'est pas représentable aujourd'hui. Les commentaires disent « entrée de `specs[]` (catalogue éditable) », sans prétendre au tag. Il reste à trancher, au schéma (`specEntrySchema`) et à `SpecsField`, avant que la règle 7 soit tenue pour ces Talents.
3. #1962 : rien fait, conformément au brief.

### N2 — garde « même référence »
1. Migration des 8 sites vers `memeRef` :
   - `src/engine/menace.ts:45` (import `:23`) : `memeRef({ id: t.talentId, spec: t.spec }, { id: 'resistance', spec: menaceId })` ;
   - `src/engine/seaNavigation.ts:81` (import `:42`) ;
   - `src/engine/riverNavigation.ts:131` (import `:37`) ;
   - `src/scenes/test-scenarios/siege-enceinte.ts:292` (import `:6`) : `memeRef(s, ref)` ;
   - le helper recopié 4× devient UN helper, `renforceCompetence` (`src/scenes/test-scenarios/_shared.ts:10-16`). Il lit `memeRef` et `skillCharacteristicById`. Appelants : `voyage.ts`, `15-commerce-fluvial.ts`, `14-voyage-maritime.ts`, `21-chute-du-greement.ts`, où les 4 copies sont supprimées avec leurs imports morts (`SkillInstance`, `skillCharacteristicById`).
   - Existant cherché : `_shared.ts` n'avait aucun helper de Compétence. `_casters.ts:20` `boostSkill(c, name, spec, characteristic, advances)` existe, mais avec une autre sémantique : entrée par LIBELLÉ (`findSkill(name)`), couverture par joker `spec == null || x.spec === spec` (`:22`), Caractéristique imposée. Il n'est pas fusionné : c'est une couverture, pas une identité, et il est hors périmètre. Son entrée par libellé (`findSkill(name)` hors `src/data/index.ts`) est un poison HORS PÉRIMÈTRE : `src/scenes/test-scenarios/_casters.ts:21`.
   - Écarts corrigés dans le geste (poison de la zone touchée) :
     - `voyage.ts` passait `'intelligence'` par défaut comme Caractéristique, faux pour Perception (donnée : `initiative`). Elle lit maintenant la donnée.
     - Des specs étaient passées en LIBELLÉ : `'Cartographe'` (`voyage.ts:37`, `15-commerce-fluvial.ts:53`) et `'Charpentier'` (`14-voyage-maritime.ts:34`). Elles deviennent les ids `cartographe` et `charpentier`, présents dans `skills.json#metier.specs`. Lus par `activities.json:125,627` (`"spec": "cartographe"`) et `riverVoyageFlow.ts:77` (`charpentier`).
2. Garde étendue :
   - `scripts/guards/lib/memeRef.mjs:14` ajoute `MEME_ID_SPEC_RX`. Il couvre `….id === … && ….spec ===`, `talentId`/`skillId` compris, et la négation `….id !== … || ….spec !==`. Il est branché `:24`, déclaré dans `memeRef.d.mts`, et l'en-tête du module est mis à jour.
   - `scripts/guards/lib/memeRef.test.mjs:18-22` : 3 cas mordus (conjonction id/spec, talentId/spec, négation) et 2 cas hors motif (couverture par joker `spec == null || …`, et `s.spec == null`).
   - `src/engine/meme-ref-guard.test.ts` : l'angle mort « `a.spec === b.spec` … n'est pas vue » est RETIRÉ. Le nouvel angle mort déclaré est la conjonction sur plusieurs lignes ou aux membres inversés (`:17`). L'en-tête cite le motif nu.
   - Sonde corpus (`readCorpus(['src'])` + `scanMemeRef`) après migration : 0 site.
   - Les tests (`*.test.ts`) portent encore la conjonction nue, hors corpus de la garde par construction (`sourceCorpus.mjs:84`, `tests = false`) : `siege-enceinte.test.ts:314-326`, `state/advancement.test.ts:171,181,259`, `spawn.test.ts:195,198`, etc.
3. NB9 : `(x.cible ?? '') === (…cible ?? '')` (`src/engine/corruption.ts:243`, `src/engine/grantedTraits.ts:70`) n'est PAS l'identité d'une instance de Trait (id, arg).
   - C'est l'identité d'un `PsychTrait` (`type`, `cible`) de `c.psychTraits` (`src/engine/psychology.ts:38-42`).
   - Constructeurs : `grantPsychTrait` (`grantedTraits.ts:55-56`, op `grantPsychTrait` d'une mutation, `corruption.ts:212`) ; `parsePsychTraits` (`src/engine/psych/registry.ts:35`, qui construit `{ type, cible }` depuis l'`arg` d'une `TraitInstance` via `splitCibles`, `:47-48`) ; `disease.ts:323` (symptômes).
   - Pas migré, conformément au brief (design `grantTrait` D3).

### N3 — provenance d'un ajout = référence d'entité
- `src/engine/talentEffects.ts:181` : `export type ProvenanceDAjout = RefDesignee & { type: Extract<TypeEntite, 'talent' | 'trait'> };`. Import de `TypeEntite` en `:33`, type seul.
- Constructeurs : `:157` et `:173` (`type: 'talent'`), `:174` (`type: 'trait'`).
- Lecteur : `src/ui/CharacterSheet.tsx:717` (`p.type === 'talent'`).
- Tests : `talentEffects.test.ts` (`par`, `:101` ; `:112`), `state/advancement.test.ts:221,223,237,255`, `traits/marque-de-khorne.test.ts:90`, `traits/marque-de-tzeentch.test.ts:96`.
- Plus aucune occurrence de `categorie: 'talents' | 'traits'` dans `src` (grep).

### N4 — la puce se nourrit de ce qu'elle affiche
- `TalentChip` (`src/ui/EntityChip.tsx:105`) prend désormais `{ talent: RefDesignee; times?: number }`. Il affiche `refConcrete('talents', talent)`, suivi de `×N` seulement si `times > 1`. `talentConcrete` et `TalentInstance` ne sont plus importés par `EntityChip.tsx`.
- Appelants : `CharacterSheet.tsx:717` passe la provenance telle quelle (`talent={p}`), sans fabriquer d'instance. `HeroSheet.tsx:192` et `CharacterCreator.tsx:2418` passent `{ id, spec }` avec `times`.
- `TraitChip` reste sur `TraitInstance` (`EntityChip.tsx:140`). Cet affichage (`formatTrait`) ne se fonde que sur des champs d'instance facultatifs (indice, arg), et le seul champ requis de `TraitInstance` est `id` (`src/engine/statEntry.ts:76-77`). `{ type, id }` y entre donc sans rien fabriquer : `CharacterSheet.tsx:717` passe `trait={p}`.

### N5 — non bloquants
- **NB1.** `src/engine/careerSlots.ts:223` devient « Un joker exige une spec : Compétence `LDB 09 l.40`. », Talent retiré. `careerSlots.test.ts:203` : describe sans citation. Au Source, LDB 10 l.17 définit la parenthèse, et aucune ligne de LDB 10 ne dit qu'un « (Au choix) » de Talent exige une spec : `grep -n -i 'au choix'` sur `10 - Talents.md` ne renvoie que l.68, l.70, l.560, l.743 (Tests/Art).
- **NB4.** `talentMax` est supprimé (`careerSlots.ts`, ancien `:385-389`), ainsi que l'import mort `talentIdByLabel` (`:32`). Son test lit maintenant la primitive vivante par id : `careerSlots.test.ts:174` `talentMaxById(h, 'lire-ecrire')` → 1, et `:181` `talentMaxById(h, 'sens-aiguise')` → 3.
  - Contre-grep `grep -rn '\btalentMax\b' src scripts docs` : il ne reste que `src/engine/advancement.ts:99` et `src/i18n/messages/fr.ts:2366` (clé i18n `adv.talentMax`, autre chose), plus `docs/index-moteur.md:59,68,468` (doc GÉNÉRÉ, périmé jusqu'à `docs:build`, qui t'appartient).
- **NB3.** Le cliquet `PLAFOND = 24` (HEAD `refs-migrated.test.ts:760-766`) comptait les « textes d'instance » : specs de Talent SANS catalogue (destinee, frenesie), régime en suspens à #1621.
  - Mesure du juge (`sonde-textes-libres.log`) : `seen 420 non resolues 26 [["bon-marcheur(FERMEE)",5],["destinee(ouverte)",21]]`.
  - Il n'a plus d'objet :
    - les 21 textes de Destinée sont LÉGITIMES, puisque LDB 10 l.315 fait proposer la Destinée (`specsOpen`) ;
    - les 5 de Bon marcheur sont au stock NOMINATIF décroissant `BORNES_EN_TEXTE_LIBRE` (`refs-migrated.test.ts:729-735`), plus strict qu'un plafond ;
    - tout autre texte libre rougit le contrat positif (`:737`) ;
    - Frénésie : 0 texte.
  - Non remis.

### R — kit de recette
1. **La recherche bornée corrige la classe.**
   - `scripts/recette/lib.mjs:446` `DELAI_CIBLE_MS = 5000` ; `:451` `chercherCible(session, expression, delaiCibleMs, intervalMs=100)` re-évalue jusqu'à une valeur non nulle, ou rend `null` à l'échéance.
   - Six helpers suivent désormais la règle (option `delaiCibleMs`, refus « … « X » … après N ms ») : `clickButtonByText` (`:754`), `cliquerSelecteur` (`:795`), `survoler` (`:898`), `infobulleDe` (`:923`), `selectOption` (`:964`), `typeInField` (`:1204`).
   - Dans le même geste, `selectOption` et `typeInField` ne réécrivent plus la triade `mouseMoved/Pressed/Released` : ils passent par `clicReel`, geste de clic unique (`:815-820`).
   - Autres helpers du kit qui cherchent une cible au DOM :
     - `attendreSelecteur` (`:1099`) et `waitFor` (`:434`) attendaient déjà (borne 8000 ms) ;
     - ne suivent PAS la règle : `champParLibelle` (`:1011`), qui rend `null` par contrat (test « racine `dans` absente = null ») et laisse le choix à l'appelant ; `poserFichier` (`:1038`, domaine `DOM` du CDP) ; `cliquerAction` (`:1238`), qui lit l'état de la console et refuse en listant les cases offertes ; `resoudreModales` (`:846`), qui boucle déjà sur sa cascade avec `pauseMs`.
   - Tests : `scripts/recette/lib.test.mjs:492+`.
     - Un bouton monté 250 ms APRÈS l'appel est cliqué.
     - À l'échéance, le refus nomme le libellé et « après 300 ms », la recherche dure ≥ 300 ms et aucun clic n'a lieu.
     - `cliquerSelecteur` attend un contrôle monté tard.
     - Le test « rangée introuvable » passe `delaiCibleMs: 200` et attend « … après 200 ms ».
   - Doc : `docs/recette-navigateur.md:232-233`, lignes `clickButtonByText` et `cliquerSelecteur`.
2. **Écart : pas de `href` à lire. Je n'ai rien codé.**
   - `Icon` (`src/ui/Icon.tsx:40-48`) rend un `<svg class="icon" aria-hidden>` dont le contenu est injecté (`dangerouslySetInnerHTML={{ __html: def.svg }}`) : il n'y a ni `<use>`, ni `href`, ni aucun attribut qui porte l'id de l'icône. `iconSvg` (`:27-29`) suit la même forme.
   - Le kit n'a pas de helper de texte accessible (grep `accessible|aria-label` : noms lus inline à `:805`, `:1020`, `:1071`, `:1252`), et une icône `aria-hidden` n'a pas de nom accessible.
   - Lire l'icône d'un élément exige que le DOM porte son id, par exemple `data-icon={id}` sur le `<svg>` de `Icon`. C'est une modification de `src/ui` hors du brief : à décider.
3. Rien, conformément au brief. LDB 07 l.118 est conforme.

### Portes
```
npm run typecheck:fast → exit=0 ; « typecheck:fast — 0 erreur(s) »
npx vitest run <32 fichiers> → exit=0 ; Test Files  32 passed (32) ; Tests  822 passed (822)
node --test scripts/guards/lib/memeRef.test.mjs → exit=0 ; # pass 2 # fail 0
node --test scripts/recette/lib.test.mjs → exit=0 ; # pass 57 # fail 0 (lancé APRÈS le vitest ; lib.mjs n'est lu par aucun test vitest)
npm run gen → non lancé (aucune donnée changée)
```
Les 32 fichiers vitest (liste aussi dans `fichiers-vitest.txt`) :
- le périmètre du juge (24) : comment-poison-guard, refs-migrated, grammaire, validate, activities, engine/advancement, careerSlots, character, combat-base-value, combat-breakdown, meme-ref-guard, talentEffects, marque-de-khorne, marque-de-tzeentch, 96-presets-edo, test-scenarios/index, niveau-complet, state/advancement, interlude-activities, partyFlow, CharacterSheet, InterludeScreen, GameOpEditor.champs-a-choix, ui-ratchets ;
- plus 8 fichiers : menace, sea-navigation, river-navigation, 14-voyage-maritime, 15-commerce-fluvial, voyage, siege-enceinte, combatFeatures/variants-lot4.

Journaux : `train2a2-corr4/{typecheck,v,node,lib-test,mutations}.log`.

### Mutations
Chaque mutation est une édition temporaire, remise en place par remplacement inverse puis vérifiée par empreinte et `cmp` (`mutations.log`) :
```
M-garde-node   scripts/guards/lib/memeRef.mjs  f77332b8→15547ede  rouge exit=1 (# pass 1 # fail 1)  remis f77332b8 identique
M-garde-vitest src/engine/seaNavigation.ts (site remis en conjonction nue)  a0f7aa61→d40dafa9  rouge exit=1 (meme-ref-guard 1 failed)  remis a0f7aa61 identique
M-N1  src/data/schemas/grammaire/ref.ts (haine, savoir-vivre rendus specsOpen)  6d9e7b41→d00647f2  rouge exit=1 : refs-migrated CONTRÔLE POSITIF, careerSlots « joker de Talent sans specsOpen (Haine) », grammaire « Talent sans specsOpen » (3 failed)  remis 6d9e7b41 identique
M-NB4 src/engine/careerSlots.ts (Maxi numérique +1)  bcbb9804→2fcb992e  rouge exit=1 (Maxi 1 Lire/Écrire)  remis bcbb9804 identique
M-N3  src/engine/talentEffects.ts (provenance de Trait typée talent)  dc87aace→5d957b71  rouge exit=1 (state/advancement, CharacterSheet, marque-de-khorne, marque-de-tzeentch : 4 failed)  remis dc87aace identique
M-N4  src/ui/EntityChip.tsx (compte affiché sans compte fourni)  54cdc912→9f6cb3f4  rouge exit=1 (CharacterSheet rangée d'ajout)  remis 54cdc912 identique
M-R1  scripts/recette/lib.mjs (recherche sans attente)  b4059a2f→69872501  rouge exit=1 (not ok 52, 53, 54 ; # fail 3)  remis b4059a2f identique
```
Sans mutation : le renommage du `it` « Talents `specsOpen` » (`refs-migrated.test.ts:489`, qui lit `talents.json`) et `renforceCompetence`, qu'aucun test de scénario ne distingue d'une comparaison par id seul.

### Fichiers touchés par ces corrections 4
- **Source**
  - `src/engine/{careerSlots.ts, talentEffects.ts, menace.ts, seaNavigation.ts, riverNavigation.ts}`
  - `src/scenes/test-scenarios/{_shared.ts, voyage.ts, 14-voyage-maritime.ts, 15-commerce-fluvial.ts, 21-chute-du-greement.ts, siege-enceinte.ts}`
  - `src/ui/{EntityChip.tsx, CharacterSheet.tsx, HeroSheet.tsx, creator/CharacterCreator.tsx}`
- **Tests**
  - `src/data/refs-migrated.test.ts`, `src/data/schemas/grammaire/grammaire.test.ts`
  - `src/engine/{careerSlots.test.ts, talentEffects.test.ts, meme-ref-guard.test.ts, traits/marque-de-khorne.test.ts, traits/marque-de-tzeentch.test.ts}`
  - `src/state/advancement.test.ts`
- **Scripts et doc**
  - `scripts/guards/lib/{memeRef.mjs, memeRef.d.mts, memeRef.test.mjs}`
  - `scripts/recette/{lib.mjs, lib.test.mjs}`
  - `docs/recette-navigateur.md`

Empreintes de début : `empreintes-debut.txt`.

### Nommé, non fait
- Tag `maison` sur une entrée de `specs[]` (N1.2) : manque au schéma (`valeurs.ts:295`) et à `SpecsField`.
- Lecture d'icône au DOM (R2) : aucun id d'icône dans le DOM (`Icon.tsx:40-48`).
- `docs/index-moteur.md` (généré) cite encore `talentMax` et des numéros de ligne de `careerSlots.ts` : à régénérer (`docs:build`, qui t'appartient). NB10 (`docs/test-scenarios.md`) est inchangé.
- Hors périmètre : `_casters.ts:20-22` `boostSkill` (entrée par libellé, `findSkill(name)` hors couture `src/data/index.ts`).

### Processus
`ps -eo pid,cmd | grep -E "vitest|node --test|chrome|tsc" | grep -v grep | wc -l` → 0. Tous les runs étaient synchrones et sont terminés.
