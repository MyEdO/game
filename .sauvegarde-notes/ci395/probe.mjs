import { JSDOM } from 'jsdom';
const d = new JSDOM('<details><summary>x</summary><p>y</p></details>');
const det = d.window.document.querySelector('details');
det.addEventListener('toggle', () => console.log('toggle, open=', det.open));
det.querySelector('summary').click();
console.log('sync open=', det.open);
await new Promise(r => setTimeout(r, 10));
console.log('done');
