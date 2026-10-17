---
name: aborder-un-sujet
description: À utiliser quand une demande est ambiguë (plusieurs approches, but en partie non dit, plusieurs modules, décision d'architecture) et doit être cadrée avant d'agir. Lève l'ambiguïté sans solliciter l'utilisateur, écrit le plan, le fait juger par une instance neuve, prouve et livre.
---
<!-- GENERATED: agents:sync; source=.claude/skills/aborder-un-sujet/SKILL.md -->

# Aborder un sujet

Méthode du guide Claude Certified Architect (Foundations), mise en œuvre avec les mécanismes de la
doc officielle. Posture : tu es le praticien certifié et l'utilisateur intervient le
moins possible. Tu cadres, planifies et vérifies toi-même ; tu ne le sollicites que pour ce qui lui
appartient. Les conventions du dépôt ou du projet (AGENTS.md, credo, instructions de projet)
restent en vigueur : cette méthode dit comment aborder la demande, pas quoi coder.

## 1. Qualifier avant le premier geste

Écris, dans ton statut ou ton premier fichier de notes, une ligne pour chacun :

- **But réel** : à quoi sert le résultat, pas seulement ce qui a été nommé. « Je veux un manteau » :
  pour quel usage, quel climat, quel budget ?
- **Livrable** : sa forme, où il atterrit, qui le lit.
- **Critère de fini** : la preuve qui dira que c'est réussi.
- **Contraintes déjà tranchées** : ce que la demande, la mémoire, les doctrines et les tickets
  imposent. Relis-les avant de décider quoi que ce soit.
- **Irréversible** : ce qui ne pourra pas être défait (déploiement en production, push direct ou
  forcé sur la branche principale, suppression, message envoyé hors du projet). La publication par
  branche, PR et file de fusion n'en fait pas partie : elle est autonome.

## 2. Agir tout de suite, ou cadrer d'abord

Le critère est l'**ambiguïté**, pas la difficulté
([guide 3.4](https://claudecertificationguide.com/learn/3-claude-code-config/3-4-plan-mode-execution)).

**Agir tout de suite** quand le changement tient en une phrase, que l'approche est connue et le
périmètre limité, même si le travail est difficile : fais, prouve, livre.

**Cadrer d'abord** dès qu'un signal est présent : plusieurs approches valables, but en partie non dit,
plusieurs fichiers ou modules, décision d'architecture, domaine mal connu, coût élevé d'une mauvaise
direction. La complexité visible dans l'énoncé se cadre tout de suite, sans attendre qu'elle surgisse.

## 3. Cadrer sans solliciter

1. **Explorer sans rien modifier.** L'exploration bavarde part dans un sous-agent en lecture seule
   (Explore, ou l'agent de lecture du dépôt) qui ne rend qu'un résumé ; ton contexte reste propre.
2. **Lever l'ambiguïté toi-même**, dans cet ordre, et arrête-toi à la première source qui tranche :
   - ce que la demande, la mémoire, les doctrines et l'historique des tickets disent déjà ;
   - ce que le code, les données ou les sources prouvent, mesuré plutôt que supposé ;
   - sinon, l'option la plus réversible et la plus fidèle au but réel, écrite comme **hypothèse**
     dans le plan et dans le livrable.
3. **Écrire un plan court** : étapes, livrable, critère de fini, hypothèses, hors périmètre.
4. **Faire juger le plan** par une instance neuve (sous-agent sans ta conversation, critères écrits
   dans son prompt) dès qu'il touche plusieurs modules ou tranche une décision structurante. Intègre
   ses objections fondées, puis exécute.
5. **Exécuter jusqu'au bout**, sans relancer l'utilisateur à chaque étape.

## 4. Ce qui revient à l'utilisateur, et rien d'autre

- **Un geste irréversible** : déploiement en production, push direct ou forcé sur la branche
  principale, suppression, envoi hors du projet. Il attend son accord explicite.
- **Un choix d'objectif que rien ne tranche** et qui change le livrable : goût, budget, priorité
  produit, règle de jeu sans réponse dans les sources.

Même alors : une décision par question, posée avec l'outil de la surface (`AskUserQuestion` dans
Codex, carte de décision dans un fil de Projet), des options d'une ligne et ta recommandation
en tête. Tout ce qui est réversible et ne dépend pas de la réponse continue en attendant ; ce qui en
dépend attend. Ne demande jamais ce que tu peux trouver en lisant ou en mesurant.

## 5. Découper selon la nature du travail

- **Travail prévisible** : une suite fixe d'étapes, chacune vérifiée.
- **Travail ouvert** (audit, exploration, débogage) : un plan qui évolue avec les découvertes ; note
  les trouvailles dans un fichier dès le début pour qu'elles survivent au contexte
  ([guide 1.6](https://claudecertificationguide.com/learn/1-agentic-architecture/1-6-task-decomposition),
  [guide 5.4](https://claudecertificationguide.com/learn/5-context-management/5-4-codebase-exploration)).
- **Beaucoup d'éléments** : une passe par élément, puis une passe d'ensemble ; au-delà de quelques
  agents, un workflow.
- **Chaque sous-agent** reçoit dans son prompt tout ce qu'il doit savoir : but, contraintes,
  résultats des phases précédentes. Il n'hérite pas de ta conversation.

## 6. Fixer les critères avant de juger

Avant d'évaluer, relire ou trier : ce qu'on signale, ce qu'on ignore, un exemple par gravité. Jamais
« signale ce qui est important »
([guide 4.1](https://claudecertificationguide.com/learn/4-prompt-engineering/4-1-system-prompts)).

## 7. Prouver avant de livrer

- Une preuve exécutée : tests, sortie de commande, scénario déroulé, source citée. Ce qui n'a pas été
  vérifié se dit comme tel.
- Tout livrable qui compte est relu par une instance neuve avec les critères de l'étape 6, jamais
  par la session qui l'a produit
  ([guide 4.6](https://claudecertificationguide.com/learn/4-prompt-engineering/4-6-multi-pass-review)).

## 8. Livrer, puis retenir

- La réponse d'abord, puis ce qui est prouvé et comment, puis les hypothèses prises, puis ce qui
  attend l'utilisateur, s'il y a quelque chose.
- Une correction que l'utilisateur a dû faire va dans la mémoire, avec sa citation et sa date.
- Une règle qui doit tenir à chaque fois devient un hook ou une permission, pas une consigne de plus
  ([features-overview](https://code.claude.com/docs/en/features-overview#compare-similar-features)).
