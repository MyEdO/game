import { coupeAuMot } from '/home/user/game/.wt-1806-L2/src/lib/coupeAuMot.mjs'
import { titreDeCommit } from '/home/user/game/.wt-1806-L2/scripts/ops/etapesDuTrain.mjs'
import { raisonCourte } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/gitPorte.mjs'
import { titreDeChapitre } from '/home/user/game/.wt-1806-L2/scripts/source/prose-source-plugin.mjs'
const mots = (n) => { let s = ''; while (s.length < n) s += 'mot '; return s.slice(0, n).replace(/ $/, 'x') }
const t120 = mots(120), t200 = mots(200), t60 = mots(60)
console.log('titreDeCommit 120 car. (tient à max=120) :', t120.length, '->', titreDeCommit(t120).length, titreDeCommit(t120) === t120 ? 'ENTIER' : 'COUPÉ')
console.log('raisonCourte 200 car. (RAISON_MAX=200) :', t200.length, '->', raisonCourte(t200).length, raisonCourte(t200) === t200 ? 'ENTIER' : 'COUPÉ')
console.log('titreDeChapitre 60 car. (TITRE_MAX=60) :', t60.length, '->', JSON.stringify(titreDeChapitre('x', '# ' + t60)))
console.log('coupeAuMot blanc seul :', JSON.stringify(coupeAuMot('     ', 2)))
console.log('coupeAuMot NBSP tête :', JSON.stringify(coupeAuMot('  Anticonstitutionnellement dit', 5)))
console.log('sortie max coupeAuMot(s,10) sur mots de 1 :', coupeAuMot('a b c d e f g h i j k l', 10), coupeAuMot('a b c d e f g h i j k l', 10).length)
const t60b = 'Les Répurgateurs et la Chasse aux Sorcières dans le Reikland'
console.log('titreDeChapitre', t60b.length, 'car. (TITRE_MAX=60) ->', JSON.stringify(titreDeChapitre({ sections: [{ title: t60b, line: 1 }] }, 'x')))
