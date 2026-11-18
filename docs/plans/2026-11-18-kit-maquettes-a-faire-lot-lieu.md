# À intégrer au lot « lieu et voyage » (2026-11-18, demande de l'utilisateur)

Ticket: #4411


- Écran unique de la nuit (fenêtre `repos`) : nuit-a-l-auberge + bivouac (voir doublons.md).
- Un seul panneau « Qui dort où » pour les deux états : lits d'une chambre (auberge) ou places sous une tente
  (bivouac), portraits posés dedans, ceux qui restent dehors à part. Aujourd'hui : chambre en panneau à l'auberge,
  couchage par carte de héros au bivouac (incohérent).
- Y remettre ce qui était sorti à cause du moteur, s'il passe le filtre (règles, embellit, cohérent) : abri de
  fortune (Survie en extérieur, LDB 09 l.554), sac de couchage (+20 au froid, LDB 74 l.60), choix tente / belle
  étoile (LDB 74 l.62). Renvois : dette-verifiee.md C9, C10 ; transversal.md § 4D.

# Lot « captures du jeu en 16:9 » (courrier #4462, 2026-11-18)
- #4464 fusionnée : vue de base 1575 × 720 sur main ; merger main dans chantier/4411-kit APRÈS le lot 3.
- Passer `bureau` (scripts/recette/vues-recette.json) à 1920 × 1080 ⇒ vue de base 1280 × 720 (formule de la garde
  planches.hors-store.test.ts) ; reposer les étalons ; coordonnées en dur de hotes/godot/recette.mjs
  (640,400 / 900,360 / 1000,360) à revoir ; voiles d'immersion a priori bons.
