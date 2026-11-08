// Le PRÉDICAT D'OBJET (#3117) : une valeur objet, ni `null` ni tableau — la forme d'un objet JSON lu. Module PUR sans
// import, en `.mjs` : le composent le code de `src/`, les scripts, les gardes et les migrations, dont la clôture
// statique de `npm run gates` ne porte aucun module TypeScript (`scripts/node-requis.test.mjs`, volet (b)). Garde :
// la construction `PREDICAT_D_OBJET` (`scripts/guards/lib/canonUnique.mjs`), aucune recopie hors de ce module.

/** `v` est-il un objet, ni `null` ni tableau ? @type {(v: unknown) => v is Record<string, unknown>} */
export const estObjet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
