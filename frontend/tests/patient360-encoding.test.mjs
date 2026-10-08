import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceFiles = [
  'index.html',
  'src/App.jsx',
  'src/components/Patient360View.jsx',
  'src/components/TopHeader.jsx',
  'src/components/DummyDomainViews.jsx',
  'src/components/PharmacySupplyViews.jsx',
  'src/services/meridianData.js',
];

const badSequences = [
  '\u00e2\u201a\u00b9',             // rupee decoded as Windows-1252
  '\u00c2\u00b7',                   // middle dot decoded as Windows-1252
  '\u00e2\u2020\u2019',             // right arrow decoded as Windows-1252
  '\u00e2\u20ac\u201d',             // em dash decoded as Windows-1252
  '\u00e2\u20ac\u00a2',             // bullet decoded as Windows-1252
  '\u00f0\u0178',                   // emoji decoded as Windows-1252
  '\u00c3\u00a2\u00e2\u20ac',       // double-encoded UTF-8 signature
  '\u00c3\u0192',                   // common double-encoding signature
];

test('Patient360 UI source contains no known mojibake sequences', async () => {
  for (const file of sourceFiles) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const sequence of badSequences) {
      assert.equal(source.includes(sequence), false, `${file} contains a corrupted text sequence`);
    }
  }
});

test('Patient360 source and browser text preserve expected UTF-8 symbols', async () => {
  const patient360 = await readFile(new URL('../src/components/Patient360View.jsx', import.meta.url), 'utf8');
  assert.ok(patient360.includes('\u20b9'));
  assert.ok(patient360.includes('\u00b7'));
  assert.ok(patient360.includes('\u{1f514}')); // existing alert-bell icon
  assert.equal(`\u20b9${new Intl.NumberFormat('en-IN').format(15500)}`, '\u20b915,500');
  assert.equal(['34', 'Female', 'English', 'O+'].join(' \u00b7 '), '34 \u00b7 Female \u00b7 English \u00b7 O+');
  assert.equal('\u{1f514}', '🔔');
});
