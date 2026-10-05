# Correctifs des dépendances

## TypeScript 7.0.2 — décodeur WTF-8

Le constructeur de `Wtf8Decoder` configure `TextDecoder` avec `ignoreBOM: true`. Sans cette option, le texte d'une source perd son BOM initial tandis que ses positions natives le comptent ; les littéraux perdent aussi un caractère U+FEFF placé au début d'un segment décodé. La sonde native de `scripts/guards/contrat-typescript.mjs` vérifie le texte original, les littéraux, les positions et les diagnostics.

Le correctif est appliqué avant les générateurs par le contrat d'installation. Celui-ci vérifie la version exacte, l'empreinte du patch, son application par Git et la sonde native. Une répétition accepte seulement un patch dont l'inverse est applicable. Les tests couvrent aussi l'installation initiale et les refus. Git est déjà requis par les hooks du dépôt ; aucun paquet supplémentaire n'est nécessaire.

Évaluation d'ingénierie du 2026-10-04 : conserver ce correctif jusqu'à une version amont dont le décodeur satisfait les mêmes témoins sans patch. Lors de cette mise à jour, supprimer le patch et son mécanisme d'application, conserver les témoins de texte et de positions, puis valider une installation fraîche et le périmètre AST/Checker. Une hausse de version seule ne justifie pas de retirer les témoins.

Références : [TextDecoder — Node.js](https://nodejs.org/api/util.html#new-textdecoderencoding-options), [git apply](https://git-scm.com/docs/git-apply).
