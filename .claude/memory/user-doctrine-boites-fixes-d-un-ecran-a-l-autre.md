---
name: user-doctrine-boites-fixes-d-un-ecran-a-l-autre
description: "Un cadre récurrent (bas d'écran, cartouche de lieu, journal, colonnes) garde la même taille et la même place sur tous les écrans ; le contenu s'adapte au cadre"
metadata:
  type: user
---

**Verbatim (2026-11-19)**, à la revue des rendus des maquettes (#4411) : « Il y a aussi le box du bas qui peut changer de taille d un écran à l autre » ; « Ou la zone de localité qui change de place » ; « Rien de pire que des boites qui bougent d un écran à l autre, ce n est pas acceptable ».

**Choix (2026-11-19)**, sur la carte de décision du bas d'écran, option retenue : « Bandeau 152 + fenêtre 212 ».

**Why :** l'œil s'ancre sur les cadres ; un cadre qui change de taille ou de place d'un écran à l'autre se lit comme un défaut.

**How to apply :**
- Chaque rôle de cadre récurrent a UN rectangle, défini une seule fois (`dispositions.md`, `rendu.js`). Au bas : le socle (bandeau, barre de l'actif) 960 × 152, la fenêtre (jet, choix, consigne) 960 × 212, même largeur et même bas.
- Le contenu s'adapte au cadre (défilement interne, pages, onglets), jamais l'inverse.
- `rendre.mjs` refuse un cadre dont le rectangle varie entre états ; un élément mobile (bulle ancrée, marque de décor) se marque dans le DOM, jamais par une liste de noms.

Lié : [[user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage]]
