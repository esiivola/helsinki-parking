// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_ZOOM, ceilToFiveMinutes, closureActiveAt, compactFacilityPrice, dateTimeInputValue, facilityAreaKey, featuresOverlap, formatParkingCardTransition, formatParkingValidity, formatPaymentMethods, hasOfficialParkingRestriction, haversine, isReferenceSnapshotUsable, isVantaaManifestStale, isVantaaManifestUsable, isVantaaTileUsable, mergeFacilities, noticeActiveAt, osmFacilities, parkingAreaLabel, parkingExceptions, parkingFeatureAt, parkingPolygonState, parkingPolygonStyle, parkingSpotLoadStatus, parkingTimeStepDisabled, pointInFeature, pointToLineDistance, readJsonCache, serviceMapFacilities, setParkingDatePart, setParkingTimePart, shouldLoadParkingSpots, shouldReuseParkingSpotCache, shouldShowFacilityMarker, shouldShowLocationMarker, shouldShowParkingZoomHint, siirtovahtiFeatures, spotMeta, visibleFacilityMarkers, writeJsonCache } from './main.jsx';
import { classifyParkingSpot, formatStayMinutes, isGeneralParkingFeature, nextPaidStart, parkingDurationMinutes, parkingNowStatus, parkingPermitCode, parkingTypeKind, parseParkingValidity, spotMaxStay, PARKING_CLASS_RULES } from './parking-rules.js';

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
    // The comma-less variant reads the same; a period (possible date) does not.
    expect(parseParkingValidity('9-21 (9-18)').byDay[6]).toEqual([{ start: 540, end: 1080 }]);
    expect(parseParkingValidity('9.21, (9-18)')).toBeNull();
  });

  it('keeps the verified Urheilukatu space paid without a price-zone match', () => {
    const urheilukatu = { properties: { luokka: 7, luokka_nimi: 'Kertamaksu enintään 1 h', kesto: '60 min', voimassaolo: '9-21, (9-21), 9-21' } };
    const friday = new Date(2026, 7, 7, 17, 50);
    const sunday = new Date(2026, 7, 9, 17, 50);
    expect(parkingNowStatus(null, friday, urheilukatu.properties.voimassaolo).paid).toBe(true);
    expect(parkingNowStatus(null, sunday, urheilukatu.properties.voimassaolo).paid).toBe(true);
    expect(parkingPolygonState(urheilukatu, null, friday, [], [], 'fi')).toMatchObject({ status: 'paid', label: 'Maksullinen · klo 21 asti' });
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
    expect(free.label).toBe('Maksuton · ti klo 9 asti · enintään 4 h');
    expect(free.nextPaidAt).toBeInstanceOf(Date);
  });

  it('shows the selected day payment window beside the polygon price', () => {
    const space = { geometry: { type: 'Polygon', coordinates: [] }, properties: { luokka: 5, voimassaolo: '9-21, (9-18)' } };
    expect(parkingPolygonState(space, '2', new Date('2026-08-15T12:00:00'), [], [], 'en').label).toBe('2 €/h · until 18:00');
  });

  it('does not infer free parking when paid-space hours are missing or malformed', () => {
    const date = new Date(2026, 7, 8, 12, 0);
    const missing = parkingPolygonState({ properties: { luokka: 5 } }, '1', date, [], [], 'fi');
    const malformed = parkingPolygonState({ properties: { luokka: 5, voimassaolo: '7-15, Maksullinen (9-18)' } }, '1', date, [], [], 'fi');
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
    expect([short.status, short.label]).toEqual(['freeShort', 'Maksuton kiekolla · enintään 30 min']);
    expect([long.status, long.label]).toEqual(['freeLong', 'Maksuton kiekolla · enintään 2 h']);
    expect([unlimited.status, unlimited.label]).toEqual(['freeLong', 'Maksuton · ei aikarajaa']);
    expect([unknown.status, unknown.label]).toEqual(['freeShort', 'Maksuton · enintään 1 h']);
  });

  it('applies provider day-specific stay limits at the selected time', () => {
    const schedule = (days, start, end) => ({ byDay: Array.from({ length: 7 }, (_, day) => days.includes(day) ? [{ start, end }] : []) });
    const feature = { properties: { parking: {
      kind: 'disc', municipality: 'vantaa', maxStayMinutes: null,
      stayRules: [
        { maxStayMinutes: 30, schedule: schedule([1, 2, 3, 4, 5], 360, 540) },
        { maxStayMinutes: 120, schedule: schedule([1, 2, 3, 4, 5], 540, 900) },
        { maxStayMinutes: 30, schedule: schedule([1, 2, 3, 4, 5], 900, 1080) },
      ],
    } } };
    expect(parkingPolygonState(feature, null, new Date(2026, 7, 10, 8, 0), [], [], 'fi').meta.maxStayMinutes).toBe(30);
    expect(parkingPolygonState(feature, null, new Date(2026, 7, 10, 10, 0), [], [], 'fi').meta.maxStayMinutes).toBe(120);

    const espoo = { properties: { parking: {
      kind: 'free', municipality: 'espoo', maxStayMinutes: null,
      stayRules: [
        { maxStayMinutes: 240, schedule: schedule([1, 2, 3, 4, 5], 360, 1080) },
        { maxStayMinutes: 120, schedule: schedule([6], 540, 900) },
      ],
    } } };
    expect(parkingPolygonState(espoo, null, new Date(2026, 7, 10, 12, 0), [], [], 'fi').meta.maxStayMinutes).toBe(240);
    expect(parkingPolygonState(espoo, null, new Date(2026, 7, 15, 12, 0), [], [], 'fi').meta.maxStayMinutes).toBe(120);
  });

  it('reads class 9 hours as a no-parking window rather than chargeable hours', () => {
    // "Pysäköinti sallittu pysäköintikieltoajan ulkopuolella": voimassaolo lists
    // when parking is forbidden, so outside it the space is free.
    const space = { properties: { luokka: 9, voimassaolo: '8-17' } };
    const banned = parkingPolygonState(space, null, new Date(2026, 7, 10, 10, 55), [], [], 'fi');
    const allowed = parkingPolygonState(space, null, new Date(2026, 7, 10, 19, 0), [], [], 'fi');
    expect([banned.status, banned.label]).toEqual(['unavailable', 'Pysäköinti kielletty · klo 17 asti']);
    expect([allowed.status, allowed.label]).toEqual(['freeLong', 'Maksuton · ti klo 8 asti · ei aikarajaa']);
    const unreadable = parkingPolygonState({ properties: { luokka: 9, voimassaolo: '7-15, Maksullinen (9-18)' } }, null, new Date(2026, 7, 10, 19, 0), [], [], 'fi');
    expect([unreadable.status, unreadable.label]).toEqual(['unavailable', 'Pysäköinti kielletty · kieltoajat tarkistettava']);
  });

  it('colours a space with an unstated time limit as short-stay parking', () => {
    const assumed = parkingPolygonState({ properties: { luokka: 1 } }, null, new Date(2026, 7, 10, 12, 0), [], [], 'fi');
    const published = parkingPolygonState({ properties: { luokka: 1, kesto: '2 h' } }, null, new Date(2026, 7, 10, 12, 0), [], [], 'fi');
    expect([assumed.status, assumed.label]).toEqual(['freeShort', 'Maksuton · enintään 1 h']);
    expect(assumed.meta.maxStayAssumed).toBe(true);
    expect([published.status, published.label]).toEqual(['freeLong', 'Maksuton · enintään 2 h']);
    expect(published.meta.maxStayAssumed).toBe(false);
  });

  it('keeps a no-parking area off the map even when it carries a permit code', () => {
    const banned = { properties: { luokka: 0, tyyppi: 'Pysäköintikielto', asukaspysakointitunnus: '0' } };
    expect(spotMeta(banned, '1', 'fi')).toMatchObject({ kind: 'prohibited', price: 0, permit: '' });
    expect(parkingPolygonState(banned, '1', new Date(2026, 7, 10, 12, 0), [], [], 'fi').status).toBe('unavailable');
    expect(isGeneralParkingFeature(banned)).toBe(false);
  });

  it('shows a disc space as free rather than resident parking', () => {
    const disc = { properties: { luokka: 8, kesto: '4 h', voimassaolo: '8-20', asukaspysakointitunnus: 'N' } };
    const state = parkingPolygonState(disc, '1', new Date(2026, 7, 10, 12, 0), [], [], 'fi');
    expect([state.status, state.label]).toEqual(['freeLong', 'Maksuton kiekolla · enintään 4 h klo 8–20']);
    expect(state.meta.permit).toBe('N');
  });

  it('names the window a free or disc time limit applies in', () => {
    // voimassaolo on a free space is the window the limit runs in, not a
    // chargeable period. Naming it adds information without claiming the limit
    // lifts outside it.
    const disc = { properties: { luokka: 8, kesto: '4 h', voimassaolo: '8-20' } };
    expect(parkingPolygonState(disc, null, new Date(2026, 7, 10, 12, 0), [], [], 'fi').label).toBe('Maksuton kiekolla · enintään 4 h klo 8–20');
    expect(parkingPolygonState(disc, null, new Date(2026, 7, 10, 22, 0), [], [], 'fi').label).toBe('Maksuton kiekolla · enintään 4 h klo 8–20');
    // Saturday carries its own hours, and a day with none stated says nothing.
    const weekend = { properties: { luokka: 1, kesto: '30 min', voimassaolo: '8-17, (9-15)' } };
    expect(parkingPolygonState(weekend, null, new Date(2026, 7, 15, 12, 0), [], [], 'fi').label).toBe('Maksuton · enintään 30 min klo 9–15');
    expect(parkingPolygonState(weekend, null, new Date(2026, 7, 16, 12, 0), [], [], 'fi').label).toBe('Maksuton · enintään 30 min');
    expect(parkingPolygonState({ properties: { luokka: 1, kesto: '30 min' } }, null, new Date(2026, 7, 10, 12, 0), [], [], 'fi').label).toBe('Maksuton · enintään 30 min');
  });

  it('does not read a paid or no-parking window as a stay limit window', () => {
    // On those classes voimassaolo already drives the deadline, so repeating it
    // beside the limit would say two different things about the same hours.
    const paid = parkingPolygonState({ properties: { luokka: 5, kesto: '4 h', voimassaolo: '9-21' } }, null, new Date(2026, 7, 10, 23, 0), [], [], 'fi');
    expect(paid.label).toBe('Maksuton · ti klo 9 asti · enintään 4 h');
    const offPeak = parkingPolygonState({ properties: { luokka: 9, voimassaolo: '8-17' } }, null, new Date(2026, 7, 10, 19, 0), [], [], 'fi');
    expect(offPeak.label).toBe('Maksuton · ti klo 8 asti · ei aikarajaa');
  });

  it('reports the window in English without the Finnish clock prefix', () => {
    const disc = { properties: { luokka: 8, kesto: '4 h', voimassaolo: '8-20' } };
    expect(parkingPolygonState(disc, null, new Date(2026, 7, 10, 12, 0), [], [], 'en').label).toBe('Free with parking disc · maximum 4 h, 8–20');
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
    expect(meta.kind).toBe('paid');
    expect(meta.price).toBe(4);
    expect(meta.permit).toBe('A');
  });

  it('only displays spaces usable for general parking', () => {
    expect(isGeneralParkingFeature({ properties: { luokka: 5 } })).toBe(true);
    expect(isGeneralParkingFeature({ properties: { luokka: 9 } })).toBe(true);
    expect(isGeneralParkingFeature({ properties: { luokka: 11, asukaspysakointitunnus: 'Z' } })).toBe(false);
    expect(isGeneralParkingFeature({ properties: { tyyppi: 'Pysäköintikielto' } })).toBe(false);
    expect(isGeneralParkingFeature({ properties: { tyyppi: 'Kuormauspaikka' } })).toBe(false);
    expect(isGeneralParkingFeature({ properties: { tyyppi: 'Invapaikka' } })).toBe(false);
  });

  it('does not treat background or restricted-area clicks as parking', () => {
    const restricted = { geometry: { type: 'Polygon', coordinates: [[[24.94, 60.17], [24.95, 60.17], [24.95, 60.18], [24.94, 60.18], [24.94, 60.17]]] }, properties: { luokka: 0, tyyppi: 'Pysäköintikielto', asukaspysakointitunnus: '0' } };
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
      { type: 'node', id: 1, lat: 60.1702, lon: 24.9402, tags: { amenity: 'parking', parking: 'underground', name: 'P-Testi', capacity: '200', charge: '4 EUR/hour', opening_hours: '24/7', operator: 'Testi Oy', website: 'https://example.test/' } },
      { type: 'node', id: 2, lat: 60.18, lon: 24.95, tags: { amenity: 'parking', parking: 'underground', name: 'Private', access: 'private' } },
    ] }, origin);
    const liipi = [{ id: 9, name: 'Testi', point: [60.1701, 24.9401], distance: 15, spacesAvailable: 42, price: null, source: 'liipi' }];
    const merged = mergeFacilities(liipi, osm);
    expect(merged).toHaveLength(1);
    expect(merged[0].spacesAvailable).toBe(42);
    expect(merged[0].price).toBe('4 EUR/hour');
    expect(merged[0].capacity).toBe(200);
    expect(merged[0].openingHours).toBe('24/7');
    expect(merged[0].operator).toBe('Testi Oy');
    expect(merged[0].website).toBe('https://example.test/');
  });

  it('shows only payment methods explicitly provided by the source', () => {
    const origin = [60.17, 24.94];
    const osm = osmFacilities({ elements: [{
      type: 'node', id: 1, lat: 60.1702, lon: 24.9402,
      tags: { name: 'P-WTC', 'payment:app': 'yes', 'payment:contactless': 'yes', 'payment:coins': 'yes' },
    }] }, origin);
    expect(osm[0].paymentMethods).toEqual(['app', 'card', 'cash']);
    expect(formatPaymentMethods(osm[0].paymentMethods, 'fi')).toBe('Pysäköinnin voi maksaa mobiilisovelluksella, maksukortilla tai käteisellä.');

    const serviceMap = serviceMapFacilities({ results: [{
      id: 2,
      name: { fi: 'Marketparkki' },
      short_description: { fi: 'Pysäköinnin maksutavat: Moovy-sovellus ja maksukortti.' },
      location: { coordinates: [24.941, 60.171] },
    }] }, origin, 'fi');
    expect(serviceMap[0].paymentMethods).toEqual(['moovy', 'card']);
    expect(formatPaymentMethods(serviceMap[0].paymentMethods, 'fi')).toBe('Pysäköinnin voi maksaa Moovy-sovelluksella tai maksukortilla.');

    const operatorOnly = serviceMapFacilities({ results: [{
      id: 3,
      name: { fi: 'Aimo Park -halli' },
      short_description: { fi: 'Hallin ylläpitäjä on Aimo Park.' },
      location: { coordinates: [24.942, 60.172] },
    }] }, origin, 'fi');
    expect(operatorOnly[0].paymentMethods).toEqual([]);
  });

  it('merges explicitly sourced payment methods without duplicates', () => {
    const primary = [{ id: 1, name: 'Kluuvi', point: [60.17, 24.94], distance: 10, paymentMethods: ['card'], source: 'service-map' }];
    const fallback = [{ id: 2, name: 'P-Kluuvi', point: [60.1701, 24.9401], distance: 15, paymentMethods: ['app', 'card'], source: 'osm' }];
    expect(mergeFacilities(primary, fallback)[0].paymentMethods).toEqual(['app', 'card']);
  });

  it('uses the fill colour for polygon outlines', () => {
    ['freeLong', 'freeShort', 'paid', 'unavailable'].forEach((status) => {
      const style = parkingPolygonStyle(status);
      expect(style.color).toBe(style.fillColor);
    });
    expect(parkingPolygonStyle('freeShort').dashArray).toBe('4 3');
  });

  it('keeps nearby parking halls with different names separate', () => {
    const liipi = [{ id: 1, name: 'Kluuvi', point: [60.17, 24.94], distance: 10, source: 'liipi' }];
    const osm = [{ id: 'osm-2', name: 'Asema', point: [60.1703, 24.9403], distance: 35, source: 'osm' }];
    expect(mergeFacilities(liipi, osm)).toHaveLength(2);
  });

  it('deduplicates prefixed Service Map and LIIPI names at the same facility', () => {
    const liipi = [{ id: 1, name: 'Perkkaantie', point: [60.221, 24.81], distance: 10, capacity: 100, source: 'liipi' }];
    const serviceMap = [{ id: 2, name: 'Pysäköintialue Perkkaantie', point: [60.22101, 24.81001], distance: 11, website: 'https://example.test', source: 'service-map' }];
    const merged = mergeFacilities(liipi, serviceMap);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ name: 'Perkkaantie', capacity: 100, website: 'https://example.test' });
  });

  it('deduplicates close cross-source station aliases with a minor spelling difference', () => {
    const liipi = [{ id: 439, name: 'Koivuhovin seisake', point: [60.206628, 24.70185], distance: 10, capacity: 50, source: 'liipi' }];
    const serviceMap = [{ id: 53531, name: 'Koivuohovin aseman liityntäpysäköinti', point: [60.206585, 24.70216], distance: 12, website: 'https://example.test/koivuhovi', source: 'service-map' }];
    const merged = mergeFacilities(liipi, serviceMap);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 439, capacity: 50, website: 'https://example.test/koivuhovi' });
  });

  it('deduplicates close cross-source facilities with a distinctive shared place token', () => {
    const liipi = [{ id: 619, name: 'Kauppakeskus Ruoholahti', point: [60.16397, 24.911505], distance: 10, source: 'liipi' }];
    const serviceMap = [{ id: 67613, name: 'EuroPark, P-Ruoholahti, Porkkalankatu 20', point: [60.164124, 24.911594], distance: 12, price: '3 €/h', source: 'service-map' }];
    const merged = mergeFacilities(liipi, serviceMap);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 619, price: '3 €/h' });
  });

  it('keeps separately numbered lots distinct even when they are close', () => {
    const liipi = [{ id: 1, name: 'Koivukylänväylä P1', point: [60.323, 25.04], distance: 10, source: 'liipi' }];
    const serviceMap = [{ id: 2, name: 'Koivukylänväylä P2', point: [60.3231, 25.0401], distance: 12, source: 'service-map' }];
    expect(mergeFacilities(liipi, serviceMap)).toHaveLength(2);
  });

  it('normalizes regional Service Map halls and outdoor parking areas', () => {
    const origin = [60.17, 24.94];
    const facilities = serviceMapFacilities({ results: [
      { id: 1, name: { fi: 'Marketparkki' }, short_description: { fi: 'Parkkihalli on auki 24/7.' }, location: { coordinates: [24.941, 60.171] }, www: { fi: 'https://example.test/halli' }, organizer_name: 'Testi Oy' },
      { id: 2, name: { fi: 'Ulkopaikka' }, short_description: { fi: 'Ulkoalue, paikkamäärä 25' }, location: { coordinates: [24.942, 60.172] } },
    ] }, origin, 'fi');
    expect(facilities).toHaveLength(2);
    expect(facilities[0]).toMatchObject({ name: 'Marketparkki', openingHours: '24/7', website: 'https://example.test/halli', operator: 'Testi Oy', source: 'service-map' });
    expect(facilities[1]).toMatchObject({ name: 'Ulkopaikka', capacity: 25, facilityType: 'outdoor' });
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

  it('uses an independent visibility threshold and layer for parking facilities', () => {
    const facility = { name: 'P-Kluuvi', point: [60.17, 24.94] };
    expect(shouldShowFacilityMarker(facility, 13, true)).toBe(false);
    expect(shouldShowFacilityMarker(facility, 14, true)).toBe(true);
    expect(shouldShowFacilityMarker(facility, 16, false)).toBe(false);
    expect(shouldShowFacilityMarker({ name: 'Missing coordinates' }, 16, true)).toBe(false);
  });

  it('does not cap the number of parking facilities shown at facility zoom', () => {
    const facilities = Array.from({ length: 12 }, (_, index) => ({ id: index, name: `Hall ${index}`, point: [60.17 + index / 1000, 24.94] }));
    expect(visibleFacilityMarkers(facilities, 13, true)).toHaveLength(0);
    expect(visibleFacilityMarkers(facilities, 16, false)).toHaveLength(0);
    expect(visibleFacilityMarkers(facilities, 14, true)).toHaveLength(12);
  });

  it('reuses street polygons while the viewport remains inside a recent padded request', () => {
    const cache = {
      bounds: { west: 24.90, south: 60.15, east: 24.98, north: 60.20 },
      fetchedAt: 1_000,
      features: [{ id: 1 }],
    };
    expect(shouldReuseParkingSpotCache(cache, { west: 24.92, south: 60.16, east: 24.96, north: 60.19 }, 120_000)).toBe(true);
    expect(shouldReuseParkingSpotCache(cache, { west: 24.89, south: 60.16, east: 24.96, north: 60.19 }, 120_000)).toBe(false);
    expect(shouldReuseParkingSpotCache(cache, { west: 24.92, south: 60.16, east: 24.96, north: 60.19 }, 400_000)).toBe(false);
  });

  it('groups nearby origins into one parking-hall query area', () => {
    expect(facilityAreaKey([60.1699, 24.9384])).toBe(facilityAreaKey([60.171, 24.941]));
    expect(facilityAreaKey([60.1699, 24.9384])).not.toBe(facilityAreaKey([60.23, 25.02]));
  });

  it('uses expiring browser caches and ignores malformed entries', () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    expect(writeJsonCache(storage, 'test', { value: 7 }, 1_000)).toBe(true);
    expect(readJsonCache(storage, 'test', 5_000, 5_500)).toEqual({ value: 7 });
    expect(readJsonCache(storage, 'test', 5_000, 6_001)).toBeNull();
    expect(readJsonCache({ getItem: () => '{' }, 'broken', 5_000, 2_000)).toBeNull();
  });

  it('uses only fresh and structurally complete reference snapshots', () => {
    const now = new Date('2026-08-08T12:00:00Z').getTime();
    const snapshot = {
      schemaVersion: 2,
      generatedAt: '2026-08-01T12:00:00Z',
      paymentZones: { features: [] },
      residentZones: { features: [] },
      serviceMapFacilities: { results: [] },
      liipiFacilities: { results: [] },
      osmFacilities: { elements: [] },
    };
    expect(isReferenceSnapshotUsable(snapshot, now)).toBe(true);
    expect(isReferenceSnapshotUsable({ ...snapshot, generatedAt: '2026-07-20T12:00:00Z' }, now)).toBe(false);
    expect(isReferenceSnapshotUsable({ ...snapshot, generatedAt: '2026-08-09T12:00:00Z' }, now)).toBe(false);
    expect(isReferenceSnapshotUsable({ ...snapshot, osmFacilities: null }, now)).toBe(false);
  });

  it('gives Kauniainen curb-rule warnings precedence over provider failures', () => {
    expect(parkingSpotLoadStatus('kauniainen', 2, 0, 0)).toBe('unsupported');
    expect(parkingSpotLoadStatus('kauniainen', 2, 1, 24)).toBe('unsupported');
    expect(parkingSpotLoadStatus('kauniainen', 1, 1, 24, true)).toBe('unsupported');
    expect(parkingSpotLoadStatus('espoo', 2, 0, 0)).toBe('error');
    expect(parkingSpotLoadStatus('espoo', 2, 1, 24)).toBe('partial');
    expect(parkingSpotLoadStatus('vantaa', 1, 1, 24, true)).toBe('stale');
    expect(parkingSpotLoadStatus('vantaa', 2, 1, 24, true)).toBe('stale');
  });

  it('accepts Vantaa manifests for 31 days and flags them after 10 days', () => {
    const now = new Date('2026-08-17T12:00:00Z').getTime();
    const manifest = {
      schemaVersion: 2,
      generatedAt: '2026-08-16T12:00:00Z',
      featureCount: 2,
      tiles: [{ path: 'data/vantaa-parking/tile-0-0.json', featureCount: 2, bounds: { west: 24.7, south: 60.2, east: 24.8, north: 60.25 } }],
    };
    expect(isVantaaManifestUsable(manifest, now)).toBe(true);
    expect(isVantaaManifestStale(manifest, now)).toBe(false);
    const tenDaysOld = { ...manifest, generatedAt: '2026-08-07T12:00:00Z' };
    expect(isVantaaManifestUsable(tenDaysOld, now)).toBe(true);
    expect(isVantaaManifestStale(tenDaysOld, now)).toBe(false);
    const fallback = { ...manifest, generatedAt: '2026-08-01T12:00:00Z' };
    expect(isVantaaManifestUsable(fallback, now)).toBe(true);
    expect(isVantaaManifestStale(fallback, now)).toBe(true);
    expect(isVantaaManifestUsable({ ...manifest, generatedAt: '2026-07-17T12:00:00Z' }, now)).toBe(true);
    expect(isVantaaManifestUsable({ ...manifest, generatedAt: '2026-07-17T11:59:59Z' }, now)).toBe(false);
    expect(isVantaaManifestUsable({ ...manifest, generatedAt: '2026-08-17T14:00:00Z' }, now)).toBe(false);
    expect(isVantaaManifestUsable({ ...manifest, featureCount: 0 }, now)).toBe(false);
    expect(isVantaaManifestUsable({ ...manifest, tiles: [] }, now)).toBe(false);
    expect(isVantaaManifestUsable({ ...manifest, tiles: [{ ...manifest.tiles[0], featureCount: -1 }] }, now)).toBe(false);
  });

  it('rejects Vantaa tiles from a different run or with a wrong declared count', () => {
    const manifest = { generatedAt: '2026-08-16T12:00:00Z' };
    const tile = { featureCount: 2 };
    const snapshot = { schemaVersion: 1, generatedAt: manifest.generatedAt, features: [{ id: 1 }, { id: 2 }] };
    expect(isVantaaTileUsable(snapshot, manifest, tile)).toBe(true);
    expect(isVantaaTileUsable({ ...snapshot, generatedAt: '2026-08-15T12:00:00Z' }, manifest, tile)).toBe(false);
    expect(isVantaaTileUsable({ ...snapshot, features: [{ id: 1 }] }, manifest, tile)).toBe(false);
  });
});

describe('static search metadata', () => {
  const projectFile = (file) => readFileSync(file, 'utf8');

  it('provides crawlable page metadata and an initial description', () => {
    const html = projectFile('index.html');
    const source = projectFile('src/main.jsx');
    expect(html).toContain('<link rel="canonical" href="https://esiivola.github.io/helsinki-parking/"');
    expect(html).toContain('<meta name="robots" content="index, follow');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type": "WebApplication"');
    expect(html).toContain('<h1>Pysäköintikartta</h1>');
    expect(source).toContain('document.documentElement.lang = lang');
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

  it('uses native system fonts without an extra font-network request', () => {
    const source = projectFile('src/main.jsx');
    expect(source).not.toContain('fonts.googleapis.com');
    expect(source).not.toContain('fonts.gstatic.com');
  });

  it('does not fan out development-only parking-facility requests', () => {
    const source = projectFile('src/main.jsx');
    expect(source).not.toContain('/facilities.geojson?limit=-1');
    expect(source).not.toContain('/prediction?after=120');
    expect(source).not.toContain('/utilizations');
    expect(source).toContain('liipiFacilities(snapshot.liipiFacilities, origin, lang, parkingTime)');
  });

  it('keeps the optional static-data workflow free-tier friendly and reversible', () => {
    const workflow = projectFile('.github/workflows/update-parking-data.yml');
    const generator = projectFile('scripts/update-parking-data.mjs');
    const snapshot = JSON.parse(projectFile('public/data/parking-reference.json'));
    const vantaa = JSON.parse(projectFile('public/data/vantaa-parking.json'));
    const source = projectFile('src/main.jsx');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('actions: write');
    expect(workflow).toContain('gh workflow run deploy-pages.yml --ref main');
    expect(workflow).toContain('public/data/vantaa-parking/');
    expect(workflow).toContain('node scripts/update-parking-data.mjs');
    expect(workflow).not.toContain('actions/cache');
    expect(generator).toContain('node:fs/promises');
    expect(snapshot.schemaVersion).toBe(2);
    expect(vantaa).toMatchObject({ schemaVersion: 2, type: 'FeatureCollectionIndex', featureCount: snapshot.parkingArtifacts.vantaa.featureCount });
    expect(vantaa.tiles).toHaveLength(25);
    expect(vantaa.tiles.every((tile) => tile.path.startsWith('data/vantaa-parking/') && tile.featureCount >= 0)).toBe(true);
    expect(source).toContain('isReferenceSnapshotUsable');
    expect(source).toContain("cachedJson('payment-zones'");
    expect(source).toContain("cachedJson('service-map-facilities'");
  });

  it('uses natural Finnish wording and omits unreliable street occupancy', () => {
    const source = projectFile('src/main.jsx');
    expect(source).toContain('Väliaikaisesti poissa käytöstä');
    expect(source).toContain('Pysäköintikohteet lähellä');
    expect(source).toContain('Tarkista hinnat ja aukioloajat');
    expect(source).not.toContain('PARKKIHUBI');
    expect(source).not.toContain('Kadunvarsipaikkojen tilanne');
  });

  it('avoids browser APIs that previously prevented older Safari and Firefox from loading', () => {
    const source = projectFile('src/main.jsx');
    const providers = projectFile('src/parking-providers.js');
    expect(projectFile('vite.config.js')).toContain("target: ['es2017', 'safari11', 'firefox68']");
    expect(source).not.toContain('.matchAll(');
    expect(providers).not.toContain('.matchAll(');
    expect(source).not.toContain('.flat(');
    expect(source).not.toContain('Promise.allSettled(');
    expect(source).not.toContain('new AbortController(');
  });

  it('does not show distances in parking-hall cards', () => {
    const source = projectFile('src/main.jsx');
    expect(source).not.toContain('formatDistance(facility.distance)');
    expect(source).not.toContain("distance: 'Etäisyys'");
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
