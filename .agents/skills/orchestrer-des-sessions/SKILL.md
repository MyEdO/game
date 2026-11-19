---
name: orchestrer-des-sessions
description: Piloter plusieurs sessions de travail, du choix des tickets à la vérification de leur publication.
---
<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-sessions/SKILL.md -->

# Orchestrer des sessions

Cas courant, en cloud surtout : une session seule orchestre des agents sur son lot, sans ce skill. Celui-ci
ne sert qu'à la session qui en pilote plusieurs.

Doctrine `.claude/memory/user-doctrine-orchestration-des-sessions.md`.

## Rôles

- **Un seul orchestrateur de sessions.** Il attribue les tickets, lance les sessions, décide de leur
  suite et vérifie leur livraison. Il confie le travail des chantiers aux sessions exécutantes.
- **Même workflow pour chaque session.** Elle orchestre ses agents (skill `orchestrer-des-agents`)
  et mène son lot de bout en bout, de la prise du ticket au solde sur `main` après CI verte. Elle
  committe par chemins et publie elle-même par la file de fusion.
- **Affectation.** Appliquer la fiche `user-doctrine-fable-reserve-au-design` pour les sujets 3D et
  la conception de maquettes d'interface. Une session qui a besoin d'un autre lot soumet son brief
  à l'orchestrateur de sessions.

## Cycle

1. **Consigne.** Rédige-la dans `.git/suivi/consignes/<ticket>-<lot>.md` pour un lancement via
   `ops:session`, ou dans la demande de lancement cloud. Elle porte :
   - le lot : un ticket entier, ou un lot fermé, mené jusqu'à sa publication ; ses restes se corrigent
     dans le lot ou s'ouvrent en ticket, jamais rendus en question ;
   - le contexte, avec le ticket et son arbitrage à lire (`gh issue view N`) ;
   - pour chaque point, la CAUSE supposée et le CONTRAT à tenir, jamais une simple liste de tests à
     verdir ;
   - l'ouverture par le skill `orchestrer-des-agents`, et l'interdit d'ouvrir une session ;
   - le chemin absolu du worktree connu, ou le dépôt à ouvrir en cloud, les interdits git
     destructifs, la borne de 270 s par appel et le budget ;
   - les preuves attendues et la forme du rendu, avec une ligne « Friction : quoi · coût · outil ».
2. **Lancement.** Vérifie la tenue des tickets selon `se-coordonner-entre-comptes`. Démarre une
   session neuve dans l'environnement cloud du dépôt, ou dans son worktree créé par `ops:chantier`
   sur le poste. Pour Codex Cloud, passe `thinking: "high"` par défaut à `create_thread`.
   Avec le lanceur du dépôt, utilise
   `npm run ops:session -- lancer <consigne> --ticket <N> --agent <client> --worktree <chemin> --json`.
   Choisis un `--nom` unique si `s<N>` est pris. Conserve la sortie entière dans le scratchpad
   pour retrouver le jeton de fermeture. La session confirme sa prise sur le ticket avant de travailler.
3. **Veille.** Utilise les transitions du client cloud ou `attendre <id> --timeout-ms <n> --suivre`
   avec `ops:session` (`n` ≤ 3600000). Après une transition `inactif` ou une expiration, vérifie
   si le lot a rendu et reprends la veille depuis le dernier curseur si le travail continue.
4. **Retour.** Lis le rapport et libère la session. Avec `ops:session`, utilise `fermer <id>` et
   passe `{"jeton":"…"}` sur stdin. Démarre le lot suivant dans une session neuve. Utilise le nom
   ou l'UUID avec le lanceur pour identifier une session. `archiver` range les cartes sans session vivante.
5. **Vérification.** Relis la plage publiée et rejoue les preuves du rendu. Applique le jugement de
   diff et de fermeture quand il est dû selon `orchestrer-des-agents`. Un défaut part dans un lot neuf.
