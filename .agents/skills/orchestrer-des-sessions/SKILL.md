---
name: orchestrer-des-sessions
description: Piloter plusieurs sessions Claude ou Codex (`ops:session`) : lancer, briefer, surveiller, fermer, répartir les tickets.
---
<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-sessions/SKILL.md -->

# Orchestrer des sessions

Cas courant, en cloud surtout : une session seule orchestre des agents sur son lot, sans ce skill. Celui-ci
ne sert qu'à la session qui en pilote plusieurs.

Doctrine : fiche `.claude/memory/user-doctrine-orchestrateur-de-sessions-max5.md`.

## Rôles

- **Un seul orchestrateur de sessions.** Lui seul lance et ferme des sessions, Claude ou Codex. Il
  attribue les tickets, décide du sort des sessions en vol (finir, arrêter, relancer), et ne fait jamais
  le travail d'un chantier.
- **Il lance des orchestrateurs d'agents.** Toute session lancée, Claude ou Codex, orchestre des AGENTS
  sur son lot (skill `orchestrer-des-agents`), jamais des sessions. Elle dépêche ses codeurs, juges et
  recetteurs. Une session Claude committe par chemins sur sa branche ; une session Codex laisse son diff
  au train de l'annexe `codex.md`. Un lot qui exige une autre session se demande à
  l'orchestrateur, avec son brief. Une session ne reçoit jamais un brief de codeur : il la ferait
  coder seule au lieu de dépêcher ses agents.
- **Codex suit sa consigne à la lettre**, là où une session Claude corrige une consigne faible. Une
  consigne Codex se cadre donc plus serré : annexe `.agents/skills/orchestrer-des-sessions/codex.md`.

## Plafond

- Au plus 3 sessions en vol, dont au plus 2 Codex et au plus 2 Claude exécutantes. Les agents de
  l'orchestrateur comptent dans les 3.
- Avant tout lancement, compter les vivantes : `npm run ops:session -- lister`, en filtrant l'état
  `vivante`. Une session lancée par une autre session compte aussi.

## Cycle

1. **Consigne** : `.git/suivi/consignes/<ticket>-<lot>.md`. Elle porte toujours :
   - le contexte, avec le ticket et son arbitrage à lire (`gh issue view N`) ;
   - pour chaque point, la CAUSE supposée et le CONTRAT à tenir, jamais une simple liste de tests à
     verdir ;
   - l'ouverture par le skill `orchestrer-des-agents`, et l'interdit d'ouvrir une session ;
   - le worktree absolu, les interdits git, aucun appel de plus de 270 s, le budget ;
   - les preuves attendues et la forme du rendu, avec une ligne « Friction : quoi · coût · outil ».
2. **Lancement** : `npm run ops:session -- lancer <consigne> --ticket <N> --agent claude|codex --json`.
   Écris la sortie ENTIÈRE dans un fichier du scratchpad, sans filtre : elle porte le `jeton` que
   `fermer` exige, et seul son hachage est stocké. Un jeton perdu laisse la session vivante, sans
   moyen de la fermer.
3. **Veille** : `attendre <id> --timeout-ms <n> --suivre`, en fond, avec `n` ≤ 3600000 : au-delà, la
   commande refuse aussitôt sans rien surveiller.
4. **Retour** : lis le rapport et ferme la session dans le même geste (`fermer <id>`, jeton par stdin
   `{"jeton":"…"}`). Une session n'est jamais gardée au repos : son cache refroidit. Le lot suivant part
   dans une session NEUVE, jamais par `--resume` ni par un message à une session rendue. `archiver`
   range sous `sessions/archive/` les cartes en anomalie dont aucune identité ne vit.
5. **Vérification, par l'orchestrateur, jamais sur la foi du rapport** : relecture du diff, juge de diff
   Claude, puis commit par chemins, push et CI de branche (skill `orchestrer-des-agents`, annexes
   `publication.md` et `fermeture.md`). La consigne exige les preuves des effets à distance (étape 6 du
   même skill).
