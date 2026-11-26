/** Une lueur centrée en `(x, y)`, de rayon `r`, pleine de `force` en son centre ; `nom` : l'id de son dégradé. */
export const lueur = (nom: string, x: number, y: number, r: number, force: number) => `
    <defs><radialGradient id="${nom}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="var(--gold2)" stop-opacity="${force}"/><stop offset="1" stop-color="var(--gold2)" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${nom})"/>`;
