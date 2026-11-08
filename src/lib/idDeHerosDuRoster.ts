declare const marqueDuHerosDuRoster: unique symbol;

/** L'id d'un héros de roster (#2907) : forgé par l'entropie de la plateforme (`FabriqueDuRoster`,
 *  `src/engine/fabriqueDId.ts`), ou celui d'un pré-tiré (`idDuPretire`). Le roster traverse parties, sessions et sièges :
 *  son id ne vient d'aucun compteur. */
export type IdDeHerosDuRoster = string & { readonly [marqueDuHerosDuRoster]: true };
