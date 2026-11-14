/**
 * Migration #3666 — les sorts propres au *Guide fan v4.5* de Frenchy (`guide-frenchy`, HCVM) entrent au
 * catalogue, sourcés au guide, et se posent sur ses profils (second chantier du bestiaire, après #3656).
 * Clément, 2026-11-08 : « Oui, sourcés au guide » ; « Le jour où leurs vfs seront en ma possession, on mettra à
 * jour ses sorts ».
 *
 * GESTES, chacun sur sa seule forme d'avant (#3080) — une pose à faire : un profil du guide qui ne porte pas
 * un sort de `POSES` ; NO-OP quand il n'en reste aucune ni aucun Trait perdu :
 *  1. `books.json` : les livres VO que le registre n'a pas (`LIVRES_VO`) et qu'un sort entrant nomme, au rayon
 *     des cadres de campagne, sans `dir` ;
 *  2. `spells.json` : un sort de `SORTS`, absent du catalogue, qu'une pose à faire attend —
 *     - `desc` : la cellule « Effet » de la table imprimée à la page citée, VERBATIM (extraction du guide,
 *       `31b6c588b4^`, retirée par #3015 ; le guide n'a pas d'extraction sous `Source/`, chaque sort se cite par
 *       page comme ses profils) ; seule l'espace perdue autour d'une emphase soudée (« zone_SAUF_le ») est rétablie ;
 *     - NI, Portée, Cible, Durée : ceux de cette même table (le guide les imprime instanciés pour chaque lanceur) ;
 *     - `titreVO` et `livreVO` : le titre VO que la table imprime, et le livre VO que le guide nomme ;
 *     - `effects` : ce que le vocabulaire des GameOp porte ; le reste de la prose, en op `narrative` verbatim ;
 *  3. `creatures.json` : chaque pose à faire, d'un sort du guide ou d'un sort VF officiel au catalogue que le
 *     guide imprime sous un autre nom (`SORT_VF_DU_GUIDE`) ; un profil absent, un sort VF absent ou un id de
 *     `SORTS` pris par un autre livre passe ;
 *  4. `creatures.json` : les Traits qu'une table de Traits coupée par un saut de page a perdus au bestiaire de
 *     #3656 (`TRAITS_PERDUS`) rejoignent leur profil, s'il est là, avant son premier Trait de menace (Peur, Terreur) ; la
 *     Taille (Grande) porte le Piétinement que le guide imprime (LDB 85 l.387).
 * Les sorts du guide qu'aucun GameOp ne porte restent hors du catalogue et des profils (solde de #3666).
 *
 * ENTRÉES : écrites — `src/data/books.json`, `spells.json`, `creatures.json` ; lues — `traits.json`,
 * `skills.json`, `etats.json`, `domains.json`.
 * FAIL-FAST — dès qu'un geste est à faire, avant toute écriture, sortie 1 : document hors `serializeDataset`,
 * `narrative` d'un sort entrant qui n'est pas une sous-chaîne de sa `desc`, réf d'un sort entrant (livre, Trait,
 * Compétence, État, Domaine, créature invoquée) ou Trait perdu absent de son catalogue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = (rel) => path.join(ROOT, 'src/data', rel);

const LIVRE = 'guide-frenchy';
const source = (page) => ({ book: LIVRE, page });

const LIVRES_VO = [
  { id: 'deft-steps-light-fingers', type: 'books', label: 'Deft Steps, Light Fingers', abbr: 'DSLF', language: 'VO', folder: 'Cadre de campagne' },
  { id: 'tribes-and-tribulations', type: 'books', label: 'Tribes and Tribulations', abbr: 'TT', language: 'VO', folder: 'Cadre de campagne' },
];
/** Le rayon des cadres de campagne VO : les livres neufs suivent cette entrée. */
const APRES = 'reikland-miscellanea';

const RAT_CORNU = 'rat-cornu-compagnon';
const PDT = 'pouvoir-derriere-le-trone-compagnon';
const TT = 'tribes-and-tribulations';

const doOps = (on, ...ops) => ({ kind: 'do', effect: { type: 'ops', on, ops } });
const seq = (...steps) => ({ kind: 'seq', steps });
const test = (t, fail, success = seq()) => ({ kind: 'test', test: t, success, fail });
const narr = (text) => ({ op: 'narrative', text });
const resistance = { skill: { id: 'resistance' }, difficulty: 'intermediaire' };
const calme = { skill: { id: 'calme' }, difficulty: 'intermediaire' };
const distance = (value) => ({ kind: 'distance', value, unit: 'm' });
const un = { kind: 'count', n: 1 };
const soi = { kind: 'self' };
const zone = (meters, affects) => ({ kind: 'area', span: 'diameter', meters, ...(affects ? { affects } : {}) });
const ADVERSAIRES = { kind: 'relation', who: 'target', is: 'adversaire' };
const ALLIES = { kind: 'relation', who: 'target', is: 'allie' };
const tours = (value, plus) => ({ kind: 'rounds', value, ...(plus ? { plus: true } : {}) });
const arcane = (subType, domainId) => ({ family: 'arcane', ecole: 'Magie des Arcanes', subType, ...(domainId ? { domainId } : {}) });

/** Sorts neufs, dans l'ordre du guide par famille : [id, libellé, page, titre VO, livre VO, champs]. */
const SORTS = [
  ['armure-d-obscurite', 'Armure d’Obscurité', 377, 'Armour of Darkness', RAT_CORNU, {
    ...arcane('Ombres (skaven)'), cn: 6, range: soi, target: soi, duration: { kind: 'clock', value: 40, unit: 'minutes' },
    desc: 'le sorcier bénéficie de 2 Points d’Armure (corps entier) et d’un Bonus +20 en Discrétion.',
    effects: seq(doOps('target', { op: 'ap', amount: 2 }, { op: 'skillMod', skill: { id: 'discretion' }, mod: 20 })),
  }],
  ['rage-meurtriere-hcvm', 'Rage Meurtrière', 374, 'Death Frenzy', RAT_CORNU, {
    ...arcane('Arcanes skaven'), cn: 5, range: { kind: 'touch' }, target: un, duration: tours(4, true),
    desc: 'La cible du sort gagne l’État « Frénésie ». Une cible récalcitrante peut tenter de résister en réussissant un test de Calme (+0). En ce cas, la cible perd 1 PB.',
    effects: seq(test(calme, doOps('target', { op: 'grantTrait', trait: { id: 'frenesie' } }), doOps('target', { op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }))),
  }],
  ['pattes-gluantes', 'Pattes Gluantes', 380, 'Sticky Paws', null, {
    ...arcane('Ombres (skaven)'), cn: 8, range: soi, target: soi, duration: { kind: 'clock', value: 7, unit: 'minutes' },
    desc: 'Le skaven gagne le Trait (_Wallcrawler_) : il peut progresser sur n’importe quelle surface avec sa pleine valeur de Mouvement et sans Tests d’Escalade. Y compris au plafond, la tête à l’envers.',
    effects: seq(doOps('target', { op: 'grantTrait', trait: { id: 'grimpant' } })),
  }],
  ['poudre-d-escampette', 'Poudre d’Escampette', 374, 'Swift Scamper', null, {
    ...arcane('Ombres (skaven)'), cn: 4, range: soi, target: soi, duration: tours({ sum: [{ sl: true }, 4] }),
    desc: 'Le skaven obtient un Bonus de +2 en Mouvement. Pour chaque +2 DR au-dessus de +0, le Mouvement peut encore être augmenté de +1.',
    effects: seq(doOps('target', { op: 'moveMod', mod: 2 }, narr('Pour chaque +2 DR au-dessus de +0, le Mouvement peut encore être augmenté de +1.'))),
  }],
  ['flamme-verdatre', 'Flamme Verdâtre', 362, 'Ghostly Flame', RAT_CORNU, {
    family: 'mineure', ecole: 'Magie mineure', subType: 'Skaven', cn: 0, range: distance(20), target: un,
    duration: { kind: 'special', text: '1 Heure OU Instantané' }, missile: true, damage: 5,
    desc: 'Le mage fait apparaître une bulle gazeuse qui s’enflamme dans les airs. S’il s\'en sert de source lumineuse, elle éclaire comme une torche pendant 1 heure. S’il s’en sert de projectile, le mage utilise la Compétence Tir (Jet / Lancer). Le projectile inflige 5 Points de Dégâts (armures OK).',
    effects: seq(doOps('target', narr('S’il s\'en sert de source lumineuse, elle éclaire comme une torche pendant 1 heure.'), narr('S’il s’en sert de projectile, le mage utilise la Compétence Tir (Jet / Lancer).'))),
  }],
  ['hebetement', 'Hébètement', 362, 'Wrack', RAT_CORNU, {
    ...arcane('Arcanes skaven'), cn: 0, range: distance(2), target: un, duration: { kind: 'instant' },
    desc: 'Le sorcier envoie une étincelle depuis son doigt vers sa cible. La cible effectue un test de Résistance (+0) VS 1 État « Étourdi ».',
    effects: seq(test(resistance, doOps('target', { op: 'condition', id: 'sonne' }))),
  }],
  ['crepitement-funeste', 'Crépitement Funeste', 362, 'Crackling Doom', RAT_CORNU, {
    ...arcane('Ruine (skaven)'), cn: 5, range: distance(2), target: un, duration: { kind: 'instant' },
    desc: 'Le sorcier provoque un arc d’énergie verdâtre qui frappe sa cible et inflige 6 Points de Dégâts (armure OK). La cible effectue un Test de Résistance (+0) VS 1 État « Étourdi ».',
    effects: seq(doOps('target', { op: 'wounds', amount: 6, ignoreTB: false, ignoreAP: false }), test(resistance, doOps('target', { op: 'condition', id: 'sonne' }))),
  }],
  ['depecage', 'Dépeçage', 362, 'Flensing Ruin', RAT_CORNU, {
    ...arcane('Ruine (skaven)'), cn: 6, range: distance(2), target: un, duration: { kind: 'instant' }, missile: true, damage: 6, ignorePA: true,
    desc: 'Projectile magique qui inflige 6 Points de Dégâts (pas d’armure).',
    effects: seq(),
  }],
  ['bouclier-hcvm', 'Bouclier', 362, 'Warp Shield', RAT_CORNU, {
    ...arcane('Ruine (skaven)'), cn: 6, range: soi, target: soi, duration: tours(2, true),
    desc: 'Le sorcier bénéficie de +10 Points d’Armure. Si un adversaire attaque à mains nues ou avec une arme métallique, il encaisse 7 Points de Dégâts à cause des interférences (pas de PA d’armure métallique).',
    effects: seq(doOps('target', { op: 'ap', amount: 10 }, narr('Si un adversaire attaque à mains nues ou avec une arme métallique, il encaisse 7 Points de Dégâts à cause des interférences (pas de PA d’armure métallique).'))),
  }],
  ['rafale-hurlante', 'Rafale Hurlante', 365, 'Howling Warpgale', RAT_CORNU, {
    ...arcane('Ruine (skaven)'), cn: 7, range: soi, target: zone(4, ADVERSAIRES), duration: tours(4, true),
    desc: 'Les ennemis dans la zone ne peuvent pas voler. Les Tirs des ennemis ont un Malus de -10. Les alliés du sorcier ne sont pas affectés.',
    effects: seq(doOps('target', { op: 'skillMod', skill: { id: 'projectiles' }, mod: -10 }, narr('Les ennemis dans la zone ne peuvent pas voler.'))),
  }],
  ['immuno-deficience', 'Immuno - Déficience', 387, 'Vector', RAT_CORNU, {
    ...arcane('Arcanes skaven'), cn: 0, range: distance(4), target: un, duration: { kind: 'clock', value: 24, unit: 'hours' },
    desc: 'La cible effectue un Test de Résistance (+0). En cas d’échec, elle a un Malus de -20 pour résister aux maladies pendant 24 heures.',
    effects: seq(test(resistance, doOps('target', { op: 'diseaseTestMod', amount: -20 }))),
  }],
  ['arme-souillee', 'Arme Souillée', 306, 'Bless With Filth', RAT_CORNU, {
    ...arcane('Peste (skaven)'), cn: 6, range: { kind: 'touch' }, target: un, duration: { kind: 'special', text: '8 Minutes +' },
    desc: 'Le démon frotte 1 arme sur une blessure purulente. Une cible touchée per cette arme ou ces munitions souffre de 1 État « Empoisonné » en plus des dégâts. Les Tests de Résistance se font à (+0).',
    effects: seq(doOps('target',
      { op: 'augmentWeapon', onHitEffects: [{ trigger: 'onHit', on: 'victime', flow: doOps('target', { op: 'condition', id: 'empoisonne' }) }] },
      narr('Les Tests de Résistance se font à (+0).'))),
  }],
  ['nuee-de-mouches', 'Nuée de Mouches', 306, 'Veil of Flies', RAT_CORNU, {
    ...arcane('Peste (skaven)'), cn: 6, range: soi, target: zone(8), duration: tours(8, true),
    desc: 'Le démon développe le Trait « Distraction ». Les alliés et ennemis à moins de 3 mètres du démon subissent un Malus de -20 à _TOUS_ leurs Tests.',
    effects: seq(doOps('caster',
      { op: 'grantTrait', trait: { id: 'perturbant' } },
      narr('Les alliés et ennemis à moins de 3 mètres du démon subissent un Malus de -20 à _TOUS_ leurs Tests.'))),
  }],
  ['haleine-fetide', 'Haleine Fétide', 311, 'Pestilent Breath', RAT_CORNU, {
    ...arcane('Peste (skaven)'), cn: 8, range: distance(8), target: { kind: 'special', text: 'Cône Longueur (8 Mètres) x Largeur (2 Mètres)' }, duration: { kind: 'instant' },
    desc: 'Le démon exhale une haleine fétide. Quiconque est dans la zone d’effet effectue un Test de Résistance (-10) VS 8 PB (pas d’armures). Pour chaque +2 DR au-dessus de +0, la largeur peut augmenter de +1 Mètre.',
    effects: seq(
      test({ skill: { id: 'resistance' }, difficulty: 'complexe' }, doOps('target', { op: 'wounds', amount: 8, ignoreTB: false, ignoreAP: true })),
      doOps('caster', narr('Pour chaque +2 DR au-dessus de +0, la largeur peut augmenter de +1 Mètre.'))),
  }],
  ['avatar-du-rat-cornu', 'Avatar du Rat Cornu', 418, 'Aspect of the Horned Rat', null, {
    ...arcane('Arcanes skaven'), cn: 4, range: soi, target: soi, duration: tours(5),
    desc: 'Le visage du sorcier se tord et prend l’aspect du Rat Cornu en personne. Le sorcier gagne les Traits suivants : Belligérant, Peur 1, Haine. Pour chaque +2 DR au-dessus de +0 le Trait Peur augmente de +1. À la fin du sort, le sorcier effectue un Test de Résistance (+0) VS 1 État « Fatigue ».',
    effects: seq(doOps('target',
      { op: 'grantTrait', trait: { id: 'belliqueux' } },
      { op: 'grantTrait', trait: { id: 'peur', value: 1 }, indicePerSL: { every: 2, amount: 1 } },
      { op: 'grantTrait', trait: { id: 'haine' } },
      narr('À la fin du sort, le sorcier effectue un Test de Résistance (+0) VS 1 État « Fatigue ».'))),
  }],
  ['cacophonie-scabreuse', 'Cacophonie Scabreuse', 290, 'Cacophonic Caress', PDT, {
    family: 'chaos', ecole: 'Magie du Chaos', subType: 'Slaanesh', cn: 6, range: soi, target: { ...zone(8, ADVERSAIRES), excludesCaster: true }, duration: { kind: 'instant' },
    desc: 'Le démon hurle des obscénités. Tous les ennemis dans la zone subissent 3 Points de Dégâts par DR + 8 Points de Dégâts (pas d’armure).',
    effects: seq(doOps('target', { op: 'wounds', amount: 8, perSL: { every: 1, amount: 3 }, ignoreTB: false, ignoreAP: true })),
  }],
  ['langue-aceree', 'Langue Acérée', 290, 'Cutting Wit', PDT, {
    family: 'chaos', ecole: 'Magie du Chaos', subType: 'Slaanesh', cn: 6, range: distance(8), target: un, duration: tours(8),
    desc: 'Le démon projette sa langue devenue un instant protractile. La cible subit 11 Points de Dégâts (pas d’armure).',
    effects: seq(doOps('target', { op: 'wounds', amount: 11, ignoreTB: false, ignoreAP: true })),
  }],
  ['courage-du-loup', 'Courage du Loup', 93, 'Heart of the Wolf', PDT, {
    family: 'invocation', ecole: 'Invocation', subType: 'Ulric', cn: null, range: soi, target: zone(5, ALLIES), duration: tours(5),
    desc: 'Tous les alliés dans la zone perdent leur État « En Déroute ». Pendant la durée du miracle, ils sont immunisés VS Peur / Terreur / Intimidation.',
    effects: seq(doOps('target', { op: 'removeCondition', id: 'brise', all: true }, narr('Pendant la durée du miracle, ils sont immunisés VS Peur / Terreur / Intimidation.'))),
  }],
  ['piste-froide', 'Piste Froide', 120, 'The Heat is Off', 'deft-steps-light-fingers', {
    family: 'invocation', ecole: 'Invocation', subType: 'Ranald', cn: null, range: soi, target: soi, duration: { kind: 'clock', value: 5, unit: 'hours' },
    desc: 'Après avoir commis un crime (cambriolage…), les personnes que croise le PJ l’ignorent, y compris les autorités ou le Guet. Le miracle prend fin si le prêtre commet un nouveau crime. Tant que le miracle est actif, le prêtre a un Malus de -3 DR pour les Tests de Sociabilité car ses interlocuteurs ne parviennent pas à se concentrer sur ce que le prêtre dit.',
    effects: seq(doOps('target',
      { op: 'charDRBonus', characteristic: 'sociabilite', bonus: -3 },
      narr('Après avoir commis un crime (cambriolage…), les personnes que croise le PJ l’ignorent, y compris les autorités ou le Guet. Le miracle prend fin si le prêtre commet un nouveau crime.'))),
  }],
  ['crepitements-vengeurs', 'Crépitements Vengeurs', 449, 'Vindictive Glare', TT, {
    ...arcane('Waaagh mineure (Mork)'), cn: 6, range: distance(30), target: zone(3), duration: { kind: 'instant' }, missile: true, damage: 7,
    desc: 'Des éclairs verts jaillissent des doigts du shaman. Projectile magique qui inflige 7 Points de Dégâts (armure OK). Les cibles blessées effectuent un Test de Calme (+0) VS État « Étourdi ».',
    effects: seq({ kind: 'if', cond: { kind: 'woundsDealt', op: '>', value: 0 }, then: test(calme, doOps('target', { op: 'condition', id: 'sonne' })) }),
  }],
  ['lune-de-malheur', 'Lune de Malheur', 456, 'Curse of da Bad Moon', TT, {
    ...arcane('Waaagh mineure (Mork)'), cn: 8, range: distance(6), target: zone(6), duration: tours(6),
    desc: 'Le shaman invoque une lune grimaçante qui flotte dans les airs. Les personnes ou créatures dans la zone sont maudites : elles subissent 1 État « Fatigue » et elles ne peuvent pas utiliser de Points de détermination pendant la durée du sort.',
    effects: seq(doOps('target', { op: 'condition', id: 'extenue' }, narr('elles ne peuvent pas utiliser de Points de détermination pendant la durée du sort.'))),
  }],
  ['prise-de-tete', 'Prise de Tête', 473, 'Brainbursta', TT, {
    ...arcane('Waaagh majeure (Gork)'), cn: 4, range: distance(5), target: un, duration: { kind: 'instant' },
    desc: 'Le sort fait bouillir la cervelle de la cible qui subit immédiatement 1 État « À Terre » + 1 État « Étourdi ». Pour chaque +1 DR au-dessus de +0, on ajoute +1 État « Étourdi ». Si le nombre d’État « Étourdi » subis dépasse le Bonus d’Endurance de la cible, elle effectue un Test de Calme (+20). En cas d’échec, la cible encaisse un Coup Critique à la Tête.',
    effects: seq(doOps('target',
      { op: 'condition', id: 'a-terre' },
      { op: 'condition', id: 'sonne', value: 1, valuePerSL: { every: 1, amount: 1 } },
      narr('Si le nombre d’État « Étourdi » subis dépasse le Bonus d’Endurance de la cible, elle effectue un Test de Calme (+20). En cas d’échec, la cible encaisse un Coup Critique à la Tête.'))),
  }],
  ['z-oeils-de-mork', 'Z’Oeils de Mork', 473, 'Gaze of Mork', TT, {
    ...arcane('Waaagh majeure (Gork)'), cn: 4, range: distance(55), target: { kind: 'special', text: 'Spécial' }, duration: { kind: 'instant' },
    desc: 'Un rayon vert surgit des yeux du shaman. Toute personne ou créature sur la trajectoire du rayon encaisse 4 PB. Les structures dont l’Endurance est inférieure à 65 peuvent également être endommagées.',
    effects: seq(doOps('target', { op: 'wounds', amount: 4, ignoreTB: true, ignoreAP: true }, narr('Les structures dont l’Endurance est inférieure à 65 peuvent également être endommagées.'))),
  }],
  ['coup-d-boule', 'Coup d’Boule !', 473, '’Eadbutt !', TT, {
    ...arcane('Waaagh majeure (Gork)'), cn: 5, range: distance(5), target: un, duration: { kind: 'instant' }, missile: true, damage: 1,
    desc: 'Projectile magique qui touche _TOUJOURS_ la tête de la cible en infligeant +1 PB. Si la cible est un mage, les Dégâts montent à +6 !',
    effects: seq(doOps('target', narr('Projectile magique qui touche _TOUJOURS_ la tête de la cible'), narr('Si la cible est un mage, les Dégâts montent à +6 !'))),
  }],
  ['soleil-noir', 'Soleil Noir', 481, 'The Evil Sun', TT, {
    ...arcane('Waaagh majeure (Gork)'), cn: 11, range: distance(8), target: zone(8), duration: tours(8),
    desc: 'Un soleil grimaçant apparaît. Les cibles dans la zone encaisse 8 Points de Dégâts à chaque Tour (armure OK). Les cibles effectue également, à chaque Tour, un Test Résistance (+0) VS 1 État « En Feu ».',
    effects: seq(
      doOps('caster', { op: 'zone', shape: 'disc', radiusMeters: 4, perRound: [{ op: 'wounds', amount: 8, ignoreTB: false, ignoreAP: false }] }),
      doOps('target', narr('Les cibles effectue également, à chaque Tour, un Test Résistance (+0) VS 1 État « En Feu ».'))),
  }],
  ['waaagh', 'WAAAGH !', 481, 'WAAAGH !', TT, {
    ...arcane('Waaagh majeure (Gork)'), cn: 11, range: soi, target: zone(85, ALLIES), duration: tours(8),
    desc: 'Chaque cible dans la zone ajoute +1 Avantage dans la Réserve des Peaux-Vertes. Les alliés du shaman dans la zone perdent leurs États « En Déroute » et gagnent un Bonus de +2 DR pour les Tests de Calme et de Résistance.',
    effects: seq(doOps('target',
      { op: 'removeCondition', id: 'brise', all: true },
      { op: 'skillDRBonus', skill: { id: 'calme' }, bonus: 2 },
      { op: 'skillDRBonus', skill: { id: 'resistance' }, bonus: 2 },
      narr('Chaque cible dans la zone ajoute +1 Avantage dans la Réserve des Peaux-Vertes.'))),
  }],
  ['algues-cruelles', 'Algues Cruelles', 503, 'Tangleweed', null, {
    ...arcane(null), cn: 5, range: distance(90), target: zone(9), duration: { kind: 'special', text: 'Spécial' },
    desc: 'Les algues répondent à la volonté du mage. Elles agrippent toute personne dans la zone d’effet et inflige 1 État « Enchevêtré » par DR du Test de Langue (Magick) avec une Force égale à la FM du mage. Au Tour suivant, les algues attirent les cibles sous l’eau (appliquer les règles de noyade).',
    effects: seq(doOps('target',
      { op: 'condition', id: 'empetre', value: 0, valuePerSL: { every: 1, amount: 1 }, escapeStrength: { charOf: 'force-mentale' } },
      narr('Au Tour suivant, les algues attirent les cibles sous l’eau (appliquer les règles de noyade).'))),
  }],
  ['vague-scelerate', 'Vague Scélérate', 503, 'Angry Wave', null, {
    ...arcane(null), cn: 11, range: { kind: 'special', text: 'Spécial' }, target: { kind: 'special', text: 'Zone Diamètre 9 mètres +' }, duration: tours(1),
    desc: 'Il faut que le mage soit à proximité immédiate d’un fleuve ou d’un lac. Le mage invoque une vague géante qui peut atteindre des cibles à (2 x Bonus FM mage) mètres du bord. C’est une attaque magique qui inflige 10 Points de Dégâts (armure OK) à toute personne ou créature dans la zone d’effet. Celles qui sont entre la source d’eau et la zone d’effet encaissent 5 Points de Dégâts. Toutes ces cibles effectuent un Test d’Athlétisme (+0). En cas d’échec, elles sont entraînées par le reflux et se retrouvent à l’eau à (DR Test Langue (Magick) + DR Test Athlétisme).',
    effects: seq(
      doOps('target',
        { op: 'wounds', amount: 10, ignoreTB: false, ignoreAP: false },
        narr('Il faut que le mage soit à proximité immédiate d’un fleuve ou d’un lac.'),
        narr('Celles qui sont entre la source d’eau et la zone d’effet encaissent 5 Points de Dégâts.')),
      test({ skill: { id: 'athletisme' }, difficulty: 'intermediaire' },
        doOps('target', narr('elles sont entraînées par le reflux et se retrouvent à l’eau à (DR Test Langue (Magick) + DR Test Athlétisme).')))),
  }],
  ['forme-spectrale', 'Forme Spectrale', 523, 'Spirit Walk', 'empire-en-ruine-compagnon', {
    ...arcane('Nécromancie', 'necromancie'), cn: 4, range: soi, target: soi, duration: tours(7),
    desc: 'Le nécromancien devient « Éthéré » : il peut passer à travers les objets solides (portes, murs) et ne peut être blessé qu’avec des armes magiques ou des sorts.',
    effects: seq(doOps('target', { op: 'grantTrait', trait: { id: 'ethere' } })),
  }],
  ['invocation-d-un-colosse-necrofex', 'Invocation d’un Colosse Necrofex', 524, 'Create Construct', null, {
    ...arcane(null), cn: 180, range: distance(70), target: { kind: 'special', text: '1 Cimetère / Charnier / Champ de Bataille' }, duration: { kind: 'untilDawn' },
    desc: 'Voir le profil de la créature par ailleurs.',
    effects: seq(doOps('caster', { op: 'summon', ref: 'colosse-necrofex', count: 1, allyOfCaster: true })),
  }],
];

/** Sort VF officiel que le guide imprime sous son nom de traduction : l'Agression Æthyrique est *Disrupt Magic*
 *  (WoM p.26, VDM p.26) ; la Brume Mystique, celle de la magie du marais (VDM p.217). */
const SORT_VF_DU_GUIDE = ['perturber-la-magie', 'brume-mystique-magie-du-marais'];

/** Sort → profils du guide qui l'impriment (ids du bestiaire). */
const POSES = {
  'armure-d-obscurite': ['assassin', 'maitre-assassin', 'prophete-gris', 'prophete-gris-ancien'],
  'rage-meurtriere-hcvm': ['coureur-d-egouts', 'assassin', 'maitre-assassin'],
  'pattes-gluantes': ['maitre-assassin'],
  'poudre-d-escampette': ['coureur-d-egouts', 'assassin', 'maitre-assassin', 'prophete-gris', 'prophete-gris-ancien'],
  'flamme-verdatre': ['technomage', 'technomage-experimente', 'architechnomage', 'moine-de-la-peste', 'grand-moine-de-la-peste', 'predicateur-de-la-peste', 'prophete-gris', 'prophete-gris-ancien'],
  hebetement: ['technomage', 'technomage-experimente', 'architechnomage', 'moine-de-la-peste', 'grand-moine-de-la-peste', 'predicateur-de-la-peste', 'prophete-gris', 'prophete-gris-ancien'],
  'crepitement-funeste': ['technomage', 'technomage-experimente', 'architechnomage'],
  depecage: ['technomage', 'technomage-experimente', 'architechnomage', 'prophete-gris', 'prophete-gris-ancien'],
  'bouclier-hcvm': ['technomage', 'technomage-experimente', 'architechnomage'],
  'rafale-hurlante': ['technomage-experimente', 'architechnomage'],
  'immuno-deficience': ['moine-de-la-peste', 'grand-moine-de-la-peste', 'predicateur-de-la-peste', 'prophete-gris', 'prophete-gris-ancien'],
  'arme-souillee': ['heraut-exalte-de-nurgle', 'grand-immonde-de-nurgle', 'grand-immonde-exalte-de-nurgle'],
  'nuee-de-mouches': ['heraut-exalte-de-nurgle', 'grand-immonde-de-nurgle', 'grand-immonde-exalte-de-nurgle', 'grand-moine-de-la-peste', 'predicateur-de-la-peste', 'prophete-gris', 'prophete-gris-ancien'],
  'haleine-fetide': ['grand-immonde-de-nurgle', 'grand-immonde-exalte-de-nurgle'],
  'avatar-du-rat-cornu': ['prophete-gris', 'prophete-gris-ancien'],
  'cacophonie-scabreuse': ['heraut-exalte-de-slaanesh', 'gardien-des-secrets-de-slaanesh', 'gardien-des-secrets-exalte-de-slaanesh'],
  'langue-aceree': ['heraut-exalte-de-slaanesh', 'gardien-des-secrets-de-slaanesh', 'gardien-des-secrets-exalte-de-slaanesh'],
  'courage-du-loup': ['pretre-d-ulric'],
  'piste-froide': ['pretre-voleur-de-ranald-niveau-3'],
  'crepitements-vengeurs': ['shaman-gobelin', 'grand-shaman-gobelin', 'fongus-de-mork'],
  'lune-de-malheur': ['fongus-de-mork'],
  'prise-de-tete': ['shaman-orc', 'grand-shaman-orc', 'fongus-de-gork'],
  'z-oeils-de-mork': ['shaman-orc', 'grand-shaman-orc', 'fongus-de-gork'],
  'coup-d-boule': ['shaman-orc', 'grand-shaman-orc', 'fongus-de-gork'],
  'soleil-noir': ['fongus-de-gork'],
  waaagh: ['fongus-de-gork'],
  'algues-cruelles': ['affreuse-vieille-sorciere-troll-des-marais'],
  'vague-scelerate': ['affreuse-vieille-sorciere-troll-des-marais'],
  'forme-spectrale': ['magister-mortis', 'vampire-hcvm', 'comte-vampire', 'seigneur-vampire'],
  'invocation-d-un-colosse-necrofex': ['magister-mortis'],
  'perturber-la-magie': ['seigneur-vampire'],
  'brume-mystique-magie-du-marais': ['affreuse-vieille-sorciere-troll-des-marais'],
};

/** Profil → Traits imprimés sur la suite de sa table de Traits, après le saut de page (guide p.501). */
const TRAITS_PERDUS = {
  'affreuse-vieille-sorciere-troll-des-marais': [{ id: 'regeneration' }, { id: 'taille', arg: 'grande' }],
};

const fautes = [];
const docs = new Map();
function charger(rel) {
  if (!docs.has(rel)) {
    const texte = fs.readFileSync(DATA(rel), 'utf8');
    const doc = JSON.parse(texte);
    if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage hors serializeDataset`);
    docs.set(rel, { doc, avant: texte });
  }
  return docs.get(rel).doc;
}
/** Ids d'un catalogue : liste d'entrées, ou record keyé par id (`etats.json`). */
function ids(rel) {
  const doc = JSON.parse(fs.readFileSync(DATA(rel), 'utf8'));
  return new Set(Array.isArray(doc) ? doc.map((e) => e.id) : Object.keys(doc));
}

const books = charger('books.json');
const spells = charger('spells.json');
const creatures = charger('creatures.json');
const refs = { trait: ids('traits.json'), skill: ids('skills.json'), etat: ids('etats.json'), domain: ids('domains.json'), creature: new Set(creatures.map((c) => c.id)) };
const profilDuGuide = (pid) => creatures.find((c) => c.id === pid && c.source?.book === LIVRE);
const SORT = new Map(SORTS.map((s) => [s[0], s]));

/** Forme d'avant de chaque pose : un profil du guide qui ne porte pas le sort, d'un sort du guide ou de
 *  `SORT_VF_DU_GUIDE` au catalogue. Un profil ou un sort VF absent, ou une pose déjà faite, passe. */
const posesAFaire = Object.entries(POSES).flatMap(([sort, profils]) => {
  const pris = spells.find((s) => s.id === sort);
  if (SORT.has(sort) ? pris && pris.source?.book !== LIVRE : !SORT_VF_DU_GUIDE.includes(sort) || !pris) return [];
  return profils.map(profilDuGuide).filter((p) => p && !p.spells.includes(sort)).map((p) => [sort, p]);
});
/** Forme d'avant d'un Trait perdu : un profil du guide qui ne le porte pas, et porte un Trait de menace. */
const traitsAFaire = Object.entries(TRAITS_PERDUS).flatMap(([pid, perdus]) => {
  const p = profilDuGuide(pid);
  if (!p || !p.traits.some((t) => t.id === 'peur' || t.id === 'terreur')) return [];
  const manquants = perdus.filter((t) => !p.traits.some((x) => x.id === t.id));
  return manquants.length ? [[p, manquants]] : [];
});
/** Un sort du guide n'entre que pour une pose à faire, et s'il manque au catalogue. */
const aEntrer = [...new Set(posesAFaire.map(([sort]) => sort))].filter((sort) => SORT.has(sort) && !spells.some((s) => s.id === sort)).map((sort) => SORT.get(sort));

if (!posesAFaire.length && !traitsAFaire.length) {
  console.log('#3666 — aucune pose ni aucun Trait perdu à la forme d’avant : rien à écrire.');
  process.exit(0);
}

for (const livre of LIVRES_VO) {
  if (books.some((b) => b.id === livre.id) || !aEntrer.some((s) => s[4] === livre.id)) continue;
  const i = books.findIndex((b) => b.id === APRES);
  books.splice(i < 0 ? books.length : i + 1, 0, livre);
}
const livres = new Set(books.map((b) => b.id));

/** Toute réf d'un arbre d'effets, vérifiée contre son catalogue. */
function verifierRefs(id, noeud) {
  if (Array.isArray(noeud)) return noeud.forEach((n) => verifierRefs(id, n));
  if (noeud == null || typeof noeud !== 'object') return;
  const manque = (cat, ref) => { if (!refs[cat].has(ref)) fautes.push(`${id} : ${cat} ${ref} absent du catalogue`); };
  if (noeud.op === 'grantTrait') manque('trait', noeud.trait.id);
  if (noeud.op === 'skillMod' || noeud.op === 'skillDRBonus') manque('skill', noeud.skill.id);
  if (noeud.op === 'condition' || (noeud.op === 'removeCondition' && noeud.id)) manque('etat', noeud.id);
  if (noeud.op === 'summon') manque('creature', noeud.ref);
  if (noeud.test?.skill) manque('skill', noeud.test.skill.id);
  Object.values(noeud).forEach((v) => verifierRefs(id, v));
}
const narratives = (noeud) => (Array.isArray(noeud) ? noeud.flatMap(narratives) : noeud && typeof noeud === 'object'
  ? [...(noeud.op === 'narrative' ? [noeud.text] : []), ...Object.values(noeud).flatMap(narratives)] : []);

const neufs = aEntrer.map(([id, label, page, titre, livre, champs]) => {
  if (livre && !livres.has(livre)) fautes.push(`${id} : livre VO ${livre} absent du registre`);
  if (champs.domainId && !refs.domain.has(champs.domainId)) fautes.push(`${id} : Domaine ${champs.domainId} absent`);
  for (const t of narratives(champs.effects)) if (!champs.desc.includes(t)) fautes.push(`${id} : narrative hors desc — « ${t} »`);
  verifierRefs(id, champs.effects);
  const { desc, effects, ...resolution } = champs;
  return { id, type: 'spells', label, ...resolution, desc, effects, source: source(page), titreVO: titre, ...(livre ? { livreVO: { id: livre } } : {}) };
});
for (const [p, manquants] of traitsAFaire) for (const t of manquants) if (!refs.trait.has(t.id)) fautes.push(`TRAITS_PERDUS ${p.id} : trait ${t.id} absent`);

if (fautes.length) {
  console.error(`#3666 — rien n'est écrit :\n  ${fautes.join('\n  ')}`);
  process.exit(1);
}
spells.push(...neufs);
for (const [sort, p] of posesAFaire) p.spells.push(sort);
for (const [p, manquants] of traitsAFaire) p.traits.splice(p.traits.findIndex((t) => t.id === 'peur' || t.id === 'terreur'), 0, ...manquants);
for (const [rel, { doc, avant }] of docs) {
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(DATA(rel), apres);
}
console.log(`#3666 — ${neufs.length} sort(s) neuf(s), ${posesAFaire.length} pose(s), ${traitsAFaire.reduce((n, [, m]) => n + m.length, 0)} Trait(s) perdu(s).`);
