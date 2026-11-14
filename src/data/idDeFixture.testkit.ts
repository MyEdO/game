import { idDe, type Id, type PorteeLocale, type TypeEntite } from './schemas/grammaire/ref';

/** Portée qu'aucun objet n'ouvre (`ouvrirPortees`) : sa feuille admet un id absent du registre sans le juger. */
const IDS_DE_FIXTURE = { collection: 'ids', catalogue: 'ids de fixture' } as const satisfies PorteeLocale;

/** L'id `id` de `type` tel que la donnée PARSÉE le porte (`Id<type>`), pour une FIXTURE : frappé par la porte
 *  zod (`idDe`), feuille à portée hors de tout ouvreur — un id de fixture absent du registre y est admis, un id présent y reste jugé. */
export const idDeFixture = <T extends TypeEntite>(type: T, id: string): Id<T> => idDe(type, undefined, { portee: IDS_DE_FIXTURE }).parse(id);
