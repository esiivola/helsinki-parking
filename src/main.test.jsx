// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_ZOOM, ceilToFiveMinutes, closureActiveAt, compactFacilityPrice, dateTimeInputValue, featuresOverlap, formatParkingCardTransition, formatParkingValidity, hasOfficialParkingRestriction, haversine, isGeneralParkingFeature, mergeFacilities, nextPaidStart, noticeActiveAt, osmFacilities, parkingAreaLabel, parkingDurationMinutes, parkingExceptions, parkingFeatureAt, parkingNowStatus, parkingPolygonState, parkingTimeStepDisabled, parseParkingValidity, pointInFeature, pointToLineDistance, setParkingDatePart, setParkingTimePart, shouldLoadParkingSpots, shouldShowFacilityMarker, shouldShowLocationMarker, shouldShowParkingZoomHint, siirtovahtiFeatures, spotMeta, visibleFacilityMarkers } from './main.jsx';

describe('parking map helpers', () => {
  it('detects a point inside a GeoJSON polygon', () => {
    const feature = { geometry: { type: 'Polygon', coordinates: [[[24.9, 60.1], [25, 60.1], [25, 60.2], [24.9, 60.2], [24.9, 60.1]]] } };
    expect(pointInFeature([24.95, 60.15], feature)).toBe(true);
    expect(pointInFeature([25.2, 60.15], feature)).toBe(false);
  });

  it('calculates realistic Helsinki-scale distance', () => {
    expect(haversine([60.17, 24.94], [60.18, 24.94])).toBeGreaterThan(1100);
    expect(haversine([60.17, 24.94], [60.18, 24.94])).toBeLessThan(1120);
  });

  it('applies the standard payment schedule', () => {
    expect(parkingNowStatus(1, new Date('2026-08-03T12:00:00')).paid).toBe(true);
    expect(parkingNowStatus(1, new Date('2026-08-02T12:00:00')).paid).toBe(false);
    expect(parkingNowStatus(2, new Date('2026-08-01T19:00:00')).paid).toBe(false);
  });

  it('parses official weekday, Saturday and Sunday validity notation', () => {
    const weekdays = parseParkingValidity('9-21');
    expect(weekdays.byDay[1]).toEqual([{ start: 540, end: 1260 }]);
    expect(weekdays.byDay[6]).toEqual([]);
    expect(weekdays.byDay[0]).toEqual([]);

    const allWeek = parseParkingValidity('9-21, (9-21), 9-21');
    expect(allWeek.byDay[5]).toEqual([{ start: 540, end: 1260 }]);
    expect(allWeek.byDay[6]).toEqual([{ start: 540, end: 1260 }]);
    expect(allWeek.byDay[0]).toEqual([{ start: 540, end: 1260 }]);
    expect(formatParkingValidity('9-21, (9-18)', 'fi')).toBe('Ma–pe 9–21 · la 9–18');
    expect(parseParkingValidity('9-21 (9-18)')).toBeNull();
    expect(parseParkingValidity('9.21, (9-18)')).toBeNull();
  });

  it('keeps the verified Urheilukatu space paid without a price-zone match', () => {
    const urheilukatu = { properties: { luokka: 7, luokka_nimi: 'Kertamaksu enintään 1 h', kesto: '60 min', voimassaolo: '9-21, (9-21), 9-21' } };
    const friday = new Date(2026, 7, 7, 17, 50);
    const sunday = new Date(2026, 7, 9, 17, 50);
    expect(parkingNowStatus(null, friday, urheilukatu.properties.voimassaolo).paid).toBe(true);
    expect(parkingNowStatus(null, sunday, urheilukatu.properties.voimassaolo).paid).toBe(true);
    expect(parkingPolygonState(urheilukatu, null, friday, [], [], 'fi')).toMatchObject({ status: 'paid', label: 'Maksu · klo 21 asti' });
  });

  it('respects Saturday and Sunday omissions in official validity notation', () => {
    const validity = '9-21, (9-18)';
    expect(parkingNowStatus('1', new Date(2026, 7, 8, 17, 50), validity).paid).toBe(true);
    expect(parkingNowStatus('1', new Date(2026, 7, 8, 19, 0), validity).paid).toBe(false);
    expect(parkingNowStatus('1', new Date(2026, 7, 9, 12, 0), validity).paid).toBe(false);
  });

  it('finds when charging next resumes after a free period', () => {
    expect(nextPaidStart(1, new Date('2026-08-03T08:00:00')).getHours()).toBe(9);
    expect(nextPaidStart(1, new Date('2026-08-07T22:00:00')).getDay()).toBe(6);
    const afterSaturday = nextPaidStart(1, new Date('2026-08-08T19:00:00'));
    expect([afterSaturday.getDay(), afterSaturday.getHours()]).toEqual([1, 9]);
  });

  it('uses natural Finnish wording for card validity transitions', () => {
    const selected = new Date(2026, 7, 10, 17, 30);
    expect(formatParkingCardTransition('paidUntil', new Date(2026, 7, 10, 21, 0), selected, 'fi')).toBe('Maksullinen klo 21:00 asti');
    expect(formatParkingCardTransition('chargingStarts', new Date(2026, 7, 11, 9, 0), selected, 'fi')).toBe('Maksu alkaa ti klo 09:00');
    expect(formatParkingCardTransition('paidUntil', new Date(2026, 7, 10, 21, 0), selected, 'en')).toBe('Paid until 21:00');
  });

  it('uses the chosen date for temporary restrictions', () => {
    const closure = { properties: { licence_startdate: '2026-08-10', licence_enddate: '2026-08-12', licence_status: 'ACTIVE' } };
    const notice = { properties: { validFrom: new Date('2026-08-10T08:00:00Z').getTime() / 1000, validTo: new Date('2026-08-10T16:00:00Z').getTime() / 1000 } };
    expect(closureActiveAt(closure, new Date('2026-08-11T12:00:00Z'))).toBe(true);
    expect(closureActiveAt(closure, new Date('2026-08-13T12:00:00Z'))).toBe(false);
    expect(noticeActiveAt(notice, new Date('2026-08-10T12:00:00Z'))).toBe(true);
    expect(noticeActiveAt(notice, new Date('2026-08-11T12:00:00Z'))).toBe(false);
  });

  it('formats a browser-compatible local date-time value', () => {
    expect(dateTimeInputValue(new Date('2026-08-10T12:34:00Z'))).toMatch(/^2026-08-10T\d{2}:34$/);
  });

  it('rounds selected times up to the next five-minute interval', () => {
    expect(ceilToFiveMinutes(new Date('2026-08-10T12:30:00Z')).toISOString()).toBe('2026-08-10T12:30:00.000Z');
    expect(ceilToFiveMinutes(new Date('2026-08-10T12:30:01Z')).toISOString()).toBe('2026-08-10T12:35:00.000Z');
    expect(ceilToFiveMinutes(new Date('2026-08-10T12:31:00Z')).toISOString()).toBe('2026-08-10T12:35:00.000Z');
  });

  it('edits date and time separately while preserving five-minute precision', () => {
    const initial = new Date(2026, 7, 10, 12, 30);
    const dated = setParkingDatePart(initial, '2026-08-12');
    expect([dated.getFullYear(), dated.getMonth(), dated.getDate(), dated.getHours(), dated.getMinutes()]).toEqual([2026, 7, 12, 12, 30]);
    const timed = setParkingTimePart(dated, '14:33');
    expect([timed.getHours(), timed.getMinutes()]).toEqual([14, 35]);
  });

  it('derives polygon colour, inline label and upcoming exception from one state', () => {
    const space = { geometry: { type: 'Polygon', coordinates: [[[24.94, 60.17], [24.941, 60.17], [24.941, 60.171], [24.94, 60.171], [24.94, 60.17]]] }, properties: { luokka: 5, kesto: '4 h', voimassaolo: '9-21, (9-18)' } };
    const closure = { id: 7, geometry: { type: 'Polygon', coordinates: [[[24.9405, 60.1695], [24.942, 60.1695], [24.942, 60.172], [24.9405, 60.172], [24.9405, 60.1695]]] }, properties: { licence_startdate: '2026-08-12', licence_enddate: '2026-08-13', licence_type: 'Street work' } };
    const paid = parkingPolygonState(space, '1', new Date('2026-08-10T12:00:00'), [closure], [], 'fi');
    expect(paid.status).toBe('paid');
    expect(paid.label).toBe('4 €/h · klo 21 asti');
    expect(paid.hasUpcoming).toBe(true);
    expect(parkingExceptions(space, new Date('2026-08-10T12:00:00'), [closure])).toHaveLength(1);
    const unavailable = parkingPolygonState(space, '1', new Date('2026-08-12T12:00:00'), [closure], [], 'fi');
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.until).toBeGreaterThan(new Date('2026-08-13T12:00:00').getTime());
    const free = parkingPolygonState(space, '1', new Date('2026-08-10T23:00:00'), [], [], 'fi');
    expect(free.status).toBe('freeLong');
    expect(free.label).toBe('Maksuton · maksu alkaa ti klo 9');
    expect(free.nextPaidAt).toBeInstanceOf(Date);
  });

  it('shows the selected day payment window beside the polygon price', () => {
    const space = { geometry: { type: 'Polygon', coordinates: [] }, properties: { luokka: 5, voimassaolo: '9-21, (9-18)' } };
    expect(parkingPolygonState(space, '2', new Date('2026-08-15T12:00:00'), [], [], 'en').label).toBe('2 €/h · until 18:00');
  });

  it('does not infer free parking when paid-space hours are missing or malformed', () => {
    const date = new Date(2026, 7, 8, 12, 0);
    const missing = parkingPolygonState({ properties: { luokka: 5 } }, '1', date, [], [], 'fi');
    const malformed = parkingPolygonState({ properties: { luokka: 5, voimassaolo: '9-21 (9-18)' } }, '1', date, [], [], 'fi');
    expect([missing.status, missing.label]).toEqual(['paid', '4 €/h · maksulliset ajat tarkistettava']);
    expect([malformed.status, malformed.label]).toEqual(['paid', '4 €/h · maksulliset ajat tarkistettava']);
  });

  it('separates short and long free parking and describes disc requirements', () => {
    expect(parkingDurationMinutes('45 min')).toBe(45);
    expect(parkingDurationMinutes('1 h 30 min')).toBe(90);
    expect(parkingDurationMinutes('24')).toBe(1440);
    expect(parkingDurationMinutes('ei aikarajoitusta')).toBe(Infinity);
    const short = parkingPolygonState({ properties: { luokka: 8, kesto: '30 min' } }, null, new Date('2026-08-10T12:00:00'), [], [], 'fi');
    const long = parkingPolygonState({ properties: { luokka: 8, kesto: '2 h' } }, null, new Date('2026-08-10T12:00:00'), [], [], 'fi');
    const unlimited = parkingPolygonState({ properties: { luokka: 1, kesto: 'ei aikarajoitusta' } }, null, new Date('2026-08-10T12:00:00'), [], [], 'fi');
    const unknown = parkingPolygonState({ properties: { luokka: 1 } }, null, new Date('2026-08-10T12:00:00'), [], [], 'fi');
    expect([short.status, short.label]).toEqual(['freeShort', '30 min kiekolla']);
    expect([long.status, long.label]).toEqual(['freeLong', '2 h kiekolla']);
    expect([unlimited.status, unlimited.label]).toEqual(['freeLong', 'Maksuton · ei aikarajaa']);
    expect([unknown.status, unknown.label]).toEqual(['freeLong', 'Maksuton · aikaraja ei tiedossa']);
  });

  it('disables time stepping at the selectable range limits', () => {
    const minimum = new Date(2026, 7, 10, 12, 30);
    const maximum = new Date(2026, 7, 24, 12, 30);
    expect(parkingTimeStepDisabled(minimum, -5, minimum, maximum)).toBe(true);
    expect(parkingTimeStepDisabled(new Date(2026, 7, 10, 12, 35), -5, minimum, maximum)).toBe(false);
    expect(parkingTimeStepDisabled(maximum, 5, minimum, maximum)).toBe(true);
  });

  it('only flags exceptions beginning within the next seven days', () => {
    const space = { geometry: { type: 'Polygon', coordinates: [[[24.94, 60.17], [24.941, 60.17], [24.941, 60.171], [24.94, 60.171], [24.94, 60.17]]] } };
    const closure = (id, start) => ({ id, geometry: space.geometry, properties: { licence_startdate: start, licence_enddate: start } });
    const selectedTime = new Date('2026-08-10T12:00:00');
    expect(parkingExceptions(space, selectedTime, [closure(1, '2026-08-17')])).toHaveLength(1);
    expect(parkingExceptions(space, selectedTime, [closure(2, '2026-08-18')])).toHaveLength(0);
  });

  it('derives price and resident permit from a parking feature', () => {
    const feature = { properties: { luokka: 10, luokka_nimi: 'Maksullinen vyöhykehinta', asukaspysakointitunnus: 'A', paikat_ala: 5 } };
    const meta = spotMeta(feature, '1', 'fi');
    expect(meta.kind).toBe('resident');
    expect(meta.price).toBe(4);
    expect(meta.residentCode).toBe('A');
  });

  it('only displays spaces usable for general parking', () => {
    expect(isGeneralParkingFeature({ properties: { luokka: 5 } })).toBe(true);
    expect(isGeneralParkingFeature({ properties: { luokka: 9 } })).toBe(false);
    expect(isGeneralParkingFeature({ properties: { tyyppi: 'Kuormauspaikka' } })).toBe(false);
    expect(isGeneralParkingFeature({ properties: { tyyppi: 'Invapaikka' } })).toBe(false);
  });

  it('does not treat background or restricted-area clicks as parking', () => {
    const restricted = { geometry: { type: 'Polygon', coordinates: [[[24.94, 60.17], [24.95, 60.17], [24.95, 60.18], [24.94, 60.18], [24.94, 60.17]]] }, properties: { luokka: 9 } };
    expect(parkingFeatureAt([24.945, 60.175], null, [])).toBeNull();
    expect(parkingFeatureAt([24.945, 60.175], restricted, [restricted])).toBeNull();
  });

  it('only loads street-space polygons at the detailed map zoom', () => {
    expect(shouldLoadParkingSpots(15)).toBe(false);
    expect(shouldLoadParkingSpots(16)).toBe(true);
    expect(shouldLoadParkingSpots(DEFAULT_MAP_ZOOM)).toBe(true);
  });

  it('keeps the parking-area zoom prompt visible until the detailed zoom', () => {
    expect(shouldShowParkingZoomHint(15, true)).toBe(true);
    expect(shouldShowParkingZoomHint(16, true)).toBe(false);
    expect(shouldShowParkingZoomHint(15, false)).toBe(false);
  });

  it('labels payment and resident zones with their official identifiers', () => {
    expect(parkingAreaLabel({ properties: { vyohykkeen_nro: '1' } }, 'payment', 'fi')).toBe('Maksuvyöhyke 1');
    expect(parkingAreaLabel({ properties: { asukaspysakointitunnus: 'A' } }, 'resident', 'en')).toBe('Resident zone A');
  });

  it('only shows the location marker for a confirmed GPS position', () => {
    expect(shouldShowLocationMarker('ready')).toBe(true);
    expect(shouldShowLocationMarker('fallback')).toBe(false);
    expect(shouldShowLocationMarker('locating')).toBe(false);
  });

  it('detects polygon overlap even when no vertex is contained', () => {
    const horizontal = { geometry: { type: 'Polygon', coordinates: [[[0, 1], [4, 1], [4, 2], [0, 2], [0, 1]]] } };
    const vertical = { geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 4], [1, 4], [1, 0]]] } };
    const separate = { geometry: { type: 'Polygon', coordinates: [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]] } };
    expect(featuresOverlap(horizontal, vertical)).toBe(true);
    expect(featuresOverlap(horizontal, separate)).toBe(false);
  });

  it('measures proximity to a Siirtovahti street line', () => {
    const line = { geometry: { type: 'MultiLineString', coordinates: [[[24.94, 60.17], [24.95, 60.17]]] } };
    expect(pointToLineDistance([24.945, 60.1701], line)).toBeLessThan(12);
    expect(pointToLineDistance([24.945, 60.172], line)).toBeGreaterThan(200);
  });

  it('normalizes Siirtovahti records into GeoJSON features', () => {
    const result = siirtovahtiFeatures({ hits: { hits: [{ _id: 'notice-1', _source: { address: ['Testikatu 1'], valid_from: [100], valid_to: [200], geometry: [{ type: 'multilinestring', coordinates: [[[24.9, 60.1], [25, 60.2]]] }] } }] } });
    expect(result).toHaveLength(1);
    expect(result[0].geometry.type).toBe('MultiLineString');
    expect(result[0].properties.address).toBe('Testikatu 1');
  });

  it('adds public OSM halls but keeps LIIPI as the preferred duplicate', () => {
    const origin = [60.17, 24.94];
    const osm = osmFacilities({ elements: [
      { type: 'node', id: 1, lat: 60.1702, lon: 24.9402, tags: { amenity: 'parking', parking: 'underground', name: 'P-Testi', capacity: '200', charge: '4 EUR/hour' } },
      { type: 'node', id: 2, lat: 60.18, lon: 24.95, tags: { amenity: 'parking', parking: 'underground', name: 'Private', access: 'private' } },
    ] }, origin);
    const liipi = [{ id: 9, name: 'Testi', point: [60.1701, 24.9401], distance: 15, spacesAvailable: 42, price: null, source: 'liipi' }];
    const merged = mergeFacilities(liipi, osm);
    expect(merged).toHaveLength(1);
    expect(merged[0].spacesAvailable).toBe(42);
    expect(merged[0].price).toBe('4 EUR/hour');
    expect(merged[0].capacity).toBe(200);
  });

  it('keeps nearby parking halls with different names separate', () => {
    const liipi = [{ id: 1, name: 'Kluuvi', point: [60.17, 24.94], distance: 10, source: 'liipi' }];
    const osm = [{ id: 'osm-2', name: 'Asema', point: [60.1703, 24.9403], distance: 35, source: 'osm' }];
    expect(mergeFacilities(liipi, osm)).toHaveLength(2);
  });

  it('extracts a compact price for parking-hall map markers', () => {
    expect(compactFacilityPrice('4 EUR/hour')).toBe('4 €/h');
    expect(compactFacilityPrice('2,50 €/h')).toBe('2,50 €/h');
    expect(compactFacilityPrice('Maksuton')).toBe('Maksuton');
  });

  it('treats official no-parking descriptions as authoritative restrictions', () => {
    expect(hasOfficialParkingRestriction({ name: { fi: 'Pysäköintikielto', en: 'No parking' } })).toBe(true);
    expect(hasOfficialParkingRestriction({ name: { fi: 'Pysäköintialue', en: 'Parking area' } })).toBe(false);
  });

  it('uses the street-parking visibility threshold for parking halls', () => {
    const facility = { name: 'P-Kluuvi', point: [60.17, 24.94] };
    expect(shouldShowFacilityMarker(facility, 15, true)).toBe(false);
    expect(shouldShowFacilityMarker(facility, 16, true)).toBe(true);
    expect(shouldShowFacilityMarker(facility, 16, false)).toBe(false);
    expect(shouldShowFacilityMarker({ name: 'Missing coordinates' }, 16, true)).toBe(false);
  });

  it('does not cap the number of parking halls shown at street-parking zoom', () => {
    const facilities = Array.from({ length: 12 }, (_, index) => ({ id: index, name: `Hall ${index}`, point: [60.17 + index / 1000, 24.94] }));
    expect(visibleFacilityMarkers(facilities, 15, true)).toHaveLength(0);
    expect(visibleFacilityMarkers(facilities, 16, false)).toHaveLength(0);
    expect(visibleFacilityMarkers(facilities, 16, true)).toHaveLength(12);
  });
});

describe('static search metadata', () => {
  const projectFile = (file) => readFileSync(file, 'utf8');

  it('provides crawlable page metadata and an initial description', () => {
    const html = projectFile('index.html');
    expect(html).toContain('<link rel="canonical" href="https://esiivola.github.io/helsinki-parking/"');
    expect(html).toContain('<meta name="robots" content="index, follow');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type": "WebApplication"');
    expect(html).toContain('<h1>Helsingin pysäköintikartta</h1>');
  });

  it('publishes crawler instructions and the canonical URL in a sitemap', () => {
    expect(projectFile('public/robots.txt')).toContain('Sitemap: https://esiivola.github.io/helsinki-parking/sitemap.xml');
    expect(projectFile('public/sitemap.xml')).toContain('<loc>https://esiivola.github.io/helsinki-parking/</loc>');
  });

  it('uses standard-resolution map tiles to reduce mobile transfer size', () => {
    const source = projectFile('src/main.jsx');
    expect(source).toContain("light_all/{z}/{x}/{y}.png");
    expect(source).not.toContain("light_all/{z}/{x}/{y}{r}.png");
  });

  it('documents the live service and deploys the production build to GitHub Pages', () => {
    const readme = projectFile('README.md');
    const workflow = projectFile('.github/workflows/deploy-pages.yml');
    expect(readme).toContain('https://esiivola.github.io/helsinki-parking/');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('actions/deploy-pages@v4');
    expect(workflow).toContain('path: ./dist');
  });
});
