<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-agents/codex.md -->
# Régime Codex

Annexe du skill `orchestrer-des-agents` (`.agents/skills/orchestrer-des-agents/SKILL.md`). Constat et
mesures : #2989 (Régime Codex de l'orchestrateur : corps du codeur, juge de diff, garde du retrait de
garde).

Une session Codex du pont (`scripts/ops/session.mjs`) suit sa consigne à la lettre (#2989).

- **Deux Codex en vol au plus** (fiche `user-doctrine-orchestrateur-de-sessions-max5`).
- **Avant le brief, l'analyse écrite** (#2989) : problème, cause, options, choix confronté au DoD du ticket et au credo. J'ouvre le code et
  le `Source/` qu'elle cite ; un rendu de Codex n'en tient pas lieu. Tant que je ne sais pas l'écrire,
  aucun brief ne part.
- **Le brief commence par cette analyse**, puis suit l'étape 2 (Brief) de `SKILL.md` en entier, et
  porte les consignes de `.claude/agents/codeur.md` tant que le pont ne les transmet pas (#2989 lot 2),
  hors la forme du rendu.
- **Le rendu commence par le raisonnement de Codex** (ce qu'il a compris du but, ce qu'il a écarté et
  pourquoi), puis les données brutes : pour un brief Codex, cette forme remplace « rendu final =
  données brutes » de l'étape 2 et de `codeur.md`. Ses preuves ne remplacent pas la lecture du diff.
- **Le train de l'étape 3 devient, pour un diff Codex** (fiche `user-doctrine-orchestrateur-de-sessions-max5`) : diff → juge de diff → ma relecture → commit → push.
  1. Le `juge` lit le diff contre le credo et le DoD, sans ma conclusion, découpé selon l'étape 3
     au-delà de 10 fichiers.
  2. Je relis son verdict ET le diff, et je confronte chaque point du credo.
  Un seul défaut renvoie le lot, quelles que soient ses preuves vertes.
- **Une correction se décide comme un brief neuf** (#2989) : le DoD se relit d'abord, jamais une rustine écrite sur le dernier rendu.
