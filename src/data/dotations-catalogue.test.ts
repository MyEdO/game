import { describe, expect, it } from 'vitest';
import { careerLevels, classes, creatures, trappings, trappingRefLabel, type TrappingRef } from './index';
import { replier } from '../lib/ordre.mjs';

/**
 * CONTRAT POSITIF (#1463 L-ref-1, étendu au bestiaire par L-ref-1bis) — une dotation qui NOMME une possession du catalogue est une
 * RÉFÉRENCE, jamais du texte. L'index label → ids est construit sur `trappings.json` SEUL : c'est le
 * catalogue DU SITE, et la résolvabilité vers n'importe quel autre dataset n'y vaut rien (« Assistant »,
 * « Bureau », « Écuyer », « Munitions » sont des ids AILLEURS — ce ne sont pas des possessions).
 *
 * TROIS PORTES, dont la troisième est la seule à voir un pluriel du livre : le libellé ENTIER, la
 * TÊTE DE PARENTHÈSE (« Atelier (Magie) »), et le SINGULIER mot à mot (« Haches de lancer » ↔
 * `hache-de-lancer`, « Cartes » ↔ `carte`). Sans la troisième, une dotation au pluriel reste du texte
 * en silence — c'est cet angle mort qui avait laissé passer `tueur-3`.
 *
 * PÉRIMÈTRE : les TROIS datasets qui portent des dotations — `careerLevels.json` et `classes.json`
 * (dotations de PERSONNAGE), `creatures.json` (les Possessions d'un statbloc, MDG `16 - Bestiaire.md`
 * l.407 pour `long-drong-silver`). Le catalogue et les trois portes sont les mêmes pour les trois :
 * une possession NOMMÉE est une référence, quel que soit son porteur.
 */

/** Normalisation de libellé — `replier`, puis la ponctuation en espace, comme le scan de structures. */
const normaliser = (s: string) => replier(s).replace(/[^a-z0-9]+/g, ' ').trim();

/** SINGULIER mot à mot d'un libellé normalisé : « haches de lancer » → « hache de lancer ». */
const singulier = (s: string) =>
  normaliser(s)
    .split(' ')
    .map((mot) => mot.replace(/aux$/, 'al').replace(/[sx]$/, ''))
    .join(' ');

/** Tête de parenthèse : « Atelier (Magie) » → « Atelier ». */
const teteDeParenthese = (texte: string): string | undefined => {
  const m = /^(.*?)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/.exec(texte);
  return m ? m[1] : undefined;
};

const PAR_LABEL = new Map<string, string[]>();
const PAR_SINGULIER = new Map<string, string[]>();
for (const t of trappings) {
  const k = normaliser(t.label);
  PAR_LABEL.set(k, [...(PAR_LABEL.get(k) ?? []), t.id]);
  const s = singulier(t.label);
  PAR_SINGULIER.set(s, [...(PAR_SINGULIER.get(s) ?? []), t.id]);
}

/**
 * Les `{text}` de dotation que le catalogue NOMME sans qu'ils soient des références — la parenthèse
 * n'y est pas une spécialisation. Liste NOMINATIVE, chacune avec sa raison ; elle ne fait que
 * décroître, et un texte qui n'y est pas se lie.
 */
const EXCLUSIONS: readonly { texte: string; raison: string }[] = [
  { texte: 'Bijoux (50 CO)', raison: 'PRIX, pas une spécialisation (LDB 08 l.971 « bijoux valant 50 CO »)' },
  { texte: 'Bijoux (200 CO)', raison: 'PRIX' },
  { texte: 'Bijoux (500 CO)', raison: 'PRIX' },
  { texte: "Grimoire (souvent sous forme d'os ou de dents gravés)", raison: 'PROSE du statbloc' },
  { texte: 'Outils professionnels (même spécialisation que Métier)', raison: 'RENVOI de règle' },
  { texte: 'Outils professionnels (Au choix)', raison: 'SENTINELLE d’emplacement non désigné (#1457)' },
];

/** Toutes les dotations des deux datasets, branches `choice` comprises, avec leur porteur. */
const dotations = (): { porteur: string; ref: TrappingRef }[] => {
  const out: { porteur: string; ref: TrappingRef }[] = [];
  const pousser = (porteur: string, refs: readonly TrappingRef[]) => {
    for (const ref of refs) {
      out.push({ porteur, ref });
      if ('choice' in ref) pousser(porteur, ref.choice);
    }
  };
  for (const c of classes) pousser(`classes.json › ${c.id}`, c.trappings);
  for (const l of careerLevels) pousser(`careerLevels.json › ${l.id}`, l.trappings);
  for (const c of creatures) pousser(`creatures.json › ${c.id}`, c.trappings);
  return out;
};

describe('dotations : ce que le catalogue NOMME est une référence (#1463 L-ref-1)', () => {
  it('le périmètre n’est pas vide — les trois datasets portent bien des dotations', () => {
    expect(dotations().length).toBeGreaterThan(700);
    expect(
      dotations().filter((d) => d.porteur.startsWith('creatures.json')).length,
      'le bestiaire doit être DANS le périmètre — sans lui, ses `{text}` ne sont vus par aucune porte',
    ).toBeGreaterThan(100);
  });

  it('les trois portes MORDENT — libellé entier, singulier, tête de parenthèse (contre-épreuve)', () => {
    expect(PAR_LABEL.get(normaliser('Dague')), '« Dague » doit être au catalogue').toEqual(['dague']);
    expect(
      PAR_SINGULIER.get(singulier('Haches de lancer')),
      'la porte SINGULIER doit ramener `hache-de-lancer` — c’est la seule qui voyait ce pluriel',
    ).toContain('hache-de-lancer');
    expect(teteDeParenthese('Atelier (Magie)')).toBe('Atelier');
    expect(PAR_SINGULIER.get(singulier('Sa Honte')), '« Sa Honte » ne nomme aucune possession').toBeUndefined();
  });

  it('aucun `{text}` de dotation ne nomme une possession du catalogue', () => {
    const aLier: string[] = [];
    const vues = new Set<string>();
    for (const { porteur, ref } of dotations()) {
      if (!('text' in ref)) continue;
      const exclusion = EXCLUSIONS.find((e) => e.texte === ref.text);
      if (exclusion) {
        vues.add(exclusion.texte);
        continue;
      }
      const exact = PAR_LABEL.get(normaliser(ref.text));
      if (exact) {
        aLier.push(`${porteur} : « ${ref.text} » EST le libellé de ${exact.join('/')} — s’écrit {id}`);
        continue;
      }
      const pluriel = PAR_SINGULIER.get(singulier(ref.text));
      if (pluriel) {
        aLier.push(`${porteur} : « ${ref.text} » est la graphie au PLURIEL de ${pluriel.join('/')} — s’écrit {id}`);
        continue;
      }
      const tete = teteDeParenthese(ref.text);
      const cible = tete == null ? undefined : (PAR_LABEL.get(normaliser(tete)) ?? PAR_SINGULIER.get(singulier(tete)));
      if (cible)
        aLier.push(`${porteur} : « ${ref.text} » nomme ${cible.join('/')} + une spécialisation — s’écrit {id, spec}`);
    }
    expect(aLier, `dotation(s) à lier au catalogue :\n${aLier.join('\n')}`).toEqual([]);
    const perimees = EXCLUSIONS.filter((e) => !vues.has(e.texte)).map((e) => e.texte);
    expect(perimees, `exclusion(s) PÉRIMÉE(s) — le texte n’est plus dans la donnée, retirer la ligne :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('chaque exclusion porte sa RAISON', () => {
    expect(EXCLUSIONS.filter((e) => !e.raison.trim()).map((e) => e.texte)).toEqual([]);
  });

  /**
   * ARBITRAGE ÉPINGLÉ : deux entrées du catalogue portent le MÊME libellé « Carreau » — `carreau`
   * (munition d'arbalète) et `carreau-de-baliste` (munition de siège). Les six dotations que le livre
   * écrit « arbalète (de poing) et dix carreaux » (`LDB 08` l.1435, l.1543, l.2826, l.3239, l.3396 ;
   * `MDG 09` l.401) visent l'arbalète — distinction que `MDG 12` l.379 pose explicitement. L'index
   * libellé → ids n'est donc PAS injectif : sans cet arbitrage, un appariement par libellé peut poser
   * la mauvaise munition en silence.
   */
  it('« Carreaux » vise `carreau`, jamais `carreau-de-baliste` (homonymie de libellé au catalogue)', () => {
    expect(
      PAR_LABEL.get(normaliser('Carreau'))?.slice().sort(),
      'l’homonymie a disparu du catalogue — l’arbitrage perd son objet',
    ).toEqual(['carreau', 'carreau-de-baliste']);
    const munitions = dotations().filter(({ ref }) => 'id' in ref && (ref.id === 'carreau' || ref.id === 'carreau-de-baliste'));
    expect(
      munitions.filter(({ ref }) => 'id' in ref && ref.id === 'carreau-de-baliste').map((m) => m.porteur),
      'aucune dotation de carrière ne prend la munition de SIÈGE',
    ).toEqual([]);
    expect(munitions.length, 'les 6 « Carreaux » migrés + le site historique `patrouilleur-routier-1`').toBe(7);
  });

  it('la `spec` d’une dotation s’AFFICHE — sur la donnée réelle, jamais une réf forgée', () => {
    const site = dotations().find(({ ref }) => 'id' in ref && ref.id === 'outils-professionnels' && ref.spec === 'Maréchal-ferrant');
    expect(site, 'aucune dotation `outils-professionnels (Maréchal-ferrant)` en donnée — le témoin a disparu').toBeTruthy();
    expect(trappingRefLabel(site!.ref)).toBe('Outils professionnels (Maréchal-ferrant)');
    const choix = dotations().find(({ ref }) => 'choice' in ref && ref.choice.some((b) => 'id' in b && b.id === 'atelier' && b.spec != null));
    expect(choix, 'aucun choix de dotation `atelier` spécialisé en donnée — le témoin a disparu').toBeTruthy();
    expect(trappingRefLabel(choix!.ref)).toBe('Atelier (Ingénierie) ou Atelier (Magie)');
    const compte = dotations().find(({ ref }) => 'id' in ref && ref.id === 'carreau' && ref.count != null);
    expect(trappingRefLabel(compte!.ref)).toBe('Carreau (10)');
  });
});
