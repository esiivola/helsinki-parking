// How the City of Helsinki on-street parking layer (avoindata:Pysakointipaikat_alue)
// turns into the categories this app shows. Everything here is language-independent
// and free of React, so `scripts/audit-parking-classes.mjs` can replay it over the
// whole live dataset and prove no published value falls through.
//
// The guiding rule is that an uncertain reading always resolves to the stricter
// option: a shorter stay, a chargeable hour, a space we will not promise.

// Longest stay we are willing to call "short" on the map. A space at or under
// this limit gets its own colour so a driver never reads a 30 min bay as a place
// to leave the car for the afternoon.
export const SHORT_STAY_MINUTES = 60;

// `luokka` values published by the layer. Each class number carries exactly one
// `luokka_nimi`, so the number alone is the rule. `maxStayMinutes` is what the
// class name itself guarantees. `assumed` marks the two classes whose name only
// says "lyhytaikainen" (short-term) without naming a limit: their `kesto` values
// run from 15 min to 4 h, so when a space leaves `kesto` empty we fall back to
// the short end instead of promising the long one.
export const PARKING_CLASS_RULES = {
  1: { kind: 'free', maxStayMinutes: SHORT_STAY_MINUTES, assumed: true }, // Ilmainen lyhytaikainen pysäköinti
  2: { kind: 'free', maxStayMinutes: Infinity }, // Ilmainen pitkäaikainen pysäköinti
  3: { kind: 'paid', maxStayMinutes: 60 }, // Kertamaksu enintään 1 tunti
  4: { kind: 'paid', maxStayMinutes: 120 }, // Kertamaksu enintään 2 tuntia
  5: { kind: 'paid', maxStayMinutes: 240 }, // Kertamaksu enintään 4 tuntia
  6: { kind: 'paid', maxStayMinutes: Infinity }, // Maksullinen ilman asukas-/yritystunnusta
  7: { kind: 'paid', maxStayMinutes: 60 }, // Kertamaksu enintään 1 h ilman asukas-/yritystunnusta
  8: { kind: 'disc', maxStayMinutes: SHORT_STAY_MINUTES, assumed: true }, // Ilmainen lyhytaikainen, käytä kiekkoa
  9: { kind: 'offPeak', maxStayMinutes: Infinity }, // Pysäköinti sallittu pysäköintikieltoajan ulkopuolella
  10: { kind: 'paid', maxStayMinutes: Infinity }, // Maksullinen vyöhykehinta
  11: { kind: 'restricted' }, // Z-tunnus nouto/palautus
};

// `tyyppi` is free text naming the vehicle group a space is reserved for. A
// reservation always wins over the pricing class behind it, so these patterns
// are matched first. Order matters: "Taxi, lataus" is a taxi rank, not a charging
// bay. `car` is the one value that adds no restriction at all.
const PARKING_TYPE_RULES = [
  ['prohibited', /pys[äa]k[öo]inti\s*kiel|pys[äa]ytt[äa]mis\s*kiel/],
  ['disabled', /\binva\b/],
  ['loading', /kuormaus/],
  ['scooter', /potkulauta/],
  ['bicycle', /polkupy[öo]r[äa]/],
  ['motorcycle', /moottoripy[öo]r[äa]/],
  ['taxi', /\btaksi\b|\btaxi\b/],
  ['charging', /s[äa]hk[öo]auto|lataus/],
  ['coach', /matkailuliikenne|linja-auto|kuorma-auto/],
  ['permitOnly', /^cd$|poliisi|virka-auto|valtioneuvosto|kaupunginkanslia|kirjastoauto|parklet/],
  ['car', /henkil[öo]auto|pakettiauto/],
];

// Kinds an ordinary car may actually use. Everything else is drawn as unavailable
// and left out of the tappable street layer.
export const PARKABLE_KINDS = new Set(['free', 'disc', 'paid', 'offPeak']);

// Returns null when `tyyppi` carries no vehicle group (blank, or one of the stray
// numeric values the layer contains), and 'restricted' for text we do not
// recognise — unrecognised beats assuming a space is free for anyone.
export function parkingTypeKind(value) {
  const text = String(value || '').toLowerCase().trim();
  if (!text || /^\d+$/.test(text)) return null;
  const rule = PARKING_TYPE_RULES.find(([, pattern]) => pattern.test(text));
  return rule ? rule[0] : 'restricted';
}

// Resident and company permit codes are single letters. The layer also stores a
// literal "0" for "none", which must not read as a permit.
export function parkingPermitCode(value) {
  const code = String(value || '').trim();
  return code && code !== '0' ? code : '';
}

export function parkingDurationMinutes(value) {
  const text = String(value || '').trim().toLowerCase().replace(',', '.');
  if (!text) return null;
  if (/ei\s+aikaraj/.test(text)) return Infinity;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h|t(?:unti(?:a)?)?)(?:\b|$)/);
  const minutes = text.match(/(\d+)\s*min(?:uut(?:ti|tia))?(?:\b|$)/);
  if (!hours && !minutes && /^\d+$/.test(text)) return Number(text) * 60;
  if (!hours && !minutes) return null;
  return Math.round((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
}

export function formatStayMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

// The shortest limit the two sources agree on. `kesto` holds typos ("4 H",
// "60min") and the odd value that contradicts its class, so a limit spelled out
// in the class name always caps it.
export function spotMaxStay(kesto, classRule) {
  const published = parkingDurationMinutes(kesto);
  const fromClass = classRule?.maxStayMinutes ?? null;
  if (published === null) return { minutes: fromClass, assumed: fromClass !== null && Boolean(classRule?.assumed) };
  if (fromClass === null || classRule?.assumed) return { minutes: published, assumed: false };
  return { minutes: Math.min(published, fromClass), assumed: false };
}

export function classifyParkingSpot(feature, zoneNumber) {
  const p = feature?.properties || {};
  const regional = p.parking;
  if (regional && typeof regional === 'object') {
    const kind = String(regional.kind || 'unknown');
    const permit = parkingPermitCode(regional.permit);
    const hourlyPrice = Number(regional.hourlyPrice);
    const hasHourlyPrice = regional.hourlyPrice !== null && regional.hourlyPrice !== '' && Number.isFinite(hourlyPrice);
    return {
      kind,
      price: kind === 'paid' && hasHourlyPrice ? hourlyPrice : kind === 'paid' ? null : 0,
      permit,
      residentCode: permit,
      maxStayMinutes: Object.prototype.hasOwnProperty.call(regional, 'maxStayMinutes') ? regional.maxStayMinutes : null,
      maxStayAssumed: Boolean(regional.maxStayAssumed),
      stayRules: Array.isArray(regional.stayRules) ? regional.stayRules : [],
      validity: regional.schedule || '',
      scheduleLabel: regional.scheduleLabel || '',
      estimated: regional.estimatedSpaces ?? null,
      rawLabel: regional.rawLabel || '',
      municipality: regional.municipality || p.municipality || '',
      provider: regional.provider || '',
      notes: regional.notes || '',
      attribution: regional.attribution || '',
      zone: regional.zone || null,
    };
  }
  const classRule = PARKING_CLASS_RULES[Number(p.luokka)] || null;
  const typeKind = parkingTypeKind(p.tyyppi);
  const restriction = typeKind && typeKind !== 'car' ? typeKind : null;
  const kind = restriction || classRule?.kind || 'unknown';
  const stay = spotMaxStay(p.kesto, classRule);
  const permit = parkingPermitCode(p.asukaspysakointitunnus);
  return {
    kind,
    price: kind === 'paid' ? (Number(zoneNumber) === 1 ? 4 : Number(zoneNumber) === 2 ? 2 : null) : 0,
    permit,
    residentCode: permit,
    maxStayMinutes: stay.minutes,
    maxStayAssumed: stay.assumed,
    validity: p.voimassaolo || '',
    estimated: p.paikat_ala || null,
    rawLabel: p.luokka_nimi || '',
  };
}

export function isGeneralParkingFeature(feature) {
  return PARKABLE_KINDS.has(classifyParkingSpot(feature, null).kind);
}

function parseTimeRanges(value) {
  const ranges = [];
  const normalized = String(value || '').replace(/(\d{1,2})\s*\.\s*(\d{1,2})/g, '$1-$2');
  const pattern = /(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?/g;
  let match = pattern.exec(normalized);
  while (match) {
    const start = Number(match[1]) * 60 + Number(match[2] || 0);
    const end = Number(match[3]) * 60 + Number(match[4] || 0);
    if (start >= 0 && start < 1440 && end > 0 && end <= 1440) ranges.push({ start, end });
    match = pattern.exec(normalized);
  }
  return ranges;
}

// `voimassaolo` lists weekday hours, then Saturday in brackets, then Sunday.
// Anything that does not follow that shape returns null on purpose: the caller
// then says the hours must be checked rather than guessing them.
export function parseParkingValidity(value) {
  if (value && typeof value === 'object' && Array.isArray(value.byDay) && value.byDay.length === 7) {
    const valid = value.byDay.every((ranges) => Array.isArray(ranges) && ranges.every((range) => Number.isFinite(range?.start) && Number.isFinite(range?.end)));
    return valid ? value : null;
  }
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (/\d\s*\.\s*\d/.test(text)) return null;
  const saturday = /\(([^)]*)\)/.exec(text);
  // The canonical shape separates the Saturday bracket with a comma
  // ("9-21, (9-18)"). Also accept the comma-less "9-21 (9-18)" when the weekday
  // part is nothing but hour ranges, but keep rejecting mixed text such as
  // "7-15, Maksullinen (9-18)" where a stray word means the shape is unclear.
  const beforeSaturday = saturday ? text.slice(0, saturday.index) : '';
  if (saturday && !beforeSaturday.trim().endsWith(',') && /[a-zåäö]/i.test(beforeSaturday)) return null;
  const weekdayRanges = parseTimeRanges(saturday ? text.slice(0, saturday.index) : text);
  const saturdayRanges = saturday ? parseTimeRanges(saturday[1]) : [];
  const sundayRanges = saturday ? parseTimeRanges(text.slice(saturday.index + saturday[0].length)) : [];
  if (!weekdayRanges.length && !saturdayRanges.length && !sundayRanges.length) return null;
  return { byDay: [sundayRanges, weekdayRanges, weekdayRanges, weekdayRanges, weekdayRanges, weekdayRanges, saturdayRanges], source: text };
}

export function schedulePeriodAt(schedule, date) {
  if (!schedule) return null;
  const minute = date.getHours() * 60 + date.getMinutes();
  const day = date.getDay();
  const atMinutes = (dayOffset, value) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() + dayOffset);
    result.setMinutes(value);
    return result;
  };
  for (const range of schedule.byDay[day]) {
    if (range.end > range.start && minute >= range.start && minute < range.end) return { end: atMinutes(0, range.end) };
    if (range.end <= range.start && minute >= range.start) return { end: atMinutes(1, range.end) };
  }
  const previousDay = (day + 6) % 7;
  for (const range of schedule.byDay[previousDay]) {
    if (range.end <= range.start && minute < range.end) return { end: atMinutes(0, range.end) };
  }
  return null;
}

export function nextScheduleStart(schedule, date) {
  let next = null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    for (const range of schedule.byDay[day.getDay()]) {
      const candidate = new Date(day);
      candidate.setMinutes(range.start);
      if (candidate > date && (!next || candidate < next)) next = candidate;
    }
  }
  return next;
}

export function parkingNowStatus(zoneNumber, date = new Date(), validity = '') {
  const schedule = parseParkingValidity(validity);
  if (schedule) {
    const period = schedulePeriodAt(schedule, date);
    return { paid: Boolean(period), key: period ? 'paidNow' : 'freeNow', end: period?.end || null };
  }
  if (String(validity || '').trim()) return { paid: false, unknown: true, key: 'unknown', end: null };
  if (!zoneNumber) return { paid: false, key: 'freeNow', end: null };
  const day = date.getDay();
  const hour = date.getHours() + date.getMinutes() / 60;
  if (day === 0) return { paid: false, key: 'allDayFree', end: null };
  if (day === 6) {
    const paid = hour >= 9 && hour < 18;
    const end = new Date(date); end.setHours(18, 0, 0, 0);
    return { paid, key: paid ? 'paidNow' : 'saturdayFree', end: paid ? end : null };
  }
  const paid = hour >= 9 && hour < 21;
  const end = new Date(date); end.setHours(21, 0, 0, 0);
  return { paid, key: paid ? 'paidNow' : 'nextFree', end: paid ? end : null };
}

export function nextPaidStart(zoneNumber, date = new Date(), validity = '') {
  if (parkingNowStatus(zoneNumber, date, validity).paid) return null;
  const schedule = parseParkingValidity(validity);
  if (schedule) return nextScheduleStart(schedule, date);
  if (!zoneNumber) return null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(date);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(9, 0, 0, 0);
    if (candidate.getDay() !== 0 && candidate.getTime() > date.getTime()) return candidate;
  }
  return null;
}
