/**
 * SOCLE QUADRUPÈDE — cliquets des TROIS VUES (#1082, Lot 0 : instrumentation).
 *
 * Trois contrats, tous adossés à la table publiée `QUAD_Z` :
 *
 *  (a) DÉCORS MORTS — un couple `deco`×os×vue déclaré par une def mais JAMAIS émis par
 *      l'assemblage de cette vue : le décor est silencieusement perdu. Le stock est GELÉ
 *      nominativement et son plafond ne peut que décroître (plancher visé : 0). Un couple mort
 *      qui n'est pas dans le stock = régression. La POPULATION mesurée (les couples applicables)
 *      est gelée nominativement elle aussi : un couple applicable ne disparaît légitimement que
 *      si l'os porte désormais un art dans cette vue (solde réel) ; supprimer la clé `deco` pour
 *      faire baisser le stock des morts (blanchiment) ou substituer un couple à un autre rougit.
 *
 *  (b) ORDRE DES OS PAR VUE — la liste (os, z) triée par plan, figée depuis `QUAD_Z`. Tout
 *      changement d'ordre rougit. Ce snapshot SERA mis à jour intentionnellement au Lot 1
 *      (z par vue : crâne/nuque, ailes, cavalier) — la mise à jour se fait avec la table.
 *
 *  (c) SOURCE UNIQUE — le squelette (les 3 vues) et le couple monté (cavalier, harnachement)
 *      lisent leurs plans dans `QUAD_Z` ; aucun littéral de z ne subsiste dans `quadSkeleton.ts`
 *      ni `mountedRig.ts`.
 *
 * Les MESURES chiffrées (parité de silhouette, occlusion, ligne de sol, débords) ne sont pas ici :
 * elles sont l'état courant du socle, rapportées par `scripts/qc/quad-vues.mts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CREATURES, QUAD_SPECIES, WINGED_SPECIES } from '../creatures';
import { QUAD_Z, quadZOrder, QUAD_DECO_PLAN_MAX } from './quadZ';
import { quadDecoCouples, APPLICABLES_GELES, quadDecoDefs, quadLayersSvg, DECO_VIEWS } from './deco-stock.fixture';
import { DECOS_MORTS_RATCHET, DECOS_SANS_PLAN_RATCHET } from '../../../../scripts/guards/lib/quadDecoStock.mjs';
import { ecartDuVolet, remedeNomme, type EntreeNominative } from '../../../../scripts/guards/lib/stock.mjs';
import { fichierDeEspece } from '../../../../scripts/guards/lib/quadDecoAudit';
import { resolveQuad, resolveQuadFromProps } from './composeQuad';
import { buildQuadSkeleton, quadSkeletonForView, type QuadBoneId, type QuadProps } from './quadSkeleton';
import { quadParts, quadDecoFragments, quadAnchor } from './quadParts';
import { QUAD_HARNAIS, DEFAUT_HARNAIS_MONTE } from './harnais';
import { QUAD_REST } from './quadPose';
import { riderZForQuad } from '../mountedRig';
import { rigFxGradients } from '../fxGradients';
import type { ResolvedBone } from '../composeRig';
import type { View } from '../facing';

const VIEWS: View[] = ['profile', 'front', 'back'];
const quadDefs = CREATURES.filter((c) => c.quad).map((c) => ({ id: c.id, quad: c.quad as QuadProps }));

/** Plan de fragment HORS du voisinage admis de son os : au-delà de la borne, ou non fini
 *  (`NaN`/`±Infinity` — toute comparaison avec `NaN` est fausse, la valeur passerait sinon). */
const STOCK = 'scripts/guards/lib/quadDecoStock.mjs';
/** Les couples du stock, en clés `<espèce> <vue> <clé>` — la forme que les sondes de rendu lisent. */
const MORTS = DECOS_MORTS_RATCHET.map((e) => e.ref);

/** Cliquet générique par la primitive PARTAGÉE du dépôt : sites hors stock = neuves, entrées que
 *  plus aucun couple ne porte = périmées. Aucun PLAFOND — ce qu'une dette ne peut pas faire, c'est
 *  croître SANS SE DÉCLARER, et c'est l'entrée `{ fichier, ref, occurrence }`, qui NOMME la def de
 *  créature, que la porte de plage voit à l'append. */
const ratchet = (couples: readonly string[], stock: Iterable<EntreeNominative>) =>
  ecartDuVolet({ sites: couples.map((c) => ({ file: fichierDeEspece(c.split(' ')[0]), ref: c })), stock, ou: STOCK });

const planHorsBorne = (plan: number): boolean =>
  !Number.isFinite(plan) || Math.abs(plan) > QUAD_DECO_PLAN_MAX;

// ── (a) DÉCORS MORTS, PLANS NON DÉCLARÉS ────────────────────────────────────────────────────
// Le DÉTECTEUR (`quadDecoCouples`) vit dans `deco-stock.fixture.ts` — source unique, partagée avec
// le CONTRAT `quad-anchor-contract.test.ts` qui, lui, rougit sur tout couple mort NOUVEAU ; le
// fixture porte aussi les deux listes GELÉES que les gardes lisent telles quelles
// (`APPLICABLES_GELES`, la population applicable ; `ANCRES_OEIL_ABSENTES_GELEES`, au CONTRAT).
// Les trois stocks nominatifs `{ fichier, ref, occurrence }` vivent dans
// `scripts/guards/lib/quadDecoStock.mjs` (`DECOS_MORTS_RATCHET`, `DECOS_SANS_PLAN_RATCHET`,
// `REPERES_ART_PROPRES_RATCHET`), importés ci-dessus — jugés par l'ÉCART NOMINATIF (`ecartDuVolet`).

/** L'os d'un couple porte-t-il un art dans cette vue ? (art émis = le décor n'est plus perdu) */
function artEmis(couple: string): boolean {
  const [id, view, cle] = couple.split(' ') as [string, View, string];
  const def = quadDefs.find((d) => d.id === id);
  if (!def) return false;
  const os = cle.split('#')[0] as QuadBoneId;
  return !!quadParts({ ...def.quad, deco: undefined }, view)[os];
}

describe('décors MORTS : le stock gelé ne peut que décroître (#1082)', () => {
  it('la mesure porte sur une population réelle', () => {
    const { applicables } = quadDecoCouples();
    expect(quadDefs.length).toBeGreaterThan(20);
    expect(applicables.length).toBeGreaterThan(50);
  });

  it('aucun couple mort NEUF, et aucune entrée PÉRIMÉE — le stock est nominatif, sans plafond', () => {
    const { neuves, perimees } = ratchet(quadDecoCouples().morts, DECOS_MORTS_RATCHET);
    expect(neuves, `décor NEUF peint nulle part — câbler l'os ou créer l'art, jamais stocker :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `entrée du stock des morts dont l'os est désormais émis — la retirer\n` +
      `(npx tsx scripts/rig/regen-quad-deco-stock.mts) :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  /** ALLONGER le stock ne s'échange plus contre un plafond relevé : une entrée de plus se DÉCLARE,
   *  parce qu'elle nomme un fichier — la garde la voit PÉRIMÉE, la porte de plage la voit à l'append. */
  it('ALLONGER le stock rougit : une entrée que plus aucun couple ne porte est PÉRIMÉE', () => {
    const gonfle = [...DECOS_MORTS_RATCHET, {
      fichier: 'src/gameIso/rig/creatures/defs/BeteQuiNExistePas.ts', ref: 'gonflement back encolure', occurrence: 1,
    }];
    const { perimees } = ratchet(quadDecoCouples().morts, gonfle);
    expect(remedeNomme(perimees, ' :: gonflement back encolure :: 1')).toBe(true);
    expect(remedeNomme(perimees, 'entrée SOLDÉE')).toBe(true);
  });

  it('aucun couple applicable GELÉ n\'a disparu sans que son art soit émis', () => {
    const { applicables } = quadDecoCouples();
    const disparus = APPLICABLES_GELES.filter((c) => !applicables.includes(c) && !artEmis(c));
    expect(disparus, 'couple applicable retiré sans art émis dans la vue : blanchiment du stock des morts').toEqual([]);
  });
});

/**
 * LOI DU CANAL `deco` — la PREUVE que `artEmis` invoque, rendue rejouable (#1082, vague P1b).
 *
 * `quadParts` n'appose un calque de décor que sur un os qui porte DÉJÀ un art dans la vue courante
 * (« un os sans art n'affiche pas de décor flottant »). C'est cette loi — et elle seule — qui rend
 * un couple `deco`×os×vue MORT quand la vue n'émet pas l'os, et donc qui autorise à retirer un tel
 * couple des stocks gelés : le retrait est un SOLDE (le décor ne peignait rien), jamais un
 * blanchiment. Sans ce test, l'affirmation « ce couple était mort » restait une mesure d'atelier,
 * non rejouable : le stock pouvait être vidé sur parole.
 *
 * Mesure par TÉMOIN, sur le chemin de rendu RÉEL (`resolveQuadFromProps`), les deux sens à la fois :
 * un contrôle NÉGATIF vacuerait si le témoin lui-même n'arrivait jamais au markup, donc le contrôle
 * POSITIF est mesuré sur la même population, au même appel.
 */
const TEMOIN_DECO = '<path data-temoin="1" d="M0 0 L9 0 L9 9 L0 9 Z" fill="#ff00ff"/>';
const rendu = (quad: QuadProps, view: View): string =>
  resolveQuadFromProps(quad, view, {}).map((b: ResolvedBone) => b.parts.map((p) => p.svg).join('')).join('');

describe('canal `deco` : un décor ne vit que sur un os que la vue ÉMET (#1082)', () => {
  // Os de CORPS communs aux trois vues au socle : la population du témoin. Les os de membre
  // porteraient la même loi, ils n'apportent aucun cas de figure de plus.
  const OS_TEMOINS: QuadBoneId[] = ['tronc', 'encolure', 'tete', 'queue'];

  it('os NON émis par la vue → le décor ne peint RIEN (contrôle négatif)', () => {
    const fuites: string[] = [];
    let mesures = 0;
    for (const { id, quad } of quadDefs)
      for (const view of VIEWS)
        for (const os of OS_TEMOINS) {
          if (quadParts({ ...quad, deco: undefined }, view)[os]) continue; // os émis → cf. contrôle positif
          mesures++;
          if (rendu({ ...quad, deco: { [os]: TEMOIN_DECO } }, view).includes('data-temoin'))
            fuites.push(`${id} ${view} ${os}`);
        }
    // Plancher de POPULATION : sans lui, un socle qui se mettrait à émettre tous les os viderait ce
    // contrôle de son contenu et le laisserait passer À VIDE — la loi ne serait plus mesurée.
    // 80 couples au 2026-08-06, dont `encolure` en front/back sur les espèces sans art de cou de
    // bout : c'est ce cas-là que les sorties de stock des lots bovin puis équin invoquent.
    expect(mesures, 'population du contrôle négatif').toBeGreaterThan(50);
    expect(fuites, 'décor émis sur un os que la vue ne porte pas : la loi du canal ne tient plus').toEqual([]);
  });

  it('os ÉMIS par la vue → le décor peint BIEN (contrôle positif : le témoin n\'est pas inerte)', () => {
    const muets: string[] = [];
    let mesures = 0;
    for (const { id, quad } of quadDefs)
      for (const view of VIEWS)
        for (const os of OS_TEMOINS) {
          if (!quadParts({ ...quad, deco: undefined }, view)[os]) continue;
          mesures++;
          if (!rendu({ ...quad, deco: { [os]: TEMOIN_DECO } }, view).includes('data-temoin'))
            muets.push(`${id} ${view} ${os}`);
        }
    expect(mesures).toBeGreaterThan(100); // la population du contrôle positif est réelle
    expect(muets, 'décor perdu sur un os que la vue porte pourtant').toEqual([]);
  });
});

/**
 * Le stock des MORTS est une DETTE MESURÉE, ligne à ligne — pas une liste d'exceptions (#1128 L5).
 *
 * Un couple mort ne peint rien : la clé qui le porte peut donc être RÉTRÉCIE aux vues qu'elle
 * habille réellement, sans qu'un octet du rendu bouge. Ce test le vérifie POUR CHAQUE entrée
 * restante : chacune devient un solde immédiatement praticable, et le jour où l'une cesse d'être
 * byte-neutre, c'est que l'os s'est mis à porter un art dans cette vue — la ligne est alors à
 * relire, pas à garder par habitude. C'est la sonde qui a autorisé le solde 8 → 4 de ce lot,
 * rendue REJOUABLE au lieu de rester une mesure d'atelier ; son TÉMOIN INVERSÉ (2ᵉ `it`) refuse
 * qu'elle passe à vide : sur les couples VIVANTS, le même retrait DOIT changer le rendu.
 */
describe('stock des MORTS : chaque entrée est une dette soldable BYTE-NEUTRE (#1128 L5)', () => {
  const parId = () => new Map(quadDecoDefs().map((d) => [d.id, d.quad]));
  /** La même déco, PRIVÉE du couple (clé × vue) : clé `os#vue` retirée, clé nue réduite aux autres
   *  vues, À SA PLACE dans l'objet (l'ordre des clés décide de l'empilement des calques d'un os). */
  const sansCouple = (deco: NonNullable<QuadProps['deco']>, cle: string, vue: View): NonNullable<QuadProps['deco']> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(deco)) {
      if (k !== cle) { out[k] = v; continue; }
      if (k.includes('#')) continue; // clé déjà visée à une vue : le couple EST la clé
      for (const autre of DECO_VIEWS) if (autre !== vue) out[`${k}#${autre}`] = v;
    }
    return out as NonNullable<QuadProps['deco']>;
  };

  it('retirer un couple MORT de sa clé ne change RIEN au rendu des trois vues', () => {
    const defs = parId();
    const ecarts: string[] = [];
    let mesures = 0;
    for (const couple of MORTS) {
      const [id, vue, cle] = couple.split(' ') as [string, View, string];
      const quad = defs.get(id);
      expect(quad, `${couple} : def introuvable — entrée périmée du stock`).toBeTruthy();
      const etroite: QuadProps = { ...quad!, deco: sansCouple(quad!.deco!, cle, vue) };
      for (const v of VIEWS) {
        mesures++;
        if (rendu(quad!, v) !== rendu(etroite, v)) ecarts.push(`${couple} → ${v}`);
      }
    }
    expect(MORTS.length, 'stock vide : la mesure passerait à vide').toBeGreaterThan(0);
    expect(mesures).toBe(MORTS.length * 3);
    expect(ecarts, 'couple déclaré MORT dont le retrait change le rendu : il peignait quelque chose').toEqual([]);
  });

  it('la sonde MORD : retirer un couple VIVANT change le rendu (témoin inversé)', () => {
    const defs = parId();
    const vivants = quadDecoCouples().applicables.filter((c) => !MORTS.includes(c));
    const muets: string[] = [];
    for (const couple of vivants) {
      const [id, vue, cle] = couple.split(' ') as [string, View, string];
      const quad = defs.get(id);
      if (!quad) continue;
      const etroite: QuadProps = { ...quad, deco: sansCouple(quad.deco!, cle, vue) };
      if (rendu(quad, vue) === rendu(etroite, vue)) muets.push(couple);
    }
    expect(vivants.length, 'population du témoin inversé').toBeGreaterThan(30);
    expect(muets, 'couple compté VIVANT dont le retrait ne change rien : il est mort et manque au stock').toEqual([]);
  });
});

// ── (a bis) PLANS DE DÉCOR NON DÉCLARÉS (transition N2) ─────────────────────────────────────
describe('décors SANS plan déclaré : stock nominatif, sans plafond (#1082)', () => {
  it('aucun couple sans plan HORS du stock, et aucune entrée PÉRIMÉE', () => {
    const { neuves, perimees } = ratchet(quadDecoCouples().sansPlan, DECOS_SANS_PLAN_RATCHET);
    expect(neuves, `décor authoré sans \`plan\` : le canal de calques attend un plan RELATIF à l'os :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `entrée du stock qui déclare désormais son plan — la retirer\n` +
      `(npx tsx scripts/rig/regen-quad-deco-stock.mts) :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it("chaque entrée NOMME la def de créature à ouvrir — c'est ce que la porte de plage voit", () => {
    const muettes = DECOS_SANS_PLAN_RATCHET.filter((e) => !/^src\/gameIso\/rig\/creatures\/defs\/.+\.ts$/.test(e.fichier));
    expect(muettes, `Entrées dont le \`fichier\` n'est pas un chemin de def : elles seraient INVISIBLES à\n` +
      `\`croissanceDesStocks\` :\n  ${JSON.stringify(muettes)}`).toEqual([]);
  });

  it('tout plan déclaré tient dans le voisinage de son os', () => {
    const hors: string[] = [];
    for (const { id, quad } of quadDefs) {
      for (const [cle, val] of Object.entries(quad.deco ?? {})) {
        if (!val) continue;
        for (const f of quadDecoFragments(val))
          if (f.plan != null && planHorsBorne(f.plan)) hors.push(`${id} ${cle} : plan=${f.plan}`);
      }
    }
    expect(hors, `un fragment de décor ne s'écarte pas de plus de ${QUAD_DECO_PLAN_MAX} du plan de son os`).toEqual([]);
  });

  it('la borne rejette aussi le plan NON FINI (NaN, ±Infinity)', () => {
    for (const plan of [NaN, Infinity, -Infinity, 0.5, -0.5, QUAD_DECO_PLAN_MAX + 0.01])
      expect(planHorsBorne(plan), `plan=${plan}`).toBe(true);
    for (const plan of [0, QUAD_DECO_PLAN_MAX, -QUAD_DECO_PLAN_MAX, 0.1])
      expect(planHorsBorne(plan), `plan=${plan}`).toBe(false);
  });
});

// ── (a ter) CONTRAT DU PLAN RELATIF : un fragment déclaré s'intercale ────────────────────────
describe('plan RELATIF d\'un fragment de décor : l\'os résolu se dédouble (#1082)', () => {
  const M = QUAD_DECO_PLAN_MAX;
  /** Props d'épreuve : la première def quadrupède du registre, décorée de deux fragments opposés. */
  const props = (): QuadProps => ({
    ...(quadDefs[0].quad),
    deco: { 'tete#back': [{ svg: '<g data-deco="derriere"/>', plan: -M }, { svg: '<g data-deco="devant"/>', plan: M }] },
  });

  it('un fragment à plan NÉGATIF est peint AVANT l\'art de son os, un plan POSITIF après', () => {
    const os = resolveQuadFromProps(props(), 'back').filter((b) => b.id === 'tete');
    expect(os.map((b) => b.z), 'trois plans distincts portés par le MÊME os').toEqual([
      QUAD_Z.tete.back - M, QUAD_Z.tete.back, QUAD_Z.tete.back + M,
    ]);
    expect(os[0].parts[0].svg).toContain('data-deco="derriere"');
    expect(os[1].parts[0].svg).toContain('rigCutQuadCrane'); // l'art de l'os, à son propre plan
    expect(os[2].parts[0].svg).toContain('data-deco="devant"');
  });

  it('la borne est STRICTEMENT sous l\'écart de deux plans d\'os voisins', () => {
    const ecarts: string[] = [];
    for (const view of VIEWS) {
      const zs = quadZOrder(view).map((o) => o.z);
      for (let i = 1; i < zs.length; i++)
        if (zs[i] !== zs[i - 1] && zs[i] - zs[i - 1] <= QUAD_DECO_PLAN_MAX) ecarts.push(`${view} ${zs[i - 1]}→${zs[i]}`);
    }
    expect(ecarts, 'deux plans d\'os voisins séparés d\'au plus la borne : un décor pourrait en ATTEINDRE un').toEqual([]);
  });

  // Les deux cas d'ÉGALITÉ possibles : de dos, `nuque` (4,5) et `tronc` (5) sont les deux plans les
  // plus proches de la table. Poussé À la borne, le fragment reste STRICTEMENT entre les deux — le
  // tri peintre (z seul) n'a aucune égalité à départager, et l'ordre d'émission des os ne décide rien.
  const zDe = (bones: ResolvedBone[], marque: string) =>
    bones.findIndex((b) => b.parts.some((p) => p.svg.includes(marque)));

  it('un fragment de `nuque` poussé à +borne reste SOUS le tronc (de dos)', () => {
    const bones = resolveQuadFromProps(
      { ...quadDefs[0].quad, deco: { 'nuque#back': [{ svg: '<g data-deco="haut"/>', plan: M }] } }, 'back');
    const i = zDe(bones, 'data-deco="haut"'), iTronc = bones.findIndex((b) => b.id === 'tronc');
    expect(bones[i].z, 'strictement sous le plan du tronc').toBeLessThan(QUAD_Z.tronc.back);
    expect(bones[i].z).toBe(QUAD_Z.nuque.back + M);
    expect(i, 'peint AVANT le tronc = masqué par lui').toBeLessThan(iTronc);
  });

  it('un fragment de `tronc` poussé à −borne reste AU-DESSUS de la nuque (de dos)', () => {
    const bones = resolveQuadFromProps(
      { ...quadDefs[0].quad, deco: { 'tronc#back': [{ svg: '<g data-deco="bas"/>', plan: -M }] } }, 'back');
    const i = zDe(bones, 'data-deco="bas"'), iNuque = bones.findIndex((b) => b.id === 'nuque');
    expect(bones[i].z, 'strictement au-dessus du plan de la nuque').toBeGreaterThan(QUAD_Z.nuque.back);
    expect(bones[i].z).toBe(QUAD_Z.tronc.back - M);
    expect(i, 'peint APRÈS la nuque = la masque').toBeGreaterThan(iNuque);
  });

  /**
   * OCCLUSION d'un décor de TÊTE en vue de DOS. L'art de tête y est scindé en deux calques portés
   * par deux os de plans opposés au tronc (`tete` 9 dessus, `nuque` 4,5 dessous) ; un décor apposé
   * sur `tete` reste ENTIER au plan du crâne, même la part de son dessin qui descend sous la ligne
   * de coupe (bride du cheval, museau du rat-géant). Le canal l'exprime : `nuque` PARTAGE l'ancre
   * de la tête (`quadAnchor`), donc le fragment qui appartient au raccord s'authore aux MÊMES
   * coordonnées et se déclare sur `nuque#back` — il passe alors sous le tronc.
   */
  it('un décor de tête de dos porté par `nuque` passe SOUS le tronc, aux coordonnées de l\'art de tête', () => {
    const p: QuadProps = { ...quadDefs[0].quad, deco: { 'nuque#back': '<g data-deco="raccord"/>' } };
    const bones = resolveQuadFromProps(p, 'back');
    const porteur = bones.filter((b) => b.parts.some((q) => q.svg.includes('data-deco="raccord"')));
    expect(porteur.map((b) => b.id), 'un seul os porte le décor').toEqual(['nuque']);
    expect(porteur[0].z, 'sous le tronc').toBeLessThan(QUAD_Z.tronc.back);
    const i = (id: string) => bones.findIndex((b) => b.id === id);
    expect(bones.indexOf(porteur[0]), 'peint AVANT le tronc = masqué par lui').toBeLessThan(i('tronc'));
    expect(quadAnchor(p, 'nuque', 'back'), 'même repère que l\'art de tête').toBe(quadAnchor(p, 'tete', 'back'));
  });

  /**
   * L'INVARIANT qui rend ce contrat authorable : un décor déclaré sur `nuque#back` s'écrit dans les
   * coordonnées de l'art de TÊTE. Cela ne tient que si l'os `nuque` est posé exactement là où l'est
   * `tete` — même matrice monde (placement/rotation issus de la FK) ET même échelle. Toute espèce
   * dont le pivot ou l'ancre de nuque dériverait ferait glisser tous ses décors de raccord.
   */
  it('de dos, `nuque` porte la MÊME matrice monde et la MÊME échelle que `tete`, pour TOUTE espèce', () => {
    const ecarts: string[] = [];
    const especes = { ...QUAD_SPECIES, ...WINGED_SPECIES } as Record<string, QuadProps>;
    expect(Object.keys(especes).length, 'population mesurée').toBeGreaterThan(20);
    for (const [espece, p] of Object.entries(especes)) {
      const bones = resolveQuadFromProps(p, 'back');
      const tete = bones.find((b) => b.id === 'tete'), nuque = bones.find((b) => b.id === 'nuque');
      if (!tete || !nuque) { ecarts.push(`${espece} : tete=${!!tete} nuque=${!!nuque}`); continue; }
      if (tete.matrix.join(',') !== nuque.matrix.join(','))
        ecarts.push(`${espece} : matrice tete=[${tete.matrix}] nuque=[${nuque.matrix}]`);
      if (tete.scale.join(',') !== nuque.scale.join(','))
        ecarts.push(`${espece} : échelle tete=[${tete.scale}] nuque=[${nuque.scale}]`);
    }
    expect(ecarts, 'la nuque doit rester le calque BAS de la tête, au même repère').toEqual([]);
  });
});

// ── (b) ORDRE DES OS PAR VUE ────────────────────────────────────────────────────────────────
// Mis à jour au Lot 1 (2026-08-05) : c'est le CODE qui a bougé (table `QUAD_Z`), pas le détecteur —
// os `nuque` ajouté (calque bas de la tête), ailes portées SUR le dos en vue de dos (2 → 6).
const ORDRE_ATTENDU: Record<View, string[]> = {
  profile: [
    'basArG:1', 'basAvG:1', 'hautArG:1', 'hautAvG:1', 'piedArG:1', 'piedAvG:1',
    'aileG:2', 'queue:3', 'croupe:4', 'tronc:5', 'aileD:6', 'encolure:6', 'nuque:6', 'tete:7',
    'basArD:9', 'basAvD:9', 'hautArD:9', 'hautAvD:9', 'piedArD:9', 'piedAvD:9',
  ],
  front: [
    'aileD:2', 'aileG:2', 'basArD:2', 'basArG:2', 'hautArD:2', 'hautArG:2', 'piedArD:2', 'piedArG:2', 'queue:2',
    'basAvD:4', 'basAvG:4', 'croupe:4', 'hautAvD:4', 'hautAvG:4', 'piedAvD:4', 'piedAvG:4',
    'tronc:5', 'encolure:8', 'nuque:8', 'tete:9',
  ],
  back: [
    'basAvD:2', 'basAvG:2', 'hautAvD:2', 'hautAvG:2', 'piedAvD:2', 'piedAvG:2',
    'basArD:4', 'basArG:4', 'croupe:4', 'hautArD:4', 'hautArG:4', 'piedArD:4', 'piedArG:4',
    'nuque:4.5', 'tronc:5', 'aileD:6', 'aileG:6', 'queue:6', 'encolure:8', 'tete:9',
  ],
};

/** Props minimales d'un quadrupède AILÉ (tous les os, ailes comprises). */
const PROPS_AILE: QuadProps = { ...(quadDefs.find((d) => d.quad.wings)?.quad as QuadProps) };

describe('ordre des os par vue : snapshot de la table publiée (#1082)', () => {
  for (const view of VIEWS) {
    it(`${view} — ordre peintre (os, z)`, () => {
      expect(quadZOrder(view).map((o) => `${o.id}:${o.z}`)).toEqual(ORDRE_ATTENDU[view]);
    });
  }

  it('le squelette RÉSOLU porte exactement les z de la table, dans les 3 vues', () => {
    const ecarts: string[] = [];
    for (const view of VIEWS) {
      const sk = quadSkeletonForView(buildQuadSkeleton(PROPS_AILE), view);
      for (const id of Object.keys(QUAD_Z) as QuadBoneId[]) {
        if (sk[id].z !== QUAD_Z[id][view]) ecarts.push(`${view} ${id} : squelette=${sk[id].z} table=${QUAD_Z[id][view]}`);
      }
    }
    expect(ecarts).toEqual([]);
  });
});

// ── (c) SOURCE UNIQUE DES PLANS ─────────────────────────────────────────────────────────────
const isComment = (l: string) => /^\s*(\/\/|\/\*|\*)/.test(l);
const codeOf = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
    .split(/\r?\n/)
    .filter((l) => !isComment(l));

const bone = (id: string, z: number): ResolvedBone =>
  ({ id, matrix: [1, 0, 0, 1, 60, 75], scale: [1, 1], parts: [], z }) as ResolvedBone;

describe('les plans de profondeur ne vivent QUE dans QUAD_Z (#1082)', () => {
  for (const rel of ['./quadSkeleton.ts', '../mountedRig.ts']) {
    it(`${rel} : aucun littéral \`z: <nombre>\``, () => {
      const fautifs = codeOf(rel).filter((l) => /\bz:\s*-?\d/.test(l));
      expect(fautifs).toEqual([]);
    });
  }

  it('au PROFIL, le cavalier s\'intercale entre sa jambe lointaine (sous le barillet) et sa jambe proche (au-dessus de la tête)', () => {
    const profil = riderZForQuad('profile');
    expect(profil(bone('cuisseG', 0))).toBe(4.5);  // jambe lointaine, sous le barillet (5)
    expect(profil(bone('torse', 0))).toBe(6.6);    // corps, au-dessus de l'encolure (6)
    expect(profil(bone('cuisseD', 0))).toBe(8.2);  // jambe proche, au-dessus de la tête (7)
  });

  // Le plan du cavalier se lit PAR VUE dans `QUAD_RIDER_Z` : chaque vue tient son propre contrat
  // d'intercalage (profil ci-dessus, dos et face ci-dessous).
  it('de DOS, le cavalier COUVRE la tête de sa monture et ses jambes passent derrière la croupe', () => {
    const dos = riderZForQuad('back');
    expect(dos(bone('torse', 0))).toBeGreaterThan(QUAD_Z.tete.back);
    for (const jambe of ['cuisseG', 'cuisseD', 'piedG', 'piedD']) {
      expect(dos(bone(jambe, 0)), `${jambe} doit passer derrière la croupe`).toBeLessThan(QUAD_Z.tronc.back);
    }
  });

  it('de FACE, le cavalier passe DERRIÈRE la tête redressée et ses jambes derrière le poitrail', () => {
    const face = riderZForQuad('front');
    expect(face(bone('torse', 0))).toBeLessThan(QUAD_Z.tete.front);
    expect(face(bone('torse', 0))).toBeGreaterThan(QUAD_Z.tronc.front);
    for (const jambe of ['cuisseG', 'cuisseD']) expect(face(bone(jambe, 0))).toBeLessThan(QUAD_Z.tronc.front);
  });

  // Ce que tient cette garde : le HARNACHEMENT est la déco d'un SET servi par la donnée. Tout
  // fragment du set arrive au canal déco de l'os qu'il chevauche, DANS LES TROIS VUES — à `plan`
  // dans le voisinage admis (aucun plan nouveau ouvert), et peint APRÈS l'art de la bête.
  it('le harnachement du set entre dans le PLAN de l\'os qu\'il chevauche, par-dessus la robe, DANS LES TROIS VUES', () => {
    const deco = QUAD_HARNAIS[DEFAUT_HARNAIS_MONTE].deco;
    const nu = (vue: View) => resolveQuad('cheval', vue, QUAD_REST, undefined, 'folded');
    const selle = (vue: View) => resolveQuad('cheval', vue, QUAD_REST, undefined, 'folded', undefined, DEFAUT_HARNAIS_MONTE);
    expect(Object.keys(deco).length, 'set sans déco : la mesure serait vide').toBeGreaterThan(0);
    const vuesCouvertes = new Set<View>();
    for (const [cle, val] of Object.entries(deco)) {
      const [os, vue] = cle.split('#') as [QuadBoneId, View | undefined];
      const fragments = quadDecoFragments(val!);
      for (const f of fragments) expect(Math.abs(f.plan ?? 0), `${cle} : plan hors voisinage`).toBeLessThanOrEqual(QUAD_DECO_PLAN_MAX);
      const v: View = vue ?? 'profile';
      vuesCouvertes.add(v);
      const avant = nu(v).filter((b) => b.id === os), apres = selle(v).filter((b) => b.id === os);
      expect(apres.map((b) => b.z), `${cle} : le set n'ouvre aucun plan nouveau`).toEqual(avant.map((b) => b.z));
      const plan0 = (bs: ResolvedBone[]) => bs.find((b) => b.z === QUAD_Z[os][v])!;
      const ajout = plan0(apres).parts.length - plan0(avant).parts.length;
      expect(ajout, `${cle} : les fragments du set n'arrivent pas au rendu`).toBe(fragments.length);
      // APRÈS l'art de la bête : les calques d'origine restent en tête, le harnais ferme la pile.
      expect(plan0(apres).parts.slice(0, plan0(avant).parts.length)).toEqual(plan0(avant).parts);
    }
    // La garde ne vaut que par sa COUVERTURE : un set qui perdrait ses vues de bout redeviendrait
    // muet de face et de dos sans qu'aucune boucle ci-dessus ne rougisse (elle n'itère que ce qui
    // est déclaré). Les trois vues sont donc exigées nominativement.
    expect([...vuesCouvertes].sort(), 'le set doit habiller les TROIS vues').toEqual(['back', 'front', 'profile']);
  });
});

// ── (d) SÉMANTIQUE DE LA VUE DE DOS (Lot 1) ─────────────────────────────────────────────────
/** Contenu du groupe `clip-path="url(#id)"` : l'art DÉCOUPÉ seul (le décor apposé après en est exclu). */
function clipContent(svg: string, id: string): string {
  const open = `<g clip-path="url(#${id})">`;
  const i = svg.indexOf(open);
  expect(i, `groupe découpé ${id} absent`).toBeGreaterThanOrEqual(0);
  const re = /<g\b|<\/g>/g;
  re.lastIndex = i + open.length;
  for (let m = re.exec(svg), depth = 1; m; m = re.exec(svg)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(i + open.length, m.index);
  }
  throw new Error(`groupe découpé ${id} non fermé`);
}

type Box = { x0: number; y0: number; x1: number; y1: number };
/**
 * Boîte englobante d'un art SVG dans SON repère (M/L/Q absolus et relatifs, `circle`, `ellipse`,
 * `translate` interne). SUR-ENSEMBLE assumé : les points de contrôle des Q comptent comme des
 * sommets. Toute autre commande ou transformation lève — l'art nouveau se mesure, il ne se devine pas.
 */
function bboxOf(svg: string): Box {
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (x: number, y: number) => {
    b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y);
  };
  let dx = 0, dy = 0;
  for (const [, t] of svg.matchAll(/transform="([^"]+)"/g)) {
    const m = /^translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/.exec(t);
    if (!m) throw new Error(`transformation non mesurée : ${t}`);
    dx = Math.max(dx, Math.abs(+m[1])); dy = Math.max(dy, Math.abs(+m[2]));
  }
  for (const [, d] of svg.matchAll(/d="([^"]+)"/g)) {
    const toks = d.match(/[A-Za-z]|-?[\d.]+/g) ?? [];
    let x = 0, y = 0, cmd = '', k = 0;
    const n = () => +toks[k++];
    while (k < toks.length) {
      if (/[A-Za-z]/.test(toks[k])) cmd = toks[k++];
      if (cmd === 'Z' || cmd === 'z') continue;
      const rel = cmd === cmd.toLowerCase(), px = rel ? x : 0, py = rel ? y : 0, c = cmd.toUpperCase();
      if (c === 'Q') { add(px + n(), py + n()); x = px + n(); y = py + n(); }
      else if (c === 'M' || c === 'L') { x = px + n(); y = py + n(); }
      else throw new Error(`commande de tracé non mesurée : ${cmd}`);
      add(x, y);
    }
  }
  const attr = (tag: string, a: string) => +(new RegExp(`${a}="(-?[\\d.]+)"`).exec(tag)?.[1] ?? 0);
  for (const [, tag] of svg.matchAll(/<circle([^>]*)>/g)) {
    const [cx, cy, r] = [attr(tag, 'cx'), attr(tag, 'cy'), attr(tag, 'r')];
    add(cx - r, cy - r); add(cx + r, cy + r);
  }
  for (const [, tag] of svg.matchAll(/<ellipse([^>]*)>/g)) {
    const [cx, cy, rx, ry] = [attr(tag, 'cx'), attr(tag, 'cy'), attr(tag, 'rx'), attr(tag, 'ry')];
    add(cx - rx, cy - ry); add(cx + rx, cy + ry);
  }
  return { x0: b.x0 - dx, y0: b.y0 - dy, x1: b.x1 + dx, y1: b.y1 + dy };
}

describe('vue de DOS : crâne au-dessus du tronc, nuque dessous, aile pliée SUR le dos (#1082)', () => {
  it('l\'art de tête de dos est scindé en DEUX calques portés par deux os de plans différents', () => {
    for (const { id, quad } of quadDefs) {
      const back = quadParts(quad, 'back');
      expect(quadLayersSvg(back.tete), `${id} : calque crâne`).toContain('clip-path="url(#rigCutQuadCrane)"');
      expect(quadLayersSvg(back.nuque), `${id} : calque nuque`).toContain('clip-path="url(#rigCutQuadNuque)"');
    }
    expect(QUAD_Z.nuque.back).toBeLessThan(QUAD_Z.tronc.back);
    expect(QUAD_Z.tete.back).toBeGreaterThan(QUAD_Z.tronc.back);
  });

  it('les deux découpes se PARTAGENT le plan de l\'art (complémentaires, et elles le COUVRENT)', () => {
    const rect = (id: string) => {
      const m = new RegExp(`id="${id}"[^>]*><rect x="(-?[\\d.]+)" y="(-?[\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"`).exec(rigFxGradients);
      expect(m, `clipPath ${id} absent des DEFS`).toBeTruthy();
      return { x: +m![1], y: +m![2], w: +m![3], h: +m![4] };
    };
    const crane = rect('rigCutQuadCrane'), nuque = rect('rigCutQuadNuque');
    expect(crane.y + crane.h, 'le bas du crâne = le haut de la nuque').toBe(nuque.y);
    expect(crane.x).toBe(nuque.x);
    expect(crane.w).toBe(nuque.w);
    // Couverture : l'art de tête de dos de CHAQUE espèce tient dans l'union des deux rects — un art
    // qui déborde serait amputé au rendu, il rougit ici.
    const union = { x0: crane.x, x1: crane.x + crane.w, y0: crane.y, y1: nuque.y + nuque.h };
    const debords: string[] = [];
    for (const { id, quad } of quadDefs) {
      const b = bboxOf(clipContent(quadLayersSvg(quadParts(quad, 'back').tete), 'rigCutQuadCrane'));
      if (b.x0 < union.x0 || b.x1 > union.x1 || b.y0 < union.y0 || b.y1 > union.y1)
        debords.push(`${id} : art x[${b.x0}..${b.x1}] y[${b.y0}..${b.y1}] hors de x[${union.x0}..${union.x1}] y[${union.y0}..${union.y1}]`);
    }
    expect(debords, 'l\'union des deux découpes doit couvrir l\'art de tête de dos').toEqual([]);
  });

  it('l\'os `nuque` ne porte d\'art QUE de dos (de face et de profil, la tête est entière)', () => {
    for (const { id, quad } of quadDefs) {
      for (const view of ['profile', 'front'] as View[]) {
        expect(quadParts(quad, view).nuque, `${id} ${view}`).toBeUndefined();
        expect(quadLayersSvg(quadParts(quad, view).tete), `${id} ${view}`).not.toContain('rigCutQuad');
      }
    }
  });

  it('l\'aile pliée repose SUR le dos de dos, et reste derrière le poitrail de face', () => {
    expect(QUAD_Z.aileD.back).toBeGreaterThan(QUAD_Z.tronc.back);
    expect(QUAD_Z.aileG.back).toBeGreaterThan(QUAD_Z.tronc.back);
    expect(QUAD_Z.aileD.front).toBeLessThan(QUAD_Z.tronc.front);
    expect(QUAD_Z.aileG.front).toBeLessThan(QUAD_Z.tronc.front);
  });
});
