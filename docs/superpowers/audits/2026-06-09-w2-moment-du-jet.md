# Audit lisibilité combat — W2 (le moment du jet : pré-roll + Résilience/Chance vs RAW)

Problèmes confirmés : 8

## Findings confirmés

### [majeur] (fidélité-RAW) Résilience « Je ne faillirai pas ! » : le mode AVANT-jet (le mode PRIMAIRE du RAW) est impossible — uniquement le rattrapage post-échec est implémenté
- **Symptôme**: Le bouton « 🔥 Réussite garantie » n'apparaît qu'APRÈS avoir cliqué « Lancer » et vu le verdict défavorable (ResilienceButton avec show=!res.hit / !pt.success / etc., rendu seulement dans la branche post-résultat). Toutes les actions forceSuccess refusent d'agir tant que le dé n'a pas été lancé : testForceSuccess `if(!pt||pt.roll==null) return` (store.ts:3137-3138), attackForceSuccess `if(!…||!pa.result…) return` (store.ts:3148), defenseForceSuccess (store.ts:3170), disengageForceSuccess (store.ts:3196), castForceSuccess (store.ts:3182). Impossible de déclarer « je ne faillirai pas » avant de lancer.
- **Cause**: Le flux par modale a été conçu autour d'un unique état post-jet : le pending ne propose la Résilience que quand `result`/`roll` est rempli. Le RAW décrit pourtant DEUX moments : (a) à la place du jet, (b) — concession — après un échec. Seul (b) est codé ; (a) n'a jamais été modélisé (pas de bouton dans la phase de choix pré-Lancer, pas de chemin store qui pose success sans tirer le dé d'abord).
- **Preuve**: src/ui/ResilienceButton.tsx:6-12 (show requis) ; src/ui/RollModal.tsx:131 + TestModal.tsx:52 + DefenseModal.tsx:85 + DisengageModal.tsx:87 + CastModal.tsx:97 (rendu uniquement post-result) ; src/state/store.ts:3136-3138,3146-3151,3168-3173,3194-3198 (gardes roll==null/!result)
- **RAW**: LDB 17 l.68
- **Vérif**: haute / code=True / raw=True
- **Direction**: Exposer la Résilience DÈS la phase de choix de chaque modale (avant « Lancer »), en gardant le rattrapage post-échec actuel comme 2e porte. Concrètement :

1) UI — ajouter un bouton « 🔥 Je ne faillirai pas ! » à côté de « Lancer »/« Défendre »/« Esquiver » dans la branche pré-jet (`!res`/`!rolled`/`phase==='choice'`) de RollModal/TestModal/DefenseModal/CastModal/DisengageModal (et par cohérence FocusModal/RunModal), affiché si `resilience > 0`. Le ResilienceButton existant reste tel quel en post-échec (concession l.73).

2) Store — lever la garde `roll==null`/`!result` UNIQUEMENT pour un chemin pré-jet dédié (ne pas casser le chemin post-échec). Le pré-jet doit POSER directement : Test simple → success:true, sl = max(requireSL, 1) ; Test opposé → l'emporte avec sl = max(advSL+1, 1) sans tirer le d100 propre de l'acteur. Décrémenter la Résilience puis sauter la révélation du dé (passer direct à « Appliquer », ou auto-confirmer).

3) Fidélité maximale (couvre le hidden gap #1) : implémenter aussi les pouvoirs annexes du mode primaire — permettre, sur ce chemin, de CHOISIR la valeur du résultat et, si l'issue est un Coup Critique, de CHOISIR la Localisation (au lieu du hasard), conformément à l'exemple l.75. À défaut d'aller jusque-là, fabriquer un `roll` « choisi » cohérent (≤ target) pour ne pas casser l'affichage et les calculs critique/double en aval.

4) Garder le wording du RAW : intitulé « Je ne faillirai pas ! », tooltip citant LDB 17 l.68 « au lieu de lancer les dés ». Tests : un cas pré-jet par modale (success garanti sans roll, Résilience −1) + non-régression du post-échec existant + invariant « si jet, modale » (roll-modal-invariant.test.ts).

Ce n'est PAS un design verrouillé : le minimum fidèle = exposer le choix avant le jet ; le « choisir le résultat / la localisation » est l'étage supérieur de fidélité à arbitrer.

### [majeur] (UX-lisibilité) Les dés sont déjà résolus à l'instant où le verdict s'affiche — aucun suspense de lancer (révélation instantanée, pas d'animation)
- **Symptôme**: Au clic « Lancer », l'action store tire le dé ET pose le résultat dans le même set() ; React re-render et la modale bascule directement sur le verdict figé (« 🎲 47 ✓ +2 DR »). Le joueur ne « voit » jamais le dé rouler : le chiffre apparaît déjà décidé. Retour utilisateur conservé au ticket #3175 : le lancer manque de suspense.
- **Cause**: Pas d'étape intermédiaire entre clic et révélation : attackRoll/testRoll/defenseRoll/castRoll font tirage + set() atomiques (store.ts:2665-2678, 3282-3286, 2921-2931). Aucun composant n'anime le dé (grep CSS : 0 @keyframes de dé ; seuls bob/dégâts/token existent). La modale ne distingue que 2 états : « pas lancé » / « lancé ».
- **Preuve**: src/state/store.ts:2665-2678 (attackRoll : resolveAttack puis set result) ; src/state/store.ts:3282-3286 (testRoll : rollTest puis set roll) ; src/state/store.ts:2921-2931 (defenseRoll) ; src/ui/RollModal.tsx:84-128 (branche binaire !res / res) ; src/ui/styles.css + src/gameIso/anim.css (aucun keyframe de dé)
- **RAW**: aucune
- **Vérif**: haute / code=True / raw=True
- **Direction**: Séparer les deux problèmes. (A) UX/anticipation (RÉEL) : ajouter un beat de « roulement » purement cosmétique entre le clic Lancer et la révélation — le résultat reste calculé d'avance (RNG seedé intact), seul l'affichage défile ~400-600 ms puis fige sur la vraie valeur. Implémentation propre : composant Dé partagé (ou état UI-local `rolling` dans la modale, PAS dans le store, pour ne pas polluer l'état seedé) + 1 @keyframes ajouté à styles.css, réutilisé par les ~13 modales via RollLine / .dice. A minima (fallback) : flash/scale CSS sur le chiffre à la révélation. Respecter clearAllTimers (fake-timers) et l'invariant roll-modal. (B) Fidélité Résilience : NE RIEN « corriger » au sens du grief utilisateur — la dépense post-échec est RAW (l.73 + exemple l.75) et le code est juste. Optionnellement, comme amélioration séparée et RAW-légale (l.73 « au lieu de lancer les dés »), exposer aussi « Je ne faillirai pas ! » AVANT le jet (état pré-roll des modales), en gardant la voie post-échec. Ne pas étendre ce pré-jet à la Chance (Relance/+1 DR), dont le RAW impose le post-jet.

### [mineur] (tempo) Aucune décision possible avant le lancer (sauf la cible/le mode) : le joueur subit le dé sans engagement préalable
- **Symptôme**: Dans la phase pré-« Lancer », les seuls choix offerts sont la localisation visée (attaque), parade/esquive (défense), ou le menu désengagement. Toute dépense de ressource (Chance, Résilience) est verrouillée tant que le dé n'est pas tombé. Le joueur ne peut PAS « parier » avant de connaître l'issue — l'engagement émotionnel se fait après-coup, ce qui aplatit le moment.
- **Cause**: Conséquence directe des deux findings ci-dessus : la Chance est par nature post-jet (relance/+1 DR, fidèle), mais comme la Résilience pré-jet manque AUSSI, il ne reste littéralement aucune action de ressource avant le lancer. La phase de choix sert donc juste à paramétrer le jet, jamais à s'investir dedans.
- **Preuve**: src/ui/RollModal.tsx:84-107 (phase pré-Lancer = localisation + Annuler/Lancer, rien d'autre) ; src/ui/TestModal.tsx:34-39 (phase pré-Lancer = juste « Lancer ») ; src/ui/DefenseModal.tsx:45-65
- **RAW**: LDB 17 l.68
- **Vérif**: haute / code=True / raw=True
- **Direction**: Le problème est À LA FOIS tempo (UX) ET fidélité — la vérification le requalifie. Direction (pas un design verrouillé) :

A. FIDÉLITÉ d'abord — ajouter le mode PRÉ-JET de « Je ne faillirai pas ! » (le mode nominal du RAW l.73 « au lieu de lancer les dés »). Dans la phase `!res`/`!rolled` de chaque modale, exposer un bouton Résilience « 🔥 Je ne faillirai pas ! » qui, AVANT le clic Lancer, déclare la réussite garantie (et court-circuite le tirage). Conserver le bouton post-jet existant (le RAW autorise les deux via « vous pouvez même... après un Test qui a échoué »). Le store a déjà toute la mécanique forceSuccess ; il suffit d'ajouter un chemin qui n'exige pas `roll != null` (fabriquer un résultat forcé sans tirer le d100, ou marquer un flag `resilienceDeclared` consommé à la résolution).

B. Refléter « vous choisissez le résultat » (l.73) : pour les Critiques, laisser le joueur choisir la localisation (le RAW le permet explicitement) plutôt que de la laisser au hasard. Optionnel, mais c'est le cœur du « choix » RAW que le code aplatit aujourd'hui.

C. TEMPO/anticipation : faire de ce bouton pré-jet le pivot de la décision avant « Lancer », et uniformiser l'affichage de la cible-à-ne-pas-dépasser AVANT le tirage dans RollModal/DefenseModal (aligner sur TestModal:30) pour que le joueur pèse le risque et « parie » sa Résilience en connaissance de cause.

D. Garder Chance en post-jet (c'est fidèle : ch.17 l.24/l.26) — ne PAS la déplacer en pré-jet. Le seul levier pré-jet à ajouter est la Résilience.

E. Au passage : corriger toutes les refs de commentaire « l.72 » → « l.73 » (13 modales + store.ts:757/1762/3135 + ResilienceButton.tsx:2).

### [mineur] (fidélité-RAW) Désengagement : le jet d'attaque de l'adversaire (atk) est pré-tiré à l'ouverture du menu, avant tout clic du joueur
- **Symptôme**: À l'ouverture de la modale de désengagement (phase 'choice'), le d100 de Corps à corps du foe est DÉJÀ lancé et figé dans pendingDisengage.atk — avant même que le joueur choisisse Esquiver/Fuir/Sacrifier. Quand le joueur clique enfin « Esquiver », seul SON jet d'Esquive est tiré et opposé à un atk pré-déterminé. C'est le seul flux où une partie du Test opposé est pré-tirée hors d'un clic joueur.
- **Cause**: startDisengage appelle rollDisengageAttack(foe) au moment de construire le pending (combatFlow.ts:595), commentaire assumé « Son jet de CC est figé d'avance ». Cohérent côté moteur (l'atk doit être stable pour Chance/Résilience qui ne relancent que l'Esquive du mover), mais incohérent côté UX/anticipation : une moitié du jet existe déjà avant l'interaction, renforçant le sentiment de « dés déjà lancés ».
- **Preuve**: src/state/combatFlow.ts:592-607 (rollDisengageAttack avant le set pendingDisengage) ; src/state/store.ts:3102-3109 (disengageRoll tire seulement l'Esquive et l'oppose à pd.atk figé)
- **RAW**: aucune
- **Vérif**: haute / code=True / raw=True
- **Direction**: Garder le moment du CALCUL (atk pré-figé est nécessaire pour la stabilité des relances ciblées Chance/Résilience sur la seule Esquive du mover) ; changer le moment de la RÉVÉLATION. Concrètement : ne révéler le d100 d'attaque du foe qu'AU clic « Esquiver », dans le même beat que l'Esquive du mover, pour que les deux dés « roulent ensemble ». Comme le chiffre du foe n'est de toute façon jamais affiché en phase 'choice' (seules les valeurs statiques le sont), l'enjeu est surtout d'AFFICHER le pd.atk.roll en phase 'esquive' à côté du def.roll — aujourd'hui la phase 'esquive' ne montre que le dé du mover (DisengageModal.tsx:76), pas celui du foe : le Test opposé est donc à moitié invisible. Direction : phase 'esquive' = montrer les DEUX d100 côte à côte (foe atk vs mover esquive) avec une anim de lancer simultanée, et garder atk figé en state dès startDisengage. Bonus à traiter avec : harmoniser avec PendingDefense (même atk pré-figé non affiché côté ennemi) pour une règle d'affichage cohérente « les deux dés d'un Test opposé se révèlent ensemble au clic du joueur, jamais l'un avant l'autre ». Ne PAS reclasser en problème de fidélité-RAW : il n'y a pas de violation de règle.

### [polish] (fidélité-RAW) « Je ne faillirai pas ! » sur Coup Critique : le choix de la localisation atteinte (offert par le RAW) n'est pas proposé
- **Symptôme**: Quand la Résilience force la réussite d'une attaque (attackForceSuccess), le code pose success + DR (store.ts:3146-3166) mais ne propose jamais au joueur de CHOISIR la localisation du Coup Critique éventuel — la localisation reste celle visée / au hasard et le critique est tiré normalement plus loin (applyCriticalToTarget → critLocationRoll, combatFlow.ts:654).
- **Cause**: forceSuccess ne fait que surcharger success/sl du jet ; le RAW « Si vous infligez un Coup Critique, vous pouvez choisir la Localisation atteinte » n'a pas de point d'entrée UI ni de paramètre porté jusqu'à la résolution du critique.
- **Preuve**: src/state/store.ts:3146-3166 (attackForceSuccess : ne touche pas la localisation du critique) ; src/state/combatFlow.ts:654 (critLocationRoll au hasard pour un Coup Critique)
- **RAW**: LDB 17 l.68
- **Vérif**: haute / code=True / raw=True
- **Direction**: Cas de niche — à coupler avec le finding 1 (anticipation/pré-roll). Direction : faire porter par attackForceSuccess un drapeau « critique potentiel à localiser » dans pendingAttack. Si le result forcé produit un Coup Critique (res.critical), réutiliser le sélecteur de localisation déjà présent (RollModal.tsx:88-97 + LOCS/HIT_LOCATION_LABELS) en mode post-jet pour offrir le choix, puis transmettre la localisation choisie jusqu'à applyCriticalToTarget afin de court-circuiter critLocationRoll (combatFlow.ts:654) — par ex. en passant la loc choisie comme `location` ET en supprimant la branche `isCoupCritique ? critLocationRoll(...)` quand un choix explicite Résilience est présent. Garde-fous : (a) n'offrir le choix QUE si res.critical est vrai après le forçage ; (b) respecter le footprint/bodyShape de la cible (le sélecteur doit proposer les localisations valides pour la cible non-bipède). Optionnel/plus large : exposer aussi le choix du résultat du d100 (RAW l.75) pour fidélité complète de « Je ne faillirai pas ! », et étendre le choix de localisation à tout critique issu d'une réussite forcée par Résilience, pas seulement attackForceSuccess. PAS de design verrouillé.

### [majeur] (fidélité-RAW) Résilience « Je ne faillirai pas ! » : le mode RAW « au lieu de lancer les dés » (avant le jet) n'existe pas — uniquement offerte après un échec
- **Symptôme**: Dans TOUTES les modales de jet, le bouton 🔥 Résilience n'apparaît qu'une fois le dé tiré ET seulement si l'issue est mauvaise : RollModal.tsx:131 `show={!!res && !res.hit}`, TestModal.tsx:52 `show={rolled && !pt.success}`, DefenseModal.tsx:85 `show={!!res && res.hit}`, CastModal.tsx:97 `show={!!res && !res.cast}`, DisengageModal.tsx:87 `show={pd.phase==='esquive' && pd.result!=='success'}`, FocusModal.tsx:57 `show={r.dr===0}`, plus Frenzy/Psych/EncounterPsych/Heal/Run/Trample (`show={!ok}` / `show={!r.success}`). Le joueur ne peut JAMAIS déclarer « Je ne faillirai pas ! » avant/au lieu de lancer.
- **Cause**: Le RAW (LDB 17 l.68) définit deux fenêtres : la fenêtre PRIMAIRE « au lieu de lancer les dés pour un Test, vous choisissez le résultat » (avant le jet = auto-réussite, on choisit même le dé : « Elle choisit également le résultat du dé, 11 ») et la fenêtre EXCEPTIONNELLE « Vous pouvez même faire ce choix après un Test qui a échoué » (le mot « même » marque l'extension). Le code n'a implémenté QUE la seconde, et l'a même restreinte (cf. forceSuccess early-return sur `roll==null`/`!result`, store.ts:3138/3148/3170/3182/3196). La fenêtre canonique principale est absente. Conséquence ludique en plus du défaut de fidélité : impossible de garantir un succès dont on veut MAÎTRISER le DR/la localisation avant de connaître le dé, alors que l'exemple LDB l.75 repose précisément là-dessus (choisir 11 → Critique → localisation).
- **Preuve**: src/ui/RollModal.tsx:131; src/ui/TestModal.tsx:52; src/ui/DefenseModal.tsx:85; src/ui/CastModal.tsx:97; src/ui/DisengageModal.tsx:87; src/ui/FocusModal.tsx:57; src/ui/ResilienceButton.tsx:6-7 (`if (resilience<=0 || !show) return null`); src/state/store.ts:3136-3201 (tous les *ForceSuccess early-return si pas de result)
- **RAW**: LDB 17 l.68
- **Vérif**: haute / code=True / raw=True
- **Direction**: Ajouter la fenêtre PRÉ-JET sans casser l'extension après-échec (les deux doivent coexister — LDB 17 l.68).
1) UI : dans la branche `!res`/`!rolled` de chaque modale (à côté de « 🎲 Lancer » / « 🛡️ Défendre » / « Défendre »), rendre un bouton « 🔥 Je ne faillirai pas ! (réussite garantie) » conditionné uniquement à `resilience > 0` (pas à une issue, puisqu'il n'y a pas encore de jet). Garder le bouton existant dans la branche post-jet pour la fenêtre après-échec.
2) Store : rendre chaque `*ForceSuccess` capable de fabriquer un résultat réussi SANS jet préalable. Réutiliser la logique d'issue déjà présente (opposé → DR adverse +1 ; simple → DR ≥ requireSL) mais en synthétisant un d100 propre quand `roll == null` (p.ex. roll = target) au lieu de l'early-return. Concrètement : remplacer les gardes `roll==null`/`!result` par « si pas de résultat, en fabriquer un réussi », en factorisant le cœur commun pré/post-échec.
3) Capacité manquante (l.73/l.75) : sur un Critique forcé, permettre de CHOISIR la localisation (réutiliser la grille de localisation déjà présente dans RollModal) ; idéalement permettre de choisir le résultat du dé pour viser un Critique. À traiter au moins pour attaque/défense ; pour les Tests simples hors combat la localisation est sans objet.
4) Tests : couvrir le chemin pré-jet (Résilience dépensée alors que `roll==null` → succès garanti, opposé DR +1, simple requireSL) et la persistance du chemin après-échec. Surveiller le garde-fou « un jet = une modale » : ici on AUTORISE une réussite SANS jet, ce qui est conforme au RAW — documenter l'exception.
NE PAS verrouiller un design : c'est une direction. Valider que la consommation d'Action/Mouvement reste cohérente quand on garantit sans lancer (notamment Désengagement où l'Esquive consomme l'Action dans les deux issues, store.ts:3203).

### [majeur] (UX-lisibilité) Pas de frisson du lancer : le dé n'est jamais animé, le résultat s'affiche instantanément
- **Symptôme**: Le retour brut « Les dés sont déjà lancés avant l'ouverture de la modale — pas de frisson du lancer » pointe un ressenti réel mais une cause légèrement différente : la modale s'ouvre bien AVANT le jet (branche `!res` avec bouton « Lancer », RollModal.tsx:84/103), donc les dés ne sont pas pré-lancés. Le vrai manque est qu'au clic « Lancer » le store calcule le résultat synchroni­quement (attackRoll store.ts:2665-2678) et la modale re-rend immédiatement le NOMBRE FINAL (RollModal.tsx:26-28 `🎲 <b>{roll}</b>`), sans aucune phase de roulement/suspense. Zéro anticipation entre l'intention et le verdict.
- **Cause**: Aucun état intermédiaire « en train de rouler » : `pending*.result`/`pending*.roll` passe directement de null au résultat final, et le rendu du dé est un simple `<span>` numérique (aucune classe d'animation dans RollModal.tsx, aucun @keyframes dice associé). Le pattern « un jet = une modale » garantit la MODALE mais pas l'ANIMATION du tirage.
- **Preuve**: src/ui/RollModal.tsx:26-28 et :103-106; src/state/store.ts:2307 (result:null), :2665-2678 (roll instantané); src/ui/TestModal.tsx:43 (`<span className="dice">…`); src/ui/DisengageModal.tsx:76
- **RAW**: aucune
- **Vérif**: haute / code=True / raw=True
- **Direction**: Deux remédiations distinctes, à co-traiter (l'une UX, l'autre fidélité) :

A) UX « frisson du lancer » (n'animer QUE l'affichage, jamais re-tirer) : introduire un état visuel transitoire « en cours de roulement » porté côté UI (pas dans le moteur). Au clic « Lancer/Défendre/Esquiver », le store calcule déjà le résultat final (déterminisme préservé) ; la modale affiche un dé qui défile ~400-600 ms (composant de dé partagé — le `.dice`/`.rm-roll-dice`/RollLine sont déjà mutualisés) via classe `.rolling` + un nouveau `@keyframes`, puis se fige sur `roll`. Ne révéler ChanceButtons + ResilienceButton + le verdict + « Appliquer » qu'à la FIN du roulement. Honorer `prefers-reduced-motion: reduce` (fige immédiatement). Garder l'horloge purement côté composant pour ne pas perturber les tests moteur ; si nécessaire, exposer un flag « skipDiceAnim » en test.

B) Fidélité Résilience « AVANT le jet » (LDB 17 l.68, sur-thème « Je ne faillirai pas ! avant le lancer ») : exposer le chemin pré-jet. Dans la branche `!res`/`!rolled` de chaque modale (à côté de « Lancer »), offrir un bouton « 🔥 Je ne faillirai pas ! » qui choisit le résultat sans lancer (Test opposé → l'emporter avec DR +1 ; Critique → choix de localisation par le joueur, l.73). Cela complète, sans le retirer, le chemin après-échec existant. Décision de design (NON verrouillée) : présenter A et B ensemble pour que la dépense Résilience pré-jet soit une vraie alternative au lancer, conformément au retour brut.

### [mineur] (fidélité-RAW) Cohérence entre modales : 12 implémentations dupliquées du même `show={mauvaise issue}` — risque de dérive et faille systémique unique
- **Symptôme**: Le choix « Résilience uniquement après échec » n'est pas centralisé : il est ré-exprimé dans CHAQUE modale via une condition `show=` ad hoc (RollModal:131, TestModal:52, DefenseModal:85, CastModal:97, DisengageModal:87, FocusModal:57, FrenzyModal:53, PsychModal:91, EncounterPsychModal:78, HealModal:132, RunModal:55, TrampleModal:52). Le défaut de fidélité (#1) est donc répliqué 12 fois ; toute correction doit toucher 12 sites + 12 store actions *ForceSuccess.
- **Cause**: ResilienceButton (et le flux forceSuccess) ont été conçus autour d'un seul timing (après-échec) sans abstraction du moment d'offre. Ajouter la fenêtre pré-jet sans factoriser multiplierait encore la surface. C'est le « problème caché qui voyage avec » la correction #1.
- **Preuve**: src/ui/ResilienceButton.tsx:1-13 (composant sans notion de phase pré/post-jet); 12 call-sites listés ci-dessus; src/state/store.ts:3136-3201 (5 *ForceSuccess combat) + encounterPsychFlow.ts:86 + frenzy/psych/run/trample/heal/focus ForceSuccess
- **RAW**: LDB 17 l.68
- **Vérif**: haute / code=True / raw=True
- **Direction**: Avant de corriger le défaut de timing #1, factoriser la PHASE d'offre, pas le prédicat. (1) Introduire dans le store une primitive partagée par flux capable de forcer le succès SANS résultat préalable (pré-jet : on consomme la Résilience puis on construit directement un TestResult success/DR+1 sans appeler battleRng/rollTest — l'invariant « un jet = une modale » reste respecté car aucun aléa n'est tiré), distincte des `*ForceSuccess` actuels (post-résultat). Réutiliser une même fabrique (forceSuccessFromScratch + forceSuccessFromResult) dans les 12 flux plutôt que 12 corps copiés. (2) Côté UI, remplacer le `show={…}` ad hoc par un wrapper de modale commun exposant DEUX emplacements standard : un bouton Résilience « pré-jet » visible tant que le jet n'est pas lancé (resilience>0 && !rolled) et le bouton actuel « post-échec » (resilience>0 && rolled && échec). ResilienceButton prend une `phase: 'pre'|'post'`. (3) Protéger par un test étendant roll-modal-invariant : « chaque modale de jet rend ResilienceButton phase='pre' quand resilience>0 et le jet n'est pas encore résolu » + « la primitive pré-jet ne tire aucun aléa ». NE PAS tenter de fusionner les 12 expressions d'issue défavorable (formes de résultat hétérogènes) — standardiser l'EMPLACEMENT/PHASE suffit à supprimer la duplication de timing.

## Diagnostic synthétisé
Tout est confirmé. La synthèse fournie est exacte sur tous les points vérifiés (code et RAW). J'ai tout ce qu'il faut pour produire le diagnostic actionnable demandé.

---

# DIAGNOSTIC — « le moment du jet » (RPG WFRP4e)

Vérifié à la source : code (file:line) ET RAW (LDB ch.17 « Destin et Résistance », ligne à ligne). La synthèse fournie est correcte sur tous les points re-vérifiés. Je sépare nettement **(A) FIDÉLITÉ-RAW** et **(B) UX/tempo**, puis les **dépendances** avec le reste du combat.

---

## A. ÉCARTS DE FIDÉLITÉ-RAW

### A1. Résilience « Je ne faillirai pas ! » : le mode PRIMAIRE (avant le jet) n'existe pas — MAJEUR
**RAW** — LDB 17 l.68 : « **au lieu de lancer les dés pour un Test, vous choisissez le résultat** […]. S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1. **Vous pouvez même** faire ce choix **après** un Test qui a échoué. » → deux fenêtres : (1) **pré-jet** = mode nominal, (2) post-échec = concession (« même »).

**Code** — seule la fenêtre (2) est codée, et restreinte aux issues défavorables :
- `src/ui/ResilienceButton.tsx:7` — `if (resilience <= 0 || !show) return null` (composant sans notion de phase).
- Rendu uniquement post-résultat avec `show={mauvaise issue}` : `RollModal.tsx:131` (`!!res && !res.hit`), et 11 autres modales identiques.
- Toutes les `*ForceSuccess` early-return tant que le dé n'est pas tiré : `store.ts:3138` (`pt.roll == null`), `:3148` (`!pa.result`), `:3170`, `:3182`, `:3196`. **Aucun chemin store ne pose `success` sans `result`/`roll` préexistant.**

**Direction** — exposer la Résilience dans la branche pré-jet (`!res`/`!rolled`/`phase==='choice'`), libellée « 🔥 Je ne faillirai pas ! », conditionnée à `resilience > 0` seul. Ajouter un chemin store `forceSuccessFromScratch` qui **fabrique** un succès sans tirer : Test simple → `success:true, sl = max(requireSL, 1)` ; Test opposé → l'emporte `sl = max(advSL+1, 1)`. Garder la fenêtre post-échec actuelle (les deux coexistent, l.73). Consommer 1 Résilience, court-circuiter la révélation.

### A2. « Vous choisissez le résultat » + choix de la Localisation du critique non implémentés — POLISH/FIDÉLITÉ
**RAW** — l.73 : « vous **choisissez le résultat** » et « Si vous infligez un Coup Critique, vous pouvez **choisir la Localisation atteinte**, plutôt que de la laisser au hasard. » L'exemple l.75 en dépend (Salundra choisit 11 → Critique).

**Code** — `attackForceSuccess` (`store.ts:3146-3166`) force seulement `success`+`sl` ; il ne laisse pas choisir la valeur du d100. Pire, `combatFlow.ts:654` : `const loc = isCoupCritique ? critLocationRoll(battleRng(), target.bodyShape) : location;` → **quand c'est un Coup Critique (précisément le cas RAW), la localisation est TIRÉE AU HASARD et l'argument `location` est ignoré.**

**Direction** — quand un succès forcé produit `res.critical`, réutiliser la grille de localisation existante (`RollModal.tsx:88-97` + `HIT_LOCATION_LABELS`) en mode post-forçage, et transmettre la loc choisie jusqu'à `applyCriticalToTarget` pour court-circuiter `critLocationRoll`. Respecter le `bodyShape`/footprint de la cible (localisations valides pour cible non-bipède). Le choix du d100 lui-même est l'étage de fidélité supérieur (optionnel) ; à défaut, fabriquer un `roll` cohérent (≤ target) pour ne pas casser l'affichage `🎲 null` ni les calculs critique/double en aval.

### A3. Référence de commentaire erronée partout : « l.72 » au lieu de « l.73 » — TRIVIAL mais à corriger
Tous les commentaires citent « LDB ch.17 l.72 » (`ResilienceButton.tsx:2`, `store.ts:3135`, `:3200`, etc.) alors que l.72 = « **Je te renie !** » (anti-mutation) et l.73 = « **Je ne faillirai pas !** ». Corriger les refs partout (ResilienceButton + les 12 flux store).

### A4. (NON un bug — à NE PAS « corriger ») La Chance est légitimement post-jet
Le retour brut « la Résilience doit s'utiliser avant, pas après » est **inexact pour la Chance** : LDB 17 l.24 « Relancer un Test qui s'est conclu par un **échec** » + l.26 « Ajouter +1 DR à un Test **après qu'il a été effectué** ». `fortune.ts:8` (`canReroll(ownRollFailed, alreadyRerolled)`) et `ChanceButtons.tsx:20` (`rerollable` post-jet) sont **fidèles**. Lors de l'ajout du pré-jet Résilience, **ne PAS toucher au timing de la Chance** (sinon régression de fidélité). Seule la Résilience a une fenêtre pré-jet RAW.

> Note Détermination (l.59-66) : c'est un sous-système distinct (immunité Psycho / ignorer modifs critique / retirer un État), hors « moment du jet » — pas concerné ici.

---

## B. MANQUES UX / TEMPO

### B1. Pas de frisson du lancer : dé non animé, révélation instantanée — MAJEUR
**Code** — au clic, tirage + pose du résultat dans le **même `set()`** : `attackRoll` (`store.ts:2665-2678` : `resolveAttack(...)` puis `set({pendingAttack:{...,result:r.res}})`), `testRoll` (`store.ts:3282-3286`), `defenseRoll`/`disengageRoll` idem. La modale re-rend la branche `res`/`rolled` et affiche le NOMBRE FINAL figé (`RollModal.tsx:26-28` `🎲 <b>{roll}</b>`). **Aucun `@keyframes` de dé** dans `styles.css`/`gameIso/anim.css` (seuls isobob/isoglow/dmgfloat + ambiance iso). Aucun état intermédiaire « rolling ».

**Direction** — beat de roulement **purement cosmétique** : le résultat reste calculé d'avance (RNG seedé intact). État UI-local `rolling` **dans le composant, PAS dans le store** (ne pas polluer l'état seedé), classe `.rolling` + 1 `@keyframes` partagé, dé qui défile ~400-600 ms puis fige sur `roll`. Centraliser sur le composant `RollLine`/`.dice` (déjà mutualisé) pour couvrir les ~13 modales sans dupliquer. Ne révéler ChanceButtons/ResilienceButton qu'à la fin du roulement. **Honorer `prefers-reduced-motion: reduce`** (fige immédiatement) — aucun support actuel. A minima : flash/scale sur le chiffre à la révélation.

### B2. Aucune décision de ressource possible avant « Lancer » — MINEUR (résolu par A1)
**Code** — phase pré-jet = uniquement paramétrage : `RollModal.tsx:84-107` (localisation + Annuler/Lancer), `TestModal.tsx:34-39` (juste « Lancer »), `DefenseModal.tsx:45-65` (parade/esquive). Comme la Chance est post-jet (fidèle) et que la Résilience pré-jet manque, il ne reste **littéralement aucune action de ressource avant le lancer**. Le « pari » émotionnel arrive après-coup.
**Direction** — le bouton pré-jet de A1 devient le pivot de décision avant « Lancer ». **Incohérence à harmoniser au passage** : `TestModal.tsx:30` affiche la cible avant le jet, mais RollModal/DefenseModal non → afficher la cible-à-ne-pas-dépasser AVANT le tirage dans ces deux modales pour que le joueur pèse le risque.

### B3. Désengagement : jet de CC du foe pré-tiré à l'ouverture du menu — MINEUR (UX, PAS fidélité)
**Code** — `combatFlow.ts:595` : `const atk = rollDisengageAttack(foe, battleRng())` **avant** le `set` du pending, donc le d100 du foe est figé dès la phase `'choice'`, avant tout clic. `disengageRoll` (`store.ts:3102-3109`) ne tire que l'Esquive du mover et l'oppose à `pd.atk` figé.
- **Mécaniquement nécessaire** : l'atk adverse doit rester stable pour que Chance/Résilience ne relancent que l'Esquive du mover (relances ciblées). **Aucune violation RAW** (LDB 15 l.45-49 ne dit rien sur le moment du tirage ; le type allégué « fidélité-RAW » est incorrect → c'est purement UX).
- **Nuance** : le chiffre pré-tiré n'est jamais affiché en phase `'choice'` (seules valeurs statiques `DisengageModal.tsx:42-44`). Et ce n'est **PAS** le seul flux pré-tiré : `PendingDefense.atk` (`store.ts:337` « jet d'attaque figé (rollMeleeAttacker) ») est aussi pré-roulé en défense réactive. La vraie spécificité du désengagement : le joueur **initie** l'action mais un jet **adverse** est figé avant son 1ᵉʳ clic.

**Direction** — garder le moment du CALCUL, changer le moment de la RÉVÉLATION : ne révéler le `pd.atk.roll` qu'au clic « Esquiver », dans le même beat que l'Esquive du mover, **les deux d100 côte à côte** (`DisengageModal.tsx:76` ne montre aujourd'hui que le dé du mover → Test opposé à moitié invisible). Harmoniser avec PendingDefense : règle d'affichage unique « les deux dés d'un Test opposé se révèlent ensemble au clic du joueur ».

---

## C. FACTORISATION (problème caché systémique) — MINEUR

Le choix « Résilience post-échec » est ré-exprimé via `show={mauvaise issue}` ad hoc dans **12 modales** (RollModal:131, TestModal:52, DefenseModal:85, CastModal:97, DisengageModal:87, FocusModal:57, FrenzyModal:53, PsychModal:91, EncounterPsychModal:78, HealModal:132, RunModal:55, TrampleModal:52) + 12 `*ForceSuccess` store (heal:1763, focus:2008, psych:2086, frenzy:2169, trample:2811, run:2862, test:3136, attack:3146, defense:3168, cast:3180, disengage:3194 + encounterPsychFlow.ts:86). Corriger A1 sans factoriser **multiplierait le timing par 12 ×2**.

**Direction (avant A1)** — **standardiser la PHASE d'offre, PAS le prédicat** (les 12 `show` lisent des formes de résultat hétérogènes : `res.hit`/`pt.success`/`res.cast`/`r.dr`/`pd.result`… → un booléen partagé ne les collapse pas). Concrètement :
1. Store : une primitive partagée `forceSuccessFromScratch` (pré-jet, **ne tire aucun aléa**) + `forceSuccessFromResult` (post-échec, existant) réutilisées par les 12 flux.
2. UI : `ResilienceButton` prend `phase: 'pre' | 'post'` ; un wrapper de modale commun expose deux emplacements standard (pré-jet : `resilience>0 && !rolled` ; post-échec : `resilience>0 && rolled && échec`).
3. Test : étendre `roll-modal-invariant.test.ts` — « chaque modale rend ResilienceButton phase='pre' quand resilience>0 et jet non résolu » + « la primitive pré-jet ne tire aucun aléa ».

---

## DÉPENDANCES avec le reste du combat (à arbitrer en design)

1. **Décision pré-jet ⇒ pattern `pending*` modifié.** Aujourd'hui le pending passe de `result:null` → résultat final en un `set()`. A1 introduit un 3ᵉ chemin : `result:null` → succès **fabriqué sans tirage**. Il faut que les consommateurs en aval (critique/double/localisation) tolèrent un `roll` synthétique cohérent (≤ target) — sinon `🎲 null` à l'écran et calculs critique cassés. `PendingTest` porte déjà `roll:number|null, requireSL, success, sl` (store.ts:128-153) → structurellement faisable.

2. **Invariant « un jet = une modale »** (`roll-modal-invariant.test.ts`, RESOLVER `/(Roll|Reroll|BonusSL|ForceSuccess|Confirm|Cancel)$/`) : A1 **autorise une réussite SANS jet** (conforme RAW l.73 « au lieu de lancer les dés ») → documenter l'exception, ne pas casser l'invariant. B1 (anim) ne doit pas le casser non plus.

3. **Piège fake-timers** (déjà documenté, `clearAllTimers`) : B1 s'appuie sur un timer côté composant → respecter le piège pour ne pas geler Vitest. Garder l'horloge côté composant (pas store) ; exposer éventuellement un flag `skipDiceAnim` en test.

4. **Déterminisme RNG seedé** (`makeRNG`, tests + coop future) : B1 n'anime QUE l'affichage, **jamais de re-tirage**. A3/désengagement : ne pas changer le moment du `battleRng()`.

5. **Consommation Action/Mouvement** : vérifier la cohérence quand on garantit sans lancer — notamment Désengagement où l'Esquive consomme l'Action dans les deux issues (`store.ts:3203`).

**Ordre suggéré** : C (factoriser la phase) → A1 (pré-jet Résilience) → A2 (choix localisation critique) → B1 (anim partagée) → A3+B2+B3 (polish/harmonisation affichage). A4 = ne rien toucher (Chance fidèle).

**Fichiers clés** : `src/ui/ResilienceButton.tsx`, `src/ui/RollModal.tsx` (+ les 12 modales `*Modal.tsx`), `src/state/store.ts` (`*ForceSuccess` l.3136-3201, `attackRoll`/`testRoll` l.2665/3282, `PendingTest`/`PendingDefense`/`PendingDisengage` l.128/332/351), `src/state/combatFlow.ts:595` (pré-roll désengagement) + `:654` (`critLocationRoll`), `src/engine/fortune.ts` (NE PAS toucher), `src/ui/ChanceButtons.tsx` (NE PAS toucher), `src/state/roll-modal-invariant.test.ts`. RAW : `Source/Warhammer v4 - Livre de base version corrigée/17 - Destin et Résistance.md` l.24/26 (Chance, post-jet), l.73 (Résilience, deux fenêtres), l.75 (exemple Salundra).

