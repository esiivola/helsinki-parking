import { mkdir, writeFile } from 'node:fs/promises';

const WFS = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
const SERVICE_MAP_FACILITIES = 'https://api.hel.fi/servicemap/v2/unit/?service=537&municipality=helsinki&page_size=200';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const HELSINKI = [60.16986, 24.93838];
const OUTPUT = new URL('../public/data/parking-reference.json', import.meta.url);

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

async function fetchJson(url, timeoutMs = 45000, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HelsinkiParkingSnapshot/1.0 (+https://esiivola.github.io/helsinki-parking/)',
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    if (attempt >= 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return fetchJson(url, timeoutMs, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

function requireRows(value, field, source) {
  if (!Array.isArray(value?.[field]) || value[field].length === 0) throw new Error(`${source} returned no ${field}`);
  return value;
}

async function main() {
  const [paymentZones, residentZones, serviceMapFacilities] = await Promise.all([
    fetchJson(wfsUrl('Pysakoinnin_maksuvyohykkeet_alue', 20), 30000),
    fetchJson(wfsUrl('Asukas_ja_yrityspysakointivyohykkeet_alue', 40), 30000),
    fetchJson(SERVICE_MAP_FACILITIES, 30000),
  ]);
  const osmFacilities = await fetchJson(overpassUrl(), 60000);

  requireRows(paymentZones, 'features', 'Payment zones');
  requireRows(residentZones, 'features', 'Resident zones');
  requireRows(serviceMapFacilities, 'results', 'Service Map facilities');
  requireRows(osmFacilities, 'elements', 'OpenStreetMap facilities');

  const snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    paymentZones,
    residentZones,
    serviceMapFacilities,
    osmFacilities,
  };

  await mkdir(new URL('.', OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot)}\n`, 'utf8');
  console.log(`Updated ${OUTPUT.pathname}`);
}

await main();
