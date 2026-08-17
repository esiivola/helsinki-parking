import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isGeneralParkingFeature } from './parking-rules.js';
import {
  espooParkingUrl,
  filterFeaturesToBounds,
  liipiFacilities,
  municipalityForPoint,
  normalizeVantaaDivision,
  normalizeVantaaParking,
  parseEspooParkingGml,
  parseTampereParking,
  parseTurkuParking,
  parseTurkuResidentZones,
  providerIdsForBounds,
  regionalSchedule,
  tampereParkingUrl,
  turkuParkingUrl,
  turkuResidentZonesUrl,
  vantaaParkingUrl,
  vantaaPayZonePrice,
} from './parking-providers.js';

const TAMPERE_GEOMETRY = { type: 'MultiPolygon', coordinates: [[[[23.75, 61.49], [23.76, 61.49], [23.76, 61.50], [23.75, 61.49]]]] };

function tampereCollection(rows) {
  return { type: 'FeatureCollection', features: rows.map((props) => ({ type: 'Feature', id: `pysakointi_pysakointipaikat_polygon_gk24.${props.id}`, geometry: TAMPERE_GEOMETRY, properties: props })) };
}

const ESPOO_GML = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:GIS="http://www.tekla.com/gis">
  <gml:featureMember>
    <GIS:InfStreet gml:id="InfStreet.222706165">
      <GIS:ID>222706165</GIS:ID>
      <GIS:LABEL>049LP Elfvikintie</GIS:LABEL>
      <GIS:USETYPETEXT>Pysäköintialue</GIS:USETYPETEXT>
      <GIS:PARKINGSPACES>40</GIS:PARKINGSPACES>
      <GIS:PARKINGTIMES>Arki, aikarajoite 4 h: alkaa 06:00 - päättyy 18:00; Lauantai, aikarajoite 2 h: alkaa 09:00 - päättyy 15:00</GIS:PARKINGTIMES>
      <GIS:PARKINGFEE>0</GIS:PARKINGFEE>
      <GIS:DISABLEDPARKINGSPACES>2</GIS:DISABLEDPARKINGSPACES>
      <GIS:CARSHARINGPARKINGSPACES>1</GIS:CARSHARINGPARKINGSPACES>
      <GIS:Geometry>
        <gml:Polygon srsName="EPSG:4326">
          <gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>24.7000,60.2000,0 24.7100,60.2000,0 24.7100,60.2100,0 24.7000,60.2000,0</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs>
          <gml:innerBoundaryIs><gml:LinearRing><gml:coordinates>24.7020,60.2020 24.7030,60.2020 24.7020,60.2020</gml:coordinates></gml:LinearRing></gml:innerBoundaryIs>
        </gml:Polygon>
      </GIS:Geometry>
    </GIS:InfStreet>
  </gml:featureMember>
  <gml:featureMember>
    <GIS:InfStreet gml:id="InfStreet.2">
      <GIS:ID>2</GIS:ID><GIS:LABEL>Paid area</GIS:LABEL><GIS:PARKINGSPACES>12</GIS:PARKINGSPACES>
      <GIS:PARKINGFEE>1</GIS:PARKINGFEE><GIS:PARKINGFEEDESCRIPTION>Vyöhyke 1 (3,5€/h)</GIS:PARKINGFEEDESCRIPTION>
      <GIS:Geometry><gml:Polygon><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>24.72,60.20 24.73,60.20 24.73,60.21 24.72,60.20</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></GIS:Geometry>
    </GIS:InfStreet>
  </gml:featureMember>
</wfs:FeatureCollection>`;

describe('regional parking providers', () => {
  it('builds an Espoo viewport request using the verified GML2 contract', () => {
    const url = new URL(espooParkingUrl({ west: 24.6, south: 60.1, east: 24.8, north: 60.3 }, 123));
    expect(url.hostname).toBe('kartat.espoo.fi');
    expect(url.searchParams.get('typeName')).toBe('GIS:InfStreet');
    expect(url.searchParams.get('outputFormat')).toBe('GML2');
    expect(url.searchParams.get('srsName')).toBe('EPSG:4326');
    expect(url.searchParams.get('bbox')).toBeNull();
    expect(url.searchParams.get('maxFeatures')).toBe('123');
    expect(url.searchParams.get('filter')).toContain('PARKINGSPACES');
    expect(url.searchParams.get('filter')).toContain('<gml:lowerCorner>24.6 60.1</gml:lowerCorner>');
  });

  it('parses Espoo GML2 polygons, holes and provider-specific rules', () => {
    const features = parseEspooParkingGml(ESPOO_GML);
    expect(features).toHaveLength(2);
    expect(features[0]).toMatchObject({
      id: 'espoo:InfStreet:222706165',
      geometry: { type: 'Polygon' },
      properties: { parking: { municipality: 'espoo', kind: 'free', maxStayMinutes: null, estimatedSpaces: 40 } },
    });
    expect(features[0].geometry.coordinates).toHaveLength(2);
    expect(features[0].geometry.coordinates[0][0]).toEqual([24.7, 60.2]);
    expect(features[0].properties.parking.stayRules).toHaveLength(2);
    expect(features[0].properties.parking.stayRules[0]).toMatchObject({ maxStayMinutes: 240 });
    expect(features[0].properties.parking.stayRules[0].schedule.byDay[1]).toEqual([{ start: 360, end: 1080 }]);
    expect(features[0].properties.parking.stayRules[1]).toMatchObject({ maxStayMinutes: 120 });
    expect(features[0].properties.parking.stayRules[1].schedule.byDay[6]).toEqual([{ start: 540, end: 900 }]);
    expect(features[1].properties.parking).toMatchObject({ kind: 'paid', hourlyPrice: 3.5, zone: '1' });
    expect(features[1].properties.parking.schedule.byDay[0]).toEqual([{ start: 480, end: 1080 }]);

    const structuredZone = parseEspooParkingGml(ESPOO_GML.replace(
      '<GIS:PARKINGFEE>1</GIS:PARKINGFEE>',
      '<GIS:PARKINGFEE>2</GIS:PARKINGFEE>',
    ));
    expect(structuredZone[1].properties.parking.zone).toBe('2');
    expect(structuredZone[1].properties.parking.schedule.byDay[0]).toEqual([]);
  });

  it('rejects WFS exception documents and non-parking Espoo rows', () => {
    expect(() => parseEspooParkingGml('<ServiceExceptionReport><ServiceException>bad filter</ServiceException></ServiceExceptionReport>')).toThrow(/Espoo WFS/);
    const noSpaces = ESPOO_GML.replaceAll('<GIS:PARKINGSPACES>40</GIS:PARKINGSPACES>', '<GIS:PARKINGSPACES>0</GIS:PARKINGSPACES>')
      .replaceAll('<GIS:PARKINGSPACES>12</GIS:PARKINGSPACES>', '<GIS:PARKINGSPACES>0</GIS:PARKINGSPACES>');
    expect(parseEspooParkingGml(noSpaces)).toEqual([]);
  });

  it('normalizes Vantaa rules without Helsinki tariff or schedule defaults', () => {
    const disc = normalizeVantaaDivision({
      id: 26055,
      type: 'street_parking_area',
      municipality: 'vantaa',
      boundary: { type: 'MultiPolygon', coordinates: [[[[25.01, 60.29], [25.02, 60.29], [25.02, 60.30], [25.01, 60.29]]]] },
      extra: { katu: 'Kaislaranta', tyyppi: '2h-3h', aikarajoitus: '2h', voimassaoloaika: '8-18', kiekkopaikka: 'Kyllä', paikkamäärä: 9 },
    });
    expect(disc).toMatchObject({
      id: 'servicemap:vantaa:street_parking_area:26055',
      properties: { parking: { kind: 'disc', hourlyPrice: null, maxStayMinutes: 120, estimatedSpaces: 9 } },
    });
    expect(disc.properties.parking.schedule.byDay[1]).toEqual([{ start: 480, end: 1080 }]);

    const paid = normalizeVantaaDivision({
      id: 16683,
      type: 'parking_area',
      boundary: disc.geometry,
      extra: { katu: 'Tikkurilan kirjasto', tyyppi: 'Maksullinen', lisätiedot: 'Maksullinen. 1. tunti maksuton.', voimassaoloaika: '7-19 (9-15)', paikkamäärä: 16 },
    });
    expect(paid.properties.parking).toMatchObject({ kind: 'paid', hourlyPrice: null, notes: 'Maksullinen. 1. tunti maksuton.' });
    expect(paid.properties.parking.schedule.byDay[6]).toEqual([{ start: 540, end: 900 }]);

    const unlimited = normalizeVantaaDivision({ id: 9, type: 'parking_area', boundary: disc.geometry, extra: { tyyppi: 'Ei rajoitusta' } });
    expect(JSON.parse(JSON.stringify(unlimited)).properties.parking.maxStayMinutes).toBe('unlimited');

    const bucketDerived = normalizeVantaaDivision({
      id: 10,
      type: 'parking_area',
      boundary: disc.geometry,
      extra: { tyyppi: '4h-11h', voimassaoloaika: '8-18', kiekkopaikka: 'Kyllä' },
    });
    expect(bucketDerived.properties.parking).toMatchObject({
      maxStayMinutes: 240,
      maxStayAssumed: true,
      stayRules: [{ maxStayMinutes: 240, maxStayAssumed: true }],
    });
  });

  it('joins Vantaa pay-zone prices spatially and preserves unknown categories', () => {
    const boundary = { type: 'MultiPolygon', coordinates: [[[[25, 60.2], [25.1, 60.2], [25.1, 60.3], [25, 60.3], [25, 60.2]]]] };
    const zones = [{ boundary, name: { fi: '1 € / tunti' }, extra: {} }];
    expect(vantaaPayZonePrice(zones[0])).toBe(1);
    const collection = normalizeVantaaParking({ results: [
      { id: 1, type: 'parking_area', boundary, extra: { tyyppi: 'Maksullinen', paikkamäärä: 4 } },
      { id: 2, type: 'parking_area', boundary, extra: { tyyppi: 'Muu' } },
    ] }, zones);
    expect(collection).toHaveLength(1);
    expect(collection[0].properties.parking.hourlyPrice).toBe(1);

    const nonHourly = normalizeVantaaParking({ results: [{
      id: 17239,
      type: 'parking_area',
      boundary,
      extra: { tyyppi: 'Maksullinen', lisätiedot: 'Maksullisuus voimassa 24/7, hinta 50 €/kk tai 5 €/vrk' },
    }] }, zones);
    expect(nonHourly[0].properties.parking.hourlyPrice).toBeNull();
    expect(nonHourly[0].properties.parking.notes).toContain('50 €/kk');
  });

  it('treats explicit Vantaa allowed windows as allowed, not prohibited', () => {
    const boundary = { type: 'Polygon', coordinates: [[[24.8, 60.25], [24.81, 60.25], [24.81, 60.26], [24.8, 60.25]]] };
    const feature = normalizeVantaaDivision({
      id: 206550,
      type: 'street_parking_area',
      boundary,
      extra: { katu: 'Varistotie', tyyppi: 'Varattu päivisin', voimassaoloaika: '9-15', lisätiedot: 'Pysäköinti sallittu 9-15' },
    });
    expect(feature.properties.parking.scheduleMeaning).toBe('prohibition');
    expect(feature.properties.parking.schedule.byDay[1]).toEqual([{ start: 0, end: 540 }, { start: 900, end: 1440 }]);
    expect(feature.properties.parking.schedule.byDay[6]).toEqual([{ start: 0, end: 1440 }]);

    const daily = normalizeVantaaDivision({
      id: 16842,
      type: 'parking_area',
      boundary,
      extra: { tyyppi: 'Varattu päivisin', voimassaoloaika: '17-22, (17-22), 17-22', lisätiedot: 'Pysäköinti sallittu vain klo 17-22 kaikkina viikonpäivinä.' },
    });
    expect(daily.properties.parking.schedule.byDay[0]).toEqual([{ start: 0, end: 1020 }, { start: 1320, end: 1440 }]);

    const overnight = normalizeVantaaDivision({
      id: 205674,
      type: 'street_parking_area',
      boundary,
      extra: { tyyppi: 'Varattu päivisin', voimassaoloaika: 'ma-su 18-8', lisätiedot: 'Sallittu henkilö- ja pakettiautoille klo 18-8' },
    });
    expect(overnight.properties.parking.schedule.byDay[1]).toEqual([{ start: 480, end: 1080 }]);
  });

  it('keeps recipient-restricted Vantaa windows prohibited for ordinary users', () => {
    const boundary = { type: 'Polygon', coordinates: [[[24.8, 60.25], [24.81, 60.25], [24.81, 60.26], [24.8, 60.25]]] };
    const fixtures = [
      [16734, '6-18', 'Pysäköinti sallittu vain päiväkodin henkilökunnalle klo 6-18', 360, 1080],
      [17193, '6-18', 'Pysäköinti sallittu vain maanomistajan luvalla ma-pe klo 6-18.', 360, 1080],
      [17030, '17-6', 'Vain päiväkodin henkilökunnalle arkisin 6-17', 360, 1020],
      [205669, '18-7', 'Pysäköinti kielletty 7-18', 420, 1080],
      [206230, '08-16', 'Pysäköintikieletty arkisin klo 08-16. Muuna aikana sallittu.', 480, 960],
    ];
    fixtures.forEach(([id, source, notes, start, end]) => {
      const feature = normalizeVantaaDivision({
        id,
        type: 'parking_area',
        boundary,
        extra: { tyyppi: 'Varattu päivisin', voimassaoloaika: source, lisätiedot: notes },
      });
      expect(feature.properties.parking.scheduleMeaning).toBe('prohibition');
      expect(feature.properties.parking.schedule.byDay[1]).toEqual([{ start, end }]);
      expect(feature.properties.parking.schedule.byDay[6]).toEqual([]);
    });
  });

  it('does not publish recipient-, permit- or non-car-only Vantaa rows as general parking', () => {
    const boundary = { type: 'Polygon', coordinates: [[[24.8, 60.25], [24.81, 60.25], [24.81, 60.26], [24.8, 60.25]]] };
    const normalize = (id, type, notes) => normalizeVantaaDivision({
      id, type: 'parking_area', boundary, extra: { tyyppi: type, lisätiedot: notes },
    }).properties.parking.kind;

    expect(normalize(16865, 'Ei rajoitusta', 'Vain päiväkodin henkilökunnalle')).toBe('restricted');
    expect(normalize(16811, '2h-3h', 'Terveysaseman asiakkaille')).toBe('restricted');
    expect(normalize(16878, 'Lyhytaikainen', 'Kioskin asiakkaille')).toBe('restricted');
    expect(normalize(16888, 'Ei rajoitusta', 'Asiakkaille')).toBe('restricted');
    expect(normalize(17242, 'Ei rajoitusta', 'Maanomistajan luvalla')).toBe('permitOnly');
    expect(normalize(17217, '4h-11h', '1.8.-5.6. vain maanomistajan luvalla ma-pe 7-17')).toBe('permitOnly');
    expect(normalize(17073, '12h-24h', 'Sallittu vain mopoille ja moottoripyörille')).toBe('restricted');
    expect(normalize(26329, '12h-24h', 'Sallittu kuorma-autoille 24h')).toBe('restricted');
    expect(normalize(26153, '12h-24h', 'Raskaan liikenteen pysäköinti')).toBe('restricted');
    expect(normalize(16763, '12h-24h', 'Sallittu vain henkilö- ja pakettiautoille')).toBe('free');
    expect(normalize(16857, '12h-24h', 'Henkilö-, pakettiautojen ja raskaan liikenteen pysäköinti sallittu')).toBe('free');
    expect(normalize(999, 'Ei rajoitusta', '2 ap asiakkaille')).toBe('free');
  });

  it('combines coincident Vantaa rows into time-dependent stay rules', () => {
    const boundary = { type: 'Polygon', coordinates: [[[24.8, 60.25], [24.81, 60.25], [24.81, 60.26], [24.8, 60.25]]] };
    const rows = normalizeVantaaParking({ results: [
      { id: 26257, type: 'street_parking_area', boundary, extra: { katu: 'Karhunkierros', tyyppi: 'Lyhytaikainen', aikarajoitus: '30min', voimassaoloaika: '6-9, 15-18', kiekkopaikka: 'Kyllä', paikkamäärä: 23 } },
      { id: 206562, type: 'street_parking_area', boundary, extra: { katu: 'Karhunkierros', tyyppi: '2h-3h', aikarajoitus: '2h', voimassaoloaika: '9-15', kiekkopaikka: 'Kyllä', paikkamäärä: 23 } },
    ] });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('servicemap:vantaa:combined:26257-206562');
    expect(rows[0].properties.parking).toMatchObject({ kind: 'disc', maxStayMinutes: null, estimatedSpaces: 23 });
    expect(rows[0].properties.parking.stayRules.map((rule) => rule.maxStayMinutes)).toEqual([30, 120]);
  });

  it('builds and filters the paginated Vantaa artifact contract', () => {
    const url = new URL(vantaaParkingUrl('street_parking_area'));
    expect(url.searchParams.get('municipality')).toBe('vantaa');
    expect(url.searchParams.get('geometry')).toBe('true');
    expect(url.searchParams.get('page_size')).toBe('1000');
    const features = parseEspooParkingGml(ESPOO_GML);
    expect(filterFeaturesToBounds(features, { west: 24.695, south: 60.195, east: 24.715, north: 60.215 })).toHaveLength(1);
    expect(filterFeaturesToBounds(features, { west: 25, south: 61, east: 25.1, north: 61.1 })).toEqual([]);
  });

  it('selects cross-border providers and identifies Kauniainen as unsupported for curb rules', () => {
    expect(providerIdsForBounds({ west: 24.80, south: 60.15, east: 24.86, north: 60.22 })).toEqual(['helsinki', 'espoo']);
    expect(providerIdsForBounds({ west: 24.95, south: 60.27, east: 25.02, north: 60.31 })).toEqual(['helsinki', 'vantaa']);
    expect(municipalityForPoint([60.212, 24.727])).toBe('kauniainen');
    expect(municipalityForPoint([60.181, 24.65])).toBe('espoo');
    expect(providerIdsForBounds({ west: 24.71, south: 60.21, east: 24.72, north: 60.218 })).toEqual([]);
    expect(providerIdsForBounds({ west: 24.95, south: 60.17, east: 24.97, north: 60.19 })).toEqual(['helsinki']);
  });

  it('routes the isolated Tampere coverage box to its own provider only', () => {
    expect(providerIdsForBounds({ west: 23.74, south: 61.49, east: 23.77, north: 61.50 })).toEqual(['tampere']);
    expect(municipalityForPoint([61.4947, 23.7517])).toBe('tampere');
    // The metro viewports keep their existing providers and never gain Tampere.
    expect(providerIdsForBounds({ west: 24.95, south: 60.17, east: 24.97, north: 60.19 })).toEqual(['helsinki']);
    expect(municipalityForPoint([60.17, 24.94])).toBe('helsinki');
  });

  it('builds a lon,lat CRS84 BBOX request for the Tampere GeoServer layer', () => {
    const url = new URL(tampereParkingUrl({ west: 23.70, south: 61.49, east: 23.77, north: 61.50 }, 4000));
    expect(url.hostname).toBe('geodata.tampere.fi');
    expect(url.searchParams.get('typeNames')).toBe('liikennealueet:pysakointi_pysakointipaikat_polygon_gk24');
    expect(url.searchParams.get('outputFormat')).toBe('application/json');
    expect(url.searchParams.get('srsName')).toBe('EPSG:4326');
    expect(url.searchParams.get('count')).toBe('4000');
    expect(url.searchParams.get('bbox')).toBe('23.7,61.49,23.77,61.5,urn:ogc:def:crs:OGC:1.3:CRS84');
  });

  it('normalizes Tampere paid, disc, mixed, bus and free rows into the shared contract', () => {
    const features = parseTampereParking(tampereCollection([
      { id: 15, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'maksullinen pysäköinti', maksuvyohyke: 3, osoite: 'Tiiliruukinkatu 14', paikkamaara: 11, suurin_sallittu_pysakointiaika: '10', rajoitus_maksullinen_arkena: '8-18', rajoitus_maksullinen_lauantaina: '8-16', asukas_yrityspysakointialue: 'D', yopysakointikielto: 'ei' },
      { id: 2384, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'kiekkopysäköinti', maksuvyohyke: null, osoite: 'Eino Salmelaisen katu 3', paikkamaara: 2, suurin_sallittu_pysakointiaika: '2', rajoitus_kiekolla_arkena: '8-16' },
      { id: 24, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'kiekkopysäköinti', maksuvyohyke: 3, osoite: 'Mariankatu 39', paikkamaara: 6, suurin_sallittu_pysakointiaika: '0.5', rajoitus_kiekolla_arkena: '7-17', rajoitus_maksullinen_lauantaina: '8-16' },
      { id: 32, kohteen_tyyppi: 'linja-autojen pysäköintialue', rajoitustyyppi: null, osoite: 'Satamakatu 14', paikkamaara: 3 },
      { id: 1358, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: null, osoite: 'Tapionraitti 8', paikkamaara: 18 },
    ]));

    const byId = Object.fromEntries(features.map((feature) => [feature.id, feature.properties.parking]));
    expect(features.map((feature) => feature.id)).toEqual([
      'tampere:pysakointi:15', 'tampere:pysakointi:2384', 'tampere:pysakointi:24', 'tampere:pysakointi:32', 'tampere:pysakointi:1358',
    ]);

    expect(byId['tampere:pysakointi:15']).toMatchObject({
      provider: 'tampere-wfs', municipality: 'tampere', kind: 'paid', hourlyPrice: 1.4, zone: '3',
      permit: 'D', maxStayMinutes: 600, scheduleMeaning: 'charge', estimatedSpaces: 11,
    });
    expect(byId['tampere:pysakointi:15'].schedule.byDay[1]).toEqual([{ start: 480, end: 1080 }]);
    expect(byId['tampere:pysakointi:15'].schedule.byDay[6]).toEqual([{ start: 480, end: 960 }]);
    expect(byId['tampere:pysakointi:15'].schedule.byDay[0]).toEqual([]);

    expect(byId['tampere:pysakointi:2384']).toMatchObject({ kind: 'disc', hourlyPrice: null, zone: null, maxStayMinutes: 120, scheduleMeaning: 'limit' });
    expect(byId['tampere:pysakointi:2384'].schedule.byDay[1]).toEqual([{ start: 480, end: 960 }]);

    expect(byId['tampere:pysakointi:24']).toMatchObject({ kind: 'disc', maxStayMinutes: 30 });
    expect(byId['tampere:pysakointi:24'].schedule.byDay[1]).toEqual([{ start: 420, end: 1020 }]);
    expect(byId['tampere:pysakointi:24'].notes).toContain('Maksullinen osan viikkoa');
    expect(byId['tampere:pysakointi:24'].notes).toContain('la 8-16');

    expect(byId['tampere:pysakointi:32'].kind).toBe('coach');
    expect(byId['tampere:pysakointi:1358']).toMatchObject({ kind: 'free', hourlyPrice: null, maxStayMinutes: null, schedule: null });
  });

  it('keeps Tampere restriction and vehicle types out of ordinary car parking', () => {
    const rows = parseTampereParking(tampereCollection([
      { id: 100, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'vain henkilökunnalle', osoite: 'A' },
      { id: 101, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'yksityisalue', osoite: 'B' },
      { id: 102, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'jakeluliikenne', osoite: 'C' },
      { id: 103, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'asukas- ja yrityspysäköinti', osoite: 'D' },
      // Resident + disc: an ordinary car may still park with a disc.
      { id: 104, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'asukas- ja yrityspysäköinti ja kiekkopysäköinti', suurin_sallittu_pysakointiaika: '2', rajoitus_kiekolla_arkena: '8-16', osoite: 'E' },
      { id: 105, kohteen_tyyppi: 'sähköautojen latauspaikka', rajoitustyyppi: 'kiekkopysäköinti', suurin_sallittu_pysakointiaika: '4', osoite: 'F' },
      { id: 106, kohteen_tyyppi: 'inva- pysäköintialue', rajoitustyyppi: 'kiekkopysäköinti', osoite: 'G' },
      { id: 107, kohteen_tyyppi: 'taksiasema', rajoitustyyppi: null, osoite: 'H' },
      { id: 108, kohteen_tyyppi: 'moottoripyörien pysäköintialue', rajoitustyyppi: null, osoite: 'I' },
      // Special-licence text: an exemption ("… ei koske …") keeps the base disc
      // rule; a bare "Sallittu … luvalla" on an otherwise-free spot is permit-only.
      { id: 109, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: 'kiekkopysäköinti', suurin_sallittu_pysakointiaika: '2', rajoitus_kiekolla_arkena: '8-16', erikoisluvalla_sallittu: 'Aikarajoitus ei koske pysäköintiä erikoisluvalla O2', osoite: 'J' },
      { id: 110, kohteen_tyyppi: 'pysäköintialue', rajoitustyyppi: null, erikoisluvalla_sallittu: 'Sallittu kaupungin erikoisluvalla O', osoite: 'K' },
    ]));
    const kind = Object.fromEntries(rows.map((r) => [r.id, r.properties.parking.kind]));
    expect(kind['tampere:pysakointi:100']).toBe('restricted');
    expect(kind['tampere:pysakointi:101']).toBe('restricted');
    expect(kind['tampere:pysakointi:102']).toBe('loading');
    expect(kind['tampere:pysakointi:103']).toBe('permitOnly');
    expect(kind['tampere:pysakointi:104']).toBe('disc');
    expect(kind['tampere:pysakointi:105']).toBe('charging');
    expect(kind['tampere:pysakointi:106']).toBe('disabled');
    expect(kind['tampere:pysakointi:107']).toBe('taxi');
    expect(kind['tampere:pysakointi:108']).toBe('motorcycle');
    expect(kind['tampere:pysakointi:109']).toBe('disc');
    expect(kind['tampere:pysakointi:110']).toBe('permitOnly');
    // Everything except the disc rows is excluded from the tappable car layer.
    expect(rows.filter((r) => isGeneralParkingFeature(r)).map((r) => r.id)).toEqual(['tampere:pysakointi:104', 'tampere:pysakointi:109']);
  });

  it('routes the Turku coverage box and builds its OGC API request', () => {
    expect(providerIdsForBounds({ west: 22.20, south: 60.43, east: 22.30, north: 60.47 })).toEqual(['turku']);
    expect(municipalityForPoint([60.4518, 22.2666])).toBe('turku');
    const url = new URL(turkuParkingUrl());
    expect(url.hostname).toBe('turku.asiointi.fi');
    expect(url.pathname).toContain('Pysakoinnin_maksuvyohykkeet');
    expect(url.searchParams.get('f')).toBe('json');
  });

  it('normalizes Turku payment zones with price, paid hours and 2-D geometry', () => {
    const features = parseTurkuParking({
      type: 'FeatureCollection',
      features: [
        // Second in source order, first after the numeric id sort.
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[22.25, 60.45, 0], [22.26, 60.45, 0], [22.26, 60.46, 0], [22.25, 60.45, 0]]] }, properties: { maksuvyohyke: '3', maksuvyohykehinta: '0,6 €/h', maksullisuus_arki: '9-18', maksullisuus_lauantai: '9-15', maksullisuus_sunnuntai: 'ei maksua' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[22.25, 60.45], [22.26, 60.45], [22.26, 60.46], [22.25, 60.45]]] }, properties: { maksuvyohyke: '1', maksuvyohykehinta: '3,6 €/h', maksullisuus_arki: '9-20', maksullisuus_lauantai: '9-17', maksullisuus_sunnuntai: 'ei maksua', Lisatieto: 'note' } },
        { type: 'Feature', geometry: null, properties: { maksuvyohyke: '9' } },
      ],
    });

    expect(features.map((feature) => feature.id)).toEqual(['turku:maksuvyohyke:1', 'turku:maksuvyohyke:3']);
    const zone1 = features[0].properties.parking;
    expect(zone1).toMatchObject({ provider: 'turku-ogc', municipality: 'turku', kind: 'paid', hourlyPrice: 3.6, zone: '1', maxStayMinutes: 'unlimited', scheduleMeaning: 'charge' });
    expect(zone1.scheduleLabel).toBe('ma–pe 9-20, la 9-17');
    expect(zone1.schedule.byDay[1]).toEqual([{ start: 540, end: 1200 }]);
    expect(zone1.schedule.byDay[6]).toEqual([{ start: 540, end: 1020 }]);
    expect(zone1.schedule.byDay[0]).toEqual([]);
    // JSON keeps the no-limit sentinel a string; Infinity would serialise to null.
    expect(JSON.parse(JSON.stringify(zone1)).maxStayMinutes).toBe('unlimited');
    // The Z ordinate the OGC API adds is stripped from the stored geometry.
    expect(features[1].geometry.coordinates[0][0]).toEqual([22.25, 60.45]);
  });

  it('normalizes Turku permit districts into resident-overlay features', () => {
    const zones = parseTurkuResidentZones({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[22.25, 60.45, 0], [22.26, 60.45, 0], [22.26, 60.46, 0], [22.25, 60.45, 0]]] }, properties: { Lupapysakointialue: 'Lupapysäköintialue D', Hinta: '24,28€/kk (sis. alv 25.5%)' } },
        { type: 'Feature', geometry: null, properties: { Lupapysakointialue: 'Lupapysäköintialue X' } },
      ],
    });
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({
      id: 'turku:lupavyohyke:D',
      properties: { municipality: 'turku', asukaspysakointitunnus: 'D', permitPrice: '24,28€/kk (sis. alv 25.5%)' },
    });
    // Overlay features carry no `parking` contract — they never become spots.
    expect(zones[0].properties.parking).toBeUndefined();
    // Z ordinate stripped like the paid zones.
    expect(zones[0].geometry.coordinates[0][0]).toEqual([22.25, 60.45]);
    expect(new URL(turkuResidentZonesUrl()).pathname).toContain('Lupapysakointialueet');
  });

  it('ships a valid committed Turku snapshot with payment and permit zones', () => {
    const snapshot = JSON.parse(readFileSync('public/data/turku-parking.json', 'utf8'));
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.features).toHaveLength(3);
    expect(snapshot.features.map((feature) => feature.id).sort()).toEqual(['turku:maksuvyohyke:1', 'turku:maksuvyohyke:2', 'turku:maksuvyohyke:3']);
    snapshot.features.forEach((feature) => {
      const parking = feature.properties.parking;
      expect(parking).toMatchObject({ provider: 'turku-ogc', municipality: 'turku', kind: 'paid', scheduleMeaning: 'charge' });
      expect(typeof parking.hourlyPrice).toBe('number');
      expect(parking.schedule.byDay).toHaveLength(7);
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
    });
    expect(Array.isArray(snapshot.residentZones)).toBe(true);
    expect(snapshot.residentZones.length).toBeGreaterThanOrEqual(1);
    snapshot.residentZones.forEach((feature) => {
      expect(feature.properties.asukaspysakointitunnus).toBeTruthy();
      expect(feature.properties.parking).toBeUndefined();
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
    });
  });

  it('parses regional schedule variants conservatively', () => {
    expect(regionalSchedule('9-21, (9-18), 10-16').byDay[0]).toEqual([{ start: 600, end: 960 }]);
    expect(regionalSchedule('7-19 (9-15)').byDay[6]).toEqual([{ start: 540, end: 900 }]);
    expect(regionalSchedule('check the sign')).toBeNull();
  });

  it('normalizes LIIPI car facilities from the build-time snapshot', () => {
    const rows = liipiFacilities({ results: [{
      id: 444,
      name: { fi: 'Helsingintie', en: 'Helsingintie' },
      location: { type: 'Polygon', bbox: [24.72, 60.21, 24.73, 60.22], coordinates: [] },
      status: 'IN_OPERATION',
      pricingMethod: 'FREE_12H',
      builtCapacity: { CAR: 247, BICYCLE: 72 },
      openingHours: { openNow: false, info: { fi: 'Avoinna aina' }, url: { fi: 'https://example.test/' } },
      paymentInfo: { paymentMethods: ['DEBIT_CARD'] },
    }] }, [60.212, 24.727], 'fi');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'liipi-444', capacity: 247, price: 'Maksuton', maxStayMinutes: 720, openNow: null, source: 'liipi' });
    expect(rows[0].paymentMethods).toEqual(['card']);
  });

  it('qualifies LIIPI paid prices and formats weekly opening hours', () => {
    const rows = liipiFacilities({ results: [{
      id: 1233,
      name: { fi: 'Finnoo', en: 'Finnoo' },
      location: { type: 'Polygon', bbox: [24.70, 60.15, 24.71, 60.16], coordinates: [] },
      status: 'IN_OPERATION',
      pricingMethod: 'PAID_12H',
      builtCapacity: { CAR: 97 },
      pricing: [{ usage: 'PARK_AND_RIDE', capacityType: 'CAR', price: { fi: '2', en: '2' } }],
      paymentInfo: { detail: { fi: 'Vain kertamaksu. 2 € / 12 h + palvelumaksu.', en: '€2 / 12 h plus service fee.' }, paymentMethods: ['MOBILE_PAYMENT'] },
      openingHours: { byDayType: { BUSINESS_DAY: { from: '00', until: '24' }, SATURDAY: { from: '00', until: '24' }, SUNDAY: { from: '00', until: '24' } } },
    }] }, [60.155, 24.705], 'fi');
    expect(rows[0]).toMatchObject({ price: '2 € / 12 h', maxStayMinutes: 720, openingHours: '24/7', openNow: null });

    const tiered = liipiFacilities({ results: [{
      id: 1133,
      name: { en: 'Haarikkokuja P1' },
      location: { type: 'Polygon', bbox: [25.0, 60.3, 25.01, 60.31], coordinates: [] },
      status: 'IN_OPERATION', pricingMethod: 'PAID_16H_24H_48H', builtCapacity: { CAR: 9 },
      paymentInfo: { detail: { en: 'Parking fee 5 €/16 h, 10 €/24 h, 20 €/48 h.' }, paymentMethods: [] },
      openingHours: { byDayType: { BUSINESS_DAY: { from: '06', until: '24' }, SATURDAY: { from: '06', until: '24' }, SUNDAY: { from: '06', until: '24' } } },
    }] }, [60.305, 25.005], 'en');
    expect(tiered[0]).toMatchObject({ price: '5 € / 16 h · 10 € / 24 h · 20 € / 48 h', maxStayMinutes: 2880, openingHours: 'Daily 06–24' });

    const structured = liipiFacilities({ results: [{
      id: 990, name: { en: 'Tapiola Park' },
      location: { type: 'Polygon', bbox: [24.80, 60.17, 24.81, 60.18], coordinates: [] },
      status: 'IN_OPERATION', pricingMethod: 'PAID_12H', builtCapacity: { CAR: 100 },
      pricing: [{ usage: 'PARK_AND_RIDE', capacityType: 'CAR', price: { en: '2' }, priceExtra: '1.5' }],
      paymentInfo: { detail: null, paymentMethods: [] }, openingHours: {},
    }] }, [60.175, 24.805], 'en');
    expect(structured[0]).toMatchObject({ price: '2 € / 12 h', parkingTerms: 'Additional price: 1.5 €' });

    const liipyHours = liipiFacilities({ results: [{
      id: 991, name: { en: 'P+R opening-hours preference' },
      location: { type: 'Polygon', bbox: [24.80, 60.17, 24.81, 60.18], coordinates: [] },
      status: 'IN_OPERATION', pricingMethod: 'FREE_12H', builtCapacity: { CAR: 10 },
      paymentInfo: { detail: null, paymentMethods: [] },
      openingHours: {
        info: { en: 'General facility hours' },
        liipyByDayType: { BUSINESS_DAY: { from: '05', until: '23' }, SATURDAY: { from: '06', until: '22' }, SUNDAY: { from: '07', until: '21' } },
        byDayType: { BUSINESS_DAY: { from: '00', until: '24' }, SATURDAY: { from: '00', until: '24' }, SUNDAY: { from: '00', until: '24' } },
      },
    }] }, [60.175, 24.805], 'en');
    expect(liipyHours[0].openingHours).toBe('Mon–Fri 05–23 · Sat 06–22 · Sun 07–21');

    const blankAndSpacedPrices = liipiFacilities({ results: [{
      id: 992, name: { en: 'Blank price' },
      location: { type: 'Polygon', bbox: [24.80, 60.17, 24.81, 60.18], coordinates: [] },
      status: 'IN_OPERATION', pricingMethod: 'PAID_12H', builtCapacity: { CAR: 10 },
      pricing: [
        { usage: 'PARK_AND_RIDE', capacityType: 'CAR', price: null },
        { usage: 'PARK_AND_RIDE', capacityType: 'CAR', price: { en: '   ' } },
      ],
      paymentInfo: { detail: null, paymentMethods: [] }, openingHours: {},
    }, {
      id: 993, name: { en: 'Spaced price' },
      location: { type: 'Polygon', bbox: [24.81, 60.17, 24.82, 60.18], coordinates: [] },
      status: 'IN_OPERATION', pricingMethod: 'PAID_12H', builtCapacity: { CAR: 10 },
      pricing: [{ usage: 'PARK_AND_RIDE', capacityType: 'CAR', price: { en: ' 2 ' } }],
      paymentInfo: { detail: null, paymentMethods: [] }, openingHours: {},
    }] }, [60.175, 24.805], 'en');
    expect(blankAndSpacedPrices.map((facility) => facility.price)).toEqual(['Free', '2 € / 12 h']);

    const custom = liipiFacilities({ results: [{
      id: 994, name: { en: 'Custom flat price' },
      location: { type: 'Polygon', bbox: [24.81, 60.17, 24.82, 60.18], coordinates: [] },
      status: 'IN_OPERATION', pricingMethod: 'CUSTOM', builtCapacity: { CAR: 10 },
      pricing: [{ usage: 'PARK_AND_RIDE', capacityType: 'CAR', price: { en: ' 2 ' }, priceExtra: ' 0 ', priceOther: ' 0 ' }],
      paymentInfo: { detail: null, paymentMethods: [] }, openingHours: {},
    }] }, [60.175, 24.815], 'en');
    expect(custom[0]).toMatchObject({ price: '2 €', parkingTerms: '' });

    const mixedUse = liipiFacilities({ results: [{
      id: 1009, name: { en: 'Mixed-use facility' },
      location: { type: 'Polygon', bbox: [24.80, 60.17, 24.81, 60.18], coordinates: [] },
      status: 'IN_OPERATION', pricingMethod: 'FREE_12H', builtCapacity: { CAR: 796 },
      pricing: [
        { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'BUSINESS_DAY', maxCapacity: 200 },
        { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'SATURDAY', maxCapacity: 200 },
        { usage: 'COMMERCIAL', capacityType: 'CAR', dayType: 'BUSINESS_DAY', maxCapacity: 596 },
      ],
      unavailableCapacities: [{ usage: 'PARK_AND_RIDE', capacityType: 'CAR', capacity: 12 }],
      paymentInfo: { detail: null, paymentMethods: [] }, openingHours: {},
    }] }, [60.175, 24.805], 'en');
    expect(mixedUse[0].capacity).toBe(188);

    const hertsi = {
      results: [{
        id: 1091, name: { en: 'Hertsi' },
        location: { type: 'Polygon', bbox: [25.03, 60.19, 25.04, 60.20], coordinates: [] },
        status: 'IN_OPERATION', pricingMethod: 'PAID_12H', builtCapacity: { CAR: 100 },
        pricing: [
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'BUSINESS_DAY', time: { from: '05', until: '06' }, maxCapacity: 43, price: { en: '1' } },
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'BUSINESS_DAY', time: { from: '06', until: '17:30' }, maxCapacity: 100, price: { en: '1' } },
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'BUSINESS_DAY', time: { from: '17:30', until: '24' }, maxCapacity: 43, price: { en: '1' } },
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'SATURDAY', time: { from: '05', until: '24' }, maxCapacity: 43, price: { en: '1' } },
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'SUNDAY', time: { from: '05', until: '24' }, maxCapacity: 43, price: { en: '1' } },
        ],
        paymentInfo: { detail: null, paymentMethods: [] }, openingHours: {},
      }],
    };
    const beforeWeekdayPeak = liipiFacilities(hertsi, [60.195, 25.035], 'en', new Date(2026, 7, 17, 5, 30));
    const duringWeekdayPeak = liipiFacilities(hertsi, [60.195, 25.035], 'en', new Date(2026, 7, 17, 12));
    const afterWeekdayPeak = liipiFacilities(hertsi, [60.195, 25.035], 'en', new Date(2026, 7, 17, 18));
    expect(beforeWeekdayPeak[0].capacity).toBe(43);
    expect(duringWeekdayPeak[0].capacity).toBe(100);
    expect(afterWeekdayPeak[0].capacity).toBe(43);

    const scheduled = {
      results: [{
        id: 1233, name: { en: 'Scheduled price and hours' },
        location: { type: 'Polygon', bbox: [24.80, 60.17, 24.81, 60.18], coordinates: [] },
        status: 'IN_OPERATION', pricingMethod: 'PAID_12H', builtCapacity: { CAR: 97 },
        pricing: [
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'BUSINESS_DAY', time: { from: '00', until: '00:30' }, maxCapacity: 97, price: { en: '2' } },
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'BUSINESS_DAY', time: { from: '04:30', until: '24' }, maxCapacity: 97, price: { en: '2' } },
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'SATURDAY', time: { from: '00', until: '24' }, maxCapacity: 97, price: { en: '2' } },
          { usage: 'PARK_AND_RIDE', capacityType: 'CAR', dayType: 'SUNDAY', time: { from: '00', until: '24' }, maxCapacity: 97, price: null },
        ],
        paymentInfo: { detail: null, paymentMethods: [] },
        openingHours: { liipyByDayType: { BUSINESS_DAY: { from: '00', until: '24' }, SATURDAY: { from: '00', until: '24' }, SUNDAY: { from: '00', until: '24' } } },
      }],
    };
    const monday = liipiFacilities(scheduled, [60.175, 24.805], 'en', new Date(2026, 7, 17, 12));
    const mondayClosed = liipiFacilities(scheduled, [60.175, 24.805], 'en', new Date(2026, 7, 17, 3));
    const sunday = liipiFacilities(scheduled, [60.175, 24.805], 'en', new Date(2026, 7, 16, 12));
    expect(monday[0].price).toBe('2 € / 12 h');
    expect(mondayClosed[0].price).toBeNull();
    expect(sunday[0].price).toBe('Free');
    expect(monday[0].openingHours).toBe('Mon–Fri 00–00:30, 04:30–24 · Sat 00–24 · Sun 00–24');
  });

  it('ships Vantaa tiles normalized by the current provider adapter', () => {
    const directory = 'public/data/vantaa-parking';
    const filenames = readdirSync(directory).filter((name) => name.endsWith('.json'));
    const manifest = JSON.parse(readFileSync('public/data/vantaa-parking.json', 'utf8'));
    const seen = new Map();
    const mismatches = [];

    filenames.forEach((filename) => {
      const tile = JSON.parse(readFileSync(`${directory}/${filename}`, 'utf8'));
      tile.features.forEach((feature) => {
        const previous = seen.get(feature.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(feature)) mismatches.push(`${feature.id}: cross-tile payload`);
        seen.set(feature.id, feature);
        if (feature.id.includes(':combined:')) return;

        const parking = feature.properties.parking;
        const extra = { ...feature.properties };
        delete extra.parking;
        delete extra.municipality;
        delete extra.source_modified_at;
        const normalized = normalizeVantaaDivision({
          id: parking.detailRef ?? parking.sourceId,
          type: feature.id.split(':')[2],
          boundary: feature.geometry,
          extra,
          modified_at: feature.properties.source_modified_at,
        }, parking.hourlyPrice);
        if (!normalized || normalized.id !== feature.id || JSON.stringify(normalized.properties.parking) !== JSON.stringify(parking)) {
          mismatches.push(feature.id);
        }
      });
    });

    expect(filenames).toHaveLength(manifest.tiles.length);
    expect(seen.size).toBe(manifest.featureCount);
    expect(mismatches).toEqual([]);
  });
});
