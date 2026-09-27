import { describe, it, expect } from 'vitest';
import { reverseGroups, bookContents, labelIndex, tokenizeLinks } from './relations';
import { invalidateCodexLookup } from './registry';
import { setDataset } from '../../data/overrides';
import { creatures, traits, gods, trappings, skills, talents, careerLevels, etats, locations, characteristics, findCareerById, findLocationById } from '../../data';

/** Un groupe inverse de catégorie `cat` contient-il `label` ? */
const groupHas = (groups: ReturnType<typeof reverseGroups>, cat: string, label: string): boolean =>
  groups.find((g) => g.category === cat)?.referrers.some((r) => r.label === label) ?? false;

describe('relations — graphe inverse id-based', () => {
  it('trait → créatures le portant (inversion de creature.traits)', () => {
    // Prend une créature réelle + son 1er trait → l'inverse DOIT la lister.
    const c = creatures.find((x) => x.traits.length > 0)!;
    const traitId = c.traits[0].id;
    const groups = reverseGroups('traits', traitId);
    expect(groupHas(groups, 'creatures', c.label)).toBe(true);
    // Le titre de la section est la phrase descriptive (display), pas le nom brut.
    expect(groups.find((g) => g.category === 'creatures')?.title).toBe('Créatures ayant ce trait');
  });

  it('sort → culte qui l’accorde (inversion de gods.blessings/miracles), avec détail', () => {
    const g = gods.find((x) => x.blessings.length > 0)!;
    const spellId = g.blessings[0];
    const groups = reverseGroups('spells', spellId);
    const godGroup = groups.find((gr) => gr.category === 'gods');
    expect(godGroup?.referrers.some((r) => r.label === g.label && r.detail === 'Bénédiction')).toBe(true);
  });

  it('qualité → équipements la portant (inversion de trapping.qualities)', () => {
    const t = trappings.find((x) => x.qualities.length > 0)!;
    const qid = t.qualities[0].id;
    const groups = reverseGroups('qualities', qid);
    expect(groupHas(groups, 'trappings', t.label)).toBe(true);
  });

  it('caractéristique → compétences liées (inversion de skill.characteristic)', () => {
    const s = skills[0];
    const groups = reverseGroups('characteristics', s.characteristic);
    expect(groupHas(groups, 'skills', s.label)).toBe(true);
  });

  it('compétence → carrière par rang, détail « N{level} » fusionné', () => {
    // Une compétence d'un niveau de carrière → l'inverse liste la CARRIÈRE avec son rang.
    const lv = careerLevels.find((l) => l.skills.some((a) => 'id' in a))!;
    const career = findCareerById(lv.career)!;
    const skillId = lv.skills.flatMap((a) => ('id' in a ? [a.id] : []))[0];
    const groups = reverseGroups('skills', skillId);
    const careerRef = groups.find((g) => g.category === 'careers')?.referrers.find((r) => r.label === career.label);
    expect(careerRef).toBeTruthy();
    expect(careerRef!.detail).toMatch(/N\d/);
  });

  it('lieux : tout `parent` est un id qui RÉSOUT (migration id-based, zéro orphelin)', () => {
    for (const l of locations) {
      expect(typeof l.id, l.label).toBe('string');
      if (l.parent) expect(findLocationById(l.parent), `${l.label} → parent ${l.parent}`).toBeTruthy();
    }
    // Au moins un lieu-parent expose ses sous-lieux (inversion vivante).
    const parent = locations.find((l) => locations.some((c) => c.parent === l.id));
    expect(parent && reverseGroups('locations', parent.id).some((g) => g.category === 'locations')).toBe(true);
  });

  it('état → ce qui l’inflige (inversion des ops `condition` des effets Flow/TriggeredEffect)', () => {
    // Au moins un état est infligé par un Sort (op condition dans spell.effects) → groupe inverse 'spells'.
    const e = etats.find((x) => reverseGroups('etats', x.id).some((g) => g.category === 'spells'));
    expect(e, 'un état infligé par un sort').toBeTruthy();
    expect(reverseGroups('etats', e!.id).find((g) => g.category === 'spells')?.title).toBe('Sorts l’infligeant');
  });

  it('entité non référencée → aucun groupe', () => {
    expect(reverseGroups('traits', '___inexistant___')).toEqual([]);
  });

  it('titre de section : déclaré AU SITE de la relation ; arête sans titre → repli GENERIC_PLURAL', () => {
    // creature.skills est déclarée sans titre spécifique → le groupe inverse titre au pluriel générique.
    const c = creatures.find((x) => x.skills.length > 0)!;
    const groups = reverseGroups('skills', c.skills[0].id);
    expect(groups.find((g) => g.category === 'creatures')?.title).toBe('Créatures');
  });

  it('bookContents(livre-de-base) groupe le contenu par catégorie', () => {
    const contents = bookContents('livre-de-base');
    expect(contents.length).toBeGreaterThan(0);
    // Les talents du LDB doivent apparaître.
    const tCat = contents.find((c) => c.category === 'talents');
    expect(tCat && tCat.entries.length).toBeGreaterThan(0);
    // Trié alpha à l'intérieur d'une catégorie.
    if (tCat) {
      const labels = tCat.entries.map((e) => e.label);
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'fr')));
    }
  });

  it('tokenizeLinks lie le vocabulaire de règles, écarte soi-même et l’inconnu', () => {
    // Une compétence dont le libellé est auto-liable (≥4, non ambigu) doit être tokenisée en lien.
    const s = skills.find((x) => x.label.length >= 4 && labelIndex().get(x.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())?.category === 'skills')!;
    const toks = tokenizeLinks(`Effectuez un Test de ${s.label} pour réussir.`);
    const link = toks.find((t) => typeof t === 'object' && t.label === s.label);
    expect(link).toBeTruthy();
    expect((link as { category: string }).category).toBe('skills');
    // Lien vers SOI écarté → tout reste en texte (aucun token objet).
    expect(tokenizeLinks(`${s.label} est une compétence.`, s.label).every((t) => typeof t === 'string')).toBe(true);
    // Prose sans vocabulaire connu → un seul segment texte, inchangé.
    expect(tokenizeLinks('Zzz qqq wxyz vvv.')).toEqual(['Zzz qqq wxyz vvv.']);
  });

  it('labelIndex résout un libellé connu, écarte les ambigus/courts', () => {
    const idx = labelIndex();
    const t = traits.find((x) => x.label.length >= 4)!;
    // Un libellé unique se résout vers sa catégorie ; un libellé absent → undefined.
    const hit = idx.get(t.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    // (peut être absent si homonyme entre catégories — mais alors c'est volontairement écarté, pas une fausse résolution)
    if (hit) expect(hit.label).toBe(t.label);
    expect([...idx.keys()].every((k) => k.length >= 4)).toBe(true);
  });

  it('tokenizeLinks est SENSIBLE À LA CASSE : la casse discrimine le terme de règle du mot commun', () => {
    // « Charme » (compétence, libellé UNIQUE dans le catalogue) : capitalisé = terme de règle → lié ;
    // en minuscule dans un mot commun ("le charme discret") → pas lié.
    const charme = skills.find((x) => x.label === 'Charme');
    expect(charme, 'compétence Charme présente').toBeTruthy();
    const linkedUpper = tokenizeLinks('Effectuez un Test de Charme pour convaincre.');
    expect(linkedUpper.some((t) => typeof t === 'object' && t.label === 'Charme' && t.category === 'skills')).toBe(true);
    const notLinkedLower = tokenizeLinks('Il dégage un charme discret et naturel.');
    expect(notLinkedLower.every((t) => typeof t === 'string')).toBe(true);

    // « En flammes » (état, multi-mots) : capitalisé en toutes lettres, tel qu'écrit dans la source
    // (« l'État En flammes ») → lié ; en minuscule dans un usage courant → pas lié.
    const enFlammes = etats.find((x) => x.label === 'En flammes');
    expect(enFlammes, 'état En flammes présent').toBeTruthy();
    const flammesLinked = tokenizeLinks("La cible subit l'État En flammes.");
    expect(flammesLinked.some((t) => typeof t === 'object' && t.label === 'En flammes' && t.category === 'etats')).toBe(true);
    const flammesNotLinked = tokenizeLinks('Le brasero est en flammes dans la cheminée.');
    expect(flammesNotLinked.every((t) => typeof t === 'string')).toBe(true);

    // « une œuvre d'art » (mot commun) ne doit jamais lier un terme de règle (casse en minuscule).
    const artLower = tokenizeLinks("Il peint une œuvre d'art dans son atelier.");
    expect(artLower.every((t) => typeof t === 'string')).toBe(true);

    // Accent conservé : « Charme » avec sa capitale ordinaire fonctionne aussi en tout DÉBUT de phrase.
    const startOfSentence = tokenizeLinks('Charme est une compétence sociale.', 'Charme');
    // Auto-référence (selfLabel) → écarté malgré le lien potentiel.
    expect(startOfSentence.every((t) => typeof t === 'string')).toBe(true);
  });

  it('tokenizeLinks garde un libellé MULTI-MOTS tel qu’écrit (casse figée, pas de variante)', () => {
    const magie = talents.find((x) => x.label === 'Magie des Arcanes');
    expect(magie, 'talent Magie des Arcanes présent').toBeTruthy();
    const linked = tokenizeLinks('Le sort relève de la Magie des Arcanes.');
    expect(linked.some((t) => typeof t === 'object' && t.label === 'Magie des Arcanes' && t.category === 'talents')).toBe(true);
    // Variante de casse partielle (« magie des Arcanes ») ≠ libellé exact → pas de lien.
    const notLinked = tokenizeLinks('Cette étrange magie des Arcanes intrigue les érudits.');
    expect(notLinked.every((t) => typeof t === 'string')).toBe(true);
  });

  it('tokenizeLinks : pluriel FR simple (chaque mot du libellé accepte un « s » optionnel)', () => {
    // « Attaque caudale » (trait ET manœuvre — homonyme RÉEL, cf. `PRIORITY_CAT_ORDER`) : le pluriel
    // « Attaques caudales » (accord régulier des deux mots) doit lier le libellé SINGULIER d'origine.
    const traitHit = traits.find((x) => x.label === 'Attaque caudale');
    expect(traitHit, 'trait Attaque caudale présent').toBeTruthy();
    const toks = tokenizeLinks('Les Attaques caudales sont redoutables.');
    const link = toks.find((t) => typeof t === 'object' && t.label === 'Attaque caudale');
    expect(link, 'lien vers le libellé singulier malgré le pluriel dans le texte').toBeTruthy();
    expect((link as { text: string }).text).toBe('Attaques caudales'); // texte affiché = VERBATIM de la source
    // Simple compétence au pluriel : « Charmes » → « Charme ».
    expect(skills.find((x) => x.label === 'Charme'), 'compétence Charme présente').toBeTruthy();
    const charmeToks = tokenizeLinks('Vous déployez tous vos Charmes.');
    expect(charmeToks.some((t) => typeof t === 'object' && t.label === 'Charme' && t.category === 'skills')).toBe(true);
  });

  it('tokenizeLinks : absorbe la parenthèse de spécialisation ADJACENTE en une seule mention', () => {
    expect(skills.find((x) => x.label === 'Savoir'), 'compétence Savoir présente').toBeTruthy();
    const toks = tokenizeLinks('Vous maîtrisez Savoir (Histoire) parfaitement.');
    const link = toks.find((t) => typeof t === 'object' && t.label === 'Savoir') as
      { category: string; label: string; spec?: string; text: string } | undefined;
    expect(link, 'une SEULE mention, pas coupée au milieu de la parenthèse').toBeTruthy();
    expect(link!.category).toBe('skills');
    expect(link!.spec).toBe('Histoire'); // spec = PARAMÈTRE structuré, séparé du texte affiché
    expect(link!.text).toBe('Savoir (Histoire)'); // texte affiché = verbatim complet (libellé + parenthèse)
    // Sans parenthèse adjacente : pas de `spec`, comportement inchangé.
    const bare = tokenizeLinks('Vous maîtrisez Savoir parfaitement.').find((t) => typeof t === 'object') as
      { spec?: string; text: string } | undefined;
    expect(bare?.spec).toBeUndefined();
    expect(bare?.text).toBe('Savoir');
  });

  it('tokenizeLinks : homonymes RÉSOLUS (pas jetés) — priorité GLOBALE puis `selfCategory`', () => {
    // « Haine » existe en TALENT et en TRAIT (collision réelle du catalogue) — labelIndex() général
    // écarterait ce libellé ; le matcher LINKABLE le résout au lieu de le jeter.
    const talentHaine = talents.find((x) => x.label === 'Haine');
    const traitHaine = traits.find((x) => x.label === 'Haine');
    expect(talentHaine && traitHaine, 'homonyme réel Haine (talent + trait)').toBeTruthy();
    // Sans contexte → priorité GLOBALE (talents avant traits, cf. PRIORITY_CAT_ORDER documentée).
    const noCtx = tokenizeLinks('Il agit par pure Haine.').find((t) => typeof t === 'object') as
      { category: string } | undefined;
    expect(noCtx?.category).toBe('talents');
    // Avec `selfCategory` = la fiche affichante (ex. une fiche de TRAIT parlant d'un autre trait
    // « Haine ») → le contexte prime sur la priorité globale.
    const withCtx = tokenizeLinks('Il agit par pure Haine.', undefined, 'traits').find((t) => typeof t === 'object') as
      { category: string } | undefined;
    expect(withCtx?.category).toBe('traits');
  });

  it('tokenizeLinks : forme PRÉFIXÉE par catégorie (« Compétence X »/« Talent X ») toujours non ambiguë', () => {
    // Dérivées de `GENERIC_PLURAL`, pas une table en dur nouvelle : « Compétences » → « Compétence ».
    const resSkill = skills.find((x) => x.label === 'Résistance');
    const resTalent = talents.find((x) => x.label === 'Résistance');
    expect(resSkill && resTalent, 'homonyme réel Résistance (compétence + talent)').toBeTruthy();
    const skillForm = tokenizeLinks('On y joue sa Compétence Résistance.').find((t) => typeof t === 'object') as
      { category: string; label: string } | undefined;
    expect(skillForm).toEqual({ category: 'skills', id: resSkill!.id, label: 'Résistance', spec: undefined, text: 'Compétence Résistance' });
    const talentForm = tokenizeLinks('On y joue son Talent Résistance.').find((t) => typeof t === 'object') as
      { category: string; label: string } | undefined;
    expect(talentForm).toEqual({ category: 'talents', id: resTalent!.id, label: 'Résistance', spec: undefined, text: 'Talent Résistance' });
  });

  it('B3 : « Âme pure » — « Points de Corruption » lie la JAUGE (characteristics), jamais le TRAIT homonyme', () => {
    // Régression B3 : l'ancienne politique liait « Points de Corruption » (desc d'Âme pure) au TRAIT
    // Corruption (PRIORITY_CAT_ORDER traits avant characteristics). La forme de jauge « Points de X »
    // est désormais une clé mono-catégorie → la JAUGE.
    const ame = talents.find((x) => x.id === 'ame-pure')!;
    expect(ame?.desc, 'desc d’Âme pure présente et mentionnant Points de Corruption').toMatch(/Points de Corruption/);
    const toks = tokenizeLinks(ame.desc!, ame.label, 'talents', ame.id);
    const corr = toks.find((t) => typeof t === 'object' && /corruption/i.test((t as { text: string }).text)) as
      { category: string } | undefined;
    expect(corr, 'la mention Corruption est bien liée').toBeTruthy();
    expect(corr!.category).toBe('characteristics'); // la JAUGE
    // Plus AUCUN lien faux vers le trait Corruption.
    expect(toks.some((t) => typeof t === 'object' && (t as { category: string }).category === 'traits')).toBe(false);
  });

  it('B3 : forme de JAUGE « Points de X » cible la caractéristique sans ambiguïté', () => {
    const corr = characteristics.find((x) => x.label === 'Corruption')!;
    expect(corr, 'caractéristique Corruption présente').toBeTruthy();
    const link = tokenizeLinks('Vous gagnez des Points de Corruption.').find((t) => typeof t === 'object') as
      { category: string; id: string; text: string } | undefined;
    expect(link).toEqual({ category: 'characteristics', id: corr.id, label: 'Corruption', spec: undefined, text: 'Points de Corruption' });
  });

  it('B3 : « Corruption » NU (homonyme jauge⇄trait, concepts DISTINCTS) → aucun lien sans contexte (sûr)', () => {
    // Nature B (cf. HOMONYM_DECISION) : la jauge d'âme et le trait de créature ne sont pas le même
    // concept → un match nu n'est jamais tranchable → on ne lie pas.
    expect(characteristics.find((x) => x.label === 'Corruption') && traits.find((x) => x.label === 'Corruption'), 'homonyme réel Corruption').toBeTruthy();
    const toks = tokenizeLinks('Le sanctuaire répand la Corruption alentour.');
    expect(toks.every((t) => typeof t === 'string')).toBe(true);
  });

  it('B3 : contexte de fiche — « Corruption » NU dans une fiche de TRAIT résout au TRAIT (selfCategory prime)', () => {
    const traitCorr = traits.find((x) => x.label === 'Corruption')!;
    const link = tokenizeLinks('Cette créature répand la Corruption.', undefined, 'traits').find((t) => typeof t === 'object') as
      { category: string; id: string } | undefined;
    expect(link, 'le contexte de fiche tranche l’homonyme').toBeTruthy();
    expect(link!.category).toBe('traits');
    expect(link!.id).toBe(traitCorr.id);
  });

  it('FRAÎCHEUR après persist : renommer une créature (mutation en place) + invalidate → graphe inverse ET index de libellés re-projetés', () => {
    // Miroir de la fraîcheur du registre : les datasets sont mutés EN PLACE (`overrides.ts::setDataset`),
    // puis `invalidateCodexLookup()` bump la version → les index (graphe, catalogue, labelIndex) se
    // reconstruisent depuis la donnée live. Avant invalidation : figés (défensif).
    // Créature au libellé UNIQUE parmi les créatures → l'ancien référant disparaît vraiment du groupe
    // inverse après renommage (pas d'homonyme qui le maintiendrait).
    const c = creatures.find((x) => x.traits.length > 0 && creatures.filter((y) => y.label === x.label).length === 1)!;
    const traitId = c.traits[0].id;
    const renamed = `${c.label} (renommé-test-relations)`;
    const before = [...creatures]; // snapshot des références d'origine pour restauration
    const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    try {
      // Index construits sur l'ancienne donnée.
      expect(groupHas(reverseGroups('traits', traitId), 'creatures', c.label)).toBe(true);
      setDataset('creatures', creatures.map((x) => (x.id === c.id ? { ...x, label: renamed } : x)));
      // Figé tant que non invalidé (même comportement défensif que `codexLookup`).
      expect(groupHas(reverseGroups('traits', traitId), 'creatures', c.label)).toBe(true);
      invalidateCodexLookup();
      // Re-projection : le graphe inverse porte le nouveau libellé, plus l'ancien.
      const groups = reverseGroups('traits', traitId);
      expect(groupHas(groups, 'creatures', renamed)).toBe(true);
      expect(groupHas(groups, 'creatures', c.label)).toBe(false);
      // Et l'index de libellés (auto-liage), dérivé du catalogue, suit aussi : nouveau libellé résolu.
      expect(labelIndex().get(fold(renamed))?.label).toBe(renamed);
    } finally {
      setDataset('creatures', before);
      invalidateCodexLookup();
    }
  });
});
