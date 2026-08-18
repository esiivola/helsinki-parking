// Curated venue-parking lots whose rule flips on event days. Open data carries
// no event-day flag (an on-site LED sign resolves it), so the rule is authored
// here and the event signal comes from Helsinki's Linked Events API at runtime.
//
// Detection is deliberately defensive: it trusts Linked Events only for the
// ice hall (its feed is complete for hockey/concerts), leaves the football and
// stadium venues to the caretaker's LED sign, and always offers the venue
// calendars for a manual check. It never asserts "free" on an event day it
// simply failed to see.

const LINKED_EVENTS_ENDPOINT = 'https://api.hel.fi/linkedevents/v1/event/';

// The P-jäähalli surface lots (© OpenStreetMap contributors, ODbL — OSM ways
// 4252929 and 138324263), by the Helsinki ice halls on Nordenskiöldinkatu.
const JAAHALLI_GEOMETRY = {
  type: 'MultiPolygon',
  coordinates: [
    [[[24.925, 60.18971], [24.92489, 60.18969], [24.9249, 60.18967], [24.92494, 60.18962], [24.92504, 60.18963], [24.92506, 60.18956], [24.9244, 60.18948], [24.92435, 60.18955], [24.92443, 60.18956], [24.92433, 60.18964], [24.92359, 60.18996], [24.92345, 60.19006], [24.92324, 60.19021], [24.92322, 60.19023], [24.92312, 60.19032], [24.923, 60.19042], [24.9229, 60.19051], [24.92445, 60.19103], [24.9245, 60.19093], [24.92452, 60.19086], [24.92456, 60.19078], [24.92474, 60.19035], [24.9248, 60.19021], [24.92487, 60.19005], [24.92493, 60.1899], [24.92499, 60.18976], [24.925, 60.18971]]],
    [[[24.92515, 60.187], [24.92557, 60.18704], [24.9256, 60.18696], [24.92564, 60.18687], [24.92529, 60.18684], [24.9252, 60.18692], [24.92517, 60.18695], [24.92515, 60.187]]],
  ],
};

export const EVENT_PARKING_LOTS = [{
  type: 'Feature',
  id: 'helsinki:event-lot:jaahalli',
  geometry: JAAHALLI_GEOMETRY,
  properties: {
    municipality: 'helsinki',
    parking: {
      provider: 'curated',
      municipality: 'helsinki',
      sourceId: 'jaahalli',
      // Default (non-event) reading: free for 4 h with a parking disc.
      kind: 'disc',
      hourlyPrice: null,
      zone: null,
      permit: '',
      maxStayMinutes: 240,
      maxStayAssumed: false,
      stayRules: [],
      schedule: null,
      scheduleLabel: '',
      scheduleMeaning: 'limit',
      rawLabel: 'P-jäähalli',
      notes: '',
      estimatedSpaces: null,
      attribution: 'Rule: EuroPark · geometry © OpenStreetMap, ODbL',
      // Read by the detail panel to render the dual rule and run the live check.
      eventParking: {
        name: { fi: 'P-jäähalli', en: 'P-jäähalli (ice hall)' },
        free: { fi: 'Maksuton 4 h pysäköintikiekolla', en: 'Free for 4 h with a parking disc' },
        event: { fi: 'Tapahtumapäivinä maksullinen: 13,50 € / 12 h', en: 'On event days: €13.50 / 12 h' },
        // Venues whose Linked Events feed we auto-check. An event at any of them
        // flips the lot to "likely paid" — the safe direction, since checking
        // more venues only adds warnings, never false "free". The ice hall feed
        // is complete; the stadium's covers big events (misses some concerts);
        // the arena's is currently stale, so its link below is the real backstop.
        checkVenues: ['tprek:41176', 'tprek:20888', 'tprek:20999', 'tprek:40557'],
        links: [
          { name: { fi: 'Helsingin jäähalli · HIFK / Liiga', en: 'Helsinki Ice Hall · HIFK / Liiga' }, url: 'https://liiga.fi/fi/ottelut' },
          { name: { fi: 'Olympiastadion', en: 'Olympic Stadium' }, url: 'https://www.stadion.fi/fi/tapahtumat' },
          { name: { fi: 'Bolt Arena · HJK', en: 'Bolt Arena · HJK' }, url: 'https://www.hjk.fi/ottelut' },
        ],
      },
    },
  },
}];

function localDay(date) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Linked Events query for events at the given venues overlapping one local day.
export function linkedEventsUrl(venueIds, date) {
  const query = new URLSearchParams({
    location: (venueIds || []).join(','),
    start: localDay(date),
    end: localDay(date),
    sort: 'start_time',
    page_size: '20',
  });
  return `${LINKED_EVENTS_ENDPOINT}?${query}`;
}

// The first event whose window covers `at` — parking fills from ~2 h before the
// start through the end. Returns null when nothing overlaps.
export function overlappingEvent(events, at) {
  const moment = (at instanceof Date ? at : new Date(at)).getTime();
  for (const event of Array.isArray(events) ? events : []) {
    const start = new Date(event?.start_time).getTime();
    if (!Number.isFinite(start)) continue;
    const end = new Date(event?.end_time || event?.start_time).getTime();
    const from = start - 2 * 60 * 60 * 1000;
    const to = (Number.isFinite(end) ? end : start) + 60 * 60 * 1000;
    if (moment >= from && moment <= to) return event;
  }
  return null;
}
