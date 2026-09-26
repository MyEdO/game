## Brief du codeur — train 2a2, corrections 4 après le juge de diff et la recette (#1473, #1463, #1955), 2026-09-24

**Contexte.** Arbre `/home/claude/game/.wt-1473-t2` (branche `chantier/1473-t2`, HEAD `6a55a5d7c`) : le train 2a2 et
ses corrections jusqu'aux corrections 3 sont dans l'arbre de travail, rien de committé. Tu PROLONGES ce diff. Le juge
de diff rend FRAGILE avec deux bloquants :
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-2a2-corr3/verdict.md` (lis-le EN
ENTIER, ses sondes sont dans le même dossier). La recette navigateur est rendue :
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/recette-2a2-corr3/rendu.md`. Le rendu
des corrections 3 : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/train2a2-corr3/rendu.md`.
Aucun socle n'est touché ; les trois sections du design v3.1 (`/mnt/project-files/dettes/1463-train2-talent-brief-v3.1.md`)
valent.

## N1 — ce que le livre dit de l'ouverture, et ce qui est un arbitrage (bloquant 1)

Le juge montre que quatre sites font dire au livre qu'une liste d'exemples est un catalogue FERMÉ, alors que ces phrases
ouvrent la liste : `src/data/refs-migrated.test.ts:487` et `:775`, `src/engine/careerSlots.test.ts:241`,
`src/data/schemas/grammaire/grammaire.test.ts:1261`.

Ce que dit le livre, verbatim :
- LDB 10 l.315 (Destinée) : « En accord avec votre MJ, proposez une Destinée appropriée. »
- LDB 09 l.40 : « […] choisissez parmi les exemples de *Spécialisation* qui s'y trouvent, ou, avec l'accord du MJ, créez
  une *Spécialisation* unique qui correspond à la Compétence et qui convient au mieux à votre Personnage. »
- LDB 10 l.548 (Haine) : « Chaque fois que vous prenez ce Talent, vous développez une certaine haine envers un nouveau
  groupe. Voici quelques exemples de groupes que vous pouvez haïr : […] » ; même forme à LDB 10 l.117, l.1051, l.1070
  et ADE II 02 l.265.

Ce qui est un arbitrage d'ingénierie, et doit se dire comme tel : pour les cinq Talents dont le livre donne une liste
d'exemples sans faire créer la spécialisation, un groupe neuf est une ENTRÉE du catalogue éditable, pas un texte libre.
`CLAUDE.md`, règle 7, verbatim : « Ce que le RAW laisse « au MJ » reçoit un arbitrage EXPLICITE (donnée éditable
taguée maison, ou choix joueur) ». Fiche `.claude/memory/user-doctrine-ids-stables-labels-affichage.md` : cite sa ligne
qui dit qu'une logique se keye par id.

Travail :
1. Réécris les quatre sites (commentaires, `describe`, messages d'`expect`) : réf nue (règle 6), l'ouverture fondée sur
   LDB 10 l.315 et LDB 09 l.40, la forme « catalogue éditable » fondée sur la règle 7, jamais sur LDB 10 l.117 ou
   l.548. Aucune phrase ne dit « le livre ferme ».
2. Établis en sortie, citation `fichier:ligne` à l'appui : une entrée de `specs[]` d'un Talent peut-elle porter le tag
   `maison` au schéma, et par quel chemin l'atelier du Compendium ajoute-t-il une spécialisation à un Talent ? Si l'un
   des deux manque, NE LE CODE PAS : dis-le.
3. La surface joueur qui manque (créer une spécialisation, proposer une Destinée) est tracée par #1962 : rien à faire
   ici.

## N2 — la garde « même référence » couvre sa classe (bloquant 2)

Huit sites comparent une identité (id, spec) par `s.id === X && s.spec === Y` (sonde du juge,
`juge-2a2-corr3/sonde-identite-sans-normalisation.log`) : `src/engine/menace.ts:44`, `src/engine/seaNavigation.ts:80`,
`src/engine/riverNavigation.ts:130`, `src/scenes/test-scenarios/siege-enceinte.ts:291`, et le même helper recopié dans
`src/scenes/test-scenarios/voyage.ts:19`, `15-commerce-fluvial.ts:31`, `14-voyage-maritime.ts:22`,
`21-chute-du-greement.ts:30`.
1. Migre-les vers `memeRef`. Le helper recopié des scénarios devient UN helper partagé (cherche d'abord s'il en existe
   un dans `src/scenes/test-scenarios/`, `_shared.ts` ou `_casters.ts` : cite ce que tu trouves).
2. Étends la garde (`scripts/guards/lib/memeRef.mjs`) à cette graphie ; le cas se prouve dans `memeRef.test.mjs` ;
   l'angle mort déclaré dans `src/engine/meme-ref-guard.test.ts` se retire. Les couvertures par joker
   (`spec == null ||`, liste du juge) ont une autre sémantique : elles restent hors de la garde, et un test le montre.
3. `(x.cible ?? '') === (op.cible ?? '')` (`src/engine/corruption.ts:243`, `src/engine/grantedTraits.ts:70`, NB9) :
   dis en sortie si c'est l'identité d'une instance de Trait (id, cible), et qui la construit. NE LE MIGRE PAS : le
   design `grantTrait` (`/mnt/project-files/dettes/1463-granttrait-instance-design-v1.md`, D3 « une seule construction
   d'instance ») la reçoit.

## N3 — la provenance d'un ajout est une référence d'entité (verdict du design du foyer, bloquant B9)

`ProvenanceDAjout` (`src/engine/talentEffects.ts:181`) naît `{ categorie: 'talents' | 'traits', id, spec? }` : des
catégories du Codex, pas des types d'entité. Juge de design du 2026-09-24 (run `wf_45835b0d-496`) : « F5 exige que
ProvenanceDAjout naisse sous la forme `{ type: 'talent' | 'trait', id, spec? }`. `talent` et `trait` sont déjà dans TYPES
(ref.ts:40-41) ». Pose `type` typé par `TypeEntite` (`src/data/schemas/grammaire/ref.ts`), restreint à ce que
l'ajout peut porter ; tous les constructeurs et lecteurs suivent (`talentEffects.ts:157`, `:173`, `:174`,
`CharacterSheet.tsx`, tests).

## N4 — une puce se nourrit de ce qu'elle affiche (NB6)

`src/ui/CharacterSheet.tsx:717` fabrique une `TalentInstance` (`times: 1`) pour afficher une provenance. Lis
`TalentChip` et `TraitChip` (`src/ui/EntityChip.tsx`) et leurs appelants : si une puce ne peut afficher qu'une
instance, dis pourquoi, sinon son entrée devient la référence (`id`, `spec`) avec le compte facultatif, et plus aucun
appelant ne fabrique d'instance pour elle.

## N5 — non bloquants dans les fichiers touchés

- NB1 : `src/engine/careerSlots.ts:223` et `src/engine/careerSlots.test.ts:203` citent LDB 10 l.17 pour « un joker exige
  une spec » ; l.17 définit la parenthèse. Cite ce qui fonde le propos au `Source/`, ou retire la citation.
- NB4 : `talentMax` (`src/engine/careerSlots.ts:386`) est mort, seul son test le lit (`careerSlots.test.ts:174`,
  `:181`). Il part avec son test ; contre-grep collé.
- NB3 : le cliquet `PLAFOND = 24` des textes d'instance a été retiré par les corrections 3 sans être nommé. Dis en sortie
  ce qu'il comptait, sa mesure aujourd'hui (sonde du juge, `sonde-textes-libres.log`) et pourquoi il n'a plus d'objet,
  ou remets-le.

## R — frictions de la recette

La recette a déroulé la partie A (scénario « Niveau complet », achats, puces de provenance) à la console 0 erreur ; les
parties B et C (Maître artisan, spécialisations au Compendium) ne sont pas faites et passent à la recette qui suivra tes
corrections.

1. **Le kit de recette clique avant le montage.** Après le clic sur « Scénarios de test », la liste se monte en différé :
   un `clickButtonByText` immédiat ne trouve rien (rendu, friction 1 ; `scripts/recette/lib.mjs`, vers `:719-748`).
   Corrige la classe, pas la doc : le helper de clic ATTEND sa cible, borné, comme `waitFor` du même module, et dit
   nommément ce qu'il n'a pas trouvé à l'échéance. Cite tous les helpers du kit qui cherchent une cible au DOM et dis
   lesquels suivent la même règle. Mets à jour `docs/recette-navigateur.md` dans le même geste s'il décrit ce helper.
2. **L'icône d'une section ne se lit pas au DOM** (friction 3 : le `<use>` d'un SVG n'est pas extrait). Si le kit a un
   helper de lecture de texte accessible, dis comment une icône s'y lit ; sinon ajoute au kit la lecture de l'`href` de
   l'icône d'un élément, une ligne d'usage à `docs/recette-navigateur.md`.
3. **Coût de « Monter » : 200 PX, puis 100 PX une fois le Niveau achevé.** Ce n'est pas un défaut : LDB 07 l.118 « Si
   c'est le cas, le changement de Carrière vous coûte 100 PX. Si ce n'est pas le cas, il vous en coûtera 200 PX. », et
   LDB 07 l.137. La rangée affiche déjà « niveau actuel non complété » ou « ✓ niveau complété » à côté du prix. Rien à
   faire.

## Contraintes

- Chemin ABSOLU : `/home/claude/game/.wt-1473-t2`. Interdits : tout `git checkout/restore/reset/stash/add/commit`, toute
  suppression récursive, toute écriture hors de ce worktree et de ton dossier de rendu.
- Portes : `npm run typecheck:fast`, `npx vitest run <fichiers du périmètre>` (liste collée), `node --test
  scripts/guards/lib/memeRef.test.mjs`, `npm run gen` si une donnée change. PAS de typecheck complet, de suite complète,
  ni de `docs:build`/`docs:check` : ils sont à moi.
- Preuve par mutation pour chaque garde ou test neuf ou réécrit : fichier muté, empreinte avant et après, rouge
  constaté, remise identique.
- La zone touchée sort aux normes : un concept, un terme ; commentaires à réf nue ; morts purgés.
- Budget : 45 minutes d'horloge, un livrable :
  `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/train2a2-corr4/rendu.md`, données
  brutes (sorties des portes collées, `fichier:ligne` de chaque changement). À l'échéance, rends ce qui est fait et
  NOMME le reste. Aucun processus laissé derrière toi, `ps` collé.

---
_Generated by [Claude Code](https://claude.ai/code)_
