import { idDe, type Id, type TypeEntite } from './schemas/grammaire/ref';

/** L'id `id` de `type` tel que la donnée PARSÉE le porte (`Id<type>`), pour une FIXTURE : frappé par la porte
 *  zod (`idDe`), feuille OUVERTE — un id de fixture absent du registre y est admis, un id présent y reste jugé. */
export const idDeFixture = <T extends TypeEntite>(type: T, id: string): Id<T> => idDe(type, undefined, { ouverte: true }).parse(id);
