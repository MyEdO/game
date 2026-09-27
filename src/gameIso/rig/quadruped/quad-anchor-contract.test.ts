import { describe, it, expect } from 'vitest';
import { CREATURES } from '../creatures';
import { quadParts } from './quadParts';
import { ANCRES_OEIL_ABSENTES_GELEES, PLAFOND_ANCRES_OEIL_ABSENTES } from './deco-stock.fixture';
import { DECOS_MORTS_RATCHET, REPERES_ART_PROPRES_RATCHET } from '../../../../scripts/guards/lib/quadDecoStock.mjs';
import { ecartDuVolet, remedeNomme, type EntreeNominative } from '../../../../scripts/guards/lib/stock.mjs';
import { mesureDesReperes, fichierDeEspece } from '../../../../scripts/guards/lib/quadDecoAudit';
import type { Site } from '../../../../scripts/guards/lib/stock.mjs';
import { applyEyes } from '../parts/eyes';
import type { QuadBoneId, QuadProps } from './quadSkeleton';
import type { View } from '../facing';

/**
 * Contrat du canal `deco` : `quadAnchor(p, os, vue)` EST le repère dans lequel vit l'art de cet os
 * pour cette vue. `quadParts` appose le décor via `quadAnchored` (même transform) — si l'art porte
 * un transform enveloppant que l'ancre ne reproduit pas, le décor authoré sur les coordonnées de
 * l'art atterrit ailleurs (repère implicite resté dans l'assemblage).
 * PÉRIMÈTRE du détecteur : (a) l'art de TÊTE de TOUTES les defs du registre (`OS_TETE`, avec ou
 * sans `deco` — un repère propre est une propriété de l'art, et l'échelle de tête étant portée par
 * l'os depuis `composeQuad`, c'est là que l'unité part↔os doit coïncider) ; (b) tout os visé par
 * une clé `deco`. Stock NOMINATIF `REPERES_ART_PROPRES_RATCHET` (`scripts/guards/lib/quadDecoStock.mjs`,
 * GÉNÉRÉ par `npx tsx scripts/rig/regen-quad-deco-stock.mts`), aucun plafond, aucune entrée périmée.
 * La MESURE vit dans `scripts/guards/lib/quadDecoAudit.ts` — partagée avec le régénérateur, pour
 * qu'aucun des deux n'ait sa propre lecture du corpus.
 */

const VIEWS: View[] = ['profile', 'front', 'back'];
const STOCK = 'scripts/guards/lib/quadDecoStock.mjs';

/** Cliquet générique : sites hors stock = neuves (échec) ; entrées que plus aucun site ne porte =
 *  périmées (échec). La primitive PARTAGÉE du dépôt, jamais une comparaison locale. Aucun PLAFOND :
 *  ce qu'une dette ne peut pas faire, c'est croître SANS SE DÉCLARER, et c'est l'entrée
 *  `{ fichier, ref, occurrence }` — qui NOMME la def à ouvrir — que la porte de plage voit à l'append. */
const ratchet = (sites: readonly Site[], stock: Iterable<EntreeNominative>) =>
  ecartDuVolet({ sites, stock, ou: STOCK });

const quadDefs = CREATURES.filter((c) => c.quad).map((c) => ({ id: c.id, quad: c.quad as QuadProps }));

describe('quadAnchor = repère de l\'art de l\'os (contrat du canal deco)', () => {
  it('couvre tout le registre quadrupède/ailé', () => {
    expect(quadDefs.length).toBeGreaterThan(20);
  });

  it('chaque art de part vit dans le repère que quadAnchor reproduit', () => {
    const { sites, divergences, couplesTete, couplesDeco } = mesureDesReperes();
    expect(couplesTete).toBeGreaterThan(90); // 25 defs × 3 vues, moins les os de tête sans art
    expect(couplesDeco).toBeGreaterThan(50);
    const { neuves, perimees } = ratchet(sites, REPERES_ART_PROPRES_RATCHET);
    expect(neuves, `repère propre à l'art d'une part, hors stock :\n${divergences.join('\n')}`).toEqual([]);
    // … et aucune entrée PÉRIMÉE : un repère soldé doit SORTIR du stock, sinon il ment.
    expect(perimees, `entrée du stock qui ne diverge plus — la retirer\n` +
      `(npx tsx scripts/rig/regen-quad-deco-stock.mts) :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it("chaque entrée NOMME la def de créature à ouvrir — c'est ce que la porte de plage voit", () => {
    const muettes = [...REPERES_ART_PROPRES_RATCHET, ...DECOS_MORTS_RATCHET]
      .filter((e) => !/^src\/gameIso\/rig\/creatures\/defs\/.+\.ts$/.test(e.fichier));
    expect(muettes, `Entrées dont le \`fichier\` n'est pas un chemin de def : elles seraient INVISIBLES à
` +
      `\`croissanceDesStocks\`, et un append ne coûterait rien :
  ${JSON.stringify(muettes)}`).toEqual([]);
  });

  /** ALLONGER le stock ne s'échange plus contre un plafond relevé : une entrée de plus se DÉCLARE,
   *  parce qu'elle nomme un fichier — la garde la voit PÉRIMÉE, la porte de plage la voit à l'append. */
  it('ALLONGER le stock rougit : une entrée que plus aucun site ne porte est PÉRIMÉE', () => {
    const gonfle = [...REPERES_ART_PROPRES_RATCHET, {
      fichier: 'src/gameIso/rig/creatures/defs/BeteQuiNExistePas.ts', ref: 'gonflement profile tete', occurrence: 1,
    }];
    const { perimees } = ratchet(mesureDesReperes().sites, gonfle);
    expect(remedeNomme(perimees, ' :: gonflement profile tete :: 1')).toBe(true);
    expect(remedeNomme(perimees, 'entrée SOLDÉE')).toBe(true);
  });

  /**
   * Contrat POSITIF : une clé `deco` vise UNE vue (`os#vue`) ou LES TROIS (clé nue) — et dans
   * CHACUNE des vues visées, l'os doit porter un art, sinon le décor est peint nulle part. Le
   * stock des couples encore perdus (`DECOS_MORTS_RATCHET`) est la seule exemption, nominative :
   * tout couple mort NOUVEAU rougit ici.
   */
  it('chaque clé `deco` authorée vise un os qui porte un art dans CHACUNE des vues visées', () => {
    const perdus: string[] = [];
    for (const { id, quad } of quadDefs) {
      if (!quad.deco) continue;
      for (const key of Object.keys(quad.deco)) {
        const [bone, vue] = key.split('#') as [QuadBoneId, View | undefined];
        for (const v of (vue ? [vue] : VIEWS))
          if (!quadParts({ ...quad, deco: undefined }, v)[bone]) perdus.push(`${id} ${v} ${key}`);
      }
    }
    const { neuves, perimees } = ratchet(perdus.map((c) => ({ file: fichierDeEspece(c.split(' ')[0]), ref: c })), DECOS_MORTS_RATCHET);
    expect(neuves, `décor authoré pour une vue où son os n'est pas émis :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `entrée du stock des morts dont l'os est désormais émis — la retirer\n` +
      `(npx tsx scripts/rig/regen-quad-deco-stock.mts) :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });
});

/**
 * ANCRE D'ŒIL d'un art de VUE (`QuadProps.viewArt`) — contrat d'ANCRES, comme le reste du fichier,
 * mais côté catalogue d'yeux plutôt que côté décor.
 *
 * Le canal `viewArt` REMPLACE l'art de l'os `tete` pour la vue qu'il déclare (`quadParts`). Or
 * `swapEye` (`parts/eyes`) opère par REMPLACEMENT TEXTUEL du groupe `<g data-eye="D" data-ec="x y">`
 * — il n'a aucun autre point d'accroche. Une bête dessinée d'un trait dont l'art de tête peint son
 * œil « en dur » fait donc taire le catalogue d'yeux (montures mortes-vivantes à œil rouge…) SANS
 * AUCUNE erreur : `applyEyes` ne trouve rien à remplacer et rend l'art inchangé.
 * Le silence porte loin : `cheval` est l'espèce de REPLI de `resolveQuad`, donc toute résolution
 * dont l'espèce est inconnue hérite de son art de tête.
 * `data-ec` est en coordonnées de l'OS — le compilateur de dessins ne cuit que les `d`, jamais un
 * attribut : c'est une valeur écrite à la main, et ce test est ce qui empêche qu'elle disparaisse.
 */
describe('art de VUE : l\'œil reste ANCRÉ pour le catalogue (#1082)', () => {
  const ANCRE = /<g data-eye="[GD]" data-ec="-?[\d.]+ -?[\d.]+">/;

  /** Les arts de tête dessinés par vue : `<espèce> <vue>` → l'art compilé. */
  const artsDeTete = quadDefs.flatMap(({ id, quad }) =>
    VIEWS.flatMap((view) => {
      const art = quad.viewArt?.[view]?.tete;
      return art ? [{ cle: `${id} ${view}`, art }] : [];
    }));

  it('toute def à `viewArt` garde `data-eye`/`data-ec` sur l\'art de tête de la vue dessinée', () => {
    // Plancher : au moins une espèce dessinée d'un trait porte un art de tête (sinon ce test
    // passerait à vide le jour où le canal `viewArt` serait renommé).
    expect(artsDeTete.length, 'population des arts de tête dessinés par vue').toBeGreaterThan(0);
    const muettes = artsDeTete.filter(({ art }) => !ANCRE.test(art)).map(({ cle }) => cle);
    expect(muettes.filter((c) => !ANCRES_OEIL_ABSENTES_GELEES.includes(c)),
      'art de tête sans ancre d\'œil : `swapEye` y est MUET (catalogue d\'yeux sans effet), et en silence')
      .toEqual([]);
    // Le stock ne peut que RÉTRÉCIR, et ne tolère aucune entrée périmée : une ancre posée en sort.
    expect(muettes.length).toBeLessThanOrEqual(PLAFOND_ANCRES_OEIL_ABSENTES);
    expect(ANCRES_OEIL_ABSENTES_GELEES.filter((c) => !muettes.includes(c)),
      'entrée gelée dont l\'ancre est désormais posée — à retirer du stock').toEqual([]);
  });

  it('l\'ancre est bien le point d\'accroche de `swapEye` (contre-factuel sur l\'art réel)', () => {
    const rouge = '<circle data-eye-art="temoin" r="2" fill="#f00"/>';
    const ancres = artsDeTete.filter(({ cle }) => !ANCRES_OEIL_ABSENTES_GELEES.includes(cle));
    expect(ancres.length).toBeGreaterThan(0);
    for (const { cle, art } of ancres) {
      expect(applyEyes(art, { D: rouge }), cle).toContain('data-eye-art="temoin"');
      expect(applyEyes(art, undefined), cle).not.toContain('data-eye-art');
    }
    // Le stock gelé est bien MUET — c'est la conséquence que le stock DIT, mesurée, pas supposée.
    for (const cle of ANCRES_OEIL_ABSENTES_GELEES) {
      const g = artsDeTete.find((a) => a.cle === cle);
      if (g) expect(applyEyes(g.art, { D: rouge }), `${cle} (gelé)`).toBe(g.art);
    }
  });
});
