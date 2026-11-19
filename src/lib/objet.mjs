// Le PRÉDICAT D'OBJET (#3117) : une valeur objet, ni `null` ni tableau — la forme d'un objet JSON lu ; et la valeur
// d'une donnée à un chemin (`auChemin`), qu'il lit. Module PUR sans
// import, en `.mjs` : le composent le code de `src/`, les scripts, les gardes et les migrations, dont la clôture
// statique de `npm run gates` ne porte aucun module TypeScript (`scripts/node-requis.test.mjs`, volet (b)). Garde :
// les constructions `PREDICAT_D_OBJET` et `LECTURE_AU_CHEMIN` (`scripts/guards/lib/canonUnique.mjs`), aucune recopie
// hors de ce module.

/** `v` est-il un objet, ni `null` ni tableau ? @type {(v: unknown) => v is Record<string, unknown>} */
export const estObjet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

/** La valeur de `o` au chemin `chemin`, `undefined` hors de lui. @type {(o: unknown, chemin: readonly PropertyKey[]) => unknown} */
export const auChemin = (o, chemin) => chemin.reduce((v, pas) => (estObjet(v) || Array.isArray(v) ? v[pas] : undefined), o)
