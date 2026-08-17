import { describe, expect, it } from 'vitest';
import cases from './fixtures/parking-classification-cases.json';
import {
  PARKABLE_KINDS,
  PARKING_CLASS_RULES,
  SHORT_STAY_MINUTES,
  classifyParkingSpot,
  formatStayMinutes,
  parkingDurationMinutes,
  parkingPermitCode,
  parkingTypeKind,
  parseParkingValidity,
  spotMaxStay,
} from './parking-rules.js';

const spaces = cases.cases;
const classify = (properties) => classifyParkingSpot({ properties }, null);
const totalOf = (rows) => rows.reduce((total, row) => total + row.count, 0);

describe('published dataset coverage', () => {
  // The fixture is every distinct combination of luokka, luokka_nimi, tyyppi,
  // kesto, voimassaolo and asukaspysakointitunnus in the live layer. Refresh it
  // with `npm run audit:parking`.
  it('covers the whole layer the fixture was taken from', () => {
    expect(totalOf(spaces)).toBe(cases.features);
  });

  it('classifies every space the city describes', () => {
    const described = spaces.filter((row) => PARKING_CLASS_RULES[Number(row.properties.luokka)] || parkingTypeKind(row.properties.tyyppi));
    const missed = described.filter((row) => classify(row.properties).kind === 'unknown');
    expect(missed).toEqual([]);
    // The remainder carry neither a class nor a type, so there is nothing to read.
    const blank = spaces.filter((row) => classify(row.properties).kind === 'unknown');
    expect(totalOf(blank)).toBeLessThan(cases.features * 0.01);
  });

  it('reads every published time limit', () => {
    const unreadable = spaces.filter((row) => row.properties.kesto && parkingDurationMinutes(row.properties.kesto) === null);
    expect(unreadable).toEqual([]);
  });

  it('never leaves a usable space without a stay limit', () => {
    const missing = spaces.filter((row) => {
      const spot = classify(row.properties);
      return PARKABLE_KINDS.has(spot.kind) && spot.maxStayMinutes === null;
    });
    expect(missing).toEqual([]);
  });

  it('keeps every no-parking area out of the parkable categories', () => {
    const leaked = spaces.filter((row) => /kielto/i.test(row.properties.tyyppi) && PARKABLE_KINDS.has(classify(row.properties).kind));
    expect(leaked).toEqual([]);
  });
});

describe('assumptions the rules are built on', () => {
  // The whole design rests on `luokka` alone being enough to identify a rule.
  // If the city ever ships two different names under one number, that is false
  // and the class table has to grow a second dimension.
  it('publishes exactly one name per class number', () => {
    const names = new Map();
    for (const row of spaces) {
      if (!row.properties.luokka_nimi) continue;
      const seen = names.get(row.properties.luokka) || new Set();
      seen.add(row.properties.luokka_nimi);
      names.set(row.properties.luokka, seen);
    }
    const ambiguous = [...names].filter(([, seen]) => seen.size > 1);
    expect(ambiguous).toEqual([]);
    expect(names.size).toBeGreaterThan(0);
  });

  // Guards against the class table drifting away from the text the city ships:
  // "Kertamaksu enintään 2 tuntia" must not be encoded as anything but 120 min.
  it('encodes the limit each class name spells out', () => {
    const named = new Map(spaces.filter((row) => row.properties.luokka_nimi).map((row) => [Number(row.properties.luokka), row.properties.luokka_nimi]));
    const mismatches = [];
    for (const [luokka, rule] of Object.entries(PARKING_CLASS_RULES)) {
      if (!PARKABLE_KINDS.has(rule.kind)) continue;
      const name = named.get(Number(luokka));
      if (!name) continue;
      const stated = name.match(/enintään\s+(\d+)\s*(tunti|tuntia|h)\b/i);
      const expected = stated ? Number(stated[1]) * 60 : Infinity;
      if (stated ? rule.maxStayMinutes !== expected : !(rule.assumed || rule.maxStayMinutes === Infinity)) {
        mismatches.push({ luokka, name, expected, actual: rule.maxStayMinutes });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('charges nothing on every category that is not paid parking', () => {
    const priced = spaces.filter((row) => {
      const spot = classifyParkingSpot({ properties: row.properties }, '1');
      return spot.kind !== 'paid' && spot.price !== 0;
    });
    expect(priced).toEqual([]);
  });

  it('keeps every reserved vehicle group out of the tappable street layer', () => {
    const reserved = ['prohibited', 'disabled', 'loading', 'scooter', 'bicycle', 'motorcycle', 'taxi', 'charging', 'coach', 'permitOnly', 'restricted', 'unknown'];
    reserved.forEach((kind) => expect(PARKABLE_KINDS.has(kind)).toBe(false));
    ['free', 'disc', 'paid', 'offPeak'].forEach((kind) => expect(PARKABLE_KINDS.has(kind)).toBe(true));
  });

  // A rule change shows up here as a diff rather than as a silent shift in what
  // thousands of spaces say on the map.
  it('splits the whole layer into the categories recorded here', () => {
    const totals = {};
    for (const row of spaces) {
      const { kind } = classifyParkingSpot({ properties: row.properties }, null);
      totals[kind] = (totals[kind] || 0) + row.count;
    }
    expect(totals).toEqual({
      paid: 4443,
      disc: 1598,
      prohibited: 888,
      free: 440,
      scooter: 312,
      offPeak: 284,
      charging: 187,
      taxi: 130,
      loading: 98,
      disabled: 88,
      permitOnly: 68,
      coach: 64,
      unknown: 61,
      restricted: 60,
      motorcycle: 17,
      bicycle: 14,
    });
  });

  it('records how many spaces fall back to an assumed limit', () => {
    const assumed = spaces.filter((row) => spotMaxStay(row.properties.kesto, PARKING_CLASS_RULES[Number(row.properties.luokka)]).assumed);
    expect(totalOf(assumed)).toBe(355);
  });

  // 603 of these are simply blank in the source; the remaining 10 are genuinely
  // malformed (a stray word, or a period that could be a date). The comma-less
  // "9-21 (9-18)" shape is now read, so it no longer counts here.
  // If the blank count moves, the city started publishing hours.
  it('records how many chargeable or no-parking windows cannot be read', () => {
    const unreadable = spaces.filter((row) => {
      const { kind, validity } = classifyParkingSpot({ properties: row.properties }, null);
      return (kind === 'paid' || kind === 'offPeak') && !parseParkingValidity(validity);
    });
    const blank = unreadable.filter((row) => !row.properties.voimassaolo.trim());
    expect([totalOf(unreadable), totalOf(blank)]).toEqual([613, 603]);
  });
});

describe('conservative readings', () => {
  it('treats an unstated limit in a short-term class as the short limit', () => {
    // "Ilmainen lyhytaikainen pysäköinti" is used for 15 min to 4 h spaces, so an
    // empty kesto may not be read as the generous end of that range.
    const free = classify({ luokka: 1 });
    expect([free.kind, free.maxStayMinutes, free.maxStayAssumed]).toEqual(['free', SHORT_STAY_MINUTES, true]);
    const disc = classify({ luokka: 8 });
    expect([disc.kind, disc.maxStayMinutes, disc.maxStayAssumed]).toEqual(['disc', SHORT_STAY_MINUTES, true]);
  });

  it('prefers a published limit over the class assumption', () => {
    const spot = classify({ luokka: 8, kesto: '4 h' });
    expect([spot.maxStayMinutes, spot.maxStayAssumed]).toEqual([240, false]);
  });

  it('caps a published limit that contradicts its own class name', () => {
    // "Kertamaksu enintään 2 tuntia" with a stray kesto of 4 h.
    expect(spotMaxStay('4', PARKING_CLASS_RULES[4])).toEqual({ minutes: 120, assumed: false });
    expect(spotMaxStay('24 h', PARKING_CLASS_RULES[5])).toEqual({ minutes: 240, assumed: false });
  });

  it('lets a reserved vehicle group override the pricing class behind it', () => {
    expect(classify({ luokka: 8, tyyppi: 'Pysäköintikielto', kesto: '4 h' }).kind).toBe('prohibited');
    expect(classify({ luokka: 0, tyyppi: 'Taxi, lataus' }).kind).toBe('taxi');
    expect(classify({ luokka: 2, tyyppi: 'henkilöauto, pakettiauto' }).kind).toBe('free');
  });

  it('does not read the literal "0" permit code as a resident permit', () => {
    // 398 no-parking areas ship with asukaspysakointitunnus "0".
    expect(parkingPermitCode('0')).toBe('');
    expect(parkingPermitCode(' A ')).toBe('A');
    expect(classify({ luokka: 0, tyyppi: 'Pysäköintikielto', asukaspysakointitunnus: '0' }).kind).toBe('prohibited');
  });

  it('keeps a resident permit as extra detail on a paid space', () => {
    // "Maksullinen ilman asukas-/yritystunnusta": a visitor still pays.
    const spot = classifyParkingSpot({ properties: { luokka: 6, asukaspysakointitunnus: 'I' } }, '1');
    expect([spot.kind, spot.price, spot.permit]).toEqual(['paid', 4, 'I']);
  });

  it('ignores the stray numeric values the tyyppi column contains', () => {
    expect(parkingTypeKind('9')).toBeNull();
    expect(parkingTypeKind('')).toBeNull();
    expect(parkingTypeKind('Kaupunginkanslia')).toBe('permitOnly');
    expect(parkingTypeKind('Jokin uusi arvo')).toBe('restricted');
  });

  it('refuses to guess hours it cannot parse', () => {
    // A stray word before the bracket, or a period that could be a date, stays
    // unparsed so the app says "check the sign" rather than inventing hours.
    expect(parseParkingValidity('7-15, Maksullinen (9-18)')).toBeNull();
    expect(parseParkingValidity('9.21 (9-18)')).toBeNull();
  });

  it('reads the Saturday bracket even without the separating comma', () => {
    const schedule = parseParkingValidity('9-21 (9-18)');
    expect(schedule.byDay[1]).toEqual([{ start: 540, end: 1260 }]);
    expect(schedule.byDay[6]).toEqual([{ start: 540, end: 1080 }]);
    expect(schedule.byDay[0]).toEqual([]);
  });

  it('uses explicit regional metadata without Helsinki tariff or schedule fallbacks', () => {
    const schedule = { byDay: [[], [{ start: 420, end: 1140 }], [], [], [], [], []], source: '7-19' };
    const paid = classifyParkingSpot({ properties: { parking: {
      provider: 'service-map', municipality: 'vantaa', kind: 'paid', hourlyPrice: 1,
      maxStayMinutes: null, schedule, notes: 'Source-specific rule', estimatedSpaces: 16,
    } } }, '1');
    expect(paid).toMatchObject({ kind: 'paid', price: 1, municipality: 'vantaa', notes: 'Source-specific rule', estimated: 16 });
    expect(parseParkingValidity(paid.validity)).toBe(schedule);

    const unknownPrice = classifyParkingSpot({ properties: { parking: {
      provider: 'service-map', municipality: 'vantaa', kind: 'paid', hourlyPrice: null,
      maxStayMinutes: null, schedule: null,
    } } }, '1');
    expect(unknownPrice.price).toBeNull();
    expect(unknownPrice.validity).toBe('');
  });
});

describe('stay formatting', () => {
  it('normalises the time limits the layer publishes', () => {
    expect(parkingDurationMinutes('4 H')).toBe(240);
    expect(parkingDurationMinutes('60min')).toBe(60);
    expect(parkingDurationMinutes('30 min, (30 мин)')).toBe(30);
    expect(parkingDurationMinutes('max 60 min lauantai')).toBe(60);
    expect(parkingDurationMinutes('ei aikarajoitusta')).toBe(Infinity);
    expect(formatStayMinutes(30)).toBe('30 min');
    expect(formatStayMinutes(240)).toBe('4 h');
    expect(formatStayMinutes(90)).toBe('1 h 30 min');
    expect(formatStayMinutes(Infinity)).toBe('');
  });
});
