import { describe, it, expect, afterEach } from 'vitest';
import {
  humanizeFlowSentence, humanizeCondition, humanizeOp, humanizeFormula, humanizeCastBonus,
} from './humanize';
import {
  domains, spells, etats, talents, traits, groups, maladies, symptoms, skills, creatures,
} from '../../data';
import { CHAR_KEYS } from '../../engine/types';
import { OPTIONAL_RULES, setRule, resetRule } from '../../engine/policy';
import { walkFlow, type Flow, type Condition, type EffectOp } from '../../state/flow';
import type { GameOp, Formula } from '../../engine/ops';

/** Ids KEBAB (multi-segment) connus des registres : « en-flammes », « magie-des-arcanes »,
 *  « force-mentale »… — jamais un mot français de prose (« peut-être »). Une sortie JOUEUR qui en
 *  contient un a laissé fuir un id BRUT. */
const KEBAB_IDS: string[] = [
  ...etats, ...talents, ...traits, ...groups, ...maladies, ...symptoms, ...skills, ...creatures,
].map((x) => x.id).concat(CHAR_KEYS).filter((id) => id.includes('-'));

const firstKebab = (s: string): string | undefined => KEBAB_IDS.find((id) => s.includes(id));

/** Conditions (nœuds `if`, gate/difficultyBy des `test`) d'un Flow. */
function collectConditions(flow: Flow): Condition[] {
  const out: Condition[] = [];
  walkFlow(flow, (n) => {
    if (n.kind === 'if') out.push(n.cond);
    if (n.kind === 'test') { if (n.test.gate) out.push(n.test.gate); for (const d of n.test.difficultyBy ?? []) out.push(d.cond); }
  });
  return out;
}

/** GameOps des feuilles EffectOp d'un Flow (hors `narrative` — prose verbatim, pas un id). */
function collectOps(flow: Flow): GameOp[] {
  const out: GameOp[] = [];
  walkFlow(flow, (n) => {
    if (n.kind !== 'do') return;
    const e = n.effect as EffectOp;
    if (e && e.type === 'ops') for (const o of e.ops) if (o.op !== 'narrative') out.push(o);
  });
  return out;
}

describe('humanize — registre JOUEUR', () => {
  it('rend le rider du Domaine du Feu en phrase lisible (sans →, sans NON(, sans id brut)', () => {
    const feu = domains.find((d) => d.id === 'feu')!;
    const phrase = humanizeFlowSentence(feu.effects![0].flow as Flow);
    // Lisible : État et Talent en libellé.
    expect(phrase).toContain('En flammes');
    expect(phrase).toContain('Magie des Arcanes (Feu)');
    expect(phrase).toContain('adversaire');
    expect(phrase).toContain('ne possède pas');
    // Aucune fuite technique.
    expect(phrase).not.toContain('→');
    expect(phrase).not.toContain('->');
    expect(phrase).not.toContain('NON(');
    expect(firstKebab(phrase)).toBeUndefined();
  });

  it('op `fall` : la CHUTE dit sa table, jamais son id de table (#1657, MDG 13 l.678)', () => {
    const chute = humanizeOp({ op: 'fall', hauteur: { table: { id: 'tomberDuGreement' } } });
    // La HAUTEUR est dite, colonne par colonne, DÉRIVÉE de la table (MDG 13 l.684-688) — une chip qui
    // ne dirait que le nom de la table n'apprendrait rien au joueur.
    expect(chute).toBe(
      'tombe de la hauteur que dit « Tomber du gréement » (Gréement 1d10/2d10/3d10 m, Nid-de-pie 12/25/40 m, selon la Taille du bateau)',
    );
    expect(chute, 'l’id de table a fui à l’écran').not.toContain('tomberDuGreement');
    expect(chute, 'un id de station a fui à l’écran').not.toContain('nid-de-pie ');
    // Table inconnue : l'id RESTE visible — un libellé inventé masquerait l'erreur d'authoring.
    expect(humanizeOp({ op: 'fall', hauteur: { table: { id: 'tomberDeLaLune' } } })).toContain('tomberDeLaLune');
  });

  it('humanizeCondition : négation NATURELLE poussée dans la feuille (pas de « NON( … ) »)', () => {
    const c: Condition = { kind: 'not', of: { kind: 'has', who: 'target', what: 'talent', value: 'magie-des-arcanes', spec: 'feu' } };
    expect(humanizeCondition(c)).toBe('la cible ne possède pas le Talent Magie des Arcanes (Feu)');
    const rel: Condition = { kind: 'relation', who: 'target', is: 'opponent' };
    expect(humanizeCondition(rel)).toBe('la cible est un adversaire');
    // De Morgan sur any sous négation.
    const morgan: Condition = { kind: 'not', of: { kind: 'any', of: [
      { kind: 'has', who: 'target', what: 'trait', value: 'mort-vivant' },
      { kind: 'has', who: 'target', what: 'trait', value: 'demoniaque' },
    ] } };
    // Sujet dédoublonné dans la conjonction (même « la cible » en tête des deux clauses).
    expect(humanizeCondition(morgan)).toBe('la cible ne possède pas le Trait Mort-vivant et ne possède pas le Trait Démoniaque');
  });

  it('humanizeCondition : dédoublonne le sujet répété dans all/any (jamais deux sujets différents)', () => {
    const same: Condition = { kind: 'all', of: [
      { kind: 'relation', who: 'target', is: 'opponent' },
      { kind: 'not', of: { kind: 'has', who: 'target', what: 'talent', value: 'magie-des-arcanes', spec: 'feu' } },
    ] };
    expect(humanizeCondition(same)).toBe('la cible est un adversaire et ne possède pas le Talent Magie des Arcanes (Feu)');
    // Sujets DIFFÉRENTS (cible / lanceur) : aucun dédoublonnage (sûreté grammaticale).
    const mixed: Condition = { kind: 'all', of: [
      { kind: 'relation', who: 'target', is: 'opponent' },
      { kind: 'not', of: { kind: 'has', who: 'caster', what: 'trait', value: 'mort-vivant' } },
    ] };
    expect(humanizeCondition(mixed)).toBe('la cible est un adversaire et le lanceur ne possède pas le Trait Mort-vivant');
  });

  it('humanizeCondition : compare sur un État → « porte / ne porte pas »', () => {
    const has: Condition = { kind: 'compare', subject: { who: 'target', condition: 'extenue' }, op: '>=', value: 1 };
    expect(humanizeCondition(has)).toBe('la cible porte *Exténué*');
    expect(humanizeCondition({ kind: 'not', of: has })).toBe('la cible ne porte pas *Exténué*');
  });

  it('humanizeFormula : Caractéristiques et dés en clair', () => {
    expect(humanizeFormula({ bonusOf: 'force-mentale' })).toBe('le Bonus de Force Mentale');
    expect(humanizeFormula({ charOf: 'endurance' })).toBe('la Endurance');
    expect(humanizeFormula({ dice: { n: 1, sides: 10, plus: 2 } })).toBe('1d10+2');
    expect(humanizeFormula(5)).toBe('5');
    // Borne basse — « 1d10 – (Bonus d'Endurance) Rounds (minimum de 1) » (AA 07 l.113, LDB 18 l.88).
    expect(humanizeFormula({ minimum: 1, of: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] } }))
      .toBe('1d10 + le Bonus de Endurance × -1 (minimum de 1)');
  });

  it('une op à durée propre DIT sa durée, borne comprise (AA 07 l.113, LDB 18 l.88)', () => {
    const DUREE: Formula = { minimum: 1, of: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] } };
    expect(humanizeOp({ op: 'maxWeaponHands', hands: 1, durationRounds: DUREE } as GameOp))
      .toBe('ne peut manier que des armes à 1 main(s) pendant 1d10 + le Bonus de Endurance × -1 (minimum de 1) Round(s)');
    expect(humanizeOp({ op: 'moveScale', num: 1, den: 2, durationRounds: DUREE } as GameOp))
      .toBe('voit son Mouvement réduit de moitié pendant 1d10 + le Bonus de Endurance × -1 (minimum de 1) Round(s)');
    // Sans durée propre (celle du contexte) : aucune phrase inventée.
    expect(humanizeOp({ op: 'maxWeaponHands', hands: 1 } as GameOp)).toBe('ne peut manier que des armes à 1 main(s)');
  });

  it('humanizeOp : État en libellé italique, jamais l’id', () => {
    const op: GameOp = { op: 'condition', id: 'en-flammes' };
    expect(humanizeOp(op)).toBe("gagne l'État *En flammes*");
    expect(firstKebab(humanizeOp(op))).toBeUndefined();
  });

  it('humanizeCastBonus : français JOUEUR, sans jargon ni Markdown (contexte plein texte)', () => {
    const feu = domains.find((d) => d.id === 'feu')!;
    expect(humanizeCastBonus(feu.castBonus!)).toBe('+10 par cible affectée par En flammes dans un rayon égal à votre Bonus de Force Mentale en mètres');
  });
});

describe('humanize — GARDE structurelle (toutes les données réelles)', () => {
  it('domaines : humanize ne jette jamais et ne fuit aucun id/→ brut', () => {
    for (const d of domains) {
      for (const e of d.effects ?? []) {
        const flow = e.flow as Flow;
        const full = humanizeFlowSentence(flow);
        expect(full, `${d.id}: →/->/NON(`).not.toMatch(/→|->|NON\(/);
        for (const c of collectConditions(flow)) {
          const s = humanizeCondition(c);
          expect(firstKebab(s), `${d.id} cond « ${s} »`).toBeUndefined();
        }
        for (const o of collectOps(flow)) {
          const s = humanizeOp(o);
          expect(firstKebab(s), `${d.id} op ${o.op} « ${s} »`).toBeUndefined();
        }
      }
      if (d.castBonus) expect(firstKebab(humanizeCastBonus(d.castBonus)), d.id).toBeUndefined();
      for (const o of (d.casterOps ?? []) as GameOp[]) {
        if (o.op === 'narrative') continue;
        expect(firstKebab(humanizeOp(o)), `${d.id} casterOp ${o.op}`).toBeUndefined();
      }
    }
  });

  it('sorts : humanize ne jette jamais et ne fuit aucun id/→ brut', () => {
    for (const s of spells) {
      const flow = s.effects as Flow | undefined;
      if (!flow) continue;
      // Les `narrative` (prose VERBATIM) peuvent porter un « → » de source → l'arbre if/test (le VRAI
      // risque « → » d'atelier) est couvert par la garde des DOMAINES (sans narrative). Ici : pas de
      // « NON( » structurel, et aucun id kebab par condition/op.
      const full = humanizeFlowSentence(flow);
      expect(full, `${s.id}: NON(`).not.toContain('NON(');
      for (const c of collectConditions(flow)) {
        const str = humanizeCondition(c);
        expect(firstKebab(str), `${s.id} cond « ${str} »`).toBeUndefined();
      }
      for (const o of collectOps(flow)) {
        const str = humanizeOp(o);
        expect(firstKebab(str), `${s.id} op ${o.op} « ${str} »`).toBeUndefined();
      }
    }
  });
});

/**
 * Une règle optionnelle NUMÉRIQUE (`kind: 'param'`) est une QUANTITÉ pour le joueur : la phrase porte
 * sa valeur courante, la règle nommée entre parenthèses. Le rendu suit la règle quand elle change.
 *
 * MUTATION : rendre au terme `{rule}` d'`humanizeFormula` sa forme « la règle « X » » — la valeur
 * disparaît de la phrase et les `expect` de montant tombent.
 */
describe('terme `{rule}` d’une Formula — la VALEUR au joueur, la règle nommée (#1612)', () => {
  const AMENDE: GameOp = {
    op: 'money',
    montant: { brass: { times: { of: { rule: 'mendier-amende-sous' }, factor: -1 } } },
  };
  afterEach(() => resetRule('mendier-amende-sous'));

  it('l’op `money` d’un DÉBIT réglé dit « perd <valeur> … » et nomme la règle', () => {
    setRule('mendier-amende-sous', 12);
    const dit = humanizeOp(AMENDE);
    expect(dit).toContain('perd');
    expect(dit).toContain('12');
    expect(dit).toContain('sou(s) de cuivre');
    expect(dit).toContain('règle « Mendier : amende des gardes locaux »');
    expect(dit, 'un id brut a fui à l’écran').not.toContain('mendier-amende-sous');
    expect(dit, 'le signe se DIT, il ne s’imprime pas').not.toContain('× -1');
  });

  it('la phrase SUIT la règle éditée, et un CRÉDIT se dit « gagne »', () => {
    setRule('mendier-amende-sous', 30);
    expect(humanizeOp(AMENDE)).toContain('30');
    const credit: GameOp = { op: 'money', montant: { brass: { rule: 'mendier-amende-sous' } } };
    expect(humanizeOp(credit)).toBe(
      'gagne 30 sou(s) de cuivre dans sa bourse (règle « Mendier : amende des gardes locaux »)',
    );
  });

  it('une règle NON numérique (`flag`/`mode`) se NOMME — il n’y a pas de quantité à montrer', () => {
    const nonParam = OPTIONAL_RULES.find((r) => r.kind !== 'param')!;
    expect(humanizeFormula({ rule: nonParam.id })).toBe(`la règle « ${nonParam.label} »`);
  });
});

describe('humanizeOp — grantTrait à Portée (LDB 85 l.209 ; LDB 79 l.142)', () => {
  it('la phrase dit la Portée de l’op', () => {
    expect(humanizeOp({ op: 'grantTrait', traitId: 'langue-prehensile', indice: 5, range: 12 })).toBe('gagne le Trait Langue préhensile +5 (12)');
  });

  it('une attaque dit son Indice littéral en « +Dégâts »', () => {
    expect(humanizeOp({ op: 'grantTrait', traitId: 'morsure', indice: 4 })).toBe('gagne le Trait Morsure +4');
  });

  it('un Indice Formula suit le nom du Trait', () => {
    expect(humanizeOp({ op: 'grantTrait', traitId: 'vol', indice: { charOf: 'agilite' } })).toBe(`gagne le Trait Vol ${humanizeFormula({ charOf: 'agilite' })}`);
  });
});
