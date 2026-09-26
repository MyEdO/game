// Banc de la RÉPARATION du mobilier de page (`reparer-mobilier.mjs`, #1739) : suppression de ligne,
// retrait de jeton, scission d'un titre soudé, et le refus d'écrire — collage de lignes, mot ajouté
// ou retiré hors des sites.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { infidelite, motsDe, niveauDeLegende, niveauDesFreres, reparer, texteDeBandeau } from './reparer-mobilier.mjs'
import { sitesDeMobilier } from './lib/mobilier.mjs'

const sites = (texte, O, folios = [0, 0]) => sitesDeMobilier(texte, { O: new Set(O), folios })

test('ligne réduite au mobilier : SUPPRIMÉE, et une des deux lignes vides qui l’encadraient part avec elle', () => {
  const avant = ['texte', '', 'III', '', '## **ARTIST**', '', '58', '', 'fin'].join('\n')
  const { texte, refus } = reparer(avant, sites(avant, ['III'], [43, 108]))
  assert.deepEqual(refus, [])
  assert.equal(texte, ['texte', '', '## **ARTIST**', '', 'fin'].join('\n'))
})

test('une suppression qui COLLERAIT deux lignes non vides est REFUSÉE, nommée, et la ligne reste', () => {
  const avant = ['| a | b |', 'V', '| c | d |'].join('\n')
  const { texte, refus } = reparer(avant, sites(avant, ['V']))
  assert.equal(refus.length, 1)
  assert.match(refus[0], /^l\.2 : .*collerait/)
  assert.equal(texte, avant)
})

test('jeton dans une ligne : retiré, la prose et le gras intacts', () => {
  const avant = ['# **POISONS** V', '', 'V **Aimed Shots** If you spend'].join('\n')
  assert.equal(reparer(avant, sites(avant, ['V'])).texte, ['# **POISONS**', '', '**Aimed Shots** If you spend'].join('\n'))
})

test('titre SOUDÉ : scindé en DEUX titres au niveau le plus porté par les titres frères du fichier', () => {
  const avant = ['### **Chill Grasp**', '', 'x', '', '#### **Bounce** XII **Cold-blooded**', '', 'y', '', '### **Constrictor**', '', '# **Fear**'].join('\n')
  const { texte, scindes } = reparer(avant, sites(avant, ['XII']))
  assert.deepEqual(scindes, [{ ligne: 5, titres: ['### **Bounce**', '### **Cold-blooded**'] }])
  assert.equal(texte.split('\n').slice(4, 7).join('\n'), '### **Bounce**\n\n### **Cold-blooded**')
  assert.equal(niveauDesFreres(avant.split('\n'), 4), '###')
})

test('fidélité : les mots retirés sont EXACTEMENT les jetons des sites, aucun n’est ajouté', () => {
  const avant = 'III\n\n# **POISONS** V\n\nThe sceptre XI rules'
  const s = [{ jeton: 'III' }, { jeton: 'V' }, { jeton: 'XI' }]
  assert.equal(infidelite(avant, '# **POISONS**\n\nThe sceptre rules', s), null)
  assert.match(infidelite(avant, '# **POISONS**\n\nThe rules', s), /≠ jetons des sites/)
  assert.match(infidelite(avant, '# **POISONS**\n\nThe sceptre XI rules now', s), /AJOUTÉS : now×1/)
  assert.deepEqual([...motsDe('a b a')], [['a', 2], ['b', 1]])
})

test('table SANS DONNÉE après retrait (bandeau lu comme table) : UNE ligne de titre au texte verbatim, au niveau des LÉGENDES', () => {
  const avant = [
    '# **Chapitre**', 'texte', '', '| a | b |', '|---|---|', '| 1 | 2 |', '',
    '| EXAMPLE DIFFICULTIES | V |', '|----------------------|---|', '',
    '| Difficulty | Action |', '|---|---|', '| Easy | x |', '',
    '### **SOCIAL FACTORS**', '', '| c | d |', '|---|---|', '| 3 | 4 |',
  ].join('\n')
  const { texte, bandeaux } = reparer(avant, sites(avant, ['V']))
  assert.deepEqual(bandeaux, [{ ligne: 8, titre: '### **EXAMPLE DIFFICULTIES**' }])
  assert.equal(texte.split('\n').slice(7, 10).join('\n'), '### **EXAMPLE DIFFICULTIES**\n\n| Difficulty | Action |')
  assert.equal(infidelite(avant, texte, [{ jeton: 'V' }]), null)
})

test('texteDeBandeau : l’unique cellule non vide, dans l’EN-TÊTE ; une donnée restante ou deux cellules, non', () => {
  assert.equal(texteDeBandeau(['| TITRE |   |', '|---|---|']), 'TITRE')
  assert.equal(texteDeBandeau(['| TITRE |   |', '|---|---|', '|   |   |']), 'TITRE')
  assert.equal(texteDeBandeau(['| TITRE | X |', '|---|---|']), null)
  assert.equal(texteDeBandeau(['|   |   |', '|---|---|', '| x |   |']), null)
})

test('niveauDeLegende : le niveau le plus porté par les titres que suit une table, hors la ligne jugée ; sans légende, celui des frères', () => {
  const l = ['#### **A**', '', '| x |', '', '### **B**', '', '| y |', '', '### **C**', '| z |', '', '#### **D**', 'texte']
  assert.equal(niveauDeLegende(l, 99), '###')
  assert.equal(niveauDeLegende(['## **A**', 'texte', '| t |'], 2), '##')
})

test('FOLIOS (CRB) : la ligne qui n’en porte que (`#` compris) est SUPPRIMÉE ; soudés en tête de prose, le préfixe seul part', () => {
  const avant = ['texte', '', '# 274 274 275', '', '# **The Hägercrybs**', '', '298 299 *Fatigued* Conditions are accrued'].join('\n')
  const s = sites(avant, [], [272, 299])
  const { texte, refus } = reparer(avant, s)
  assert.deepEqual(refus, [])
  assert.equal(texte, ['texte', '', '# **The Hägercrybs**', '', '*Fatigued* Conditions are accrued'].join('\n'))
  assert.equal(infidelite(avant, texte, s), null)
})
