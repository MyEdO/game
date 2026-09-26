# Design v3.1 — train 2 du lot « ops à référence typées » : la référence de Talent (#1473, reprend #1646, #1621, #1610, #1924, intègre #1926), 2026-09-24

v3 (`1463-train2-talent-brief-v3.md`) jugée FRAGILE par `juge-design-socle` (run `wf_1bff0d59-f8c`, 2026-09-24) : 12
bloquants, 0 structurel, 0 écarté. Verdict : `/mnt/project-files/dettes/1463-train2v3-juge.md`. v3.1 intègre les 12 et
les « dits » du juge ; la réponse point par point est en fin de document. Sans bloquant structurel, pas de troisième
jugement de design : le juge de diff de chaque train vérifie cette réponse.

Base du codeur : `chantier/1473-t2` (worktree `/home/claude/game/.wt-1473-t2`), posée le 2026-09-24 sur `f494df559` de
`chantier/1473-r2` : fusion de #1897, commit C1 du lot R2 (`b32eb1bc3`, collections à clé marquées au schéma) et
correction 3 du train 1 (`familleDuRepere`, `enumNomme`) y sont. Le lot R2 continue en parallèle sur
`chantier/1473-r2` (C2, C3 ; C4 touche les désignateurs de `mecanique.ts` et attend ce train). Les lignes ci-dessous
sont celles du juge v3, relues à l'arbre de `c53cf8b6f` ; le codeur les relit à sa tête et nomme celles qui ont bougé.

**Commits du train 2a.** 2a1 : E1, E2, E6, E8, E10 (données commitées et projets) — la graphie, la fabrique, les
lecteurs et la couture d'acquisition changent ensemble, sans quoi rien ne compile. 2a2 : E3, E5, E7.

Tickets : #1646 « Specs de talent HORS talents[] : 18 porteurs {talentId, spec} … » ; #1621 « specsOpen par TYPE = faux
verrou dans les DEUX sens … » ; #1926 « Sorts : 6 grantTalent posent un talent à spécialisation SANS spécialisation … » ;
#1610 « TalentInstance.talentId, dernier holdout du rename d'identite d'instance … » ; #1924 « Création de personnage :
createHero rend les AdvancementRef (ids) en LIBELLÉS puis les reparse — seconde couture label→id dans src/engine » ; #1942
« Frénésie (à Volonté !) du Clan Pestilens : sa mécanique propre n'existe pas ». Mesurés à l'entrée du train 2d : #1923
« Créateur de personnage : le brouillon garde le Talent de carrière et les sorts mineurs en LIBELLÉS … » et #1607
« Createur etape 5c : ids BRUTS dans les select de spec de talent … ».

## Vocabulaire (un concept, un terme)

- **régime** : ce qu'un champ de référence admet, `RegimeDeSpec` (`grammaire/ref.ts:413`) : `specSeule` ou
  `specOuChoixFacultatifs`.
- **emplacement** : une référence non désignée, écrite `choix` (`ref.ts:386`). **porteur d'emplacement** : un champ de
  document dont les références admettent `choix` parce qu'un désignateur les lit (`ref.ts:411`).
- **champ à choix** (`ChampAChoix`) : un champ de payload d'op dont le régime est un PARAMÈTRE de la grammaire
  mécanique. Distinct des « champs d'op à slot » (`champsDOpASlot`, `scripts/docs/lib/slots-registre.mts:109-116`),
  qui sont tous les champs portant une feuille `idDe`.
- **désignateur** : le chemin de code qui remplace un `choix` par une `spec`.
- **ouvert** reste réservé à `entreeOuverte` / `specsOpen` : une entrée dont la `spec` admet un texte libre.

## Invariant

1. #1646, corps, verbatim : « une ref de talent avec spec est le MÊME concept quel que soit son porteur (talents[]
   d'entité, passive d'une mutation/d'un trait, op d'un sort) ». Question : comment s'écrit une référence de Talent,
   et qui juge sa spécialisation, quel que soit son porteur ?
2. #1897, verdict du juge de design 2e-f1 (issuecomment-5805081053), verbatim : « `choix` s'ouvre sur opt-in, en une
   ligne, aux seuls porteurs d'EMPLACEMENT ». Question : où une spécialisation peut-elle rester non désignée ? Là
   seulement où un désignateur la lit : la portée d'un régime `specOuChoixFacultatifs` est exactement le parcours de
   son désignateur, ni plus (v3 B4) ni moins.
3. LDB 10 l.17, verbatim : « **Nom du Talent (utilisation) :** la dénomination du Talent. S'il y a des parenthèses, le
   mot à l'intérieur décrit une utilisation que le Talent influence. » Question : que porte la parenthèse d'un Talent ?
   Sa spécialisation, dont l'hôte est `spec` et le catalogue `talents.json#[].specs`.
4. `CLAUDE.md`, règle 7 : « une règle présente dans la source est IMPLÉMENTÉE, jamais reportée ». Question : que
   devient une règle du livre que la parenthèse nouvellement désignée fait apparaître et que le moteur ne porte pas ?
   Elle s'implémente dans le lot (Magie des Arcanes « (n'importe laquelle) », EDOC 13 l.524 ; Destinée écrite par le
   joueur, LDB 10 l.315), ou elle a son ticket ouvert et cité avant la publication (#1942) ; un train du même lot publié
   ensemble est un séquençage, pas un report.
5. Doctrine id/label, `.claude/memory/user-doctrine-ids-stables-labels-affichage.md`, verbatim de Clément (2026-07-09,
   cité à #1924) : « Le seul endroit où on peut mettre des labels, c'est dans le champ `label`, ou pour l'afficher, ou
   sur des écrans du codex/éditeur pour aider à la saisie — mais au final ce qu'on manipule c'est des IDs. » Question :
   par quelle clé un désignateur reçoit-il le choix du joueur ? Par l'identité de la référence, jamais par son libellé.

## Cas canonique déjà couvert

- La fabrique `refOuSpec(type, extra?, regime?)` de `grammaire/ref.ts` et ses régimes ; porteur d'emplacement :
  `defs/creatures.ts:44` (Compétences de statbloc), désignées au spawn par `designateSpec` (`src/state/spawn.ts:144`,
  pool `specPoolOf`).
- Une grammaire construite UNE fois au chargement du module : `mecanique.ts` porte `OP_DEFS` (:31), `gameOpSchema`
  (:380), `effectOpSchema` (:618), `noeudTest` (:691), `flowSchema` (:732), `triggeredEffectSchema` (:797). Dans
  `OP_DEFS`, 13 `z.lazy` : 10 vers `gameOpSchema` (:50, 56, 187, 198, 226, 236, 245, 246, 263, 286), 2 vers
  `triggeredEffectSchema` (:264, :278), 1 vers `flowTestSchema` (:247). 87 lignes non-test de `src/data/schemas`
  nomment `gameOpSchema`.
- La parenthèse restreinte à un public, soldée par un ID DE CATALOGUE sourcé à sa phrase : `talents.json`
  `savoir-vivre.specs` `disciples-de-tzeentch` (`EDOC 13 l.524`), `pool: false`.
- Le synonyme d'un livre tiers, id de catalogue en `pool: false` : `bon-marcheur.specs` `foret` (`frenchy.bzh 26 l.335`)
  et `marais` (`frenchy.bzh 26 l.239`).
- L'acquisition d'un Talent qui vérifie le Maxi et fusionne `times` : `src/engine/ops.ts:2220-2229` (`talentMaxReached`).
- Le joker d'emplacement déplié à l'avancement : `src/state/advancement.ts:212` (`o.wildcard ? wildcardSpecs(o, 'talent')`).
- La migration de document portable qui renomme une clé d'identité : `ROSTER_MIGRATIONS` (`src/state/roster.ts:97`),
  entrée 3 `remapSkillIdDeep` (`skillId` → `id`, #1548 L2).

Le nouveau cas en est une instance : chaque parenthèse de Talent est une `spec` écrite par `refOuSpec` ; ce qui varie
d'un porteur à l'autre est l'ensemble de ses champs à choix, et ce régime est un argument de la grammaire, pas une
branche.

## Design jugé : `juge-design-socle`, run `wf_1bff0d59-f8c` (v3, FRAGILE, 12 bloquants intégrés ci-dessous)

**E1. Graphie unique ; homonymes et synonymes morts, schémas ET types (v3 B10, B11).**
- `grantTalent: { op, talent: <réf> }`, `grantCareerTalent: { op, talent: <réf> }`, `axes.talents: z.array(<réf>)` :
  toutes les références de Talent sont `refOuSpec('talent', extra?, regime)`, écrites AU SITE du porteur. La clé
  `talent` suit `grantCareerSkill.skill`. Les deux ops sortent d'`OPS_NON_TYPEES`.
- Les noms se mesurent par grep, pas par liste : `git grep -n "skillRefSchema\|talentRefSchema" -- src`. À l'arbre du
  juge : `grammaire/reference.ts:39` (`talentRefSchema`, meurt), `defs/axes.ts:26` (`talentRefSchema` LOCAL de forme
  `{talentId, spec}`), et quatre `skillRefSchema` de formes différentes (`defs-scenes/communs.ts:24` `{value}`
  specSeule ; `defs/creatures.ts:44` `{value}` specOuChoixFacultatifs ; `defs/axes.ts:24` nu ; `defs/activities.ts:19`
  `{difficulty}`). Règle : aucun nom partagé par deux schémas de formes différentes ; chaque site prend un nom qui dit
  sa forme, ou meurt au profit de l'appel à la fabrique au site. Le codeur donne en sortie le régime de chaque site
  avec son désignateur cité ; un site sans désignateur est `specSeule`.
- Même règle pour les TYPES, dans le lot : un seul type par forme, dérivé de la fabrique (`RefASpecialisation`,
  `RefDesignee`, `ref.ts`). Inventaire à mesurer par grep des noms : `TalentRef` (`src/data/index.ts:3186`, `extends Ref
  { times? }`, 7 fichiers hors tests dont `spawn.ts:8/:167`) et `talentRefLabel` (`StatblockEditor.tsx:152`, qui passe
  par `choixLabel`, E6) ; `SkillTalentRef` (`engine/talentEffects.ts`) ; `Ref` (`index.ts:3143`) contre `RefDesignee`
  (`ref.ts:379`), même forme ; les deux `SkillRef` (`engine/skills.ts:237` `{id; spec?}` ; `index.ts:3154` `extends Ref
  { choix?; value }`) et leurs alias de contournement (`index.ts:139` `SkillRef as EngineSkillRef`, `CodexEdit.tsx:62`
  `SkillRef as SkillRefLivre`, qui meurent). Les types d'op de `engine/ops.ts` (`grantTalent`, `grantCareerTalent`,
  `grantCareerSkill`) se dérivent du type de la fabrique. Pas de « au-delà, ticket » : un synonyme laissé à la couture
  que le lot réécrit est la dette que le lot solde.

**E2. Le régime des champs à choix est un paramètre de la grammaire mécanique ; sa portée est la racine du porteur
(v3 B4, B8, B9 ; dits sur les 13 lazies et les racines de la garde).**
- `mecanique.ts` expose UNE fabrique, `mecaniqueDe(regimes)`, qui construit et rend la famille : `opDefs`, `gameOp`,
  `effectOp`, `flow`, `triggeredEffect`, et tout autre nœud qui compose un `GameOp` (le codeur énumère : `noeudTest`,
  `travelTableEntry`, `shipCrewHit`…). Mémoïsée par la forme canonique de `regimes` (entrées triées). Les exports
  actuels sont l'instance sans régime : `OP_DEFS`, `gameOpSchema`, `flowSchema`… = `mecaniqueDe({})`. Un porteur SANS
  champ à choix écrit `gameOpSchema`/`flowSchema` ; la graphie `mecaniqueDe({})` n'apparaît jamais à un site.
- PORTÉE (invariant 2, v3 B4) : dans une famille `mecaniqueDe(regimes)` non vide, SEULS les payloads des ops à la
  racine du porteur lisent `regimes`. Toute op imbriquée dans une op (les 10 lazies `gameOp`, les 2 lazies
  `triggeredEffect`, le lazy `flowTest` de `OP_DEFS`) pointe vers la famille FERMÉE (`mecaniqueDe({})`). Pour un
  porteur de type Flow (train 3, `defs/spells.ts`), la structure Flow (seq/do/if/test/choice) reste dans la famille à
  régime, ses feuilles d'op sont « à la racine » ; une op imbriquée dans une op de Flow est fermée. La sonde du juge
  (`scratchpad/juge-train2-v3/s4-ouverture-imbriquee.mts`) devient un test promu : un `grantCareerSkill` à `choix`
  imbriqué sous `perRound` dans `talents.passive` est REFUSÉ au parse.
- `ChampAChoix` (v3 B8, B9) : le champ est déclaré UNE fois, à sa place dans le payload, par un marqueur de la fabrique
  (par exemple `aChoix('talent', extra?)`) ; la famille le résout avec la clé calculée depuis sa POSITION (op, champ) et
  lit `regimes[clé] ?? 'specSeule'`. Le type `ChampAChoix` se DÉRIVE des déclarations (type mappé), l'ensemble
  d'exécution se dérive du même parcours : aucune union littérale tenue à côté d'`OP_DEFS`, aucune clé réécrite à la
  main. Aujourd'hui : `grantTalent.talent`, `grantCareerTalent.talent`, `grantCareerSkill.skill`. Les champs qui
  DÉSIGNENT (`skillMod.skill`, `riderTest.skill`…) gardent `refOuSpec(type)`. Question en sortie : si TypeScript ne
  dérive pas le type du marqueur, quelle forme la déclaration prend-elle sans second registre (`fichier:ligne`) ?
- La famille dépose en méta, sur ses nœuds `gameOp`/`effectOp`/`flow`, ses `regimes` (lus par l'éditeur, E7) et
  appelle `marquerOpAtteinte(ctx)` : la mesure au parse (`opsDuParse`, `slotsDuParse`) range l'identité des nœuds de
  DONNÉE, pas de schéma. `champsDOpASlot` et les docs lisent l'instance fermée : mêmes champs quel que soit le régime.
- Garde du masquage (`parse-de-mesure.test.ts:239-243`, dits du juge) : elle n'instrumente aujourd'hui que
  `DEFS_DE_DOCUMENT` et `Object.entries(OP_DEFS)`, l'instance fermée. Ses RACINES deviennent toutes les familles
  construites, lues dans le cache de mémoïsation de `mecaniqueDe` exposé en lecture seule (le cache EST le registre ;
  pas de second registre). La reconnaissance de l'émetteur d'op passe par `familleDuRepere` (`ref.ts`, apporté par la
  correction 3 du train 1, d'où la base).
- Porteurs d'emplacement, une ligne chacun, désignateur cité (parcours = racine du porteur) :
  - `defs/talents.ts:94` `passive` (pas `effects`, :93) : `mecaniqueDe({ 'grantCareerSkill.skill':
    'specOuChoixFacultatifs' }).gameOp` ; désignateur : `careerSkillAdditions` (`src/engine/talentEffects.ts:162-170`,
    premier niveau de `passive`), la spec du Talent porteur.
  - `defs/traits.ts`, champ `passive` (le codeur cite la ligne) : `mecaniqueDe({ 'grantCareerTalent.talent':
    'specOuChoixFacultatifs' }).gameOp` ; désignateur : `careerTalentAdditions` rend la référence avec son `choix`, et
    `src/state/advancement.ts:227-232` la déplie comme le joker d'emplacement de `:212` (v3 B7). Donnée :
    `traits.json` `marque-de-tzeentch` écrit `{ op: 'grantCareerTalent', talent: { id: 'magie-des-arcanes', choix: true
    } }` (EDOC 13 l.524 « Magie des Arcanes (n'importe laquelle) »).
  - `defs/stars.ts:30` `ops` : `mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' }).gameOp` ; désignateur :
    `createHero` (`src/engine/character.ts:353`, via `applyStarOps`, `src/engine/creation.ts:196-199`, premier niveau de
    `ops`), APRÈS le train 2d qui le rend keyé par identité (v3 B2).
  - Train 3 : `defs/spells.ts:153` `effects: mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' }).flow`,
    désignateur au lancement.
  Coût N+1 d'un porteur d'emplacement neuf : une ligne au schéma du porteur, zéro côté éditeur (E7).
- Fossile de transition : la fusion de #1897 ouvre `grantCareerSkill.skill` AU CHAMP (`refOuSpec('skill', undefined,
  'specOuChoixFacultatifs')`, `mecanique.ts:137`), donc pour tout porteur. Il meurt au train 2a, et un test l'y tue :
  `grantCareerSkill` à `choix` refusé par `gameOpSchema` (instance fermée), admis par la famille de `talents.passive`.

**E3. Chaque parenthèse de Talent est une `spec` ; la classe « texte d'instance » meurt.** Données sourcées à la phrase
qui imprime chaque entrée :
- `destinee` : `specs` = les dix exemples de LDB 10 l.321-330 (ids slug, libellés verbatim), entrée ouverte (LDB 10
  l.315 « En accord avec votre MJ, proposez une Destinée appropriée », l.319 « Voici des exemples de Destinées pour vous
  aider à créer votre propre Talent Destinée »). Les exemples restent au pool (l.319 les offre au joueur qui crée sa
  Destinée). Les 21 textes de `creatures.json` restent des `spec` en texte libre admis par l'entrée ouverte.
- Maxi (v3 B12). La paraphrase « le Maxi se compte par spécialisation » est À TROIS sites : `src/engine/careerSlots.ts:8`
  (rattachée à « Talents (LDB 10 l.13-20) », qui ne le dit pas : LDB 10 l.18 « **Maxi :** cela indique le nombre maximum
  d'acquisitions de ce Talent »), `careerSlots.ts:363-364`, `src/engine/activities.ts:945-946`. Dans le geste, quelle
  que soit la réponse de Clément, les trois se réduisent à leur réf nue : `LDB 10 l.18` et l'arbitrage consigné à #1621
  avec sa date. La question posée à Clément le 2026-09-24 (carte : « Une seule » / « Une par texte ») couvre la classe :
  son option « Une seule » garde le Maxi par parenthèse pour les autres Talents (Frénésie et Attirant compris).
  « Une seule » : l'entrée `destinee` déclare que son Maxi compte le Talent, par un champ de l'entrée (le codeur le nomme
  en sortie, forme et `fichier:ligne` de sa déclaration dans `defs/talents.ts`), lu par `talentMaxReached`
  (`careerSlots.ts:388`) ; défaut : par parenthèse. « Une par texte » : aucun champ, le comportement actuel devient
  l'arbitrage cité. Sans réponse, le train ne se publie pas. La carte citait LDB 10 l.308/l.310 par erreur : les lignes
  sont l.313 (« **Maxi :** 1 ») et l.315.
- `frenesie` : `specs` = `a-volonte`, libellé « à Volonté ! », source `frenchy-bzh` p.384, note
  `Habitants & Creatures 58 l.123`, `pool: false`. Sa mécanique : #1942, cité au commit.
- `attirant` : `specs` = `mutants-et-hommes-betes`, `pool: false`, source EDOC (folio relevé), note `EDOC 12 l.84`
  (« Gagne le Talent Attirant avec les mutants et les hommes-bêtes »). Libellé : la convention du précédent
  `savoir-vivre|disciples-de-tzeentch` face à SA phrase (`EDOC 13 l.524`), que le codeur cite et applique. Crête sur la
  tête écrit `{ id: 'attirant', spec: 'mutants-et-hommes-betes' }`.
- `bon-marcheur` : `specs` gagne `plaine`, `pool: false` comme ses précédents `foret` et `marais` (même livre, texte
  d'un profil : `frenchy.bzh 26 l.366` « Arpenteur (Plaine_OU_Forêt) »), source `frenchy-bzh`, note
  `frenchy.bzh 26 l.366` ; les 5 bornes deviennent `choix: ['foret', 'plaine']`, et `SPECS_DE_TALENT_A_CREER` meurt.
- `species.json` (v3 B5) : les 4 rangées `humains-*` écrivent `{ id: 'destinee', choix: true }` (LDB 10 l.315), le
  régime `avancement` (`grammaire/avancement.ts:26`) l'admettant déjà. Le créateur, train 2d.
- Le cliquet `PLAFOND = 24` et son commentaire meurent ; `refs-migrated.test.ts` se réécrit sur la seule règle « toute
  spec de Talent résout au catalogue ou dans une entrée ouverte ».

**E4. Désignateur du spawn, un pour les deux types.** `designateSpec` (`spawn.ts:144`, aujourd'hui `(sk: SkillData, …)`)
devient `designateSpec(def, choix, seed)` pour toute def qui porte `specs`/`specsSource` (`SkillData`, `TalentData`).
Son pool est `specPoolOf(def)` (`src/data/index.ts:3516`), borné par `choix` quand c'est une liste. `talentsFromBook`
(`spawn.ts:167`) a DEUX appelants, `spawn.ts:244` (bestiaire) et `spawn.ts:317` (`statblockToCombatant`, statbloc de
scène de `defs-scenes/communs.ts:59`, graine `spec:${id}`) : les deux passent la même graine que `skillsFromBook`. Alors
seulement les Talents de statbloc (`creatures.ts:74`) deviennent porteurs d'emplacement (`specOuChoixFacultatifs` au
site), les 12 sentinelles « au choix » deviennent `choix: true`, et la branche sentinelle de
`defs-scenes/narratif.ts:120-127` meurt.

**E5. Données des sorts de #1926.** Sagesse de la chouette : `{ id: 'sens-aiguise', spec: 'vue' }` (LDB 43 l.307).
Cœurs ardents : une op `grantTalent` `coude-a-coude` rejoint les deux autres, et le fragment « Coude-à-coude …
(arbitrage MJ) » quitte la `narrative` (LDB 48 l.229). Les Deux Bœufs : `{ id: 'maitre-artisan', choix: true }` (ADE II
03 l.235), train 2d. Sans peur nu (Flambeau, Cœurs ardents) : la `spec` de la réponse de Clément à la carte du
2026-09-24, consignée verbatim et datée à #1926 ; sans réponse, ces deux ops restent telles quelles et le train ne se
publie pas. Instincts animaux, Traversée rapide, Dévotion : train 3.

**E6. Une seule couture d'acquisition de Talent ; lecteurs (v3 B1).**
- Quatre sites écrivent aujourd'hui l'acquisition d'une instance de Talent : `src/engine/ops.ts:2229` (vérifie le Maxi,
  `talentMaxReached` :2222, fusionne `times`) ; `src/engine/corruption.ts:210` (`attachMutation`, branche
  `op.op === 'grantTalent'` :209, sans Maxi ni fusion ; inverse :236-238) ; `src/engine/character.ts:326-330`
  (`addTalentRef`, Signes astraux) ; `src/engine/advancement.ts:100`. Ils convergent vers UNE fonction, extraite
  d'`ops.ts:2220-2229`, qui porte le Maxi et la fusion de `times` ; son inverse sert `corruption.ts:236-238`. Le
  codeur prouve par grep (`talents.push|talents = \[`) qu'aucun cinquième site ne reste. Le commentaire
  `ops.ts:2216-2218` (qui nomme `applyCreationOps`, inexistant, et une identité de chemin que le code dément) se
  réécrit. Test promu : attacher deux fois une mutation qui octroie un Talent de Maxi 1 ne dépasse pas le Maxi.
- Les lecteurs d'op lisent `op.talent` et appellent `refConcrete('talents', o.talent)`. Tout libellé d'une réf à
  `choix` passe par `choixLabel` (`index.ts:3621`), `talentRefLabel` compris. Les chemins dérivés
  (`traitGrantedTalents`, `talentEffects.ts:206`) lisent la même graphie.

**E7. Éditeurs : une couture de contexte, pas une prop par appel (v3 B3 ; dit sur les libellés d'`OP_REF_FIELDS`).**
- Le rendu générique d'un champ d'ops du Codex (`CodexEdit.tsx:850`, et `:657` pour `passive`) lit le nœud du champ
  par `noeudDuChamp(file, champ)` (`CodexEdit.tsx:14/570`), en tire les `regimes` déposés en méta par la famille (E2), et
  les pose dans UN contexte React (fournisseur au site du champ, défaut : famille fermée). La branche d'op qui rend le
  `RefField` d'un champ à choix (aujourd'hui `GameOpEditor.tsx:1057-1061`, codée en dur pour `grantTalent`, qui perd
  `choix`) lit ce contexte et le régime du champ dans l'`opDefs` de la famille. Aucune prop ne traverse les 13 sites
  d'appel imbriqués (`GameOpEditor.tsx:788`, `EffectList.tsx:708/753`, `FlowEditor.tsx:90/95/271/279/289/293/299`,
  `CodexEdit.tsx:657/681/695/850/1618`, `StructFields.tsx:125/219`, `Inspector.tsx:1011/1013`). Une op imbriquée dans
  une op étant fermée (E2), le fournisseur la rend sans `choix` : l'éditeur suit la portée du schéma.
- `TalentSpecListField` et `SkillSpecListField` deviennent des listes de `RefField`. Les specs proposées viennent de
  `specCatalogOf(def)` (`index.ts:3525`) ; la saisie libre n'existe que si `entreeOuverte(type, id)`.
- `OP_REF_FIELDS` (`GameOpEditor.tsx`) : ses entrées des ops typées se dérivent d'`OP_DEFS`. Le libellé de chaque champ
  (« Compétence de magie » de `castPenalty`, « Compétence du Test » de `corruptionExposure`, `GameOpEditor.tsx:579-605`)
  est déclaré au champ, dans `OP_DEFS`, par la primitive de méta de champ (`MetaChamp`, `meta.ts:8-18`) étendue aux
  champs de payload d'op. Question en sortie : la méta s'y attache-t-elle telle quelle, ou quelle extension, `fichier:ligne` ?
  Il ne reste à la main que les ops d'`OPS_NON_TYPEES`, sous #1468 (lot de mort) cité au commit ; le commentaire
  « SOURCE UNIQUE » (`GameOpEditor.tsx:576`) se réécrit dans le même geste, sans excuse.
- Tests promus : Les Deux Bœufs, édité puis sauvé, garde `choix: true` (train 2d) ; une op `grantTalent` à la racine de
  `stars.ops` propose `choix`, la même imbriquée sous `delayed` ne le propose pas.

**E8. Ce qui meurt dans le geste.** Mesuré par grep des NOMS à la tête du codeur :
- `gameOpRefFk.mjs` : `grantTalent.talentId`, `grantCareerTalent.talentId`, `grantTalent.spec`,
  `grantCareerTalent.spec` (`coveredBy`) ;
- `grammaireStock.mjs` et les lignes `reference … talentId` de `structuresStock.mjs` ;
- `spec-pool-contrat.test.ts` (entrées des specs à créer) ;
- `refs-migrated.test.ts` : le cliquet `PLAFOND = 24` (E3), le cliquet des sentinelles `PLAFOND = 12` et sa phrase
  « se tranche à #1621 ; d'ici là, une 13e rougit » (E4), le contrôle positif qui lit `SPECS_DE_TALENT_A_CREER`, et le
  commentaire de stock `:736-755` (il cite `talentRefSchema`, `narratif.ts l.127-133` et « ANGLE MORT … 18 porteurs ») ;
- `grammaire/reference.ts` (`talentRefSchema`, E1) ; `narratif.ts` (branche sentinelle, E4) ; `talentConcrete` (E9) ;
- les mentions de #1621 dans `defs/trappings.ts` et `grammaire/formes-partagees.test.ts` (elles visent
  `qualityRefSchema`) : réancrées si #1621 se ferme avec ce lot.

**E9. La clé d'une instance de Talent : `talentId` → `id` (#1610).** `TalentInstance.talentId`
(`src/engine/types.ts:301`) et `ActiveEffect.grantedTalent.talentId` passent à `id`, comme `SkillInstance.id`.
`talentConcrete` (`index.ts`) meurt, `refConcrete` sert les deux. Empreinte : 200 lignes `talentId` dans 56 fichiers de
`src` hors tests, 82 dans `src/data/*.json`. Dans le lot, pas en ticket : le reporter laisserait `talentId` et `id` en
synonymes à la couture op → état.

**E10. Migrations : chaque forme persistée par son canal (v3 B6).**
- Données commitées (`src/data/*.json`) : migration datée sous `scripts/migrations/`, jouée par le job `migrations`.
- Sauvegardes : bump de `SAVE_VERSION` (`src/state/saves.ts:137`), et RIEN d'autre (arbitrage du 2026-08-17 cité
  `saves.ts:15-24` : « Changement de FORME persistée : bump de `SAVE_VERSION`, et RIEN d'autre — aucune chaîne de
  migration »). Train 2c.
- Export du roster : une entrée de `ROSTER_MIGRATIONS` (`roster.ts:97`) et le bump d'`EXPORT_VERSION` correspondant,
  précédent l'entrée 3 `remapSkillIdDeep`. Train 2c.
- Projets d'auteur : une entrée de `PROJECT_MIGRATIONS` (`src/state/worldMap.ts:786-996`) par train qui casse le parse
  d'un projet existant : 2a (graphie des ops de Talent, `grantTalent.talentId` → `talent`), 2b (sentinelles de
  `talents[]` de statbloc → `choix`), 2c (`talentId` → `id`). Le codeur lit la version courante à sa tête.

## Trains et dépendances

- **Train 2a** : E1, E2 (dont `talents.passive` et `traits.passive`), E3 (sauf le créateur), E5 (Sagesse, Cœurs
  ardents), E6, E7 (sauf le test des Deux Bœufs), E8, E10 (données, projets). Bloqué par la fusion de
  `chantier/1473-r1` (correction 3) dans `chantier/1473-r2`.
- **Train 2b** : E4, E10 (projets). Après 2a.
- **Train 2c** : E9, E10 (saves, roster, projets). Après 2b.
- **Train 2d** : #1924 (`createHero` et `resolveSpeciesTalents` consomment les `AdvancementRef` en ids ; `specChoices`,
  `speciesTalentChoices`, `skillAdvances` keyés par identité d'entrée ; `talentRefOfLabel`/`talentRefKeyOf` quittent
  `src/engine`, DoD de #1924), puis `stars.ops` porteur d'emplacement, Les Deux Bœufs `choix: true`, le créateur de la
  Destinée (saisie libre d'une entrée ouverte en plus du pool, test promu). Le grounding de 2d mesure si des
  `CreateHeroOptions` en ids imposent le brouillon du créateur en ids (#1923) et les select de spec (#1607) ; si oui,
  ils entrent au train. Après 2c (`TalentChoisi`, `character.ts:95`, s'aligne sur la forme de E9).
- **Train 3** : désignateur au lancement, `defs/spells.ts` porteur d'emplacement (une ligne), Instincts animaux,
  Traversée rapide, Dévotion, garde de classe de #1926 sur TOUS les porteurs d'op de Talent (sorts, mutations, traits,
  signes, tables, dotations) : « toute référence à un Talent spécialisable porte `spec` ou `choix` » ; recette
  navigateur en joueur.
- Même lot, même publication : 2a à 2d et 3. Publication bloquée par les réponses de Clément (Sans peur, Destinée) et
  par son accord de publier.

## Portes (geste joueur)

Lancer Sagesse de la chouette : la fiche montre Sens aiguisé (Vue). Lancer Cœurs ardents : Coude-à-coude apparaît.
Créer un héros né sous Les Deux Bœufs : le créateur demande le Métier, le héros a Maître artisan (ce Métier). Un héros
qui reçoit Crête sur la tête voit « Attirant (…) » avec le libellé retenu, et la recevoir deux fois ne dépasse pas le
Maxi. Un Moine de la peste en combat montre « Frénésie (à Volonté !) ». Un Prêtre rôdeur de Taal a Bon marcheur (Forêt)
ou (Plaine), le même à chaque projection. Créer un héros humain : sa Destinée se choisit parmi les exemples ou s'écrit.
Un héros marqué de Tzeentch voit Magie des Arcanes à l'avancement et choisit son Domaine.

## Réponse au verdict v3 (12 bloquants)

1. Quatre sites d'acquisition, Maxi sur un seul → E6 : une couture extraite d'`ops.ts:2220-2229`, test promu.
2. Désignation des Signes par libellé → train 2d prend #1924 ; `stars.ops` s'ouvre après ; désignateur cité corrigé
   (`character.ts:353`, via `creation.ts:196-199`) ; le test promu porte sur la référence, pas sur un libellé.
3. Aucune couture d'éditeur → E7 : contexte React posé au site du champ par le rendu générique, lu par la branche d'op.
4. Régime propagé aux ops imbriquées → E2 : portée à la racine du porteur, imbrication fermée, sonde promue.
5. Porte Destinée sans geste → E3 (`species.json` à `choix`) et train 2d (saisie libre au créateur, test promu).
6. Migrations mal ciblées → E10 : `SAVE_VERSION`, `ROSTER_MIGRATIONS`, `PROJECT_MIGRATIONS` par train.
7. `grantCareerTalent` non désignable → E2 : `careerTalentAdditions` + dépliage d'`advancement.ts:227` ; `traits.passive`
   porteur ; Marque de Tzeentch à `choix` ; garde de classe de #1926 sur tous les porteurs (train 3).
8. « ouverture » homonyme → Vocabulaire : régime, porteur d'emplacement, champ à choix ; « ouvert » réservé.
9. `ChampDEmplacement` double `champsDOpASlot` → `ChampAChoix`, dérivé des déclarations, sans union tenue à la main.
10. Types reportés, `TalentRef` omis → E1 : un type par forme dans le lot, inventaire par grep des noms.
11. Inventaire `skillRefSchema` incomplet → E1 : grep du nom, `activities.ts:19` et `axes.ts:26` inclus.
12. Paraphrase du Maxi → E3 : trois sites réduits à leur réf nue, quelle que soit la réponse ; champ de l'entrée nommé en
    sortie ; lignes corrigées (`careerSlots.ts:8`, `:363-364`, `:388`, `activities.ts:945-946`).

Dits intégrés : 13 lazies (E2), deux appelants de `talentsFromBook` (E4), racines de la garde du masquage (E2), libellés
d'`OP_REF_FIELDS` (E7), `plaine` en `pool: false` (E3), commentaire `refs-migrated.test.ts:736-755` (E8), E9 dans le lot,
fossile tué par un test (E2), graphie d'un porteur fermé (E2).
