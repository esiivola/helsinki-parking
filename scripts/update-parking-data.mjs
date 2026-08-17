import { mkdir, rename, writeFile } from 'node:fs/promises';

import { normalizeVantaaParking, parseTurkuParking, parseTurkuResidentZones, turkuParkingUrl, turkuResidentZonesUrl } from '../src/parking-providers.js';

const WFS = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
const SERVICE_MAP = 'https://api.hel.fi/servicemap/v2/';
const SERVICE_MAP_FACILITIES = `${SERVICE_MAP}unit/?${new URLSearchParams({
  service: '537,814',
  municipality: 'helsinki,espoo,vantaa,kauniainen',
  page_size: '1000',
})}`;
const SERVICE_MAP_DIVISIONS = `${SERVICE_MAP}administrative_division/`;
const LIIPI_FACILITIES = 'https://parking.fintraffic.fi/api/v1/facilities.json?limit=-1';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const HELSINKI = [60.16986, 24.93838];
const REFERENCE_OUTPUT = new URL('../public/data/parking-reference.json', import.meta.url);
const VANTAA_OUTPUT = new URL('../public/data/vantaa-parking.json', import.meta.url);
const TURKU_OUTPUT = new URL('../public/data/turku-parking.json', import.meta.url);
const VANTAA_TILE_DIRECTORY = new URL('../public/data/vantaa-parking/', import.meta.url);
const VANTAA_TILE_ORIGIN = { longitude: 24.7, latitude: 60.2 };
const VANTAA_TILE_SIZE = { longitude: 0.1, latitude: 0.05 };
const VANTAA_TILE_MAX_X = 4;
const VANTAA_TILE_MAX_Y = 4;

function wfsUrl(layer, count) {
  const query = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: `avoindata:${layer}`,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    count: String(count),
  });
  return `${WFS}?${query}`;
}

function overpassUrl() {
  const [latitude, longitude] = HELSINKI;
  const query = `[out:json][timeout:45];nwr(around:8000,${latitude},${longitude})["amenity"="parking"]["parking"~"underground|multi-storey"];out center tags;`;
  return `${OVERPASS}?${new URLSearchParams({ data: query })}`;
}

function vantaaUrl(type) {
  return `${SERVICE_MAP_DIVISIONS}?${new URLSearchParams({
    type,
    municipality: 'vantaa',
    geometry: 'true',
    page_size: '1000',
  })}`;
}

async function fetchJson(url, timeoutMs = 45000, attempt = 1, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HelsinkiParkingSnapshot/2.0 (+https://esiivola.github.io/helsinki-parking/)',
        ...extraHeaders,
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    if (attempt >= 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return fetchJson(url, timeoutMs, attempt + 1, extraHeaders);
  } finally {
    clearTimeout(timer);
  }
}

function resolvedNext(value, currentUrl) {
  if (!value) return null;
  const next = new URL(value, currentUrl);
  if (next.hostname === 'api.hel.fi') next.protocol = 'https:';
  return next.toString();
}

async function fetchPages(initialUrl, source, maxPages = 20) {
  const seen = new Set();
  const results = [];
  let firstPage = null;
  let next = initialUrl;
  let pageCount = 0;

  while (next) {
    if (seen.has(next)) throw new Error(`${source} returned a pagination loop`);
    if (pageCount >= maxPages) throw new Error(`${source} exceeded ${maxPages} pages`);
    seen.add(next);
    const page = await fetchJson(next, 90000);
    if (!Array.isArray(page?.results)) throw new Error(`${source} returned no results array`);
    if (!firstPage) firstPage = page;
    results.push(...page.results);
    pageCount += 1;
    next = resolvedNext(page.next, next);
  }

  const declaredCount = Number(firstPage?.count);
  if (Number.isFinite(declaredCount) && declaredCount !== results.length) {
    throw new Error(`${source} declared ${declaredCount} rows but pagination returned ${results.length}`);
  }

  return {
    ...(firstPage || {}),
    count: results.length,
    next: null,
    previous: null,
    results,
  };
}

function requireRows(value, field, source) {
  if (!Array.isArray(value?.[field]) || value[field].length === 0) throw new Error(`${source} returned no ${field}`);
  return value;
}

function validPosition(position) {
  return Array.isArray(position)
    && position.length >= 2
    && Number.isFinite(position[0])
    && Number.isFinite(position[1])
    && position[0] >= -180
    && position[0] <= 180
    && position[1] >= -90
    && position[1] <= 90;
}

function validRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(validPosition)) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function validGeometry(geometry) {
  if (geometry?.type === 'Polygon') {
    return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(validRing);
  }
  if (geometry?.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates)
      && geometry.coordinates.length > 0
      && geometry.coordinates.every((polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(validRing));
  }
  return false;
}

function featureBounds(feature) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const collect = (value) => {
    if (!Array.isArray(value)) return;
    if (validPosition(value)) {
      box[0] = Math.min(box[0], value[0]);
      box[1] = Math.min(box[1], value[1]);
      box[2] = Math.max(box[2], value[0]);
      box[3] = Math.max(box[3], value[1]);
      return;
    }
    value.forEach(collect);
  };
  collect(feature?.geometry?.coordinates);
  return box.every(Number.isFinite) ? box : null;
}

function vantaaTiles(features) {
  const tiles = new Map();
  for (let y = 0; y <= VANTAA_TILE_MAX_Y; y += 1) {
    for (let x = 0; x <= VANTAA_TILE_MAX_X; x += 1) {
      tiles.set(`${x}-${y}`, { x, y, features: [] });
    }
  }
  features.forEach((feature) => {
    const box = featureBounds(feature);
    if (!box) throw new Error(`Vantaa parking feature ${feature?.id || '(unknown)'} has no bounds`);
    const minX = Math.floor((box[0] - VANTAA_TILE_ORIGIN.longitude) / VANTAA_TILE_SIZE.longitude);
    const maxX = Math.floor((box[2] - VANTAA_TILE_ORIGIN.longitude) / VANTAA_TILE_SIZE.longitude);
    const minY = Math.floor((box[1] - VANTAA_TILE_ORIGIN.latitude) / VANTAA_TILE_SIZE.latitude);
    const maxY = Math.floor((box[3] - VANTAA_TILE_ORIGIN.latitude) / VANTAA_TILE_SIZE.latitude);
    if (minX < 0 || maxX > VANTAA_TILE_MAX_X || minY < 0 || maxY > VANTAA_TILE_MAX_Y) {
      throw new Error(`Vantaa parking feature ${feature.id} maps outside the fixed tile grid: x=${minX}..${maxX}, y=${minY}..${maxY}`);
    }
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = `${x}-${y}`;
        tiles.get(key).features.push(feature);
      }
    }
  });
  return [...tiles.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function validateFeatures(features, source, { allowEmpty = false } = {}) {
  if (!Array.isArray(features)) throw new Error(`${source} produced no features array`);
  if (!allowEmpty && features.length === 0) throw new Error(`${source} produced no features`);
  const ids = new Set();
  features.forEach((feature, index) => {
    const id = String(feature?.id || '');
    if (!id) throw new Error(`${source} feature ${index} has no id`);
    if (ids.has(id)) throw new Error(`${source} contains duplicate feature id ${id}`);
    if (!validGeometry(feature.geometry)) throw new Error(`${source} feature ${id} has invalid geometry`);
    ids.add(id);
  });
}

function regionalLiipiRows(value) {
  return (value?.results || []).filter((facility) => {
    const capacity = Number(facility?.builtCapacity?.CAR);
    const bbox = facility?.location?.bbox;
    if (!(capacity > 0) || !Array.isArray(bbox) || bbox.length < 4) return false;
    const longitude = (Number(bbox[0]) + Number(bbox[2])) / 2;
    const latitude = (Number(bbox[1]) + Number(bbox[3])) / 2;
    return longitude >= 24.35 && longitude <= 25.40 && latitude >= 60.05 && latitude <= 60.52;
  });
}

function temporaryUrl(output) {
  return new URL(`${output.href}.tmp-${process.pid}-${Date.now()}`);
}

async function stageJson(output, value) {
  const temporary = temporaryUrl(output);
  await writeFile(temporary, `${JSON.stringify(value)}\n`, 'utf8');
  return { temporary, output };
}

async function main() {
  const [
    paymentZones,
    residentZones,
    serviceMapFacilities,
    liipiFacilities,
    vantaaParkingAreas,
    vantaaStreetParkingAreas,
    vantaaPayZones,
    turkuZones,
    turkuResidentZoneRows,
  ] = await Promise.all([
    fetchJson(wfsUrl('Pysakoinnin_maksuvyohykkeet_alue', 20), 30000),
    fetchJson(wfsUrl('Asukas_ja_yrityspysakointivyohykkeet_alue', 40), 30000),
    fetchJson(SERVICE_MAP_FACILITIES, 30000),
    fetchJson(LIIPI_FACILITIES, 60000, 1, { 'Digitraffic-User': 'helsinki-parking' }),
    fetchPages(vantaaUrl('parking_area'), 'Vantaa parking areas'),
    fetchPages(vantaaUrl('street_parking_area'), 'Vantaa street parking areas'),
    fetchPages(vantaaUrl('parking_payzone'), 'Vantaa parking pay zones'),
    fetchJson(turkuParkingUrl(), 45000),
    fetchJson(turkuResidentZonesUrl(), 45000),
  ]);
  const osmFacilities = await fetchJson(overpassUrl(), 60000);

  requireRows(paymentZones, 'features', 'Payment zones');
  requireRows(residentZones, 'features', 'Resident zones');
  requireRows(serviceMapFacilities, 'results', 'Service Map facilities');
  requireRows(liipiFacilities, 'results', 'Fintraffic LIIPI facilities');
  requireRows(vantaaParkingAreas, 'results', 'Vantaa parking areas');
  requireRows(vantaaStreetParkingAreas, 'results', 'Vantaa street parking areas');
  requireRows(vantaaPayZones, 'results', 'Vantaa parking pay zones');
  requireRows(osmFacilities, 'elements', 'OpenStreetMap facilities');
  requireRows(turkuZones, 'features', 'Turku parking zones');
  requireRows(turkuResidentZoneRows, 'features', 'Turku permit zones');

  const regionalLiipi = { ...liipiFacilities, results: regionalLiipiRows(liipiFacilities) };
  regionalLiipi.count = regionalLiipi.results.length;
  requireRows(regionalLiipi, 'results', 'Regional Fintraffic LIIPI facilities');

  const vantaaRows = [
    ...vantaaParkingAreas.results.map((division) => ({ ...division, type: division.type || 'parking_area' })),
    ...vantaaStreetParkingAreas.results.map((division) => ({ ...division, type: division.type || 'street_parking_area' })),
  ];
  const knownVantaaTypes = new Set(['ei rajoitusta', '4h-11h', '2h-3h', 'lyhytaikainen', '12h-24h', 'varattu päivisin', 'maksullinen', 'muu']);
  const unexpectedTypes = new Set(vantaaRows.map((division) => String(division.extra?.tyyppi || '').trim().toLowerCase()).filter((type) => type && !knownVantaaTypes.has(type)));
  if (unexpectedTypes.size) throw new Error(`Vantaa parking returned unknown types: ${[...unexpectedTypes].join(', ')}`);
  const payZones = vantaaPayZones.results.map((division) => ({ ...division, type: division.type || 'parking_payzone' }));
  const vantaaFeatures = normalizeVantaaParking({ results: vantaaRows }, payZones);
  validateFeatures(vantaaFeatures, 'Vantaa parking');

  const turkuFeatures = parseTurkuParking(turkuZones);
  validateFeatures(turkuFeatures, 'Turku parking');
  const turkuResidentZones = parseTurkuResidentZones(turkuResidentZoneRows);
  validateFeatures(turkuResidentZones, 'Turku permit zones');

  const generatedAt = new Date().toISOString();
  const source = {
    name: 'Helsinki metropolitan area Service Map',
    url: SERVICE_MAP_DIVISIONS,
    license: 'CC BY 4.0',
  };
  const tiles = vantaaTiles(vantaaFeatures);
  const vantaaParking = {
    schemaVersion: 2,
    generatedAt,
    type: 'FeatureCollectionIndex',
    source,
    featureCount: vantaaFeatures.length,
    tiles: tiles.map(({ x, y, features }) => ({
      path: `data/vantaa-parking/tile-${x}-${y}.json`,
      bounds: {
        west: VANTAA_TILE_ORIGIN.longitude + x * VANTAA_TILE_SIZE.longitude,
        south: VANTAA_TILE_ORIGIN.latitude + y * VANTAA_TILE_SIZE.latitude,
        east: VANTAA_TILE_ORIGIN.longitude + (x + 1) * VANTAA_TILE_SIZE.longitude,
        north: VANTAA_TILE_ORIGIN.latitude + (y + 1) * VANTAA_TILE_SIZE.latitude,
      },
      featureCount: features.length,
    })),
  };
  const turkuParking = {
    schemaVersion: 1,
    generatedAt,
    type: 'FeatureCollection',
    source: { name: 'City of Turku open data', url: turkuParkingUrl(), license: 'CC BY 4.0' },
    features: turkuFeatures,
    residentZones: turkuResidentZones,
  };
  const snapshot = {
    schemaVersion: 2,
    generatedAt,
    paymentZones,
    residentZones,
    serviceMapFacilities,
    liipiFacilities: regionalLiipi,
    osmFacilities,
    parkingArtifacts: {
      vantaa: {
        path: 'data/vantaa-parking.json',
        featureCount: vantaaFeatures.length,
        tileCount: tiles.length,
      },
      turku: {
        path: 'data/turku-parking.json',
        featureCount: turkuFeatures.length,
        residentZoneCount: turkuResidentZones.length,
      },
    },
  };

  await mkdir(new URL('.', REFERENCE_OUTPUT), { recursive: true });
  await mkdir(VANTAA_TILE_DIRECTORY, { recursive: true });
  const tileFiles = tiles.map(({ x, y, features }) => {
    validateFeatures(features, `Vantaa parking tile ${x}-${y}`, { allowEmpty: true });
    return stageJson(new URL(`tile-${x}-${y}.json`, VANTAA_TILE_DIRECTORY), {
      schemaVersion: 1,
      generatedAt,
      type: 'FeatureCollection',
      source,
      features,
    });
  });
  const staged = await Promise.all([
    stageJson(REFERENCE_OUTPUT, snapshot),
    stageJson(VANTAA_OUTPUT, vantaaParking),
    stageJson(TURKU_OUTPUT, turkuParking),
    ...tileFiles,
  ]);
  for (const file of staged) await rename(file.temporary, file.output);
  console.log(`Updated ${REFERENCE_OUTPUT.pathname}`);
  console.log(`Updated ${VANTAA_OUTPUT.pathname} (${vantaaFeatures.length} features in ${tiles.length} tiles)`);
  console.log(`Updated ${TURKU_OUTPUT.pathname} (${turkuFeatures.length} paid zones, ${turkuResidentZones.length} permit zones)`);
}

await main();
