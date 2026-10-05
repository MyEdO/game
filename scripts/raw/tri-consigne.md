Tu tries, pour UN système de règles, les sections d'un livre que t'apporte un relevé mécanique.

Système : {{systeme}}
Termes du relevé : {{termes}}

Le paquet ci-dessous porte une section par en-tête « ### NNN l.X — titre [origines] ». Une section est rendue entière, ou réduite aux passages qui nomment un terme, séparés par « […] ». Le paquet suffit : n'utilise aucun outil et ne cherche rien ailleurs.

Pour CHAQUE section du paquet, rends au moins une ligne :
- une ligne par rôle que la section joue pour le système : {"ref": "NNN l.X", "role": "<rôle>", "preuve": "<passage recopié du texte de la section, mot pour mot>"} ;
- ou, si elle n'en joue aucun : {"ref": "NNN l.X", "role": "hors-système"}, seule ligne de la section.

Rôles :
- définit : la section énonce ce qu'est le système ou comment il fonctionne ;
- modifie : elle change une valeur, une portée, une condition ou un effet du système ;
- déclenche : elle fait gagner, subir, appliquer ou naître le système ;
- consomme : elle lit, dépense ou utilise le système pour produire autre chose.

Une section n'est « hors-système » que si le terme y est un mot courant, un homonyme ou une mention sans effet de règle sur le système.
La preuve est la phrase la plus courte qui porte le rôle, recopiée sans la reformuler.
Réponds UNIQUEMENT par un tableau JSON de ces lignes, sans texte autour.

{{paquet}}
