/**
 * AUDIT du LITTÉRAL == JETON dans les tenues (#583 point 1) — définition UNIQUE, partagée par la
 * garde `src/gameIso/rig/parts/tenues/palette-literal.test.ts` et le régénérateur
 * `scripts/rig/regen-palette-literal-stock.mts`.
 *
 * Classe de défaut mesurée : un littéral hex (`fill`/`stroke`/`stop-color`, ou arrêt d'un dégradé
 * dérivé `url(#dg-<forme>-…)`, #1903 A3) qui vaut EXACTEMENT
 * (distance ZÉRO, insensible à la casse) une valeur déclarée dans la `palette` du MÊME def. Ce
 * littéral devait être le jeton `@<clé>` correspondant — quelle que soit la MATIÈRE peinte (chair,
 * cuir, tissu, plume…), la réponse mécanique est identique. Interdiction MÉCANISABLE SANS FAUX
 * POSITIF : on ne compare QUE contre les valeurs déclarées PAR LE MÊME def (jamais une distance
 * colorimétrique globale, faux positifs confirmés #583).
 *
 * Cas fondateur vérifié (#583) : `Messager` bras.front utilise `@peau`/`@peauO` correctement, mais
 * bras.back/bras.profile recopient `#e2b48c`/`#8c4a28` — exactement `peau`/dérivés de `peauO` du
 * même def. Idem `Naufrageur` (`#8a4f2a` == son `peauO`), `Bailli` (panache de plume == `@peauH`/
 * `@peauO` — CE cas confirme que la matière n'importe pas : plume ou peau, même faute).
 *
 * Ne scanne QUE les TENUES avec une `palette` déclarée non vide (rien à comparer sinon).
 *
 * Un SITE par OCCURRENCE (`{ fichier, ref: '<id>:<slot>:<vue>', occurrence }`), et non un par
 * `slot:vue` (#583 morsure du juge, 2026-07-18) : un `break` au premier match dans une vue DÉJÀ
 * fautive masquait toute occurrence NEUVE ajoutée dans un slot:vue déjà au stock (40 littéraux
 * injectés dans `archer:torse:front`, déjà stocké → 0 clé neuve, garde verte à tort).
 *
 * ⚠ Angle mort résiduel de l'occurrence (mesuré, pas grave — la dette n'augmente pas, la classe est
 * déjà stockée) : c'est un RANG dans l'ordre d'apparition, pas une empreinte du littéral lui-même.
 * Remplacer UN littéral fautif par UN AUTRE littéral fautif (toujours == une valeur de `palette`,
 * hex différent) laisse le COMPTE et l'ORDRE inchangés → `neuves=0, perimees=0`, garde verte, alors
 * que le contenu fautif a changé sous la même clé. Cette classe-là (substitution fautif→fautif)
 * n'est PAS couverte par ce détecteur ; seule la DISPARITION d'une occurrence (littéral → jeton)
 * fait bouger le compte.
 */
import { fichierDeDef, REGISTRE_TENUES } from './registreDeDefs';
import { TENUE_DEFS } from '../../../src/gameIso/rig/parts/tenues/_registry.generated';
import type { TenueDef } from '../../../src/gameIso/rig/parts/tenues/types';
import type { PartArt } from '../../../src/gameIso/rig/parts/types';
import { slugId } from '../../../src/data/slug';

export const BODY_SLOTS = ['torse', 'jambes', 'bras', 'tete'] as const;
export type BodySlot = (typeof BODY_SLOTS)[number];
export const VIEWS = ['front', 'back', 'profile'] as const;
export type View = (typeof VIEWS)[number];

const LITERAL = /(?:fill|stroke|stop-color)\s*=\s*("|')(#[0-9a-fA-F]{3,8})\1|url\(#dg-[a-z0-9]+((?:-(?:@[a-zA-Z]\w*|#[0-9a-fA-F]{6}))+)\)/g;

/** Littéraux hex d'une correspondance de `LITERAL` : l'attribut, ou chaque arrêt littéral d'un `dg-`. */
const litterauxDe = (m: RegExpExecArray): string[] => (m[2] ? [m[2]] : m[3].split('-').filter((a) => a.startsWith('#')));

function viewsOf(art: PartArt): Partial<Record<View, string>> {
  return typeof art === 'string' ? { front: art } : art;
}

/** Le fichier de def d'une tenue : la résolution PARTAGÉE par identité d'objet sur l'index généré
 *  (`registreDeDefs.ts`), servie ici par la description `REGISTRE_TENUES`. */
export const fichierDeTenue = (def: TenueDef): string => fichierDeDef(REGISTRE_TENUES, def);

/**
 * Un SITE par occurrence d'un littéral == une valeur de la `palette` du même def, dans l'ordre du
 * balayage : `{ file: <le def qui porte la faute>, ref: '<tenueId>:<slot>:<vue>' }`. C'est la forme
 * de site que `sitesEnEntrees` (guards/lib/stock.mjs) ordinalise en entrées nominatives. Le FICHIER
 * est dans la clé parce qu'un stock ne se relit pas sans lui : c'est lui que la
 * porte de plage voit, et lui que l'artiste doit ouvrir pour solder.
 */
export function sitesPaletteLiteral(defs: readonly TenueDef[] = TENUE_DEFS): { file: string; ref: string }[] {
  const sites: { file: string; ref: string }[] = [];
  for (const def of defs) {
    const palette = def.palette;
    if (!palette) continue;
    const hexSet = new Set(Object.values(palette).map((v) => v.toLowerCase()));
    if (hexSet.size === 0) continue;
    const id = slugId(def.label);
    for (const slot of BODY_SLOTS) {
      const art = def.set[slot];
      if (art == null) continue;
      for (const [view, svg] of Object.entries(viewsOf(art))) {
        if (!svg) continue;
        LITERAL.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LITERAL.exec(svg)))
          for (const hex of litterauxDe(m)) if (hexSet.has(hex.toLowerCase())) sites.push({ file: fichierDeTenue(def), ref: `${id}:${slot}:${view}` });
      }
    }
  }
  return sites;
}

/** Le MOTIF du volet, dernière phrase du refus de `refusDeCroissance` (`stock.mjs`). */
export const MOTIF_PALETTE_LITERAL =
  "Un nouveau def qui recopie un littéral == jeton se corrige (le jeton), il ne s'entérine pas ici.";
