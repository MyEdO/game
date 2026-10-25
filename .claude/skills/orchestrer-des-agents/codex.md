# Régime Codex

Annexe du skill `orchestrer-des-agents` (`.claude/skills/orchestrer-des-agents/SKILL.md`). Constat et
mesures : #2989 (Régime Codex de l'orchestrateur : corps du codeur, juge de diff, garde du retrait de
garde).

Une session Codex du pont (`scripts/ops/session.mjs`) suit sa consigne à la lettre (utilisateur,
2026-10-25 : « Les codex sont des modeles moins bon que ton modele. Si tu leur donne de mauvaises
instructions, ils vont les suivre, contrairement aux sessions claude. Donc assure toi bien de fourni a
Codex des demandes bien cadré »).

- **Deux Codex en vol au plus** (utilisateur, 2026-10-25, choix « 2 au plus »).
- **Avant le brief, l'analyse écrite** (utilisateur, 2026-10-25 : « Tu réponds du tac au tac, sans
  aucune analyse », puis « En faite j'ai l'impression que ni toi, ni codex, n'analyse quoi que ce
  soit ») : problème, cause, options, choix confronté au DoD du ticket et au credo. J'ouvre le code et
  le `Source/` qu'elle cite ; un rendu de Codex n'en tient pas lieu. Tant que je ne sais pas l'écrire,
  aucun brief ne part.
- **Le brief commence par cette analyse**, puis suit l'étape 2 (Brief) de `SKILL.md` en entier, et
  porte les consignes de `.claude/agents/codeur.md` tant que le pont ne les transmet pas (#2989 lot 2),
  hors la forme du rendu.
- **Le rendu commence par le raisonnement de Codex** (ce qu'il a compris du but, ce qu'il a écarté et
  pourquoi), puis les données brutes : pour un brief Codex, cette forme remplace « rendu final =
  données brutes » de l'étape 2 et de `codeur.md`. Ses preuves ne remplacent pas la lecture du diff.
- **Le train de l'étape 3 devient, pour un diff Codex** (utilisateur, 2026-10-25, choix « Juge Claude +
  moi ») : diff → juge de diff → ma relecture → commit → push.
  1. Le `juge` lit le diff contre le credo et le DoD, sans ma conclusion, découpé selon l'étape 3
     au-delà de 10 fichiers.
  2. Je relis son verdict ET le diff, et je confronte chaque point du credo.
  Un seul défaut renvoie le lot, quelles que soient ses preuves vertes.
- **Une correction se décide comme un brief neuf** (utilisateur, 2026-10-25 : « C'est tout de même dans
  le credo, avec tes reactions au tac au tac, tu pousse a entretenir la dette, voir a l'empirer, plutot
  que la réduire. ») : le DoD se relit d'abord, jamais une rustine écrite sur le dernier rendu.
