// Downloads the whole on-street parking layer and checks that every published
// `luokka`, `tyyppi` and `kesto` value maps to a rule in src/parking-rules.js.
// Run it after the city changes the dataset: an unrecognised value is a real gap,
// because the app then has to fall back to "rules unknown" for those spaces.
//
// Spaces the city publishes with neither a class nor a type carry no rule to
// recognise. They are reported separately and do not fail the audit.
//
//   node scripts/audit-parking-classes.mjs           # report + refresh fixture
//   node scripts/audit-parking-classes.mjs --check   # report only, no writes

import { writeFile } from 'node:fs/promises';
import { PARKING_CLASS_RULES, classifyParkingSpot, parkingDurationMinutes, parkingTypeKind, parseParkingValidity, spotMaxStay } from '../src/parking-rules.js';

const WFS = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
const LAYER = 'Pysakointipaikat_alue';
const FIXTURE = new URL('../src/fixtures/parking-classification-cases.json', import.meta.url);
const CASE_FIELDS = ['luokka', 'luokka_nimi', 'tyyppi', 'kesto', 'voimassaolo', 'asukaspysakointitunnus'];

function wfsUrl() {
  const query = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: `avoindata:${LAYER}`,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    count: '100000',
  });
  return `${WFS}?${query}`;
}

async function fetchJson(url, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function tally(rows, read) {
  const counts = new Map();
  for (const row of rows) counts.set(read(row), (counts.get(read(row)) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

async function main() {
  const check = process.argv.includes('--check');
  const data = await fetchJson(wfsUrl());
  const features = data.features || [];
  if (!features.length) throw new Error(`${LAYER} returned no features`);

  const cases = new Map();
  for (const feature of features) {
    const properties = feature.properties || {};
    const key = JSON.stringify(CASE_FIELDS.map((field) => String(properties[field] ?? '')));
    const entry = cases.get(key) || { properties: Object.fromEntries(CASE_FIELDS.map((field) => [field, String(properties[field] ?? '')])), count: 0 };
    entry.count += 1;
    cases.set(key, entry);
  }
  const rows = [...cases.values()].sort((a, b) => b.count - a.count);

  const unknownClasses = tally(features, (feature) => String(feature.properties?.luokka ?? ''))
    .filter(([value]) => value !== '' && value !== '0' && !PARKING_CLASS_RULES[Number(value)]);
  const unknownTypes = tally(features, (feature) => String(feature.properties?.tyyppi ?? ''))
    .filter(([value]) => parkingTypeKind(value) === 'restricted');
  const unknownDurations = tally(features, (feature) => String(feature.properties?.kesto ?? ''))
    .filter(([value]) => value !== '' && parkingDurationMinutes(value) === null);
  // A space with no class and no type has nothing to classify; anything else
  // reaching 'unknown' means a rule is missing.
  const describes = (row) => Boolean(PARKING_CLASS_RULES[Number(row.properties.luokka)] || parkingTypeKind(row.properties.tyyppi));
  const unclassified = rows.filter((row) => classifyParkingSpot({ properties: row.properties }, null).kind === 'unknown');
  const unknownKinds = unclassified.filter(describes);

  const spaces = rows.flatMap((row) => Array.from({ length: row.count }, () => row.properties));
  const kinds = tally(spaces, (properties) => classifyParkingSpot({ properties }, null).kind);
  const windows = tally(spaces, (properties) => {
    const { kind, validity } = classifyParkingSpot({ properties }, null);
    if (!['paid', 'offPeak', 'free', 'disc'].includes(kind)) return 'n/a';
    if (parseParkingValidity(validity)) return `${kind}: hours readable`;
    return validity.trim() ? `${kind}: hours malformed` : `${kind}: no hours published`;
  });

  console.log(`${LAYER}: ${features.length} features, ${rows.length} distinct rule combinations\n`);
  console.log('kind:');
  kinds.forEach(([kind, count]) => console.log(`  ${String(count).padStart(5)}  ${kind}`));
  console.log('\nvoimassaolo (chargeable hours on paid, no-parking hours on class 9, limit window on free):');
  windows.filter(([state]) => state !== 'n/a').sort().forEach(([state, count]) => console.log(`  ${String(count).padStart(5)}  ${state}`));

  const assumed = spaces.filter((properties) => spotMaxStay(properties.kesto, PARKING_CLASS_RULES[Number(properties.luokka)]).assumed);
  console.log(`\nspaces whose stay limit is assumed from the class: ${assumed.length}`);
  console.log(`spaces published with neither a class nor a type: ${unclassified.reduce((total, row) => total + row.count, 0)}`);

  const problems = [];
  if (unknownClasses.length) problems.push(`unmapped luokka values: ${unknownClasses.map(([v, c]) => `${v} (${c})`).join(', ')}`);
  if (unknownTypes.length) problems.push(`unmapped tyyppi values: ${unknownTypes.map(([v, c]) => `${JSON.stringify(v)} (${c})`).join(', ')}`);
  if (unknownDurations.length) problems.push(`unparsed kesto values: ${unknownDurations.map(([v, c]) => `${JSON.stringify(v)} (${c})`).join(', ')}`);
  if (unknownKinds.length) problems.push(`described spaces with no category: ${unknownKinds.reduce((total, row) => total + row.count, 0)}`);

  if (problems.length) {
    console.error(`\nFAIL\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nOK: every published class, type and time limit maps to a rule.');

  if (!check) {
    await writeFile(FIXTURE, `${JSON.stringify({ layer: LAYER, capturedAt: new Date().toISOString(), features: features.length, cases: rows }, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${FIXTURE.pathname}`);
  }
}

await main();
