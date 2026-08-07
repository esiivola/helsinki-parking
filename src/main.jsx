import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronDown,
  Clock3,
  Crosshair,
  ExternalLink,
  Info,
  Layers3,
  LocateFixed,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react';

const HELSINKI = [60.16986, 24.93838];
const WFS = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
const LIIPI = import.meta.env.DEV ? '/api/fintraffic/api/v1' : 'https://parking.fintraffic.fi/api/v1';
const PARKKIHUBI = 'https://pubapi.parkkiopas.fi/public/v1';
const SIIRTOVAHTI = 'https://liikenne-elastic-proxy.api.hel.ninja/mobilenote_data/_search';
const SERVICE_MAP = 'https://api.hel.fi/servicemap/v2/administrative_division/';
const OVERPASS = import.meta.env.DEV ? '/api/overpass/api/interpreter' : 'https://overpass-api.de/api/interpreter';
const MIN_PARKING_ZOOM = 16;
export const DEFAULT_MAP_ZOOM = MIN_PARKING_ZOOM;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, value) => String(value * 5).padStart(2, '0'));

const copy = {
  fi: {
    appName: 'PARKKI', region: 'Helsinki', locating: 'Haetaan sijaintia…', locationReady: 'Sijaintisi', locationFallback: 'Helsingin keskusta',
    when: 'Pysäköintiaika', date: 'Päivä', time: 'Kellonaika', today: 'Tänään', now: 'Nyt', paidAtTime: 'Maksullinen', freeAtTime: 'Maksuton', paidUntil: 'Maksullinen asti', chargingStarts: 'Maksu alkaa', maxStay: 'Enintään', mapHint: 'Valitse pysäköintipaikka kartalta', detailsSummary: 'Lisätiedot',
    freeLegend: 'Maksuton', freeLongLegend: 'Maksuton', freeShortLegend: 'Maksuton alle 60 min', paidLegend: 'Maksullinen', unavailableLegend: 'Poissa käytöstä', freeLabel: 'Vapaa', paidLabel: 'Maksu', unavailableLabel: 'Tilapäisesti poissa käytöstä', upcomingException: 'Tuleva poikkeus', activeException: 'Voimassa oleva poikkeus', starts: 'Alkaa', ends: 'Päättyy', noTimeLimit: 'ei aikarajaa', limitUnknown: 'aikaraja ei tiedossa', scheduleUnknown: 'maksulliset ajat tarkistettava', withDisc: 'kiekolla',
    mapLayers: 'Karttatasot', street: 'Kadunvarsipaikat', priceZones: 'Maksuvyöhykkeet', residentZones: 'Asukasvyöhykkeet', closures: 'Työt ja tapahtumat', removals: 'Siirtokehotukset',
    here: 'Tässä paikassa', tapHint: 'Napauta kartalta pysäköintipaikkaa', noMappedSpot: 'Ei tunnistettua pysäköintipaikkaa', noMappedSpotBody: 'Tälle pisteelle ei löytynyt avointa paikkatietoa. Tarkista aina liikennemerkki.',
    paid: 'Maksullinen pysäköinti', free: 'Maksuton pysäköinti', disc: 'Kiekkopaikka', resident: 'Asukaspysäköinti', disabled: 'Invapaikka', loading: 'Kuormauspaikka', restricted: 'Rajoitettu pysäköinti',
    perHour: '/ tunti', freeNow: 'Maksuton nyt', paidNow: 'Maksullinen nyt', nextFree: 'Maksuton klo 21 jälkeen', saturdayFree: 'Maksuton klo 18 jälkeen', allDayFree: 'Maksuton koko päivän',
    hours: 'Maksulliset ajat', weekdays: 'Ma–pe', saturday: 'Lauantai', sunday: 'Sunnuntai', signException: 'Paikkakohtainen voimassaolo', zone: 'Maksuvyöhyke', residentArea: 'Asukasvyöhyke', permit: 'Asukastunnus', estimatedSpaces: 'Arvioitu paikkamäärä',
    notices: 'Huomiot', closureActive: 'Työ tai tapahtuma alueella', closureBody: 'Lupa-alue leikkaa valitun pysäköintipaikan. Paikkoja voi olla tilapäisesti pois käytöstä.', removalActive: 'Siirtokehotus tämän paikan lähellä', removalBody: 'Kaupungin Siirtovahti näyttää siirtokehotuksen tällä katuosuudella.', removalPeriod: 'Voimassa', maintenanceUnavailable: 'Aura-ajoneuvojen live-syöte ei ole käytettävissä', maintenanceBody: 'Siirtokehotukset tarkistetaan kaupungin Siirtovahti-palvelusta. Kadulla oleva merkki ratkaisee.', officialRule: 'Palvelukartan virallinen kuvaus', officialRestriction: 'Pysäköinti kielletty', officialRestrictionHint: 'Virallinen rajoitus · tarkista liikennemerkki',
    occupancy: 'Kadunvarsipaikkojen tilanne', occupancyLoading: 'Haetaan arviota…', occupancyUnavailable: 'Live-arviota ei saatavilla', occupancyHint: 'Arvio ei sisällä asukaspysäköintiä eikä takaa vapaata paikkaa.', spacesHint: 'arviolta vapaana',
    nearby: 'Pysäköintilaitokset lähellä', live: 'LIVE', open: 'Auki nyt', closed: 'Suljettu nyt', statusUnknown: 'Aukiolo ei tiedossa', spaces: 'vapaana', totalSpaces: 'paikkaa', distance: 'etäisyys', priceUnavailable: 'Hinta ei tiedossa', forecast: '+2 h ennuste', facilitiesLoading: 'Haetaan pysäköintilaitoksia…', facilitiesEmpty: 'Lähistöltä ei löytynyt julkisia pysäköintilaitoksia.',
    sources: 'Tietolähteet', advisory: 'Liikennemerkki ratkaisee', disclaimer: 'Sivustolle kootut tiedot voivat olla vanhentuneita tai vääriä. Tarkista aina liikennemerkki ennen pysäköintiä',
    locate: 'Näytä sijaintini', refresh: 'Päivitä tiedot', close: 'Sulje', details: 'Tiedot', showList: 'Lähialueen hallit', dataUpdated: 'Aineisto päivitetty', dataUpdating: 'Päivitetään aineistoa', spotCount: 'paikkaa kartalla', zoomIn: 'Lähennä nähdäksesi pysäköintipaikat', hour: 'Tunti', minute: 'Minuutti',
    permissions: 'GPS sijainti ei käytettävissä', privacy: 'Sijaintia käytetään vain selaimessasi.', more: 'Lisätiedot', cc: '© Helsingin kaupunki / HRI / Palvelukartta, CC BY 4.0 · © Fintraffic, CC BY 4.0 · © OpenStreetMap, ODbL',
  },
  en: {
    appName: 'PARKKI', region: 'Helsinki', locating: 'Finding your location…', locationReady: 'Your location', locationFallback: 'Helsinki city centre',
    when: 'Parking time', date: 'Date', time: 'Time', today: 'Today', now: 'Now', paidAtTime: 'Paid', freeAtTime: 'Free', paidUntil: 'Paid until', chargingStarts: 'Charging starts', maxStay: 'Maximum', mapHint: 'Choose a parking space on the map', detailsSummary: 'Details',
    freeLegend: 'Free', freeLongLegend: 'Free', freeShortLegend: 'Free under 60 min', paidLegend: 'Paid', unavailableLegend: 'Unavailable', freeLabel: 'Free', paidLabel: 'Paid', unavailableLabel: 'Temporarily unavailable', upcomingException: 'Upcoming exception', activeException: 'Active exception', starts: 'Starts', ends: 'Ends', noTimeLimit: 'no time limit', limitUnknown: 'time limit unknown', scheduleUnknown: 'chargeable hours must be checked', withDisc: 'with parking disc',
    mapLayers: 'Map layers', street: 'On-street spaces', priceZones: 'Payment zones', residentZones: 'Resident zones', closures: 'Works and events', removals: 'Relocation notices',
    here: 'At this location', tapHint: 'Tap a parking space on the map', noMappedSpot: 'No mapped parking space', noMappedSpotBody: 'Open data has no parking record for this point. Always check the street sign.',
    paid: 'Paid parking', free: 'Free parking', disc: 'Time-limited parking', resident: 'Resident parking', disabled: 'Accessible parking', loading: 'Loading zone', restricted: 'Restricted parking',
    perHour: '/ hour', freeNow: 'Free now', paidNow: 'Paid now', nextFree: 'Free after 21:00', saturdayFree: 'Free after 18:00', allDayFree: 'Free all day',
    hours: 'Chargeable hours', weekdays: 'Mon–Fri', saturday: 'Saturday', sunday: 'Sunday', signException: 'Space-specific validity', zone: 'Payment zone', residentArea: 'Resident zone', permit: 'Resident permit', estimatedSpaces: 'Estimated capacity',
    notices: 'Advisories', closureActive: 'Works or event in this area', closureBody: 'The permit area overlaps the selected parking space. Spaces may be temporarily unavailable.', removalActive: 'Relocation notice near this space', removalBody: 'The City Siirtovahti service shows a relocation notice on this street section.', removalPeriod: 'Valid', maintenanceUnavailable: 'Live snow-plough positions are unavailable', maintenanceBody: 'Relocation notices are checked through the City Siirtovahti service. The street sign is final.', officialRule: 'Official Service Map description', officialRestriction: 'Parking prohibited', officialRestrictionHint: 'Official restriction · check the street sign',
    occupancy: 'On-street availability', occupancyLoading: 'Checking estimate…', occupancyUnavailable: 'Live estimate unavailable', occupancyHint: 'Estimate excludes resident parking and does not guarantee a free space.', spacesHint: 'estimated free',
    nearby: 'Nearby parking facilities', live: 'LIVE', open: 'Open now', closed: 'Closed now', statusUnknown: 'Hours unavailable', spaces: 'available', totalSpaces: 'spaces', distance: 'distance', priceUnavailable: 'Price unavailable', forecast: '+2 h forecast', facilitiesLoading: 'Finding parking facilities…', facilitiesEmpty: 'No public parking facilities were found nearby.',
    sources: 'Data sources', advisory: 'Street signs are final', disclaimer: 'Information collected on this site may be outdated or incorrect. Always check the traffic sign before parking.',
    locate: 'Show my location', refresh: 'Refresh data', close: 'Close', details: 'Details', showList: 'Nearby facilities', dataUpdated: 'Data updated', dataUpdating: 'Updating data', spotCount: 'spaces on map', zoomIn: 'Zoom in to see parking spaces', hour: 'Hour', minute: 'Minute',
    permissions: 'GPS location unavailable', privacy: 'Your location stays in this browser.', more: 'More information', cc: '© City of Helsinki / HRI / Service Map, CC BY 4.0 · © Fintraffic, CC BY 4.0 · © OpenStreetMap, ODbL',
  },
};

const sourceInfo = {
  fi: {
    title: 'Tietoa palvelusta',
    intro: 'Palvelu yhdistää avoimia tietolähteitä yhdeksi pysäköintinäkymäksi. Tiedot voivat muuttua, joten kadun liikennemerkki ratkaisee aina.',
    rows: [
      { name: 'Kadunvarsipaikat ja pysäköintivyöhykkeet', detail: 'Helsingin kaupunki / Helsinki Region Infoshare: sijainti, pysäköintiluokka, aikaraja, voimassaolo sekä maksu- ja asukasvyöhykkeet.', href: 'https://hri.fi/data/fi/dataset/helsingin-kantakaupungin-ja-asukaspysakointivyohykkeiden-pysakointipaikat' },
      { name: 'Paikan virallinen kuvaus', detail: 'Helsingin Palvelukartta: valitun pysäköintipaikan virallinen kuvaus ja voimassaoloaika.', href: 'https://palvelukartta.hel.fi/' },
      { name: 'Työt, tapahtumat ja siirtokehotukset', detail: 'Helsingin kaupungin avoin paikkatieto ja Siirtovahti.', href: 'https://siirtovahti.hel.fi/' },
      { name: 'Kadunvarsipaikkojen käyttöaste', detail: 'Parkkiopas: saatavuusarvio, kun tietoa on kyseiselle alueelle.', href: 'https://parkkiopas.fi/' },
      { name: 'Pysäköintilaitokset', detail: 'Fintraffic LIIPI: kapasiteetti ja saatavuus. OpenStreetMap täydentää laitosten sijainteja, nimiä ja hintoja.', href: 'https://parking.fintraffic.fi/docs/index.html' },
      { name: 'Taustakartta', detail: 'OpenStreetMapin karttatiedot ja CARTOn karttatiilet.', href: 'https://www.openstreetmap.org/copyright' },
    ],
    licence: 'Helsingin kaupungin ja Fintrafficin aineistot CC BY 4.0 · OpenStreetMap ODbL.',
    maker: 'Sivuston tekijän kotisivut:',
  },
  en: {
    title: 'About this service',
    intro: 'The service combines open datasets into one parking view. Data can change, so the street sign is always authoritative.',
    rows: [
      { name: 'On-street spaces and parking zones', detail: 'City of Helsinki / Helsinki Region Infoshare: location, parking class, time limit, validity, payment zones and resident zones.', href: 'https://hri.fi/data/en/dataset/helsingin-kantakaupungin-ja-asukaspysakointivyohykkeiden-pysakointipaikat' },
      { name: 'Official description', detail: 'Helsinki Service Map: the official description and validity of the selected parking space.', href: 'https://palvelukartta.hel.fi/en/' },
      { name: 'Works, events and relocation notices', detail: 'City of Helsinki open spatial data and Siirtovahti.', href: 'https://siirtovahti.hel.fi/' },
      { name: 'On-street occupancy', detail: 'Parkkiopas: availability estimate where the area is covered.', href: 'https://parkkiopas.fi/' },
      { name: 'Parking facilities', detail: 'Fintraffic LIIPI: capacity and availability. OpenStreetMap supplements locations, names and prices.', href: 'https://parking.fintraffic.fi/docs/index.html' },
      { name: 'Base map', detail: 'OpenStreetMap map data and CARTO map tiles.', href: 'https://www.openstreetmap.org/copyright' },
    ],
    licence: 'City of Helsinki and Fintraffic data CC BY 4.0 · OpenStreetMap ODbL.',
    maker: 'Service by',
  },
};

export function haversine(a, b) {
  const r = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function ringContains(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInFeature(point, feature) {
  if (!feature?.geometry) return false;
  const { type, coordinates } = feature.geometry;
  const inPolygon = (polygon) => ringContains(point, polygon[0]) && !polygon.slice(1).some((hole) => ringContains(point, hole));
  if (type === 'Polygon') return inPolygon(coordinates);
  if (type === 'MultiPolygon') return coordinates.some(inPolygon);
  return false;
}

function polygonRings(feature) {
  if (!feature?.geometry) return [];
  if (feature.geometry.type === 'Polygon') return [feature.geometry.coordinates[0]];
  if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) && b[0] >= Math.min(a[0], c[0]) && b[1] <= Math.max(a[1], c[1]) && b[1] >= Math.min(a[1], c[1]);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(a, c, b)) || (o2 === 0 && onSegment(a, d, b)) || (o3 === 0 && onSegment(c, a, d)) || (o4 === 0 && onSegment(c, b, d));
}

function featureBounds(feature) {
  return polygonRings(feature).flat().reduce(
    (box, [x, y]) => [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

export function featuresOverlap(a, b) {
  const aRings = polygonRings(a);
  const bRings = polygonRings(b);
  if (!aRings.length || !bRings.length) return false;
  const ab = featureBounds(a);
  const bb = featureBounds(b);
  if (ab[2] < bb[0] || bb[2] < ab[0] || ab[3] < bb[1] || bb[3] < ab[1]) return false;
  if (aRings.some((ring) => ring.some((point) => pointInFeature(point, b)))) return true;
  if (bRings.some((ring) => ring.some((point) => pointInFeature(point, a)))) return true;
  for (const ar of aRings) for (const br of bRings) {
    for (let ai = 1; ai < ar.length; ai += 1) for (let bi = 1; bi < br.length; bi += 1) {
      if (segmentsIntersect(ar[ai - 1], ar[ai], br[bi - 1], br[bi])) return true;
    }
  }
  return false;
}

function segmentDistanceMeters(point, start, end) {
  const latitude = (point[1] * Math.PI) / 180;
  const project = ([lon, lat]) => [(lon - point[0]) * 111320 * Math.cos(latitude), (lat - point[1]) * 110540];
  const [ax, ay] = project(start);
  const [bx, by] = project(end);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
  return Math.hypot(ax + ratio * dx, ay + ratio * dy);
}

export function pointToLineDistance(point, feature) {
  const geometry = feature?.geometry;
  if (!geometry) return Infinity;
  const lines = geometry.type?.toLowerCase() === 'linestring' ? [geometry.coordinates] : geometry.type?.toLowerCase() === 'multilinestring' ? geometry.coordinates : [];
  let nearest = Infinity;
  for (const line of lines) for (let index = 1; index < line.length; index += 1) nearest = Math.min(nearest, segmentDistanceMeters(point, line[index - 1], line[index]));
  return nearest;
}

export function siirtovahtiFeatures(data) {
  return (data?.hits?.hits || []).flatMap((hit) => {
    const source = hit._source || {};
    return (source.geometry || []).map((geometry, index) => ({
      type: 'Feature',
      id: `${hit._id}-${index}`,
      geometry: { ...geometry, type: geometry.type?.toLowerCase() === 'multilinestring' ? 'MultiLineString' : 'LineString' },
      properties: {
        address: source.address?.[0] || '',
        reason: source.reason?.[0] || '',
        timeRange: source.time_range?.[0] || '',
        validFrom: source.valid_from?.[0] || null,
        validTo: source.valid_to?.[0] || null,
        mapUrl: source.map_url?.[0] || '',
      },
    }));
  });
}

export function osmFacilities(data, origin) {
  const blockedAccess = new Set(['private', 'no', 'permit']);
  return (data?.elements || []).map((element) => {
    const tags = element.tags || {};
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!tags.name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || blockedAccess.has(tags.access)) return null;
    const capacity = Number(tags.capacity);
    return {
      id: `osm-${element.type}-${element.id}`,
      name: tags.name,
      point: [latitude, longitude],
      distance: haversine(origin, [latitude, longitude]),
      openNow: tags.opening_hours === '24/7' ? true : null,
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
      spacesAvailable: null,
      price: tags.charge || (tags.fee === 'no' ? 'Free / Maksuton' : null),
      operator: tags.operator || tags.brand || '',
      website: tags.website || tags.url || '',
      openingHours: tags.opening_hours || '',
      source: 'osm',
    };
  }).filter((facility) => facility && facility.distance < 8000).sort((a, b) => a.distance - b.distance);
}

function normalizedName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9åäö]+/g, ' ').replace(/\b(p|parking|parkki|pysäköinti)\b/g, '').trim();
}

export function mergeFacilities(primary, fallback, limit = 30) {
  const merged = [...primary];
  for (const candidate of fallback) {
    const candidateName = normalizedName(candidate.name);
    const match = merged.find((facility) => candidateName && candidateName === normalizedName(facility.name) && haversine(facility.point, candidate.point) < 250);
    if (match) {
      if (!match.price && candidate.price) match.price = candidate.price;
      if (!match.website && candidate.website) match.website = candidate.website;
      if (!match.operator && candidate.operator) match.operator = candidate.operator;
      if (!match.capacity && candidate.capacity) match.capacity = candidate.capacity;
    } else merged.push(candidate);
  }
  return merged.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

function parseTimeRanges(value) {
  const ranges = [];
  const normalized = String(value || '').replace(/(\d{1,2})\s*\.\s*(\d{1,2})/g, '$1-$2');
  const pattern = /(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?/g;
  for (const match of normalized.matchAll(pattern)) {
    const start = Number(match[1]) * 60 + Number(match[2] || 0);
    const end = Number(match[3]) * 60 + Number(match[4] || 0);
    if (start >= 0 && start < 1440 && end > 0 && end <= 1440) ranges.push({ start, end });
  }
  return ranges;
}

export function parseParkingValidity(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (/\d\s*\.\s*\d/.test(text)) return null;
  const saturday = /\(([^)]*)\)/.exec(text);
  if (saturday && !text.slice(0, saturday.index).trim().endsWith(',')) return null;
  const weekdayRanges = parseTimeRanges(saturday ? text.slice(0, saturday.index) : text);
  const saturdayRanges = saturday ? parseTimeRanges(saturday[1]) : [];
  const sundayRanges = saturday ? parseTimeRanges(text.slice(saturday.index + saturday[0].length)) : [];
  if (!weekdayRanges.length && !saturdayRanges.length && !sundayRanges.length) return null;
  return { byDay: [sundayRanges, weekdayRanges, weekdayRanges, weekdayRanges, weekdayRanges, weekdayRanges, saturdayRanges], source: text };
}

function schedulePeriodAt(schedule, date) {
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

export function formatParkingValidity(value, lang = 'fi') {
  const schedule = parseParkingValidity(value);
  if (!schedule) return '';
  const formatMinute = (minute) => {
    const hours = Math.floor(minute / 60);
    const minutes = minute % 60;
    return minutes ? `${hours}:${String(minutes).padStart(2, '0')}` : String(hours);
  };
  const formatRanges = (ranges) => ranges.map((range) => `${formatMinute(range.start)}–${formatMinute(range.end)}`).join(', ');
  const rows = [];
  if (schedule.byDay[1].length) rows.push(`${lang === 'fi' ? 'Ma–pe' : 'Mon–Fri'} ${formatRanges(schedule.byDay[1])}`);
  if (schedule.byDay[6].length) rows.push(`${lang === 'fi' ? 'la' : 'Sat'} ${formatRanges(schedule.byDay[6])}`);
  if (schedule.byDay[0].length) rows.push(`${lang === 'fi' ? 'su' : 'Sun'} ${formatRanges(schedule.byDay[0])}`);
  return rows.join(' · ');
}

export function parkingNowStatus(zoneNumber, date = new Date(), validity = '') {
  const schedule = parseParkingValidity(validity);
  if (schedule) {
    const period = schedulePeriodAt(schedule, date);
    return { paid: Boolean(period), key: period ? 'paidNow' : 'freeNow', hours: formatParkingValidity(validity), end: period?.end || null };
  }
  if (String(validity || '').trim()) return { paid: false, unknown: true, key: 'unknown', hours: null, end: null };
  if (!zoneNumber) return { paid: false, key: 'freeNow', hours: null, end: null };
  const day = date.getDay();
  const hour = date.getHours() + date.getMinutes() / 60;
  if (day === 0) return { paid: false, key: 'allDayFree', hours: null, end: null };
  if (day === 6) {
    const paid = hour >= 9 && hour < 18;
    const end = new Date(date); end.setHours(18, 0, 0, 0);
    return { paid, key: paid ? 'paidNow' : 'saturdayFree', hours: '09–18', end: paid ? end : null };
  }
  const paid = hour >= 9 && hour < 21;
  const end = new Date(date); end.setHours(21, 0, 0, 0);
  return { paid, key: paid ? 'paidNow' : 'nextFree', hours: '09–21', end: paid ? end : null };
}

export function nextPaidStart(zoneNumber, date = new Date(), validity = '') {
  const status = parkingNowStatus(zoneNumber, date, validity);
  if (status.paid) return null;
  const schedule = parseParkingValidity(validity);
  if (schedule) {
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
  if (!zoneNumber) return null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(date);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(9, 0, 0, 0);
    if (candidate.getDay() !== 0 && candidate.getTime() > date.getTime()) return candidate;
  }
  return null;
}

function paidPeriodEnd(zoneNumber, date = new Date(), validity = '') {
  return parkingNowStatus(zoneNumber, date, validity).end;
}

function formatPaymentTransition(value, reference, lang) {
  if (!value) return '';
  const weekdays = lang === 'fi' ? ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const time = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  const sameDay = value.getFullYear() === reference.getFullYear() && value.getMonth() === reference.getMonth() && value.getDate() === reference.getDate();
  if (lang === 'fi') return sameDay ? `klo ${time}` : `${weekdays[value.getDay()]} klo ${time}`;
  return sameDay ? time : `${weekdays[value.getDay()]} ${time}`;
}

export function formatParkingCardTransition(kind, value, reference, lang) {
  const transition = formatPaymentTransition(value, reference, lang);
  if (!transition) return '';
  if (lang === 'fi') {
    if (kind === 'paidUntil') return `Maksullinen ${transition} asti`;
    if (kind === 'chargingStarts') return `Maksu alkaa ${transition}`;
    return `Päättyy ${transition}`;
  }
  if (kind === 'paidUntil') return `Paid until ${transition}`;
  if (kind === 'chargingStarts') return `Charging starts ${transition}`;
  return `Ends ${transition}`;
}

export function closureActiveAt(feature, date) {
  const properties = feature?.properties || {};
  const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const startValue = properties.event_startdate || properties.licence_startdate;
  const endValue = properties.event_enddate || properties.licence_enddate;
  const start = startValue ? new Date(startValue).getTime() : -Infinity;
  const end = endValue ? new Date(endValue).getTime() + (String(endValue).length <= 10 ? 86399999 : 0) : Infinity;
  return properties.licence_status !== 'CANCELLED' && timestamp >= start && timestamp <= end;
}

export function noticeActiveAt(notice, date) {
  const timestamp = (date instanceof Date ? date.getTime() : new Date(date).getTime()) / 1000;
  const start = notice?.properties?.validFrom ?? -Infinity;
  const end = notice?.properties?.validTo ?? Infinity;
  return timestamp >= start && timestamp <= end;
}

export function dateTimeInputValue(date) {
  const value = date instanceof Date ? date : new Date(date);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function ceilToFiveMinutes(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return new Date(Math.ceil(value.getTime() / 300000) * 300000);
}

export function setParkingDatePart(current, dateValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const value = new Date(current);
  if (![year, month, day].every(Number.isFinite)) return value;
  value.setFullYear(year, month - 1, day);
  return ceilToFiveMinutes(value);
}

export function setParkingTimePart(current, timeValue) {
  const [hours, minutes] = String(timeValue).split(':').map(Number);
  const value = new Date(current);
  if (![hours, minutes].every(Number.isFinite)) return value;
  value.setHours(hours, minutes, 0, 0);
  return ceilToFiveMinutes(value);
}

export function parkingTimeStepDisabled(current, deltaMinutes, minimum, maximum) {
  const next = current.getTime() + deltaMinutes * 60000;
  return next < minimum.getTime() || next > maximum.getTime();
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

function formatParkingDeadline(value, reference, lang) {
  const sameDay = value.getFullYear() === reference.getFullYear() && value.getMonth() === reference.getMonth() && value.getDate() === reference.getDate();
  const clock = `${value.getHours()}:${String(value.getMinutes()).padStart(2, '0')}`.replace(':00', '');
  if (sameDay) return lang === 'fi' ? `klo ${clock}` : `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  const weekday = new Intl.DateTimeFormat(lang === 'fi' ? 'fi-FI' : 'en-GB', { weekday: 'short' }).format(value).replace('.', '');
  return lang === 'fi' ? `${weekday} klo ${clock}` : `${weekday} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function closureTimes(feature) {
  const properties = feature?.properties || {};
  const startValue = properties.event_startdate || properties.licence_startdate;
  const endValue = properties.event_enddate || properties.licence_enddate;
  return {
    start: startValue ? new Date(startValue).getTime() : -Infinity,
    end: endValue ? new Date(endValue).getTime() + (String(endValue).length <= 10 ? 86399999 : 0) : Infinity,
  };
}

function featureNearNotice(feature, notice, threshold = 40) {
  const center = geometryCenter(feature);
  const points = [...polygonRings(feature).flat()];
  if (center) points.push([center[1], center[0]]);
  return points.some((point) => pointToLineDistance(point, notice) <= threshold);
}

export function parkingExceptions(feature, date, closures = [], notices = []) {
  if (!feature) return [];
  const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const horizon = timestamp + 7 * 86400000;
  const relevantClosures = closures.filter((closure) => {
    const times = closureTimes(closure);
    return closure?.properties?.licence_status !== 'CANCELLED' && times.end >= timestamp && times.start <= horizon;
  });
  const closureRows = relevantClosures.filter((closure) => featuresOverlap(feature, closure)).map((closure) => {
    const times = closureTimes(closure);
    const properties = closure.properties || {};
    return { id: closure.id || properties.id, kind: 'closure', active: timestamp >= times.start && timestamp <= times.end, start: times.start, end: times.end, title: properties.event_description || properties.licence_type || '', detail: properties.event_location || properties.licence_status || '' };
  });
  const relevantNotices = notices.filter((notice) => (notice.properties.validTo ?? Infinity) * 1000 >= timestamp && (notice.properties.validFrom ?? -Infinity) * 1000 <= horizon);
  const noticeRows = relevantNotices.filter((notice) => featureNearNotice(feature, notice)).map((notice) => ({
    id: notice.id,
    kind: 'removal',
    active: noticeActiveAt(notice, date),
    start: (notice.properties.validFrom ?? -Infinity) * 1000,
    end: (notice.properties.validTo ?? Infinity) * 1000,
    title: notice.properties.address || notice.properties.reason || '',
    detail: [notice.properties.reason, notice.properties.timeRange].filter(Boolean).join(' · '),
  }));
  return [...closureRows, ...noticeRows]
    .filter((exception) => exception.active || (exception.start > timestamp && exception.start <= horizon))
    .sort((a, b) => (a.active === b.active ? a.start - b.start : a.active ? -1 : 1));
}

export function parkingPolygonState(feature, zone, date, closures = [], notices = [], lang = 'fi') {
  const labels = copy[lang] || copy.fi;
  const meta = spotMeta(feature, zone, lang);
  const exceptions = parkingExceptions(feature, date, closures, notices);
  const active = exceptions.find((exception) => exception.active);
  const upcoming = exceptions.some((exception) => !exception.active);
  if (active) {
    const deadline = Number.isFinite(active.end) ? formatParkingDeadline(new Date(active.end), date, lang) : '';
    const label = deadline ? `${labels.unavailableLabel} · ${lang === 'fi' ? `${deadline} asti` : `until ${deadline}`}` : labels.unavailableLabel;
    return { status: 'unavailable', label, until: active.end, hasUpcoming: upcoming, exceptions, meta };
  }
  if (['restricted', 'disabled', 'loading'].includes(meta.kind)) return { status: 'unavailable', label: meta.label, until: null, hasUpcoming: upcoming, exceptions, meta };
  const duration = feature?.properties?.kesto || '';
  const durationMinutes = parkingDurationMinutes(duration);
  const validity = feature?.properties?.voimassaolo || '';
  const paidKind = ['paid', 'resident'].includes(meta.kind);
  const scheduleUnknown = paidKind && !parseParkingValidity(validity);
  if (scheduleUnknown) {
    const price = meta.price ? `${meta.price} €/h` : labels.paidAtTime;
    return { status: 'paid', label: `${price} · ${labels.scheduleUnknown}`, until: null, hasUpcoming: upcoming, exceptions, meta, scheduleUnknown: true };
  }
  const payment = parkingNowStatus(zone, date, validity);
  if (paidKind && payment.paid) {
    const paidUntil = paidPeriodEnd(zone, date, validity);
    const deadline = paidUntil ? formatParkingDeadline(paidUntil, date, lang) : '';
    const price = meta.price ? `${meta.price} €/h` : labels.paidLabel;
    return { status: 'paid', label: deadline ? `${price} · ${lang === 'fi' ? `${deadline} asti` : `until ${deadline}`}` : price, until: paidUntil?.getTime() || null, hasUpcoming: upcoming, exceptions, meta };
  }
  const nextPaidAt = paidKind ? nextPaidStart(zone, date, validity) : null;
  const status = durationMinutes !== null && durationMinutes < 60 ? 'freeShort' : 'freeLong';
  const label = nextPaidAt ? `${labels.freeLegend} · ${lang === 'fi' ? `maksu alkaa ${formatParkingDeadline(nextPaidAt, date, lang)}` : `charging starts ${formatParkingDeadline(nextPaidAt, date, lang)}`}`
    : durationMinutes === Infinity ? `${labels.freeLegend} · ${labels.noTimeLimit}`
      : duration ? (meta.kind === 'disc' ? `${duration} ${labels.withDisc}` : `${labels.freeLegend} · ${labels.maxStay.toLowerCase()} ${duration}`)
        : `${labels.freeLegend}${meta.kind === 'disc' ? ` ${labels.withDisc}` : ''} · ${labels.limitUnknown}`;
  return { status, label, until: null, nextPaidAt, hasUpcoming: upcoming, exceptions, meta, durationMinutes };
}

export function spotMeta(feature, zoneNumber, lang = 'fi') {
  const p = feature?.properties || {};
  const klass = Number(p.luokka);
  const type = String(p.tyyppi || '').toLowerCase();
  const residentCode = p.asukaspysakointitunnus || '';
  let kind = 'restricted';
  if (type.includes('inva')) kind = 'disabled';
  else if (type.includes('kuormaus')) kind = 'loading';
  else if (residentCode) kind = 'resident';
  else if ([1, 2].includes(klass)) kind = 'free';
  else if (klass === 8) kind = 'disc';
  else if ([3, 4, 5, 6, 7, 10].includes(klass)) kind = 'paid';
  else if (klass === 9) kind = 'restricted';
  const price = kind === 'paid' || kind === 'resident' ? (Number(zoneNumber) === 1 ? 4 : Number(zoneNumber) === 2 ? 2 : null) : 0;
  const labels = copy[lang] || copy.fi;
  return { kind, label: labels[kind], price, residentCode, validity: p.voimassaolo || '', estimated: p.paikat_ala || null, rawLabel: p.luokka_nimi || '' };
}

export function isGeneralParkingFeature(feature) {
  return !['restricted', 'loading', 'disabled'].includes(spotMeta(feature, null).kind);
}

export function parkingAreaLabel(feature, areaType, lang = 'fi') {
  const labels = copy[lang] || copy.fi;
  const properties = feature?.properties || {};
  const identifier = areaType === 'payment' ? properties.vyohykkeen_nro : properties.asukaspysakointitunnus;
  if (!identifier) return '';
  return `${areaType === 'payment' ? labels.zone : labels.residentArea} ${identifier}`;
}

export function parkingFeatureAt(point, explicitFeature, spots = []) {
  if (explicitFeature) return isGeneralParkingFeature(explicitFeature) ? explicitFeature : null;
  return spots.find((feature) => isGeneralParkingFeature(feature) && pointInFeature(point, feature)) || null;
}

export function shouldLoadParkingSpots(zoom) {
  return Number(zoom) >= MIN_PARKING_ZOOM;
}

export function shouldShowParkingZoomHint(zoom, streetLayerEnabled) {
  return Boolean(streetLayerEnabled) && !shouldLoadParkingSpots(zoom);
}

export function shouldShowLocationMarker(locationState) {
  return locationState === 'ready';
}

function wfsUrl(layer, { bounds, count = 5000 } = {}) {
  const q = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeName: `avoindata:${layer}`, outputFormat: 'application/json', srsName: 'EPSG:4326', count: String(count) });
  if (bounds) q.set('bbox', `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()},EPSG:4326`);
  return `${WFS}?${q}`;
}

async function jsonWithTimeout(url, ms = 12000, signal, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function overpassUrl([lat, lon]) {
  const query = `[out:json][timeout:20];nwr(around:8000,${lat},${lon})["amenity"="parking"]["parking"~"underground|multi-storey"];out center tags;`;
  return `${OVERPASS}?${new URLSearchParams({ data: query })}`;
}

function geometryCenter(feature) {
  const bbox = feature?.geometry?.bbox || feature?.geometry?.coordinates?.flat(4).reduce((box, value, index, arr) => {
    if (typeof value !== 'number') return box;
    const isLon = index % 2 === 0;
    if (isLon) { box[0] = Math.min(box[0], value); box[2] = Math.max(box[2], value); }
    else { box[1] = Math.min(box[1], value); box[3] = Math.max(box[3], value); }
    return box;
  }, [Infinity, Infinity, -Infinity, -Infinity]);
  if (!bbox || !bbox.every(Number.isFinite)) return null;
  return [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2];
}

function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

function parsePrice(detail, lang) {
  const rows = detail?.pricing?.filter((row) => row.capacityType === 'CAR') || [];
  const first = rows.find((row) => row.price?.[lang]) || rows.find((row) => row.price?.fi) || rows[0];
  const text = first?.price?.[lang] || first?.price?.fi || first?.price?.en;
  if (text) return text.replace(/EUR/gi, '€').replace(/\/H\b/gi, '/h');
  if (first && first.price === null) return lang === 'fi' ? 'Maksuton' : 'Free';
  return null;
}

export function compactFacilityPrice(price) {
  const text = String(price || '').trim();
  if (!text) return null;
  if (/maksuton|\bfree\b/i.test(text)) return /maksuton/i.test(text) ? 'Maksuton' : 'Free';
  const normalized = text.replace(/EUR/gi, '€');
  const hourly = normalized.match(/(\d+(?:[.,]\d+)?)\s*€\s*(?:\/|per\s*)(?:h|hour|tunti)/i);
  if (hourly) return `${hourly[1]} €/h`;
  const amount = normalized.match(/(\d+(?:[.,]\d+)?)\s*€/);
  return amount ? `${amount[1]} €` : null;
}

export function hasOfficialParkingRestriction(serviceMap) {
  const description = Object.values(serviceMap?.name || {}).filter(Boolean).join(' ');
  return /pysäköintikiel|pysäköinti\s+kielletty|pysäyttäminen\s+kielletty|parking\s+(?:is\s+)?prohibited|no\s+parking|stopping\s+prohibited/i.test(description);
}

export function shouldShowFacilityMarker(facility, zoom, streetLayerEnabled = true) {
  if (!streetLayerEnabled || !shouldLoadParkingSpots(zoom)) return false;
  return Array.isArray(facility?.point)
    && facility.point.length === 2
    && facility.point.every(Number.isFinite)
    && Boolean(facility?.name);
}

export function visibleFacilityMarkers(facilities, zoom, streetLayerEnabled = true) {
  return facilities.filter((facility) => shouldShowFacilityMarker(facility, zoom, streetLayerEnabled));
}

function formatExceptionPeriod(exception, lang) {
  const locale = lang === 'fi' ? 'fi-FI' : 'en-GB';
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const formatValue = (milliseconds) => {
    if (!Number.isFinite(milliseconds)) return '—';
    const value = new Date(milliseconds);
    return `${formatter.format(value)} ${value.getHours()}:${String(value.getMinutes()).padStart(2, '0')}`;
  };
  const start = formatValue(exception.start);
  const end = formatValue(exception.end);
  return `${start} – ${end}`;
}

function IconButton({ label, children, onClick, active = false, className = '' }) {
  return <button className={`icon-button ${active ? 'active' : ''} ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function SourcePanel({ lang, onClose }) {
  const info = sourceInfo[lang] || sourceInfo.fi;
  const closeLabel = copy[lang]?.close || copy.fi.close;
  return <div className="source-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="source-panel" role="dialog" aria-modal="true" aria-labelledby="source-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="panel-close" onClick={onClose} aria-label={closeLabel}><X size={18} /></button>
      <div className="source-heading"><Info size={18} /><h2 id="source-title">{info.title}</h2></div>
      <p className="source-intro">{info.intro}</p>
      <div className="source-list">{info.rows.map((row) => <a href={row.href} target="_blank" rel="noreferrer" key={row.name}>
        <span><strong>{row.name}</strong><small>{row.detail}</small></span><ExternalLink size={15} />
      </a>)}</div>
      <p className="source-licence">{info.licence}</p>
      <div className="source-maker"><span>{info.maker}</span><a href="https://esiivola.github.io" target="_blank" rel="noreferrer">esiivola.github.io <ExternalLink size={14} /></a></div>
    </section>
  </div>;
}

function ParkingPanel({ selected, lang, occupancy, exceptions, serviceMap, parkingTime, onClose }) {
  const t = copy[lang];
  if (!selected) return null;
  const { meta, zone, resident } = selected;
  if (!meta) return null;
  const locale = lang === 'fi' ? 'fi-FI' : 'en-GB';
  const selectedDate = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(parkingTime);
  const selectedTime = `${selectedDate} · ${dateTimeInputValue(parkingTime).slice(11, 16)}`;
  const status = parkingNowStatus(zone, parkingTime, meta.validity);
  const activeException = exceptions.find((exception) => exception.active);
  const officialRestriction = hasOfficialParkingRestriction(serviceMap);
  const paidKind = ['paid', 'resident'].includes(meta.kind);
  const scheduleUnknown = paidKind && !parseParkingValidity(meta.validity);
  const isPaid = !activeException && paidKind && !scheduleUnknown && status.paid;
  const cardState = activeException || officialRestriction ? 'unavailable' : isPaid || scheduleUnknown ? 'paid' : 'free';
  const nextPaidAt = !isPaid && !scheduleUnknown && paidKind ? nextPaidStart(zone, parkingTime, meta.validity) : null;
  const paidUntil = isPaid ? paidPeriodEnd(zone, parkingTime, meta.validity) : null;
  const duration = selected.feature?.properties?.kesto || '';
  const permit = String(meta.residentCode || resident || '').trim();
  const hasPermit = permit && permit !== '0';
  const headline = officialRestriction ? t.officialRestriction : activeException ? t.unavailableLabel : (isPaid || scheduleUnknown) && meta.price ? `${meta.price} €/h` : isPaid || scheduleUnknown ? t.paidAtTime : t.freeAtTime;
  const transition = officialRestriction ? t.officialRestrictionHint
    : Number.isFinite(activeException?.end) ? formatParkingCardTransition('ends', new Date(activeException.end), parkingTime, lang)
    : scheduleUnknown ? t.scheduleUnknown
    : paidUntil ? formatParkingCardTransition('paidUntil', paidUntil, parkingTime, lang)
      : nextPaidAt ? formatParkingCardTransition('chargingStarts', nextPaidAt, parkingTime, lang)
        : duration ? `${t.maxStay} ${duration}` : '';
  const showDurationFact = Boolean(duration && (officialRestriction || activeException || scheduleUnknown || paidUntil || nextPaidAt));
  const hasKeyFacts = showDurationFact || hasPermit;
  const hasDetails = Boolean(zone || meta.validity || serviceMap?.name?.[lang] || occupancy.status === 'ready');
  const scheduleLabel = serviceMap?.extra?.validity_period || formatParkingValidity(meta.validity, lang);
  return (
    <section className="place-card">
      <button className="panel-close" onClick={onClose} aria-label={t.close}><X size={17} /></button>
      <div className="eyebrow"><MapPin size={14} /> {selectedTime}</div>
      <div className={`parking-summary ${cardState}`}>
        <h2>{headline}</h2>
        {transition && <p>{transition}</p>}
      </div>
      {hasKeyFacts && <dl className="card-key-facts">
        {showDurationFact && <div><dt>{t.maxStay}</dt><dd>{duration}</dd></div>}
        {hasPermit && <div><dt>{t.permit}</dt><dd>{permit}</dd></div>}
      </dl>}
      {exceptions.length > 0 && <div className="notices">
          {exceptions.slice(0, 3).map((exception) => <div className={`notice ${exception.active ? 'danger' : 'upcoming'}`} key={`${exception.kind}-${exception.id}-${exception.start}`}><AlertTriangle size={16} /><span><strong>{exception.active ? t.activeException : `! ${t.upcomingException}`}</strong><small>{exception.title}{exception.detail ? ` · ${exception.detail}` : ''}<br />{formatExceptionPeriod(exception, lang)}</small></span></div>)}
      </div>}
      {hasDetails && <details className="detail-disclosure">
        <summary>{t.detailsSummary}<ChevronDown size={15} /></summary>
        <div className="detail-rows">
          {zone && <div><span>{t.zone}</span><strong>{zone}</strong></div>}
          {['paid', 'resident'].includes(meta.kind) && scheduleLabel && <div><span>{t.hours}</span><strong>{scheduleLabel}</strong></div>}
          {occupancy.status === 'ready' && <div><span>{t.occupancy}</span><strong>≈ {occupancy.free} {t.spacesHint}</strong></div>}
          {serviceMap?.name?.[lang] && <div><span>{t.officialRule}</span><strong>{serviceMap.name[lang]}{serviceMap.extra?.validity_period ? ` · ${serviceMap.extra.validity_period}` : ''}</strong></div>}
        </div>
      </details>}
    </section>
  );
}

function FacilityPanel({ facility, lang, onClose }) {
  const t = copy[lang];
  if (!facility) return null;
  const compactPrice = compactFacilityPrice(facility.price);
  const status = facility.openNow === true ? t.open : facility.openNow === false ? t.closed : t.statusUnknown;
  const liveSpaces = Number.isFinite(facility.spacesAvailable) ? facility.spacesAvailable : null;
  const predictedSpaces = Number.isFinite(facility.predictedSpaces) ? facility.predictedSpaces : null;
  const statusKnown = typeof facility.openNow === 'boolean';
  const headline = liveSpaces !== null ? `${liveSpaces} ${t.spaces}`
    : compactPrice || (predictedSpaces !== null ? `≈ ${predictedSpaces} ${t.spaces}` : status);
  const subline = liveSpaces !== null && compactPrice ? compactPrice
    : liveSpaces !== null && statusKnown ? status
      : compactPrice && statusKnown ? status
        : predictedSpaces !== null ? t.forecast : '';
  const priceState = facility.openNow === false ? 'unavailable' : /maksuton|free/i.test(compactPrice || '') ? 'free' : 'neutral';
  const showPredictedDetail = predictedSpaces !== null && liveSpaces !== null;
  const hasDetails = showPredictedDetail || Number.isFinite(facility.capacity) || (facility.price && facility.price !== compactPrice);
  return (
    <section className="place-card facility-card">
      <button className="panel-close" onClick={onClose} aria-label={t.close}><X size={17} /></button>
      <div className="eyebrow"><Building2 size={14} /> {formatDistance(facility.distance)}</div>
      <h2 className="facility-name">{facility.name}</h2>
      <div className={`parking-summary facility ${priceState}`}>
        <h2>{headline}</h2>
        {subline && <p>{subline}</p>}
      </div>
      {hasDetails && <div className="detail-rows facility-details">
        {showPredictedDetail && <div><span>{t.forecast}</span><strong>≈ {facility.predictedSpaces}</strong></div>}
        {Number.isFinite(facility.capacity) && <div><span>{t.totalSpaces}</span><strong>{facility.capacity}</strong></div>}
        {facility.price && facility.price !== compactPrice && <div><span>{t.details}</span><strong>{facility.price}</strong></div>}
      </div>}
    </section>
  );
}

function App() {
  const [lang, setLang] = useState('fi');
  const t = copy[lang];
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const timePickerRef = useRef(null);
  const layersRef = useRef({ zones: null, residents: null, spots: null, closures: null, facilities: null });
  const dataRef = useRef({ zones: [], residents: [], spots: [], closures: [] });
  const parkingAbort = useRef(null);
  const removalAbort = useRef(null);
  const removalLoaded = useRef(false);
  const [location, setLocation] = useState({ point: HELSINKI, state: 'fallback', message: null });
  const [parkingTime, setParkingTime] = useState(() => ceilToFiveMinutes());
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const [selected, setSelected] = useState(null);
  const [occupancy, setOccupancy] = useState({ status: 'idle' });
  const [layerMenu, setLayerMenu] = useState(false);
  const [timeMenu, setTimeMenu] = useState(false);
  const [layers, setLayers] = useState({ street: true, zones: false, residents: false });
  const [mapData, setMapData] = useState({ zones: [], residents: [], closures: [] });
  const [removalNotices, setRemovalNotices] = useState([]);
  const [serviceMap, setServiceMap] = useState(null);
  const [spots, setSpots] = useState([]);
  const [spotStatus, setSpotStatus] = useState('loading');
  const [facilities, setFacilities] = useState([]);
  const [activeFacility, setActiveFacility] = useState(null);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (!timeMenu) return undefined;
    const closePicker = (event) => { if (!timePickerRef.current?.contains(event.target)) setTimeMenu(false); };
    document.addEventListener('pointerdown', closePicker);
    return () => document.removeEventListener('pointerdown', closePicker);
  }, [timeMenu]);

  useEffect(() => {
    if (!infoOpen) return undefined;
    const closeInfo = (event) => { if (event.key === 'Escape') setInfoOpen(false); };
    document.addEventListener('keydown', closeInfo);
    return () => document.removeEventListener('keydown', closeInfo);
  }, [infoOpen]);

  const analyzePoint = useCallback((latlng, explicitFeature) => {
    const point = [latlng.lng, latlng.lat];
    const current = dataRef.current;
    const spot = parkingFeatureAt(point, explicitFeature, current.spots);
    if (!spot) { setSelected(null); setMobilePanel(null); return; }
    const zoneFeature = current.zones.find((f) => pointInFeature(point, f));
    const residentFeature = current.residents.find((f) => pointInFeature(point, f));
    const zone = zoneFeature?.properties?.vyohykkeen_nro || null;
    setSelected({ point: [latlng.lat, latlng.lng], feature: spot, meta: spotMeta(spot, zone, lang), zone, resident: residentFeature?.properties?.asukaspysakointitunnus || '' });
    setMobilePanel('place');
  }, [lang]);

  const locate = useCallback(() => {
    setLocation((v) => ({ ...v, state: 'locating', message: null }));
    if (!navigator.geolocation) {
      setLocation({ point: HELSINKI, state: 'fallback', message: t.permissions });
      mapRef.current?.setView(HELSINKI, 15);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = [coords.latitude, coords.longitude];
        setLocation({ point, state: 'ready', message: null });
        mapRef.current?.flyTo(point, 16, { duration: 0.8 });
      },
      () => {
        setLocation({ point: HELSINKI, state: 'fallback', message: t.permissions });
        mapRef.current?.setView(HELSINKI, 15);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
    );
  }, [t.permissions]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = L.map(mapNode.current, { center: HELSINKI, zoom: DEFAULT_MAP_ZOOM, zoomControl: false, attributionControl: true, preferCanvas: true });
    L.tileLayer('https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · © <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    Object.keys(layersRef.current).forEach((key) => { layersRef.current[key] = L.layerGroup().addTo(map); });
    const updateZoom = () => setMapZoom(map.getZoom());
    map.on('click', (e) => analyzePoint(e.latlng));
    map.on('zoomend', updateZoom);
    mapRef.current = map;
    return () => { map.off('zoomend', updateZoom); map.remove(); mapRef.current = null; };
  }, [analyzePoint]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!shouldShowLocationMarker(location.state)) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }
    const icon = L.divIcon({ className: 'user-marker-wrap', html: '<span class="user-pulse"></span><span class="user-dot"></span>', iconSize: [30, 30], iconAnchor: [15, 15] });
    if (!userMarkerRef.current) userMarkerRef.current = L.marker(location.point, { icon, zIndexOffset: 1000 }).addTo(mapRef.current);
    else userMarkerRef.current.setLatLng(location.point);
  }, [location.point, location.state]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      jsonWithTimeout(wfsUrl('Pysakoinnin_maksuvyohykkeet_alue', { count: 20 })),
      jsonWithTimeout(wfsUrl('Asukas_ja_yrityspysakointivyohykkeet_alue', { count: 40 })),
      jsonWithTimeout(wfsUrl('Winkki_works', { count: 1000 })),
      jsonWithTimeout(wfsUrl('Winkki_rents_audiences', { count: 1200 })),
    ]).then((results) => {
      if (cancelled) return;
      const values = results.map((r) => (r.status === 'fulfilled' ? r.value.features || [] : []));
      const today = new Date().toISOString().slice(0, 10);
      const closures = [...values[2], ...values[3]].filter((f) => {
        const p = f.properties || {};
        const end = String(p.event_enddate || p.licence_enddate || '').slice(0, 10);
        return (!end || end >= today) && p.licence_status !== 'CANCELLED';
      });
      setMapData({ zones: values[0], residents: values[1], closures });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { dataRef.current = { ...dataRef.current, ...mapData, spots }; }, [mapData, spots]);

  const loadRemovalNotices = useCallback(async () => {
    if (removalLoaded.current) return;
    removalAbort.current?.abort();
    const controller = new AbortController();
    removalAbort.current = controller;
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 86400000);
    const body = {
      size: 500,
      sort: [{ valid_from: { order: 'asc' } }],
      query: { bool: { filter: [{ range: { valid_to: { gte: now.toISOString() } } }, { range: { valid_from: { lte: horizon.toISOString() } } }] } },
      _source: ['address', 'valid_from', 'valid_to', 'time_range', 'reason', 'map_url', 'geometry'],
    };
    try {
      const data = await jsonWithTimeout(SIIRTOVAHTI, 14000, controller.signal, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!controller.signal.aborted) {
        setRemovalNotices(siirtovahtiFeatures(data));
        removalLoaded.current = true;
      }
    } catch { if (!controller.signal.aborted) setRemovalNotices([]); }
  }, []);

  const needsRemovalData = shouldLoadParkingSpots(mapZoom) && layers.street;
  useEffect(() => {
    if (!needsRemovalData) { removalAbort.current?.abort(); return undefined; }
    loadRemovalNotices();
    return () => removalAbort.current?.abort();
  }, [needsRemovalData, loadRemovalNotices]);

  const loadSpots = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    parkingAbort.current?.abort();
    if (!layers.street) { setSpotStatus('ready'); setSpots([]); return; }
    if (!shouldLoadParkingSpots(map.getZoom())) { setSpotStatus('zoom'); setSpots([]); return; }
    const controller = new AbortController();
    parkingAbort.current = controller;
    setSpotStatus('loading');
    try {
      const data = await jsonWithTimeout(wfsUrl('Pysakointipaikat_alue', { bounds: map.getBounds().pad(0.12), count: 2000 }), 18000, controller.signal);
      if (!controller.signal.aborted) { setSpots((data.features || []).filter(isGeneralParkingFeature)); setSpotStatus('ready'); }
    } catch {
      if (!controller.signal.aborted) setSpotStatus('error');
    }
  }, [layers.street]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let timer = setTimeout(loadSpots, 250);
    const moved = () => { clearTimeout(timer); timer = setTimeout(loadSpots, 400); };
    map.on('moveend', moved);
    return () => { clearTimeout(timer); map.off('moveend', moved); parkingAbort.current?.abort(); };
  }, [loadSpots]);

  useEffect(() => {
    const groups = layersRef.current;
    if (!mapRef.current || !groups.zones) return;
    groups.zones.clearLayers(); groups.residents.clearLayers(); groups.closures.clearLayers();
    if (layers.zones) L.geoJSON(mapData.zones, {
      style: (feature) => ({ color: feature.properties.vyohykkeen_nro === '1' ? '#155eef' : '#6094ff', weight: 2, fillColor: feature.properties.vyohykkeen_nro === '1' ? '#2d6df6' : '#85aaff', fillOpacity: 0.10, dashArray: '7 6' }),
      onEachFeature: (feature, layer) => { const label = parkingAreaLabel(feature, 'payment', lang); if (label) layer.bindTooltip(label, { permanent: true, direction: 'center', className: 'area-zone-label payment', opacity: 1 }); },
    }).addTo(groups.zones);
    if (layers.residents) L.geoJSON(mapData.residents, {
      style: { color: '#7d52c8', weight: 1.7, fillColor: '#ae8fe6', fillOpacity: 0.10, dashArray: '4 5' },
      onEachFeature: (feature, layer) => { const label = parkingAreaLabel(feature, 'resident', lang); if (label) layer.bindTooltip(label, { permanent: true, direction: 'center', className: 'area-zone-label resident', opacity: 1 }); },
    }).addTo(groups.residents);
  }, [mapData.zones, mapData.residents, layers, lang]);

  useEffect(() => {
    const group = layersRef.current.spots;
    if (!group) return;
    group.clearLayers();
    if (!layers.street) return;
    const states = new WeakMap();
    const stateFor = (feature) => {
      if (states.has(feature)) return states.get(feature);
      const center = geometryCenter(feature);
      const point = center ? [center[1], center[0]] : [0, 0];
      const zone = mapData.zones.find((candidate) => pointInFeature(point, candidate))?.properties?.vyohykkeen_nro;
      const state = parkingPolygonState(feature, zone, parkingTime, mapData.closures, removalNotices, lang);
      states.set(feature, state);
      return state;
    };
    L.geoJSON(spots, {
      style: (f) => {
        const palette = { freeLong: ['#23745a', '#72bf98'], freeShort: ['#438d79', '#b6ddcf'], paid: ['#a96b1f', '#e3a456'], unavailable: ['#aa473d', '#db7d74'] };
        const [stroke, fill] = palette[stateFor(f).status];
        return { color: stroke, weight: stateFor(f).status === 'freeShort' ? 1.7 : 1.3, fillColor: fill, fillOpacity: 0.5, dashArray: stateFor(f).status === 'freeShort' ? '4 3' : null };
      },
      onEachFeature: (feature, layer) => {
        const state = stateFor(feature);
        layer.bindTooltip(state.label, { sticky: true, direction: 'top', className: `parking-hover ${state.status}`, opacity: 1 });
        if (state.hasUpcoming) {
          const center = geometryCenter(feature);
          if (center) L.tooltip({ permanent: true, direction: 'center', className: `parking-polygon-label ${state.status}`, opacity: 1 })
            .setLatLng([center[0], center[1]]).setContent('<b aria-label="Upcoming exception">!</b>').addTo(group);
        }
        layer.on('click', (e) => { L.DomEvent.stopPropagation(e); analyzePoint(e.latlng, feature); });
        layer.on('mouseover', () => layer.setStyle({ weight: 2.2, fillOpacity: 0.62 }));
        layer.on('mouseout', () => layer.setStyle({ weight: 1.2, fillOpacity: 0.48 }));
      },
    }).addTo(group);
  }, [spots, layers.street, lang, analyzePoint, t.street, parkingTime, mapData.zones, mapData.closures, removalNotices]);

  useEffect(() => {
    if (!selected?.feature) { setOccupancy({ status: 'idle' }); return; }
    const controller = new AbortController();
    const [lat, lon] = selected.point;
    const bbox = `${lon - 0.0015},${lat - 0.001},${lon + 0.0015},${lat + 0.001}`;
    setOccupancy({ status: 'loading' });
    Promise.all([
      jsonWithTimeout(`${PARKKIHUBI}/parking_area/?format=json&in_bbox=${bbox}&page_size=300`, 7000, controller.signal),
      jsonWithTimeout(`${PARKKIHUBI}/parking_area_statistics/?format=json&in_bbox=${bbox}&page_size=300`, 7000, controller.signal),
    ]).then(([areas, stats]) => {
      const area = (areas.features || []).find((f) => pointInFeature([lon, lat], f));
      const statRows = stats.results || stats.features || stats;
      const stat = Array.isArray(statRows) ? statRows.find((row) => (row.id || row.parking_area_id || row.properties?.id) === area?.id) : null;
      const capacity = area?.properties?.capacity_estimate;
      const current = stat?.current_parking_count ?? stat?.properties?.current_parking_count;
      if (Number.isFinite(capacity) && Number.isFinite(current)) setOccupancy({ status: 'ready', free: Math.max(0, Math.round(capacity - current)) });
      else setOccupancy({ status: 'unavailable' });
    }).catch(() => { if (!controller.signal.aborted) setOccupancy({ status: 'unavailable' }); });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    const originId = selected?.feature?.properties?.id;
    if (!originId) { setServiceMap(null); return; }
    const controller = new AbortController();
    setServiceMap(null);
    const query = new URLSearchParams({ type: 'parking_area', municipality: 'helsinki', origin_id: String(originId), geometry: 'false', page_size: '1' });
    jsonWithTimeout(`${SERVICE_MAP}?${query}`, 8000, controller.signal)
      .then((data) => setServiceMap(data.results?.[0] || null))
      .catch(() => { if (!controller.signal.aborted) setServiceMap(null); });
    return () => controller.abort();
  }, [selected?.feature]);

  const selectedExceptions = useMemo(() => parkingExceptions(selected?.feature, parkingTime, mapData.closures, removalNotices), [selected?.feature, parkingTime, mapData.closures, removalNotices]);
  const selectedFacility = useMemo(() => facilities.find((facility) => facility.id === activeFacility) || null, [facilities, activeFacility]);

  const loadFacilities = useCallback(async () => {
    const origin = location.point;
    const osmPromise = jsonWithTimeout(overpassUrl(origin), 22000)
      .then((data) => osmFacilities(data, origin))
      .catch(() => []);
    const visibleOsmPromise = osmPromise.then((osm) => {
      if (osm.length) setFacilities(osm.slice(0, 30));
      return osm;
    });
    try {
      const page = await jsonWithTimeout(`${LIIPI}/facilities.geojson?limit=-1`, 30000);
      const all = page.features || [];
      const nearest = all.map((feature) => {
        const center = geometryCenter(feature);
        const carCapacity = feature.properties?.builtCapacity?.CAR;
        if (!center || !carCapacity) return null;
        return { id: feature.id, name: feature.properties?.name?.[lang] || feature.properties?.name?.fi || 'Pysäköinti', point: center, distance: haversine(origin, center), status: feature.properties?.status, spacesAvailable: null, openNow: null, capacity: carCapacity, price: null, source: 'liipi' };
      }).filter((facility) => facility && facility.distance < 18000).sort((a, b) => a.distance - b.distance).slice(0, 30);
      if (nearest.length) setFacilities(nearest);
      const util = await jsonWithTimeout(`${LIIPI}/utilizations`, 14000).catch(() => []);
      const utilMap = new Map();
      for (const row of util) if (row.capacityType === 'CAR') {
        const old = utilMap.get(row.facilityId);
        if (!old || row.usage === 'COMMERCIAL') utilMap.set(row.facilityId, row);
      }
      const withUtilization = nearest.map((facility) => {
        const usage = utilMap.get(facility.id);
        return { ...facility, spacesAvailable: usage?.spacesAvailable, openNow: usage?.openNow };
      });
      if (withUtilization.length) setFacilities(withUtilization);
      const enriched = await Promise.all(withUtilization.slice(0, 10).map(async (facility) => {
        try {
          const [detail, prediction] = await Promise.all([
            jsonWithTimeout(`${LIIPI}/facilities/${facility.id}`, 9000),
            jsonWithTimeout(`${LIIPI}/facilities/${facility.id}/prediction?after=120`, 9000).catch(() => []),
          ]);
          const carPredictions = (prediction || []).filter((row) => row.capacityType === 'CAR');
          const predicted = carPredictions.find((row) => row.usage === 'COMMERCIAL') || carPredictions[0];
          return { ...facility, price: parsePrice(detail, lang), openNow: detail?.openingHours?.openNow ?? facility.openNow, predictedSpaces: predicted?.spacesAvailable };
        } catch { return facility; }
      }));
      const osm = await visibleOsmPromise;
      setFacilities(mergeFacilities([...enriched, ...withUtilization.slice(10)], osm, 30));
    } catch {
      setFacilities((await visibleOsmPromise).slice(0, 30));
    }
  }, [location.point, lang]);

  useEffect(() => { loadFacilities(); }, [loadFacilities]);

  useEffect(() => {
    const group = layersRef.current.facilities;
    if (!group) return;
    group.clearLayers();
    visibleFacilityMarkers(facilities, mapZoom, layers.street).forEach((facility) => {
      const price = compactFacilityPrice(facility.price);
      const html = `<div class="facility-marker ${facility.openNow === false ? 'closed' : ''}">P</div>`;
      const icon = L.divIcon({ className: '', html, iconSize: [44, 44], iconAnchor: [22, 22] });
      const markerLabel = [facility.name, Number.isFinite(facility.spacesAvailable) ? `${facility.spacesAvailable} ${t.spaces}` : price, facility.openNow === false ? t.closed : null].filter(Boolean).join(' · ');
      L.marker(facility.point, { icon, title: markerLabel, alt: markerLabel, zIndexOffset: 700, bubblingMouseEvents: false }).addTo(group)
        .bindTooltip([facility.name, price || facility.price].filter(Boolean).join(' · '), { direction: 'top', offset: [0, -18] })
        .on('click', () => { setSelected(null); setActiveFacility(facility.id); setMobilePanel('facility'); });
    });
  }, [facilities, layers.street, mapZoom, t.closed, t.spaces]);

  const layerItems = [
    ['street', t.street, '#2d6df6'], ['zones', t.priceZones, '#79a0f5'], ['residents', t.residentZones, '#9671d1'],
  ];

  const minimumParkingTime = ceilToFiveMinutes();
  const maximumParkingTime = new Date(Math.floor((Date.now() + 14 * 86400000) / 300000) * 300000);
  const clampParkingTime = (value) => new Date(Math.min(maximumParkingTime.getTime(), Math.max(minimumParkingTime.getTime(), value.getTime())));
  const updateParkingTime = (value) => setParkingTime(clampParkingTime(value));
  const selectedDay = dateTimeInputValue(parkingTime).slice(0, 10);
  const today = dateTimeInputValue(new Date()).slice(0, 10);
  const selectedDateLabel = selectedDay === today ? t.today : new Intl.DateTimeFormat(lang === 'fi' ? 'fi-FI' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(parkingTime);
  const selectedClockLabel = dateTimeInputValue(parkingTime).slice(11, 16);
  const [selectedHour, selectedMinute] = selectedClockLabel.split(':');
  const minusDisabled = parkingTimeStepDisabled(parkingTime, -5, minimumParkingTime, maximumParkingTime);
  const plusDisabled = parkingTimeStepDisabled(parkingTime, 5, minimumParkingTime, maximumParkingTime);
  const parkingZoomRequired = shouldShowParkingZoomHint(mapZoom, layers.street);
  const zoomToParking = () => mapRef.current?.setZoom(MIN_PARKING_ZOOM);

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <div className="sr-only">
        <h1 id="app-title">{lang === 'fi' ? 'Helsingin pysäköintikartta' : 'Helsinki parking map'}</h1>
        <p>{lang === 'fi' ? 'Tarkista kadunvarsipaikkojen maksullisuus, aikarajat, poikkeukset ja pysäköintihallit valitulle ajalle.' : 'Check on-street parking charges, time limits, exceptions and parking facilities for the selected time.'}</p>
      </div>
      <div ref={mapNode} className="map" aria-label={lang === 'fi' ? 'Helsingin pysäköintikartta' : 'Helsinki parking map'} />
      <header className="topbar">
        <div className="time-picker-wrap" ref={timePickerRef} onKeyDown={(event) => { if (event.key === 'Escape') setTimeMenu(false); }}>
          <button className="time-control" aria-expanded={timeMenu} onClick={() => setTimeMenu((value) => !value)}>
            <CalendarClock size={18} />
            <span><small>{t.when}</small><strong>{selectedDateLabel} · {selectedClockLabel}</strong></span>
            <ChevronDown size={15} />
          </button>
          {timeMenu && <div className="time-popover" role="dialog" aria-label={t.when}>
            <div className="time-popover-head"><strong>{t.when}</strong><button onClick={() => setTimeMenu(false)} aria-label={t.close}><X size={16} /></button></div>
            <label className="date-field"><span>{t.date}</span><input type="date" value={selectedDay} min={dateTimeInputValue(minimumParkingTime).slice(0, 10)} max={dateTimeInputValue(maximumParkingTime).slice(0, 10)} onChange={(event) => updateParkingTime(setParkingDatePart(parkingTime, event.target.value))} /></label>
            <div className="time-field"><span>{t.time}</span><div className="time-stepper">
              <button disabled={minusDisabled} onClick={() => updateParkingTime(new Date(parkingTime.getTime() - 300000))} aria-label={`${t.time} −5 min`}>−5 min</button>
              <div className="clock-selects">
                <select value={selectedHour} aria-label={t.hour} onChange={(event) => updateParkingTime(setParkingTimePart(parkingTime, `${event.target.value}:${selectedMinute}`))}>{HOUR_OPTIONS.map((hour) => <option value={hour} key={hour}>{hour}</option>)}</select>
                <span aria-hidden="true">:</span>
                <select value={selectedMinute} aria-label={t.minute} onChange={(event) => updateParkingTime(setParkingTimePart(parkingTime, `${selectedHour}:${event.target.value}`))}>{MINUTE_OPTIONS.map((minute) => <option value={minute} key={minute}>{minute}</option>)}</select>
              </div>
              <button disabled={plusDisabled} onClick={() => updateParkingTime(new Date(parkingTime.getTime() + 300000))} aria-label={`${t.time} +5 min`}>+5 min</button>
            </div></div>
            <div className="picker-actions">
              {selectedDay !== today && <button className="picker-today" onClick={() => updateParkingTime(setParkingDatePart(parkingTime, today))}>{t.today}</button>}
              <button className="picker-now" onClick={() => { setParkingTime(ceilToFiveMinutes()); setTimeMenu(false); }}><Clock3 size={15} />{t.now}</button>
            </div>
          </div>}
        </div>
        <div className="top-actions">
          <button className="language" onClick={() => setLang(lang === 'fi' ? 'en' : 'fi')} aria-label={lang === 'fi' ? 'FI – vaihda kieleksi englanti' : 'EN – switch language to Finnish'}>{lang.toUpperCase()}</button>
        </div>
      </header>

      {location.message && !timeMenu && !layerMenu && <div className="location-message" role="status"><AlertTriangle size={16} />{location.message}<button onClick={() => setLocation((v) => ({ ...v, message: null }))} aria-label={t.close}><X size={16} /></button></div>}

      <aside className={`bottom-sheet place-sheet ${selected && mobilePanel !== 'facility' ? 'open' : ''}`}>
        <ParkingPanel selected={selected} lang={lang} occupancy={occupancy} exceptions={selectedExceptions} serviceMap={serviceMap} parkingTime={parkingTime} onClose={() => { setSelected(null); setMobilePanel(null); }} />
      </aside>

      <aside className={`bottom-sheet facility-sheet ${mobilePanel === 'facility' ? 'open' : ''}`}>
        <FacilityPanel facility={selectedFacility} lang={lang} onClose={() => { setActiveFacility(null); setMobilePanel(null); }} />
      </aside>

      <div className="map-tools">
        <IconButton label={t.mapLayers} active={layerMenu} onClick={() => setLayerMenu((v) => !v)}><Layers3 size={19} /></IconButton>
        <IconButton label={t.locate} onClick={locate} className={location.state === 'locating' ? 'locating' : ''}><LocateFixed size={19} /></IconButton>
        {layerMenu && <div className="layer-popover"><div className="popover-title">{t.mapLayers}</div>{layerItems.map(([key, label, color]) => <label key={key}><span className="layer-swatch" style={{ '--swatch': color }} /><span>{label}</span><input type="checkbox" checked={layers[key]} onChange={() => setLayers((v) => ({ ...v, [key]: !v[key] }))} /><i /></label>)}<p>{t.disclaimer}</p></div>}
      </div>

      {parkingZoomRequired && <button className={`map-status actionable ${location.message ? 'below-message' : ''}`} onClick={zoomToParking}><Crosshair size={16} /> {t.zoomIn}</button>}
      {!parkingZoomRequired && spotStatus === 'loading' && <div className={`map-status ${location.message ? 'below-message' : ''}`}><RefreshCw className="spin" size={14} /> {t.dataUpdating}…</div>}
      {!parkingZoomRequired && spotStatus === 'error' && <div className={`map-status ${location.message ? 'below-message' : ''}`}><AlertTriangle size={14} /> {t.noMappedSpot}</div>}

      <div className="map-legend" aria-label={lang === 'fi' ? 'Pysäköinnin värit' : 'Parking colours'}><span><i className="free-long" />{t.freeLongLegend}</span><span><i className="free-short" />{t.freeShortLegend}</span><span><i className="paid" />{t.paidLegend}</span><span><i className="unavailable" />{t.unavailableLegend}</span></div>
      <button className="source-trigger" aria-label={lang === 'fi' ? 'Tietoa palvelusta ja tietolähteistä' : 'About the service and data sources'} title={lang === 'fi' ? 'Tietoa palvelusta' : 'About this service'} onClick={() => setInfoOpen(true)}><Info size={20} /></button>
      {infoOpen && <SourcePanel lang={lang} onClose={() => setInfoOpen(false)} />}
    </main>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
  :root{font-family:Manrope,Arial,sans-serif;color:#161b18;background:#e9e8e2;font-synthesis:none;--paper:#f9f8f4;--ink:#161b18;--muted:#696e69;--line:#deddd6;--blue:#155eef;--green:#13755b;--amber:#a76a08;--danger:#c64b2a}*{box-sizing:border-box}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}button{font:inherit;color:inherit}.app-shell{position:relative;width:100%;height:100%;min-height:680px;background:#d9dad4}.map{position:absolute;inset:0;z-index:0}.leaflet-container{font-family:Manrope,Arial,sans-serif;background:#dfe1dc}.leaflet-control-attribution{font-size:9px!important;background:rgba(249,248,244,.84)!important}.leaflet-control-zoom{border:0!important;box-shadow:0 8px 30px rgba(18,27,22,.14)!important;margin:0 24px 84px 0!important}.leaflet-control-zoom a{border:0!important;color:#222!important;background:#faf9f5!important}.topbar{position:absolute;z-index:600;left:18px;right:18px;top:16px;height:64px;display:flex;align-items:center;padding:8px 10px 8px 14px;background:rgba(249,248,244,.95);border:1px solid rgba(255,255,255,.75);border-radius:14px;box-shadow:0 8px 35px rgba(29,37,31,.12);backdrop-filter:blur(16px)}.brand{display:flex;align-items:center;gap:11px;width:235px}.brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:9px;background:#155eef;color:white;font-size:22px;font-weight:800;box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}.brand div,.location-chip div{display:flex;flex-direction:column}.brand strong{font-size:16px;line-height:1;letter-spacing:.12em}.brand small{margin-top:5px;color:#767a76;font:500 10px/1 DM Mono,monospace;letter-spacing:.1em;text-transform:uppercase}.location-chip{margin:auto;display:flex;align-items:center;gap:10px;min-width:245px;padding:7px 15px;border:0;border-left:1px solid var(--line);border-right:1px solid var(--line);background:transparent;cursor:pointer;text-align:left}.location-chip>span{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;color:#155eef;background:#e6edff}.location-chip .locating{animation:pulse 1.3s infinite}.location-chip strong{font-size:12px}.location-chip small{font-size:9px;color:#7b7f7b;margin-top:2px}.top-actions{display:flex;align-items:center;gap:6px;width:235px;justify-content:flex-end}.icon-button{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--line);border-radius:10px;background:#fbfaf7;cursor:pointer;transition:.2s}.icon-button:hover,.icon-button.active{border-color:#aebee8;background:#eef2ff;color:#155eef;transform:translateY(-1px)}.language{height:40px;display:flex;align-items:center;gap:4px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#fbfaf7;font:600 11px DM Mono,monospace;cursor:pointer}.left-panel,.right-panel{position:absolute;z-index:500;top:96px;bottom:82px;width:370px;overflow:auto;scrollbar-width:none}.left-panel::-webkit-scrollbar,.right-panel::-webkit-scrollbar{display:none}.left-panel{left:18px}.right-panel{right:18px}.place-card,.facilities-card{position:relative;background:rgba(249,248,244,.96);border:1px solid rgba(255,255,255,.8);border-radius:15px;box-shadow:0 12px 40px rgba(24,32,26,.14);backdrop-filter:blur(18px);overflow:hidden}.place-card{padding:20px}.eyebrow{display:flex;align-items:center;gap:7px;color:#6d726d;font:600 10px DM Mono,monospace;letter-spacing:.1em;text-transform:uppercase}.panel-close{position:absolute;right:13px;top:13px;width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;background:transparent;cursor:pointer}.place-heading{display:flex;justify-content:space-between;align-items:center;margin:15px 0 14px}.status-pill{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700}.status-pill span{width:7px;height:7px;border-radius:50%;background:currentColor}.status-pill.blue{color:#155eef}.status-pill.green{color:#13755b}.status-pill.amber{color:#a76a08}.place-heading h2{margin:8px 0 0;font-size:28px;letter-spacing:-.04em}.place-heading h2 small{font-size:12px;font-weight:600;letter-spacing:0;color:#777b77}.parking-sign{width:48px;height:55px;display:grid;place-items:center;border:3px solid currentColor;border-radius:9px;background:white}.parking-sign span{font-size:28px;font-weight:800}.parking-sign.blue{color:#155eef}.parking-sign.green{color:#13755b}.parking-sign.amber{color:#a76a08}.now-banner{display:flex;align-items:center;gap:8px;margin:0 -20px;padding:11px 20px;font-size:11px}.now-banner span{margin-left:auto;font-size:10px}.now-banner.paid{background:#e9efff;color:#164fc2}.now-banner.free{background:#e4f3ed;color:#11634d}.facts-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:14px 0;background:var(--line);border:1px solid var(--line);border-radius:9px;overflow:hidden}.facts-grid div{display:flex;flex-direction:column;padding:10px;background:#fbfaf7}.facts-grid span{font-size:8px;color:#7b7e7a;text-transform:uppercase;letter-spacing:.05em}.facts-grid strong{margin-top:3px;font-size:14px}.section-label{display:flex;align-items:center;gap:7px;margin-bottom:8px;color:#505550;font:600 10px DM Mono,monospace;text-transform:uppercase;letter-spacing:.07em}.hours-block,.occupancy-block,.notices{padding:14px 0;border-top:1px solid var(--line)}.hours-row{display:flex;justify-content:space-between;padding:4px 0;font-size:11px}.hours-row span{color:#6f736f}.validity{display:flex;align-items:center;gap:5px;margin-top:8px;padding:7px 8px;border-radius:6px;background:#eeeae0;color:#5c584e;font-size:9px}.occupancy-value{min-height:24px;font-size:11px}.occupancy-value strong{font-size:22px;color:#155eef}.occupancy-value.muted{color:#777c77}.occupancy-block p{margin:4px 0 0;color:#7a7e79;font-size:9px;line-height:1.45}.notice{display:flex;align-items:flex-start;gap:9px;padding:9px;border-radius:8px;margin-top:7px}.notice>svg{flex:0 0 auto;margin-top:2px}.notice span{display:flex;flex-direction:column}.notice strong{font-size:10px}.notice small{margin-top:3px;font-size:8px;line-height:1.4}.notice.danger{background:#fdeae3;color:#96371f}.notice.neutral{background:#eef0ed;color:#5f655f}.coordinates{margin-top:11px;color:#8d918d;font:400 8px/1.4 DM Mono,monospace}.empty-state{min-height:225px;text-align:center}.empty-state .eyebrow{text-align:left}.empty-illustration{position:relative;width:64px;height:64px;display:grid;place-items:center;margin:25px auto 12px;border-radius:50%;background:#e9efff;color:#155eef}.empty-illustration span{position:absolute;width:84px;height:84px;border:1px solid #c7d5f8;border-radius:50%}.empty-state h2{margin:8px 0;font-size:16px}.empty-state p{max-width:275px;margin:0 auto;color:#747874;font-size:10px;line-height:1.55}.facilities-card{max-height:100%}.facilities-head{display:flex;align-items:center;justify-content:space-between;padding:19px 19px 13px}.facilities-head h3{margin:5px 0 0;font-size:18px;letter-spacing:-.02em}.live-badge{display:flex;align-items:center;gap:5px;color:#117156;font:600 9px DM Mono,monospace}.live-badge i{width:6px;height:6px;border-radius:50%;background:#20a77f;box-shadow:0 0 0 4px #dcefe8}.facility-list{border-top:1px solid var(--line)}.facility-row{width:100%;display:grid;grid-template-columns:28px minmax(0,1fr) 55px;gap:9px;align-items:start;padding:13px 15px;border:0;border-bottom:1px solid #e6e5df;background:transparent;text-align:left;cursor:pointer;transition:.18s}.facility-row:hover,.facility-row.selected{background:#edf2ff}.facility-row.selected{box-shadow:inset 3px 0 #155eef}.facility-rank{padding-top:2px;color:#999c98;font:500 9px DM Mono,monospace}.facility-main{min-width:0}.facility-main>strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.facility-meta{display:flex;gap:10px;align-items:center;margin-top:5px;font-size:8px;color:#6d716d}.facility-meta span{display:flex;align-items:center;gap:3px}.facility-meta .open{color:#13755b}.facility-meta .closed{color:#b14326}.facility-main small{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#858985;font-size:8px}.availability{display:flex;flex-direction:column;align-items:flex-end;color:#155eef}.availability strong{font-size:21px;line-height:1}.availability span{margin-top:4px;color:#747975;font-size:7px;text-transform:uppercase}.availability small{margin-top:6px;padding-top:5px;border-top:1px solid #cdd8f1;color:#155eef;font:600 7px DM Mono,monospace;white-space:nowrap}.list-message{padding:20px;color:#777c77;font-size:10px;line-height:1.5}.skeleton{height:74px;display:flex;flex-direction:column;gap:9px;cursor:default}.loading-line{display:inline-block;width:90px;height:8px;border-radius:5px;background:linear-gradient(90deg,#e5e4de,#f1f0ec,#e5e4de);background-size:200% 100%;animation:shimmer 1.4s infinite}.loading-line.wide{width:150px}.map-tools{position:absolute;z-index:550;left:405px;top:96px;display:flex;flex-direction:column;gap:7px}.map-tools .icon-button{box-shadow:0 7px 24px rgba(22,30,25,.13)}.layer-popover{position:absolute;left:49px;top:0;width:230px;padding:8px;background:rgba(249,248,244,.97);border:1px solid white;border-radius:12px;box-shadow:0 12px 35px rgba(24,32,26,.15)}.popover-title{padding:6px 8px 8px;color:#6d726d;font:600 9px DM Mono,monospace;text-transform:uppercase}.layer-popover label{display:grid;grid-template-columns:12px 1fr 36px;align-items:center;gap:8px;padding:8px;border-radius:7px;font-size:10px;cursor:pointer}.layer-popover label:hover{background:#f0efea}.layer-swatch{width:9px;height:9px;border-radius:3px;background:var(--swatch)}.layer-popover input{position:absolute;opacity:0}.layer-popover i{position:relative;width:30px;height:16px;border-radius:10px;background:#ccc}.layer-popover i:after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:white;transition:.2s}.layer-popover input:checked+i{background:#155eef}.layer-popover input:checked+i:after{transform:translateX(14px)}.map-status{position:absolute;z-index:450;left:405px;bottom:83px;display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:8px;background:rgba(249,248,244,.91);box-shadow:0 5px 18px rgba(22,28,24,.1);color:#646964;font:500 9px DM Mono,monospace}.status-dot{width:6px;height:6px;border-radius:50%;background:#1b9b75}.spin{animation:spin 1s linear infinite}.disclaimer{position:absolute;z-index:600;left:18px;right:18px;bottom:16px;min-height:50px;display:flex;align-items:center;gap:10px;padding:9px 14px;background:rgba(26,31,28,.94);border-radius:12px;color:#f3f1e9;box-shadow:0 8px 30px rgba(16,21,18,.22);backdrop-filter:blur(12px)}.disclaimer>svg{flex:0 0 auto;color:#f2b64b}.disclaimer span{font-size:9px;line-height:1.45}.disclaimer small{margin-left:auto;max-width:340px;text-align:right;color:#aeb4af;font:400 7px/1.4 DM Mono,monospace}.location-message{position:absolute;z-index:700;top:88px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:#222824;color:white;font-size:9px;box-shadow:0 8px 26px rgba(0,0,0,.2)}.location-message button{display:grid;place-items:center;border:0;background:transparent;color:white;cursor:pointer}.user-marker-wrap{position:relative}.user-dot{position:absolute;left:9px;top:9px;width:12px;height:12px;border:3px solid white;border-radius:50%;background:#155eef;box-shadow:0 2px 8px rgba(0,0,0,.25)}.user-pulse{position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:rgba(21,94,239,.28);animation:pulse 2s infinite}.facility-marker{height:30px;display:flex;align-items:center;border:2px solid white;border-radius:8px;background:#17231d;color:white;box-shadow:0 5px 14px rgba(18,26,22,.28);overflow:hidden;font-family:Manrope,Arial}.facility-marker b{display:grid;place-items:center;width:26px;height:100%;background:#155eef}.facility-marker span{display:grid;place-items:center;min-width:24px;padding:0 4px;font-size:9px;font-weight:800}.facility-marker.closed{opacity:.68}.facility-marker.closed b{background:#6e746f}.mobile-tabs{display:none}@keyframes pulse{0%{transform:scale(.75);opacity:.8}70%{transform:scale(1.4);opacity:0}100%{opacity:0}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{to{background-position:-200% 0}}
  @media(max-width:1050px){.right-panel{width:330px}.left-panel{width:345px}.map-tools,.map-status{left:378px}.brand,.top-actions{width:190px}.location-chip{min-width:200px}}
  @media(max-width:760px){.app-shell{min-height:560px}.topbar{left:10px;right:10px;top:10px;height:54px;padding:6px 7px 6px 9px}.brand{width:auto}.brand-mark{width:34px;height:34px}.brand div{display:none}.location-chip{margin-left:8px;min-width:0;flex:1;border-left:1px solid var(--line);border-right:0;padding:5px 8px}.location-chip>span{width:27px;height:27px}.location-chip strong{font-size:10px}.location-chip small{display:none}.top-actions{width:auto}.top-actions .icon-button:last-child{display:none}.icon-button{width:36px;height:36px}.language{height:36px;padding:0 9px}.left-panel,.right-panel{left:10px;right:10px;top:auto;bottom:110px;width:auto;max-height:45vh;display:none}.left-panel.mobile-active,.right-panel.mobile-active{display:block}.place-card,.facilities-card{border-radius:15px}.place-card{padding:16px}.now-banner{margin-left:-16px;margin-right:-16px;padding-left:16px;padding-right:16px}.map-tools{left:auto;right:10px;top:76px}.layer-popover{left:auto;right:45px}.map-status{left:10px;bottom:111px;transform:translateY(-46vh)}.leaflet-control-zoom{margin:0 10px 162px 0!important}.disclaimer{left:10px;right:10px;bottom:10px;min-height:44px;padding:8px 10px}.disclaimer span{font-size:7px}.disclaimer small{display:none}.mobile-tabs{position:absolute;z-index:610;left:10px;right:10px;bottom:64px;height:40px;display:grid;grid-template-columns:1fr 1fr;padding:3px;border-radius:10px;background:rgba(249,248,244,.97);box-shadow:0 7px 22px rgba(20,27,23,.16)}.mobile-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:7px;background:transparent;color:#686d68;font-size:9px;font-weight:700}.mobile-tabs button.active{background:#e9efff;color:#155eef}.location-message{top:71px;max-width:80%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.facility-list{max-height:36vh;overflow:auto}.place-card{max-height:45vh;overflow:auto}.facts-grid{grid-template-columns:repeat(3,1fr)}}
`;

const refinedStyles = `
  :root{--paper:#fbfaf7;--ink:#19201c;--muted:#68716b;--line:rgba(25,32,28,.11);--blue:#2457d6;--green:#17735a;--amber:#a56616;--danger:#b94b31;color:var(--ink);background:#dfe3df;color-scheme:light}
  .app-shell{min-height:0;background:#dfe3df}
  .leaflet-tile-pane{filter:saturate(.3) contrast(.92) brightness(1.03);opacity:.92}
  .leaflet-control-attribution{font-size:8px!important;background:rgba(251,250,247,.78)!important;color:#6f7771!important}
  .leaflet-control-zoom{margin:0 18px 18px 0!important;border-radius:12px!important;overflow:hidden;box-shadow:0 8px 28px rgba(28,38,32,.13)!important}
  .topbar{left:50%;right:auto;top:18px;width:min(620px,calc(100% - 36px));height:58px;transform:translateX(-50%);gap:10px;padding:7px 8px;background:rgba(251,250,247,.93);border:1px solid rgba(255,255,255,.78);border-radius:17px;box-shadow:0 8px 32px rgba(28,38,32,.12);backdrop-filter:blur(20px)}
  .wordmark{flex:0 0 auto;padding:0 7px;color:#28312c;font-size:12px;font-weight:800;letter-spacing:-.01em}
  .brand{width:auto;flex:0 0 auto;gap:9px;padding-right:5px}.brand-mark{width:36px;height:36px;border-radius:11px;background:#1d2923;font-size:20px;box-shadow:none}.brand strong{font-size:13px;letter-spacing:.11em}.brand small{margin-top:4px;font-size:8px}
  .time-picker-wrap{position:relative;min-width:0;flex:1}.time-control{width:100%;height:42px;min-width:0;display:flex;align-items:center;gap:9px;padding:0 11px;border:0;border-radius:12px;background:#f0efe9;color:#47504a;text-align:left;cursor:pointer}.time-control>svg{flex:0 0 auto;color:#2457d6}.time-control>svg:last-child{margin-left:auto;color:#7b837d;transition:transform .18s}.time-control[aria-expanded=true]>svg:last-child{transform:rotate(180deg)}.time-control>span{min-width:0;display:flex;flex-direction:column}.time-control small{color:#7a827c;font-size:7px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.time-control strong{margin-top:2px;overflow:hidden;text-overflow:ellipsis;color:#202722;font-size:11px;white-space:nowrap}
  .time-popover{position:absolute;z-index:720;top:49px;left:50%;width:min(340px,calc(100vw - 20px));padding:15px;border:1px solid rgba(255,255,255,.9);border-radius:18px;background:rgba(251,250,247,.98);box-shadow:0 18px 54px rgba(22,31,26,.2);backdrop-filter:blur(22px);transform:translateX(-50%)}.time-popover-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.time-popover-head>strong{font-size:13px}.time-popover-head button{width:29px;height:29px;display:grid;place-items:center;border:0;border-radius:50%;background:#efeee9;cursor:pointer}.date-field,.time-field{display:flex;flex-direction:column;gap:6px}.date-field>span,.time-field>span{color:#737b75;font-size:8px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}.date-field input,.time-stepper input{height:42px;border:1px solid var(--line);border-radius:11px;background:#fff;color:#202722;font:700 13px Manrope,Arial,sans-serif;outline:0}.date-field input{width:100%;padding:0 11px}.time-field{margin-top:11px}.time-stepper{display:grid;grid-template-columns:52px minmax(0,1fr) 52px;gap:7px}.time-stepper button{border:0;border-radius:11px;background:#e7ecfa;color:#2457d6;font-size:11px;font-weight:800;cursor:pointer}.time-stepper input{width:100%;padding:0 8px;text-align:center}.picker-now{width:100%;height:38px;display:flex;align-items:center;justify-content:center;gap:7px;margin-top:11px;border:0;border-radius:11px;background:#1d2923;color:#fff;font-size:10px;font-weight:750;cursor:pointer}.top-actions{width:auto;flex:0 0 auto}.language{height:36px;padding:0 10px;border:0;border-radius:10px;background:transparent;color:#515a54;font-size:10px}.language:hover{background:#f0efe9}
  .icon-button{width:42px;height:42px;border:0;border-radius:13px;background:rgba(251,250,247,.95);box-shadow:0 7px 24px rgba(25,34,29,.13);backdrop-filter:blur(16px)}.icon-button:hover,.icon-button.active{border:0;background:#fff;color:#2457d6;transform:none}.icon-button.locating{color:#2457d6;animation:pulseSoft 1.3s infinite}
  .map-tools{left:auto;right:18px;top:94px;gap:8px}.map-tools .icon-button{box-shadow:0 7px 24px rgba(25,34,29,.13)}
  .layer-popover{left:auto;right:50px;top:0;width:238px;padding:9px;border:1px solid rgba(255,255,255,.8);border-radius:16px;background:rgba(251,250,247,.97);box-shadow:0 14px 42px rgba(25,34,29,.16);backdrop-filter:blur(20px)}.popover-title{padding:7px 9px 9px;font-size:9px}.layer-popover label{padding:9px;border-radius:10px;font-size:11px}.layer-popover p{margin:7px 5px 3px;padding:10px 5px 2px;border-top:1px solid var(--line);color:#737b75;font-size:8px;line-height:1.5}.layer-popover i{background:#cfd3cf}.layer-popover input:checked+i{background:#2457d6}
  .bottom-sheet{position:absolute;z-index:620;left:50%;bottom:18px;width:min(480px,calc(100% - 36px));max-height:calc(100% - 104px);overflow:auto;scrollbar-width:none;opacity:0;pointer-events:none;transform:translate(-50%,calc(100% + 40px));transition:transform .3s cubic-bezier(.22,.8,.25,1),opacity .22s}.bottom-sheet::-webkit-scrollbar{display:none}.bottom-sheet.open{opacity:1;pointer-events:auto;transform:translate(-50%,0)}.facilities-sheet{width:min(520px,calc(100% - 36px))}
  .place-card,.facilities-card{background:rgba(251,250,247,.98);border:1px solid rgba(255,255,255,.88);border-radius:20px;box-shadow:0 16px 46px rgba(24,33,28,.16);backdrop-filter:blur(22px)}.place-card{padding:21px 20px 14px}.sheet-handle{display:none;width:34px;height:3px;margin:0 auto 13px;border-radius:4px;background:#d3d5d1}.panel-close{right:12px;top:11px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:#68716b}.eyebrow{font-size:8px;color:#7a817c}.place-heading{margin:13px 0 15px}.place-heading h2{margin-top:7px;font-size:30px}.parking-sign{width:44px;height:49px;border-width:2px;border-radius:10px;background:#fff}.parking-sign span{font-size:25px}
  .parking-summary{display:grid;grid-template-columns:10px minmax(0,1fr);align-items:center;gap:11px;margin:15px 0 4px}.decision-dot{width:9px;height:9px;border-radius:50%;background:currentColor}.parking-summary h2{margin:0;color:var(--ink);font-size:24px;letter-spacing:-.035em}.parking-summary p{margin:3px 0 0;color:currentColor;font-size:10px;font-weight:650}.parking-summary.free{color:#27765c}.parking-summary.paid{color:#a3631d}.parking-summary.unavailable{color:#a4433a}
  .facility-name{margin:11px 36px 0 0;font-size:20px;line-height:1.15;letter-spacing:-.025em}.parking-summary.facility{margin-top:14px}.facility-details{padding-top:9px}
  .now-banner{margin:0;padding:12px 13px;border-radius:12px;font-size:11px}.now-banner.paid{background:#e9eefc;color:#234da9}.now-banner.free{background:#e4f1eb;color:#17624f}.facts-grid{display:flex;gap:7px;margin:12px 0 2px;border:0;background:transparent}.facts-grid div{min-width:76px;flex:1;padding:10px 11px;border-radius:11px;background:#f0efe9}.facts-grid span{font-size:7px}.facts-grid strong{font-size:13px}
  .notices{margin-top:13px;padding:4px 0 0;border-top:1px solid var(--line)}.notice{padding:9px 1px;border-radius:0;margin:0;border-bottom:1px solid rgba(25,32,28,.07);background:transparent!important}.notice:last-child{border-bottom:0}.notice strong{font-size:9px}.notice small{font-size:8px;line-height:1.45}.notice.danger{color:#963e35}.notice.upcoming{color:#87591f}.notice.upcoming>svg{color:#b37428}
  .detail-disclosure{margin-top:12px;border-top:1px solid var(--line)}.detail-disclosure summary{display:flex;align-items:center;justify-content:space-between;padding:13px 1px 5px;list-style:none;color:#5d665f;font-size:10px;font-weight:700;cursor:pointer}.detail-disclosure summary::-webkit-details-marker{display:none}.detail-disclosure[open] summary svg{transform:rotate(180deg)}.detail-disclosure summary svg{transition:.2s}.hours-block,.occupancy-block{padding:13px 0 3px;border:0}.occupancy-block{border-top:1px solid var(--line)}.validity{padding:9px;border-radius:9px;font-size:9px}.legal-note{display:flex;align-items:flex-start;gap:7px;margin-top:12px;padding-top:11px;border-top:1px solid var(--line);color:#777f79;font-size:8px;line-height:1.45}.legal-note svg{flex:0 0 auto;color:#ad7629}.coordinates{font-size:7px;line-height:1.5}
  .detail-rows{padding:8px 0 2px}.detail-rows>div{display:flex;justify-content:space-between;gap:16px;padding:7px 1px;border-bottom:1px solid rgba(25,32,28,.07);font-size:9px}.detail-rows>div:last-child{border-bottom:0}.detail-rows span{flex:0 0 auto;color:#747c76}.detail-rows strong{font-weight:700;text-align:right}.legal-note{align-items:center;margin-top:10px;padding-top:9px;color:#828983}.legal-note svg{color:#a96c25}
  .facilities-card{max-height:min(70vh,650px);overflow:hidden}.facilities-head{padding:23px 22px 15px}.facilities-head h3{font-size:20px}.facility-list{max-height:calc(min(70vh,650px) - 78px);overflow:auto;border-top:1px solid var(--line)}.facility-row{grid-template-columns:24px minmax(0,1fr) 60px;min-height:72px;padding:14px 18px;gap:9px;border-bottom:1px solid var(--line)}.facility-row:hover,.facility-row.selected{background:#eef1f8}.facility-row.selected{box-shadow:inset 3px 0 #2457d6}.facility-main>strong{font-size:12px}.facility-meta{font-size:9px}.facility-main small{font-size:8px}.availability{color:#2457d6}.availability strong{font-size:20px}
  .facility-trigger{position:absolute;z-index:560;left:50%;bottom:22px;display:flex;align-items:center;gap:8px;height:44px;padding:0 15px;border:1px solid rgba(255,255,255,.8);border-radius:22px;background:rgba(29,41,35,.94);color:#fff;box-shadow:0 10px 32px rgba(24,33,28,.2);backdrop-filter:blur(16px);transform:translateX(-50%);cursor:pointer}.facility-trigger span{font-size:11px;font-weight:700}.facility-trigger b{display:grid;place-items:center;min-width:21px;height:21px;padding:0 6px;border-radius:12px;background:rgba(255,255,255,.15);font-size:9px}
  .map-hint{position:absolute;z-index:450;left:50%;bottom:78px;display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:18px;background:rgba(251,250,247,.9);color:#525c56;box-shadow:0 7px 24px rgba(25,34,29,.1);backdrop-filter:blur(14px);transform:translateX(-50%);font-size:10px;font-weight:650;white-space:nowrap}.map-hint svg{color:#2457d6}
  .map-legend{position:absolute;z-index:440;left:18px;bottom:18px;display:flex;align-items:center;gap:11px;padding:8px 11px;border:1px solid rgba(255,255,255,.76);border-radius:16px;background:rgba(251,250,247,.88);box-shadow:0 7px 24px rgba(25,34,29,.08);backdrop-filter:blur(14px);color:#5d665f}.map-legend span{display:flex;align-items:center;gap:5px;font-size:8px;font-weight:700;white-space:nowrap}.map-legend i{width:8px;height:8px;border-radius:3px}.map-legend i.free{background:#79c69f}.map-legend i.paid{background:#e4a45b}.map-legend i.unavailable{background:#dd8179}
  .area-zone-label{padding:4px 7px!important;border:1px solid rgba(255,255,255,.88)!important;border-radius:8px!important;background:rgba(255,255,255,.88)!important;box-shadow:0 2px 9px rgba(28,38,32,.1)!important;font:750 9px/1 Manrope,Arial,sans-serif!important;white-space:nowrap;pointer-events:none!important}.area-zone-label:before{display:none!important}.area-zone-label.payment{color:#315ea9!important}.area-zone-label.resident{color:#704ca3!important}
  .parking-polygon-label{border:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;pointer-events:none!important;display:flex;align-items:center;gap:3px}.parking-polygon-label:before{display:none!important}.parking-polygon-label span{display:block;padding:3px 5px;border:1px solid rgba(255,255,255,.8);border-radius:6px;background:rgba(255,255,255,.86);box-shadow:0 2px 8px rgba(28,38,32,.09);font:750 8px/1 Manrope,Arial,sans-serif;white-space:nowrap}.parking-polygon-label.free span{color:#1e684f}.parking-polygon-label.paid span{color:#8c5317}.parking-polygon-label.unavailable span{color:#913d36}.parking-polygon-label b{display:grid;place-items:center;width:16px;height:16px;border:2px solid #fff;border-radius:50%;background:#c5523f;color:#fff;box-shadow:0 2px 8px rgba(93,37,29,.23);font:800 10px/1 Manrope,Arial,sans-serif}
  .map-status{left:50%;top:86px;bottom:auto;padding:8px 11px;transform:translateX(-50%);border-radius:15px;background:rgba(251,250,247,.94);font-size:8px}.map-status.below-message{top:126px}.location-message{top:86px;border-radius:14px;background:rgba(29,41,35,.95)}
  .user-dot{background:#2457d6}.user-pulse{background:rgba(36,87,214,.24)}.facility-marker{width:34px;height:34px;display:grid;place-items:center;border:3px solid #fff;border-radius:50%;background:#2865d8;color:#fff;box-shadow:0 4px 14px rgba(31,71,151,.3);font:800 14px/1 Manrope,Arial,sans-serif;overflow:hidden}.facility-marker.closed{background:#747b77;color:#fff;opacity:.8}
  @keyframes pulseSoft{50%{background:#e7ecfa}}
  @media(max-width:760px){
    .topbar{left:10px;right:10px;top:10px;width:auto;height:54px;transform:none;gap:6px;padding:6px;border-radius:16px}.wordmark{padding:0 3px;font-size:11px}.time-control{height:40px;gap:7px;padding:0 9px}.time-control>svg{width:17px}.time-control strong{margin:0;font-size:11px}.time-popover{top:46px}.language{height:34px;padding:0 7px;font-size:9px}
    .map-tools{right:10px;top:74px}.icon-button{width:40px;height:40px}.layer-popover{right:47px;width:min(238px,calc(100vw - 70px))}.map-status{top:74px}.map-status.below-message{top:108px}.location-message{top:70px;max-width:calc(100% - 80px)}
    .leaflet-control-zoom{display:none}.leaflet-control-attribution{font-size:6px!important;max-width:44vw;white-space:nowrap;overflow:hidden}
    .bottom-sheet{left:8px;right:8px;bottom:8px;width:auto;max-height:56vh;transform:translateY(calc(100% + 24px))}.bottom-sheet.open{transform:translateY(0)}.facilities-sheet{width:auto}.sheet-handle{display:block}.place-card,.facilities-card{border-radius:24px 24px 18px 18px}.place-card{max-height:56vh;overflow:auto;padding:11px 17px 16px}.panel-close{right:13px;top:12px}.place-heading{margin:11px 0 13px}.place-heading h2{font-size:27px}.now-banner{padding:11px}.facts-grid{overflow:visible}.facts-grid div{padding:9px}.detail-disclosure summary{padding-top:12px}.legal-note{margin-top:10px}
    .facilities-card{max-height:56vh}.facilities-head{padding:8px 18px 13px}.facility-list{max-height:calc(56vh - 76px)}.facility-row{min-height:68px;padding:12px 15px}
    .map-hint{bottom:60px}.map-legend{left:50%;bottom:14px;gap:8px;transform:translateX(-50%)}.facility-marker{transform:scale(.9)}
  }
  @media(max-width:380px){.wordmark{font-size:10px}.time-control{padding:0 7px}.time-control strong{font-size:10px}.language{padding:0 5px}.facts-grid div{min-width:0}.map-hint{font-size:9px}.map-legend{gap:6px;padding:7px 9px}.map-legend span{font-size:7px}}
`;

const clarityStyles = `
  :root{--type-caption:11px;--type-body:13px;--type-label:15px;--type-display:24px}
  .sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
  .leaflet-tile-pane{filter:saturate(.55) contrast(1) brightness(1.02);opacity:.96}
  .leaflet-container,.leaflet-tooltip{font-size:var(--type-caption)}
  .leaflet-control-attribution{font-size:var(--type-caption)!important}
  .topbar{height:62px;gap:8px}
  .topbar .time-picker-wrap{flex:1}
  .time-control{min-height:44px;font-size:var(--type-body)}
  .time-control small{display:block;color:#68716b;font-size:var(--type-caption);line-height:1.1;letter-spacing:.02em;text-transform:none}
  .time-control strong{font-size:var(--type-body)}
  .time-popover-head>strong{font-size:var(--type-label)}
  .time-popover-head button,.panel-close,.location-message button{width:44px;height:44px;min-width:44px;min-height:44px}
  .date-field>span,.time-field>span,.eyebrow,.popover-title{font-family:Manrope,Arial,sans-serif;font-size:var(--type-caption);line-height:1.35;letter-spacing:.06em}
  .date-field input,.time-stepper button,.picker-now,.picker-today{min-height:44px;font-size:var(--type-body)}
  .time-stepper{grid-template-columns:62px minmax(0,1fr) 62px}
  .time-stepper button{padding:0 5px}
  .time-stepper button:disabled{background:#ecece8;color:#a5aaa6;cursor:not-allowed;opacity:.72}
  .clock-selects{height:44px;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:5px}
  .clock-selects select{width:100%;height:44px;padding:0 5px;border:1px solid var(--line);border-radius:10px;background:#fff;color:#202722;font:700 var(--type-body)/1 Manrope,Arial,sans-serif;text-align:center}
  .clock-selects>span{font-size:var(--type-label);font-weight:800}
  .picker-actions{display:flex;gap:7px;margin-top:11px}
  .picker-actions button{flex:1;margin-top:0;border:0;border-radius:11px;cursor:pointer}
  .picker-today{background:#e7ecfa;color:#2457d6;font-weight:750}
  .language{width:44px;height:44px;min-width:44px;padding:0;font-size:var(--type-body)}
  .icon-button{width:44px;height:44px;min-width:44px;min-height:44px}
  .location-message{max-width:calc(100% - 24px);min-height:44px;padding:0 0 0 14px;font-size:var(--type-body)}
  .location-message button{color:inherit}
  .layer-popover label{min-height:44px;font-size:var(--type-body)}
  .layer-popover p{font-size:var(--type-caption);line-height:1.45}
  .map-status{min-height:44px;border:0;font-family:Manrope,Arial,sans-serif;font-size:var(--type-body);line-height:1.3}
  button.map-status{cursor:pointer;color:#2457d6}
  button.map-status:hover,button.map-status:focus-visible{background:#fff;box-shadow:0 9px 28px rgba(25,34,29,.16)}
  .map-legend{min-height:40px}
  .map-legend span{font-size:var(--type-caption)}
  .map-legend i.free-long{background:#72bf98}
  .map-legend i.free-short{background:#b6ddcf;border:1px dashed #438d79}
  .place-card{padding:22px 20px 16px;border-color:rgba(37,48,41,.08);box-shadow:0 14px 42px rgba(24,33,28,.14)}
  .panel-close{right:8px;top:8px}
  .eyebrow{min-height:24px;padding-right:42px;color:#6a736d;font-weight:700;letter-spacing:.03em;text-transform:none}
  .parking-summary{display:block;margin:15px 0 0;padding:2px 0 2px 14px;border-left:3px solid currentColor}
  .parking-summary h2{margin:0;color:var(--ink);font-size:var(--type-display);line-height:1.12;letter-spacing:-.025em}
  .parking-summary p{margin:5px 0 0;color:#4e5851;font-size:var(--type-body);font-weight:650;line-height:1.35}
  .parking-summary.neutral{color:#2457d6}
  .facility-name{margin-top:13px;font-size:var(--type-label);line-height:1.3}
  .parking-summary.facility{margin-top:13px}
  .card-key-facts{display:flex;margin:16px 0 0;padding:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .card-key-facts>div{min-width:0;flex:1;padding:11px 12px 10px 0}
  .card-key-facts>div+div{padding-left:12px;border-left:1px solid var(--line)}
  .card-key-facts dt{margin:0;color:#69726c;font-size:var(--type-caption);font-weight:650;line-height:1.25}
  .card-key-facts dd{margin:3px 0 0;color:var(--ink);font-size:var(--type-label);font-weight:750;line-height:1.2}
  .notice strong,.detail-disclosure summary,.detail-rows>div{font-size:var(--type-body)}
  .notice small{font-size:var(--type-caption)}
  .detail-disclosure summary{min-height:44px;padding:10px 1px}
  .detail-disclosure summary:focus-visible{outline:2px solid #2457d6;outline-offset:2px;border-radius:6px}
  .detail-rows span{color:#626b65}
  .parking-polygon-label b{width:20px;height:20px;font-size:var(--type-body)}
  .parking-hover{padding:8px 10px!important;border:1px solid rgba(255,255,255,.9)!important;border-radius:10px!important;background:rgba(251,250,247,.97)!important;box-shadow:0 7px 22px rgba(25,34,29,.16)!important;color:#263029!important;font:700 var(--type-body)/1.25 Manrope,Arial,sans-serif!important;white-space:nowrap}
  .parking-hover:before{border-top-color:rgba(251,250,247,.97)!important}
  .parking-hover.freeLong{color:#1d684f!important}.parking-hover.freeShort{color:#357664!important}.parking-hover.paid{color:#8e5719!important}.parking-hover.unavailable{color:#963f36!important}
  .facility-marker{width:36px;height:36px;font-size:var(--type-body)}
  .source-trigger{position:absolute;z-index:560;right:18px;bottom:18px;width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.82);border-radius:50%;background:rgba(251,250,247,.95);color:#38423c;box-shadow:0 7px 24px rgba(25,34,29,.13);backdrop-filter:blur(16px);cursor:pointer}
  .source-trigger:hover,.source-trigger:focus-visible{background:#fff;color:#2457d6;outline:0;box-shadow:0 9px 28px rgba(25,34,29,.17)}
  .source-backdrop{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:18px;background:rgba(24,31,27,.28);backdrop-filter:blur(4px)}
  .source-panel{position:relative;width:min(540px,100%);max-height:min(720px,calc(100vh - 36px));overflow:auto;padding:24px 22px 20px;border:1px solid rgba(255,255,255,.9);border-radius:22px;background:#fbfaf7;box-shadow:0 24px 70px rgba(18,25,21,.26)}
  .source-heading{min-height:34px;display:flex;align-items:center;gap:9px;padding-right:44px}.source-heading svg{color:#2457d6}.source-heading h2{margin:0;font-size:var(--type-display);line-height:1.15;letter-spacing:-.025em}
  .source-intro{margin:11px 44px 17px 0;color:#59625c;font-size:var(--type-body);line-height:1.5}
  .source-list{border-top:1px solid var(--line)}.source-list>a{min-height:66px;display:flex;align-items:center;gap:14px;padding:11px 2px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none}.source-list>a:hover,.source-list>a:focus-visible{color:#2457d6;outline:0}.source-list>a>span{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}.source-list strong{font-size:var(--type-body);line-height:1.3}.source-list small{color:#68716b;font-size:var(--type-caption);line-height:1.4}.source-list>a>svg{flex:0 0 auto;color:#7b837d}
  .source-licence{margin:14px 0;color:#737b75;font-size:var(--type-caption);line-height:1.45}.source-maker{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-top:13px;border-top:1px solid var(--line);font-size:var(--type-body)}.source-maker span{color:#68716b}.source-maker a{display:flex;align-items:center;gap:5px;color:#2457d6;font-weight:750;text-decoration:none}
  @media(max-width:760px){
    .topbar{height:60px;gap:6px;padding:8px}
    .time-control{height:44px;padding:0 9px}
    .time-control strong{font-size:var(--type-body)}
    .language{height:44px;padding:0}
    .map-tools{top:80px}
    .time-popover{top:54px}
    .location-message{top:80px;left:10px;right:64px;max-width:none;transform:none}
    .map-status{top:80px}
    .map-status.below-message{top:132px}
    .bottom-sheet{bottom:8px;max-height:58vh}
    .place-card{max-height:58vh;padding:20px 18px 16px}
    .panel-close{right:8px;top:8px}
    .parking-summary{margin-top:13px}
    .map-legend{left:10px;bottom:18px;width:min(300px,calc(100% - 74px));display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;border-radius:16px;transform:none}
    .facility-marker{transform:none}
    .source-trigger{right:10px;bottom:18px}
    .source-backdrop{align-items:end;padding:8px}.source-panel{width:100%;max-height:86vh;padding:21px 18px 17px;border-radius:24px 24px 18px 18px}.source-heading h2{font-size:var(--type-label)}.source-intro{margin-right:36px}.source-list>a{min-height:64px}
  }
  @media(max-width:380px){
    .map-legend{gap:6px 8px;padding:7px 9px}.map-legend span{min-width:0;font-size:var(--type-caption);line-height:1.15;white-space:normal}.map-legend i{flex:0 0 auto}
    .time-control strong{font-size:var(--type-body)}
  }
`;

const rootNode = typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootNode) createRoot(rootNode).render(<><style>{styles + refinedStyles + clarityStyles}</style><App /></>);

export default App;
