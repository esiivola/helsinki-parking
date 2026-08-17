// Cross-city audit of the plain-text -> actionable-rule transformation.
//
// For every city it collects the DISTINCT rule-bearing strings the source
// publishes, runs the real parser, and prints raw -> parsed so each mapping can
// be checked by hand. It also auto-flags strings whose cost/time content did NOT
// survive into the rule (a euro amount but no price, hour ranges but no readable
// schedule, a duration but no max stay, or no category at all).
//
//   node scripts/audit-regional-rules.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { classifyParkingSpot, nextPaidStart, parkingNowStatus, parseParkingValidity } from '../src/parking-rules.js';
import { espooParkingUrl, normalizeVantaaDivision, parseEspooParkingGml, parseTampereParking, parseTurkuParking, parseTurkuResidentZones, tampereParkingUrl, turkuParkingUrl, turkuResidentZonesUrl } from '../src/parking-providers.js';

const AT = new Date('2026-08-18T10:00:00'); // fixed weekday morning for the status round-trip
const REPO = new URL('..', import.meta.url);

async function fetchText(url, timeout = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: '*/*', 'User-Agent': 'parking-audit' } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}
const fetchJson = async (url, timeout) => JSON.parse(await fetchText(url, timeout));

const hasEuro = (s) => /\d+(?:[.,]\d+)?\s*(?:€|eur)\b/i.test(s);
const hasHours = (s) => /\b\d{1,2}(?::\d{2})?\s*[-–]\s*\d{1,2}(?::\d{2})?/.test(s);
const hasDuration = (s) => /\b\d+(?:[.,]\d+)?\s*(?:h\b|min\b|tunti)/i.test(s);

// One feature -> the rule the app would act on, plus the raw text it came from.
function assess(feature, zone) {
  const meta = classifyParkingSpot(feature, zone);
  const raw = feature.properties?.parking ? '' : ''; // filled by the per-city collector via rawText
  const rawText = feature.__rawText || [meta.rawLabel, meta.notes, meta.scheduleLabel, feature.properties?.voimassaolo].filter(Boolean).join(' | ');
  const schedule = parseParkingValidity(meta.validity);
  const scheduleState = schedule ? 'readable'
    : (meta.validity && (typeof meta.validity === 'string' ? meta.validity.trim() : true)) ? 'MALFORMED'
      : (hasHours(rawText) && ['paid', 'offPeak'].includes(meta.kind)) ? 'MALFORMED' : 'none';
  // A limit may live in the static field OR in time-scoped stayRules the app
  // resolves at render, so treat either as "captured".
  const stayRules = Array.isArray(meta.stayRules) ? meta.stayRules : [];
  const hasStay = meta.maxStayMinutes !== null || stayRules.some((rule) => Number.isFinite(rule.maxStayMinutes) || rule.maxStayMinutes === 'unlimited');
  const flags = [];
  if (meta.kind === 'unknown') flags.push('UNKNOWN-KIND');
  if (meta.kind === 'paid' && (meta.price === null || meta.price === undefined) && hasEuro(rawText)) flags.push('PRICE-TEXT-NOT-PARSED');
  if (['paid', 'offPeak'].includes(meta.kind) && !schedule && hasHours(rawText)) flags.push('HOURS-TEXT-NOT-PARSED');
  // "… ei koske … 60 min" is a permit exemption, not a stay limit — don't flag it.
  if (!hasStay && ['free', 'disc', 'paid'].includes(meta.kind) && hasDuration(rawText) && !/ei\s+koske/.test(rawText)) flags.push('DURATION-TEXT-NOT-PARSED');
  // Status round-trip must not throw.
  try { parkingNowStatus(zone, AT, meta.validity); nextPaidStart(zone, AT, meta.validity); } catch (error) { flags.push(`STATUS-THREW:${error.message}`); }
  return { kind: meta.kind, price: meta.kind === 'paid' ? meta.price : '', maxStay: meta.maxStayMinutes, scheduleState, flags };
}

function report(city, rows) {
  // rows: [{ rawKey, rawText, feature, zone }]
  const groups = new Map();
  for (const row of rows) {
    const parsed = assess({ ...row.feature, __rawText: row.rawText }, row.zone);
    const key = `${row.rawKey} => ${parsed.kind}|${parsed.price}|${parsed.maxStay}|${parsed.scheduleState}|${parsed.flags.join(',')}`;
    const entry = groups.get(key) || { rawKey: row.rawKey, parsed, count: 0 };
    entry.count += 1;
    groups.set(key, entry);
  }
  const distinct = [...groups.values()].sort((a, b) => b.count - a.count);
  const kinds = {};
  distinct.forEach((d) => { kinds[d.parsed.kind] = (kinds[d.parsed.kind] || 0) + d.count; });
  console.log(`\n===== ${city}: ${rows.length} features, ${distinct.length} distinct rule strings =====`);
  console.log('kinds:', JSON.stringify(kinds));
  distinct.forEach((d) => {
    const p = d.parsed;
    console.log(`[${String(d.count).padStart(5)}] ${d.rawKey}`);
    console.log(`         -> kind=${p.kind} price=${p.price} maxStay=${p.maxStay} sched=${p.scheduleState}${p.flags.length ? '  ⚠ ' + p.flags.join(',') : ''}`);
  });
  const flagged = distinct.filter((d) => d.parsed.flags.length);
  return { city, distinct: distinct.length, flaggedDistinct: flagged.length, flaggedFeatures: flagged.reduce((t, d) => t + d.count, 0) };
}

// ---- per-city collectors -------------------------------------------------

function helsinkiRows() {
  const fixture = JSON.parse(readFileSync(new URL('src/fixtures/parking-classification-cases.json', REPO), 'utf8'));
  return fixture.cases.flatMap((c) => Array.from({ length: 1 }, () => ({
    rawKey: `luokka=${c.properties.luokka} tyyppi="${c.properties.tyyppi}" kesto="${c.properties.kesto}" voimassaolo="${c.properties.voimassaolo}"`,
    rawText: [c.properties.luokka_nimi, c.properties.kesto, c.properties.voimassaolo].filter(Boolean).join(' | '),
    feature: { properties: c.properties },
    zone: null,
    _count: c.count,
  }))).flatMap((r) => Array.from({ length: r._count }, () => r));
}

async function espooRows() {
  const xml = await fetchText(espooParkingUrl({ west: 24.55, south: 60.13, east: 24.88, north: 60.31 }, 20000), 120000);
  return parseEspooParkingGml(xml).map((f) => ({
    rawKey: `fee="${f.properties.PARKINGFEEDESCRIPTION || ''}" times="${f.properties.PARKINGTIMES || ''}" feeFlag="${f.properties.PARKINGFEE || ''}"`,
    rawText: [f.properties.PARKINGFEEDESCRIPTION, f.properties.PARKINGTIMES].filter(Boolean).join(' | '),
    feature: f,
    zone: f.properties.parking.zone,
  }));
}

function vantaaRows() {
  const dir = new URL('public/data/vantaa-parking/', REPO);
  const files = readdirSync(dir).filter((n) => n.endsWith('.json'));
  const seen = new Set();
  const rows = [];
  for (const file of files) {
    const tile = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    for (const f of tile.features) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const e = f.properties;
      rows.push({
        rawKey: `tyyppi="${e.tyyppi || ''}" aikarajoitus="${e.aikarajoitus || ''}" voimassaolo="${e.voimassaoloaika || ''}" kiekko="${e.kiekkopaikka || ''}" lisatiedot="${(e['lisätiedot'] || e.lisatiedot || '').slice(0, 60)}"`,
        rawText: [f.properties.parking.rawLabel, f.properties.parking.notes, f.properties.parking.scheduleLabel].filter(Boolean).join(' | '),
        feature: f,
        zone: f.properties.parking.zone,
      });
    }
  }
  return rows;
}

async function tampereRows() {
  const data = await fetchJson(tampereParkingUrl(undefined, 4000), 120000);
  return parseTampereParking(data).map((f) => ({
    rawKey: `rajoitus="${f.properties.rajoitustyyppi || ''}" vyohyke="${f.properties.maksuvyohyke ?? ''}" max="${f.properties.suurin_sallittu_pysakointiaika ?? ''}" maksuArk="${f.properties.rajoitus_maksullinen_arkena || ''}" kiekkoArk="${f.properties.rajoitus_kiekolla_arkena || ''}" kohde="${f.properties.kohteen_tyyppi || ''}"`,
    rawText: [f.properties.parking.rawLabel, f.properties.parking.notes, f.properties.parking.scheduleLabel].filter(Boolean).join(' | '),
    feature: f,
    zone: f.properties.parking.zone,
  }));
}

async function turkuRows() {
  const [paid, permit] = await Promise.all([fetchJson(turkuParkingUrl()), fetchJson(turkuResidentZonesUrl())]);
  const paidByZone = new Map(paid.features.map((f) => [String(f.properties.maksuvyohyke), f.properties]));
  const rows = parseTurkuParking(paid).map((f) => {
    const p = paidByZone.get(f.properties.parking.zone) || {};
    return {
      rawKey: `vyohyke=${p.maksuvyohyke} hinta="${p.maksuvyohykehinta}" arki="${p.maksullisuus_arki}" la="${p.maksullisuus_lauantai}" su="${p.maksullisuus_sunnuntai}"`,
      rawText: [f.properties.parking.rawLabel, f.properties.parking.scheduleLabel].filter(Boolean).join(' | '),
      feature: f,
      zone: f.properties.parking.zone,
    };
  });
  // Permit zones carry no parking contract (overlay only); just list them.
  const permitZones = parseTurkuResidentZones(permit);
  console.log(`\n(Turku permit overlay: ${permitZones.length} zones ${permitZones.map((z) => z.properties.asukaspysakointitunnus).join('')} with prices ${[...new Set(permit.features.map((f) => f.properties.Hinta))].join(' / ')})`);
  return rows;
}

async function main() {
  const summaries = [];
  summaries.push(report('Helsinki', helsinkiRows()));
  try { summaries.push(report('Espoo', await espooRows())); } catch (e) { console.log('\nEspoo fetch failed:', e.message); }
  summaries.push(report('Vantaa', vantaaRows()));
  try { summaries.push(report('Tampere', await tampereRows())); } catch (e) { console.log('\nTampere fetch failed:', e.message); }
  try { summaries.push(report('Turku', await turkuRows())); } catch (e) { console.log('\nTurku fetch failed:', e.message); }

  console.log('\n================ SUMMARY ================');
  summaries.forEach((s) => console.log(`${s.city.padEnd(9)} distinct=${String(s.distinct).padStart(4)}  flaggedDistinct=${s.flaggedDistinct}  flaggedFeatures=${s.flaggedFeatures}`));
  const totalFlagged = summaries.reduce((t, s) => t + s.flaggedFeatures, 0);
  console.log(totalFlagged ? `\n⚠ ${totalFlagged} features have unparsed cost/time content — inspect the ⚠ lines above.` : '\nOK: every distinct cost/time string parsed into an actionable rule.');
}

await main();
