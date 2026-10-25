# Contrat de SQUELETTE du rig humanoïde — canon d'emboîtement (#633 P3)

Spec du squelette bipède (`skeletons.ts::HUMAIN_M` + gabarits). Complète `PART-CONTRACT.md`
(qui dit comment DESSINER une part) : ici, où les OS placent leurs articulations pour que les
parts s'emboîtent **par construction**. Gardé par `skeletons.test.ts` (`canon du squelette`).

## Principe fondateur — l'ART est la donnée fixe, le squelette s'y emboîte

Les ~117 tenues + armures + visages sont dessinés dans le repère local de leur os, avec des
**repères anatomiques implicites** (le col d'un torse est à −32, sa ceinture à +15..20, son
ourlet à +34 ; un visage descend à +16 ; une jambe va de 0 à 50). Ce stock ne se redessine pas.
Le squelette n'est donc **pas** libre : chaque articulation DOIT tomber sur le repère anatomique
que l'art peint. Le POC violait ça deux fois (tête enfoncée, jambes enfoncées — diagnostic §4).

## Canon de repères (moyen M, build 0.5, ancré au sol `groundSkeleton`, monde 120×150, y↓)

| Repère | y monde | D'où il vient |
|---|---|---|
| sommet chevelure | ~16 | tete-local −8 |
| origine os `tete` | 24 | cou (40) + `tete.pivot` −16 |
| menton (bas visage) | 40 | tete-local +16 (`visage`/`BACK_CRANE`/`PROFILE_FACE`) |
| col du torse | 42..44 | torse-local −32..−30 (courbe `Q0 −32` des arts de torse) |
| origine os `cou` | 40 | torse (74) + `cou.pivot` −34 (= −torse.length) |
| épaules (os `epauleG/D`) | 48 | torse-local −26, x ±14 |
| origine os `torse` | 74 | bassin (86) + `torse.pivot` −12 |
| ceinture de l'art de torse | 89..94 | torse-local +15..20 — tombe SUR les hanches ✓ |
| bassin (racine) | 86 | 96 − 10 d'ancrage sol |
| hanches (os `cuisseG/D`) | 90 | bassin +4, x ±9 |
| ourlet de l'art de torse | 108..112 | torse-local +34..38 — mi-cuisse, genou VISIBLE |
| genou (os `tibiaG/D`) | 116 | hanche +26 (= plaque de genou de l'art de jambes, 22..30) |
| coude (os `avantBrasG/D`) | ~66 | épaule +18 (= `epaule.length`) — bout de l'art d'épaule |
| poignet (os `mainG/D`) | ~84 | épaule +18 +18 (= +`avantBras.length`) — le poing pend à hauteur de hanche |
| cheville (os `piedG/D`) | 140 | hanche +50 (= bas de l'art de jambes) |
| sol | 150 | `GROUND_Y`, garanti par `groundSkeleton` |

Hauteur totale ≈ 134 (≈ 5,5 têtes — stylisation « figurine héroïque » du stock d'art existant ;
les illustrations WFRP sont plus élancées, mais le canon d'un rig se cale sur SON art, qui est
la seule chose rendue).

## Règles d'architecture (ce qui EMPÊCHE le retour des défauts)

1. **Emboîtement** : le pivot d'un os enfant tombe au BOUT de son parent —
   `tibia.pivot.y == cuisse.length`, `pied.pivot.y == tibia.length`,
   `avantBras.pivot.y == epaule.length`, `main.pivot.y == avantBras.length` (poignet au bout de
   l'avant-bras, #633 D1), `tete.pivot.y == −cou.length`, `cou.pivot.y == −torse.length`. Un
   membre ne peut plus se déconnecter en FK : allonger un os sans déplacer le joint enfant casse le
   test, pas le rendu. L'ancienne exception `main.pivot.y = 14` (moignon `WRIST` qui faisait le
   joint) est MORTE : la vraie main (`HAND`, `parts/resolve.ts`) s'emboîte au poignet réel.
2. **Somme des os = étendue de l'art** : `cuisse.length + tibia.length == 50` (art de jambes) ;
   le bras est SCINDÉ au coude (#633 D1) — `bras` = épaule→coude (art 0..18 = `epaule.length`),
   `avantBras` = coude→poignet (art 0..16 ; le poignet FK à `avantBras.length` = 18, la vraie
   main l'emboîte). Plus de moignon `WRIST`. L'art et la FK mesurent la même chose — jamais deux vérités.
3. **Tête posée** : menton (`tete +16`) 2..8 unités AU-DESSUS du col (`torse −32`). Le cou
   (os de 16, art système `NECK` −16.5..+4.5, seule part qu'on redessine avec le squelette)
   relie visiblement tête et torse ; sa base plonge dans le col qui le recouvre (z 4.5 < 5).
4. **Jambes attachées** : la ceinture de l'art de torse (+15..20) tombe sur les hanches ; son
   ourlet max (+38) couvre l'attache SANS avaler le genou (`hem ≤ genou`). C'est le
   `torse.pivot.y = −12` qui réalise ça — à −2 (POC) l'ourlet tombait sous le genou.
5. **La profondeur proche/lointain est une affaire de VUE, pas de squelette** : les z
   asymétriques D>G (jambe/bras proches) ne s'appliquent qu'en `profile` ; de face/dos,
   `composeRig` symétrise le z des jambes (la D ne s'imprime plus PAR-DESSUS l'ourlet).
   Les bras gardent leur asymétrie (bras armé devant le corps pendant les anims de frappe).
6. **Paramétrage, pas de cas par écran** : les gabarits (`src/data/gabarits.json`) restent des FACTEURS
   (`sl`/`st`/`legs`/`arms`/`head`) appliqués à CE canon — la structure d'emboîtement est
   préservée par homothétie (les branches `legs≠1`/`arms≠1` de `baseSkeleton` échelonnent
   longueur ET pivots enfants ensemble, même invariant).

## Étendue et suites

- **P3 livre le gabarit humain principal (`moyen`)** ; les autres gabarits héritent du canon par
  leurs facteurs mais restent à VALIDER visuellement (extension après validation utilisateur).
- Dette connue : le facteur `head` (gremlins) agrandit l'os `tete` sans remonter son pivot — un
  gros crâne redescend le menton de `16×(head−1)` vers le col. À corriger dans la branche
  `head ≠ 1` de `baseSkeleton` quand ces gabarits passeront au canon.
- `applyBuild` fait varier `length` de ±2,5 % sans toucher les pivots : jeu absorbé par les
  recouvrements (col/ourlet ≥ 2 unités ; la main déborde de ~2 unités sur le bas de l'avant-bras).
