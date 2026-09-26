# Atlas RAW — Ré-ancrage des citations

> Déterministe (`node scripts/raw/reanchor.mjs` ; `--apply` réécrit les dérives HIGH). GATE (#434) :
> exit 1 sur dérive non appliquée, ambiguïté, ou hausse de réf FAUSSE (❌) — voir en-tête du script.
> Pour chaque citation verbatim « … » d'une fiche, on relocalise le texte dans le `.md` source
> courant et on vérifie le n° de ligne cité. ✅ juste · 🔧 dérive corrigée (HIGH, unique) · 🟡 ambigu
**Bilan : ✅ 499 · 🔧 0 dérives (relancer --apply) · 🟡 0 ambigus · ❌ 21 introuvables · ➖ 2838 synthèses** (⛔ 0 hors-fichier · ⚠️ 0 sans source) sur 3358 réfs · 520 citations · 28 fiches.

> (MEDIUM, manuel) · ❌ introuvable (LOW, paraphrase/mauvais chapitre) · ➖ synthèse (réf sans citation).

## avancement.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 07 l.43` | ❌ LOW | « votre carrière va influer sur son gain en expé… » — aucune occurrence |
| `LDB 07 l.84` | ❌ LOW | « gagner de l'argent… » — aucune occurrence |

## bestiaire.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 85 l.276-277` | ❌ LOW | « augmentez f et e de +10, et réduisez ag de -5 … » — aucune occurrence |
| `LDB 85 l.387` | ❌ LOW | « corps à corps (bagarre)… » — aucune occurrence |

## carrieres.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 07 l.84` | ❌ LOW | « gagner de l'argent… » — aucune occurrence |

## combat.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 13 l.184` | ❌ LOW | « lancer pour toucher de corps à corps étant un … » — aucune occurrence |
| `ADE II 04 l.215` | ❌ LOW | « funeste : l'arme est imprégnée de magie de mor… » — aucune occurrence |
| `ADE II 04 l.235` | ❌ LOW | « de coupure infinie : … si un coup de cette arm… » — aucune occurrence |
| `ADE II 04 l.237` | ❌ LOW | « de blessure grave : … il peut inverser les chi… » — aucune occurrence |
| `ZI 13 l.984` | ❌ LOW | « nuée - la nuée est considérée comme une seule … » — aucune occurrence |
| `AA 10 l.215` | ❌ LOW | « pierrier 20 co 5 rare 30 +14 dangereuse, recha… » — aucune occurrence |

## corruption.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 19 l.51-52` | ❌ LOW | « sur un échec, vous gagnez 2 points de corrupti… » — texte trouvé en LDB 21 l.54 |
| `LDB 17 l.67` | ❌ LOW | « je te renie !… » — aucune occurrence |

## creation.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 05 l.459` | ❌ LOW | « consultez votre carrière. recherchez dans le s… » — aucune occurrence |

## deplacement.md

| Réf | Statut | Détail |
|---|---|---|
| `MDG 15 l.76` | ❌ LOW | « distance/jour suppose un équipage permettant d… » — aucune occurrence |

## etats.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 46 l.66` | ❌ LOW | « 16-20 cérumen : vos oreilles se bouchent insta… » — aucune occurrence |
| `LDB 46 l.80` | ❌ LOW | « 56-60 drain de l'âme : gagnez 1 état exténué, … » — aucune occurrence |
| `LDB 46 l.102` | ❌ LOW | « 06-10 regard maudit : vous possédez 1 état ave… » — aucune occurrence |
| `LDB 46 l.126` | ❌ LOW | « 66-70 régurgitation : gagnez l'état sonné, qui… » — aucune occurrence |
| `NADJ 05 l.117` | ❌ LOW | « état fatigué… » — aucune occurrence |

## tests.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 17 l.68` | ❌ LOW | « "je ne faillirai pas !" : au lieu de lancer le… » — aucune occurrence |
<!-- sources-empreinte: 42689e8add64211622005783e538e735991c5db8 (218 fichiers, 15 dossiers) corps: 531f3e2a52dc0771f15fec363fd14b3a094b2af5 -->
