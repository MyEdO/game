/**
 * Pièces graphiques reprises du kit des maquettes (branche `chantier/4585-catalogue`, commit cfff50879,
 * `hotes/godot/cibles/propositions/sources/gestes.js`) : bustes en silhouette, pictogrammes, textures de matière.
 */
const NS = 'http://www.w3.org/2000/svg';

/** Bustes, `viewBox` 0 0 78 90 : silhouette à la teinte du camp, détails sombres `.s`, clairs `.c`. */
export const BUSTES: Record<string, string> = {
  "berta": "<path d=\"M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z\"/><path d=\"M24 31c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z\" class=\"s\"/><path d=\"M52 33c7 9 7 22 2 33l-6-3c4-10 4-19-1-27z\" class=\"s\"/>",
  "gobelin": "<path d=\"M18 90c0-14 8-20 17-22l-1-5c-8-4-11-13-8-21 3-8 23-8 26 0 3 8 0 17-8 21l-1 5c9 2 17 8 17 22z\"/><path d=\"M27 45L5 34l20 21zM51 45l22-11-20 21z\"/><path d=\"M24 47c-2-16 5-27 15-31 10 4 17 15 15 31-10-6-20-6-30 0z\" class=\"s\"/>",
  "orc": "<path d=\"M4 90c0-22 11-30 25-32l-1-6c-8-5-11-17-7-26 4-9 32-9 36 0 4 9 1 21-7 26l-1 6c14 2 25 10 25 32z\"/><path d=\"M21 33c7-6 29-6 36 0l-3 5c-9-4-21-4-30 0z\" class=\"s\"/><path d=\"M29 54l-2-11 6 8zM49 54l2-11-6 8z\" class=\"c\"/>",
  "bjorn": "<path d=\"M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z\"/><path d=\"M24 31c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z\" class=\"s\"/>",
  "mira": "<path d=\"M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z\"/><path d=\"M22 40c-3-17 5-29 17-29s20 12 17 29c4 10 4 22 2 33l-8-6c2-10 1-20-3-27-4-5-12-5-16 0-4 7-5 17-3 27l-8 6c-2-11-2-23 2-33z\" class=\"s\"/>",
  "aldric": "<path d=\"M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z\"/><path d=\"M25 30c0-11 6-18 14-18s14 7 14 18c-9-4-19-4-28 0z\" class=\"s\"/><path d=\"M25 27c9-4 19-4 28 0v5c-9-4-19-4-28 0z\" class=\"c\"/>",
  "greta": "<path d=\"M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z\"/><circle cx=\"39\" cy=\"8\" r=\"6.500\" class=\"s\"/><path d=\"M24 33c-1-13 6-21 15-21s16 8 15 21c-4-7-9-10-15-10s-11 3-15 10z\" class=\"s\"/>",
  "astrid": "<path d=\"M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z\"/><path d=\"M21 26c1-9 9-15 20-14 9 1 15 6 14 13-11-3-23-3-34 1z\" class=\"s\"/><path d=\"M23 34c-1 8 0 16 2 22l5-3c-2-7-2-13 0-19zM55 34c1 8 0 16-2 22l-5-3c2-7 2-13 0-19z\" class=\"s\"/>",
  "kirsten": "<path d=\"M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z\"/><path d=\"M23 36c-3-15 5-25 16-25s19 10 16 25l-3 8c1-9-1-17-4-20-5-4-13-4-18 0-3 3-5 11-4 20z\" class=\"s\"/>",
  "harbull": "<path d=\"M16 90c0-15 8-21 19-23l-1-6c-8-4-11-14-7-22 4-8 20-8 24 0 4 8 1 18-7 22l-1 6c11 2 19 8 19 23z\"/><path d=\"M24 40c-3-13 4-22 15-22s18 9 15 22c-2-7-8-10-15-10s-13 3-15 10z\" class=\"s\"/>",
  "sigrid": "<path d=\"M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z\"/><path d=\"M22 34c-2-14 6-23 17-23s19 9 17 23c-3-8-9-12-17-12s-14 4-17 12z\" class=\"s\"/><path d=\"M36 13h6v12h-6zM31 17h16v4H31z\" class=\"c\"/>",
  "ilyanwe": "<path d=\"M16 90c0-17 7-25 19-27l-2-8c-6-5-8-15-5-23 3-8 19-8 22 0 3 8 1 18-5 23l-2 8c12 2 19 10 19 27z\"/><path d=\"M25 37l-10-10 10 3zM53 37l10-10-10 3z\"/><path d=\"M21 41c-3-17 5-30 18-30s21 13 18 30c4 10 5 23 3 36l-9-7c2-10 1-21-3-28-4-5-14-5-18 0-4 7-5 18-3 28l-9 7c-2-13-1-26 3-36z\" class=\"s\"/>"
};

/** Pictogrammes au trait, `viewBox` 0 0 24 24. */
export const PICTOS: Record<string, string> = {
  "route": "<circle cx=\"12\" cy=\"12\" r=\"8.500\"/><path d=\"M15.500 8.500l-2 5-5 2 2-5z\"/>",
  "chope": "<path d=\"M6 7h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 7c0-2 2-3 3.500-2C10.500 3.500 13 3.500 13.500 5c1.500-.5 2.500.5 2.500 2\"/>",
  "soin": "<path d=\"M9.500 4h5v5.500H20v5h-5.500V20h-5v-5.500H4v-5h5.500z\"/>",
  "croix": "<path d=\"M6 6l12 12M18 6L6 18\"/>",
  "epee": "<path d=\"M6 18L17 7l2-3-3 2L5 17zM8 13l3 3M4 20l2-2\"/>",
  "carte": "<path d=\"M3.500 6l5.500-2 6 2 5.500-2v14l-5.500 2-6-2-5.500 2zM9 4v14M15 6v14\"/>",
  "pieces": "<ellipse cx=\"12\" cy=\"7\" rx=\"7\" ry=\"3\"/><path d=\"M5 7v5c0 1.700 3.100 3 7 3s7-1.300 7-3V7M5 12v5c0 1.700 3.100 3 7 3s7-1.300 7-3v-5\"/>",
  "bourse": "<path d=\"M9 7h6l-1-3h-4zM9 7c-3 2.500-4.500 5.500-4.500 8.500 0 3 3 4.500 7.500 4.500s7.500-1.500 7.500-4.500c0-3-1.500-6-4.500-8.500\"/>",
  "tente": "<path d=\"M12 4L3 20h18zM12 4v-1.500M12 11l-3.500 9M12 11l3.500 9\"/>",
  "lit": "<path d=\"M3 18V7M3 15h18v3M21 15v-3a2 2 0 0 0-2-2h-8v5M5 12.500a1.800 1.800 0 1 0 3.600 0a1.800 1.800 0 1 0-3.600 0\"/>",
  "couronne": "<path d=\"M4 18h16M4 18L3 8l5 4 4-7 4 7 5-4-1 10\"/>",
  "bouclier": "<path d=\"M12 3l7.500 2.500v5.500c0 4.800-3.200 8-7.500 9.500-4.300-1.500-7.500-4.700-7.500-9.500V5.500z\"/>",
  "sablier": "<path d=\"M7 3h10M7 21h10M8.500 3c0 5 7 6.500 7 9s-7 4-7 9M15.500 3c0 5-7 6.500-7 9s7 4 7 9\"/>",
  "lune": "<path d=\"M19 14.500A8 8 0 0 1 9.500 5a8 8 0 1 0 9.500 9.500z\"/>",
  "feu": "<path d=\"M12 21c-4 0-6.500-2.500-6.500-6 0-3 2-4.500 3-7 1.500 1 2 2.500 2 4 1.500-2 2.500-5 1.500-8.500 4 2 6.500 6 6.500 11 0 4-2.500 6.500-6.500 6.500z\"/>",
  "ville": "<path d=\"M4 20V9l2-2 2 2v3h3V6l3-2.500L17 6v6h3v8zM4 20h16M13 9.500h2M7 14h.01M13 14h2\"/>",
  "oeil": "<path d=\"M2.500 12C5 7.500 8.300 5.500 12 5.500s7 2 9.500 6.500c-2.500 4.500-5.800 6.500-9.500 6.500S5 16.500 2.500 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  "balance": "<path d=\"M12 4v16M7 20h10M4 8h16M4 8l-2 6a3.200 3.200 0 0 0 6 0L6 8M20 8l-2 6a3.200 3.200 0 0 0 6 0l-2-6\" transform=\"translate(-.5 0) scale(.96)\"/>",
  "des": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2.500\"/><circle cx=\"8.500\" cy=\"8.500\" r=\".8\"/><circle cx=\"15.500\" cy=\"15.500\" r=\".8\"/><circle cx=\"12\" cy=\"12\" r=\".8\"/><circle cx=\"15.500\" cy=\"8.500\" r=\".8\"/><circle cx=\"8.500\" cy=\"15.500\" r=\".8\"/>",
  "enclume": "<path d=\"M4 8h13c0 2-1.500 3.500-4 3.500v3.500h3v4H7v-4h3v-3.500C7 11.500 4 10.500 4 8zM17 8h3.500\"/>",
  "livre": "<path d=\"M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6\"/>",
  "etoile": "<path d=\"M12 3l2.300 6.200 6.700.3-5.200 4.100 1.800 6.400L12 16.300 6.400 20l1.800-6.400L3 9.500l6.700-.3z\"/>"
};

export const picto = (nom: string, taille = 22, trait = 1.6): string =>
  `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PICTOS[nom] ?? ''}</svg>`;

export const portrait = (buste: string, camp: 'heros' | 'ennemi', taille: 'petit' | 'moyen' | 'grand' = 'moyen', classe = ''): string =>
  `<div class="portrait ${camp === 'heros' ? 'laiton' : 'fer'} ${camp} ${taille} ${classe}"><div><svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${BUSTES[buste] ?? BUSTES.bjorn}</svg></div></div>`;

/** Les textures de bois et de parchemin, posées en variables CSS (`--tex-bois`, `--tex-parchemin`). */
export function poserLesTextures(): void {
  const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  document.documentElement.style.setProperty('--tex-bois', url(`<svg xmlns='${NS}' width='600' height='300'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.22' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.30  0.9 0.9 0.9 0 -0.75'/></filter><rect width='100%' height='100%' fill='#c9a57a'/><rect width='100%' height='100%' filter='url(#f)'/></svg>`));
  document.documentElement.style.setProperty('--tex-parchemin', url(`<svg xmlns='${NS}' width='500' height='400'><filter id='a' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='4' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.16  0.9 0.9 0.9 0 -0.95'/></filter><filter id='b' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' fill='#fff'/><rect width='100%' height='100%' filter='url(#a)'/><rect width='100%' height='100%' filter='url(#b)'/></svg>`));
}

const FERRURES = '<i class="ferrure hg"></i><i class="ferrure hd"></i><i class="ferrure bg"></i><i class="ferrure bd"></i>';

/** Le cadre de chêne ferré du kit, son fond (`bois` sombre ou `parchemin`) et son ruban de titre. */
export const cadre = (contenu: string, { ruban = '', fond = '', classe = '', balise = 'section' } = {}): string =>
  `<${balise} class="cadre bois ${classe}"><div class="fond ${fond}">${contenu}</div>${FERRURES}${ruban ? `<div class="ruban gothique">${ruban}</div>` : ''}</${balise}>`;

/** La plaque du kit en bouton : repos laiton, `armee` (l'appel principal), `fermee` (désactivée). */
export const plaque = (libelle: string, attrs: string, { armee = false, fermee = false, icone = '', prix = '', taille = 'moyenne', titre = '' } = {}): string =>
  `<button type="button" class="plaque ${fermee ? 'fer fermee' : 'laiton'} ${taille}${armee ? ' armee' : ''}" ${attrs}${fermee ? ' disabled' : ''}${titre ? ` title="${titre}"` : ''}><div>${icone ? picto(icone, 19, 1.7) : ''}<span>${libelle}</span>${prix ? `<span class="prix chiffres">${prix}</span>` : ''}</div></button>`;

/** Le médaillon du kit : un rond à pictogramme. */
export const medaillon = (nom: string, taille: 'grand' | 'moyen' | 'petit' = 'moyen', ferme = false): string =>
  `<div class="medaillon ${ferme ? 'fer ferme' : 'laiton'} ${taille}"><div>${picto(nom, { grand: 27, moyen: 20, petit: 15 }[taille])}</div></div>`;

/** La jauge du kit (`cire` : la vie). */
export const jauge = (part: number, { teinte = 'cire', taille = 'fine' } = {}): string =>
  `<div class="jauge ${teinte} ${taille}"><i style="width:${Math.max(0, Math.min(1, part)) * 100}%"></i></div>`;

/** Le bouton rond du kit, à pictogramme, et son libellé dessous (l'« outil » du kit). */
export const rond = (nom: string, libelle: string, attrs: string, taille: 'moyen' | 'grand' = 'grand'): string =>
  `<button type="button" class="outil" ${attrs}><span class="bouton-rond laiton ${taille}"><span>${picto(nom, taille === 'grand' ? 24 : 20)}</span></span><span class="libelle">${libelle}</span></button>`;
