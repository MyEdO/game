/**
 * DÉTECTEUR du canal `deco` du gabarit quadrupède (#1082), et les deux listes qui vivent ICI
 * — un seul détecteur (`quadDecoCouples`), deux gardes : le CONTRAT
 * (`quad-anchor-contract.test.ts` : une clé qui vise une vue sans art rougit ; c'est lui qui
 * consomme `ANCRES_OEIL_ABSENTES_GELEES`) et le CLIQUET (`quad-vues-ratchet.test.ts` : la
 * population APPLICABLE `APPLICABLES_GELES` ne se blanchit pas — un couple n'en sort que par un art
 * émis).
 *
 * Les TROIS stocks nominatifs `{ fichier, ref, occurrence }` vivent dans
 * `scripts/guards/lib/quadDecoStock.mjs` (`DECOS_MORTS_RATCHET`, `DECOS_SANS_PLAN_RATCHET`,
 * `REPERES_ART_PROPRES_RATCHET`) : la garde les juge par l'ÉCART NOMINATIF (`ecartDuVolet` —
 * neuves ET périmées), sans aucun plafond.
 *
 * Un COUPLE s'écrit `<espèce> <vue> <clé deco>` : c'est l'unité de mesure de tout ce fichier.
 * Ce module est un FIXTURE de test (jamais importé par le rendu) : il vit sous `src/` pour lire
 * le registre réel des créatures, à l'image de `src/scenes/test-fixture.ts`.
 */
import { CREATURES, QUAD_SPECIES, WINGED_SPECIES } from '../creatures';
import { QUAD_HARNAIS } from './harnais';
import { mergeQuadDeco } from './composeQuad';
import { quadParts, quadDecoFragments, type QuadLayer } from './quadParts';
import { readQuadDecoKey, type QuadProps } from './quadSkeleton';
import { VIEWS } from '../facing';

/** Art d'un os, calques concaténés dans l'ordre du peintre (plan croissant, tri STABLE) : ce que
 *  le rendu peint pour cet os, tous plans confondus — mesure de test (le rendu, lui, émet un os
 *  RÉSOLU par plan distinct, cf. `composeQuad`). */
export const quadLayersSvg = (ls?: QuadLayer[]): string =>
  [...(ls ?? [])].sort((a, b) => (a.plan ?? 0) - (b.plan ?? 0)).map((l) => l.svg).join('');

/**
 * Le dénominateur de toute mesure de ce module : les defs quadrupèdes/ailées du registre, ET les
 * SETS d'équipement (`harnais/`) — la déco d'un set est de la déco, soumise au MÊME contrat (os
 * émis par la vue, `plan` déclaré, repli dans le voisinage de l'os). Un set se mesure sur la
 * carrure de CHAQUE espèce qu'il déclare, sous la clé `<set>@<espèce>` : c'est l'assemblage que le
 * rendu produira (`resolveQuad`, fusion `mergeQuadDeco`).
 */
export const quadDecoDefs = (): { id: string; quad: QuadProps }[] => {
  const especes: Record<string, QuadProps> = { ...QUAD_SPECIES, ...WINGED_SPECIES };
  return [
    ...CREATURES.filter((c) => c.quad).map((c) => ({ id: c.id, quad: c.quad as QuadProps })),
    ...Object.values(QUAD_HARNAIS).flatMap((s) =>
      s.especes.flatMap((e) => (especes[e]
        ? [{ id: `${s.id}@${e}`, quad: { ...especes[e], deco: mergeQuadDeco(especes[e].deco, s.deco) } }]
        : []))),
  ];
};

export interface DecoCouples {
  /** Couples APPLICABLES : la clé vise cette vue (clé nue = les trois). */
  applicables: string[];
  /** Couples MORTS : l'os visé ne porte AUCUN art dans cette vue → le décor est perdu. */
  morts: string[];
  /** Couples VIVANTS dont au moins un fragment ne déclare pas son `plan`. */
  sansPlan: string[];
}

/** DÉTECTEUR UNIQUE des couples `deco`×os×vue, listes triées. */
export function quadDecoCouples(): DecoCouples {
  const applicables: string[] = [], morts: string[] = [], sansPlan: string[] = [];
  for (const { id, quad } of quadDecoDefs()) {
    if (!quad.deco) continue;
    for (const view of VIEWS) {
      const nu = quadParts({ ...quad, deco: undefined }, view);
      for (const [cle, val] of Object.entries(quad.deco)) {
        const { bone: os, views } = readQuadDecoKey(cle);
        if (!val || !views.includes(view)) continue;
        applicables.push(`${id} ${view} ${cle}`);
        if (!nu[os]) morts.push(`${id} ${view} ${cle}`);
        else if (quadDecoFragments(val).some((f) => f.plan == null)) sansPlan.push(`${id} ${view} ${cle}`);
      }
    }
  }
  return { applicables: applicables.sort(), morts: morts.sort(), sansPlan: sansPlan.sort() };
}

/**
 * Population GELÉE (mesurée le 2026-08-05, re-mesurée le 2026-08-06) : les 66 couples APPLICABLES,
 * dénominateur du stock des morts. Un couple ne quitte cette liste que par un art émis (solde réel)
 * — ou, nommément, par la preuve qu'il ne peignait RIEN. Sorties du 2026-08-06 : `boeuf back/front
 * encolure` sur la mesure du témoin (cf. `DECOS_MORTS_RATCHET`,
 * `scripts/guards/lib/quadDecoStock.mjs`) ; puis les cinq clés `deco`
 * bovines qui n'existent plus dans la def — `tete#back`, `tete#front` (l'art de tête est une part,
 * `quadruped/heads/defs/boeuf.ts`), `encolure`, `tete#profile`, `tronc#profile` (le PROFIL bovin est
 * un dessin entier compilé par os, `viewArt`). Restent les deux calques de modelé de bout.
 *
 * Sorties du 2026-08-06 (vague P1b-MASSE) — les SIX clés `deco` ÉQUINES, pour deux raisons
 * distinctes qu'il faut tenir séparées : `cheval back/front encolure` ne peignaient RIEN (mesure du
 * témoin, cf. `DECOS_MORTS_GELES`) ; `cheval profile encolure`/`profile tete` sont SOLDÉES par
 * l'art (le harnais et la bride sont peints dans le dessin entier de profil, sur l'os qu'ils
 * chevauchent) ; `cheval back/front tete` portaient la BRIDE — un art de PROFIL (têtière et
 * muserolle en diagonale, anneau de mors sur la joue) que les vues de bout affichaient TEL QUEL sur
 * un mufle vu de face. Ce couple-là émettait donc bien quelque chose, mais de faux : sa disparition
 * rend aux vues de bout le cheval NU, ce que la def annonçait déjà. Un art de bride vu de bout
 * appartient à la phase d'ART des vues front/back, il n'est pas rattrapable par un décor de profil.
 *
 * DÉMÉNAGÉS le 2026-08-06 (#1128 L5) : les clés `deco` CANINES et PÉGASES ne sortent pas par
 * disparition, elles CHANGENT DE PORTEUR — l'art d'équipement est passé aux sets
 * `harnais-de-guerre-canin` et `collier-dore-pegase`, mesurés sous `<set>@<espèce>` (rendu prouvé
 * byte-identique pour le record qui porte le set, retrait pur pour les records dénudés). Les quatre
 * couples `sellerie-imperiale@cheval` ENTRENT au même titre : la population mesurée les comptait
 * déjà (L2), cette liste ne les nommait pas — 66 énumérés pour 70 mesurés.
 *
 * Les QUATRE couples `<set> back/front encolure` ne sont PAS repris : la clé des deux sets vise
 * `encolure#profile`, elle ne réclame plus les vues de bout (solde du stock des morts,
 * 8 → 4, mesuré byte-neutre). Population : 70 → 66.
 */
export const APPLICABLES_GELES = [
  'blaireau back tete#back',
  'blaireau front tete#front',
  'blaireau front tronc#front',
  'blaireau profile tete#profile',
  'blaireau profile tronc#profile',
  'boeuf back tronc#back',
  'boeuf front tronc#front',
  'collier-dore-pegase@pegase profile encolure#profile',
  'grand-cerf back encolure',
  'grand-cerf back tete',
  'grand-cerf front encolure',
  'grand-cerf front tete',
  'grand-cerf profile encolure',
  'grand-cerf profile tete',
  'grand-cerf profile tete#profile',
  'griffon back basAvD',
  'griffon back basAvG',
  'griffon back hautArD',
  'griffon back hautArG',
  'griffon back hautAvD',
  'griffon back hautAvG',
  'griffon front basAvD',
  'griffon front basAvG',
  'griffon front hautArD',
  'griffon front hautArG',
  'griffon front hautAvD',
  'griffon front hautAvG',
  'griffon profile basAvD',
  'griffon profile basAvG',
  'griffon profile hautArD',
  'griffon profile hautArG',
  'griffon profile hautAvD',
  'griffon profile hautAvG',
  'harnais-de-guerre-canin@chien back tronc',
  'harnais-de-guerre-canin@chien front tronc',
  'harnais-de-guerre-canin@chien profile encolure#profile',
  'harnais-de-guerre-canin@chien profile tronc',
  'lion-de-guerre-de-chrace profile piedAvD#profile',
  'manticore back tete',
  'manticore front tete',
  'manticore profile queue#profile',
  'manticore profile tete',
  'preyton back tronc',
  'preyton front tronc',
  'preyton profile tronc',
  'rat-geant back tete',
  'rat-geant front tete',
  'rat-geant profile tete',
  'sanglier back encolure',
  'sanglier back tete#back',
  'sanglier front encolure',
  'sanglier front tete#front',
  'sanglier profile encolure',
  'sanglier profile tete#profile',
  'sanglier profile tronc#profile',
  'sellerie-imperiale@cheval back tronc#back',
  'sellerie-imperiale@cheval front tronc#front',
  'sellerie-imperiale@cheval profile tete#profile',
  'sellerie-imperiale@cheval profile tronc#profile',
  'varghulf back aileD',
  'varghulf back aileG',
  'varghulf front aileD',
  'varghulf front aileG',
  'varghulf profile aileD',
  'varghulf profile aileG',
  'varghulf profile tronc#profile',
];

/**
 * Stock GELÉ des arts de VUE dont la tête ne porte PAS l'ancre d'œil `data-eye`/`data-ec`
 * (mesuré le 2026-08-06 par la garde `quad-anchor-contract.test.ts`, section « art de VUE :
 * l'œil reste ANCRÉ pour le catalogue »). Conséquence exacte, vérifiée au contre-factuel :
 * `swapEye` n'y trouve aucun point d'accroche et rend l'art INCHANGÉ — le catalogue d'yeux est
 * sans effet sur l'espèce, sans erreur ni trace. Le stock est nominatif, son plafond ne peut que
 * décroître, et il ne tolère aucune entrée périmée (une ancre posée doit SORTIR d'ici).
 *
 * `boeuf profile` : l'étalon « bête entière par vue » a été dessiné avant que cette conséquence
 * soit mesurée — son œil est peint en dur dans `boeufCompile.ts`, module d'art compilé de l'espèce, keyé par vue (0 occurrence de
 * `data-eye`, vérifié à l'octet). Le solde est un geste d'ART sur le dessin bovin (poser le
 * groupe d'ancre autour du globe et du reflet, comme `cheval-profile.dessin.mts` le fait), donc
 * il appartient à la vague qui reprendra cette espèce, pas à un lot voisin.
 */
export const ANCRES_OEIL_ABSENTES_GELEES = [
  'boeuf profile',
];
export const PLAFOND_ANCRES_OEIL_ABSENTES = ANCRES_OEIL_ABSENTES_GELEES.length;
