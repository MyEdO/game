<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-sessions/codex.md -->
# Régime Codex

Annexe du skill `orchestrer-des-sessions` (`.agents/skills/orchestrer-des-sessions/SKILL.md`). Constat
et mesures : #2989 (Régime Codex de l'orchestrateur : corps du codeur, juge de diff, garde du retrait de
garde). Doctrine : fiche `.claude/memory/user-doctrine-orchestrateur-de-sessions-max5.md`.

Une session Codex du pont (`scripts/ops/session.mjs`) suit sa consigne à la lettre : une mauvaise
instruction est exécutée telle quelle.

- **Avant la consigne, l'analyse écrite** : problème, cause, options, choix confronté au DoD du ticket et
  au credo. J'ouvre le code et le `Source/` qu'elle cite ; un rendu de Codex n'en tient pas lieu. Tant
  que je ne sais pas l'écrire, aucune consigne ne part.
- **La consigne commence par cette analyse**, puis suit le cycle du skill `orchestrer-des-sessions`.
  Codex y orchestre ses agents comme une session Claude (types `.codex/agents/`).
- **Le rendu commence par le raisonnement de Codex** (ce qu'il a compris du but, ce qu'il a écarté et
  pourquoi), puis les données brutes. Ses preuves ne remplacent pas la lecture du diff.
- **Le train d'un diff Codex** : diff → juge de diff → ma relecture → commit → push.
  1. Le `juge` lit le diff contre le credo et le DoD, sans ma conclusion, découpé selon l'étape 3 du
     skill `orchestrer-des-agents` au-delà de 10 fichiers.
  2. Je relis son verdict ET le diff, et je confronte chaque point du credo.
  Un seul défaut renvoie le lot, quelles que soient ses preuves vertes.
- **Une correction se décide comme une consigne neuve** : le DoD se relit d'abord, jamais une rustine écrite
  sur le dernier rendu.
