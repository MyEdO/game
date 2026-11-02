export const ROLES_AMBIANTS = Object.freeze(['feeding', 'praying', 'cowering', 'standing', 'howling'] as const);
export type RoleAmbiant = (typeof ROLES_AMBIANTS)[number];
