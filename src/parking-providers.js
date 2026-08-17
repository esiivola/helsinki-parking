// Provider-specific adapters for Helsinki metropolitan-area parking data.
// Every adapter emits ordinary GeoJSON plus a `properties.parking` contract so
// regional records never fall through to Helsinki's tariffs or default hours.

export const MUNICIPALITY_COVERAGE = {
  helsinki: { west: 24.75, south: 60.13, east: 25.30, north: 60.34 },
  espoo: { west: 24.43, south: 60.10, east: 24.90, north: 60.38 },
  vantaa: { west: 24.77, south: 60.24, east: 25.22, north: 60.46 },
  kauniainen: { west: 24.64, south: 60.18, east: 24.79, north: 60.25 },
  // Isolated cities outside the metropolitan area. Their open parking rules
  // come from each city's own machine-readable service, and the boxes below only
  // decide when to query that service and how to label the map centre — they
  // never infer a rule. Kept as coverage rectangles rather than exact municipal
  // borders because the cities are far from the metro area and from each other.
  tampere: { west: 23.60, south: 61.42, east: 23.98, north: 61.56 },
  turku: { west: 22.14, south: 60.40, east: 22.36, north: 60.50 },
};

// Simplified official municipality boundaries from Service Map's `muni`
// divisions (origin IDs 49, 91, 92 and 235). They only select a data provider
// and the Kauniainen capability notice; they never infer a parking rule.
const MUNICIPALITY_BOUNDARIES = {
  espoo: { type: 'MultiPolygon', coordinates: [[[[24.831403,60.254055],[24.841913,60.2212],[24.848062,60.2186],[24.846211,60.210572],[24.842797,60.19576],[24.844412,60.165584],[24.835671,60.130414],[24.782805,60.09996],[24.942299,59.922489],[24.831664,59.901087],[24.745414,60.008021],[24.68185,60.051737],[24.644655,60.092136],[24.654747,60.106169],[24.626771,60.14928],[24.604817,60.158306],[24.587783,60.165302],[24.572292,60.172619],[24.569053,60.179302],[24.536214,60.196464],[24.524747,60.205349],[24.503201,60.212863],[24.525406,60.231022],[24.525024,60.246582],[24.504336,60.25543],[24.504449,60.274086],[24.515569,60.281292],[24.512038,60.291734],[24.500169,60.326289],[24.562672,60.314085],[24.595654,60.324185],[24.614089,60.344366],[24.627694,60.359241],[24.664705,60.36277],[24.683964,60.357999],[24.702266,60.35346],[24.749283,60.341783],[24.746237,60.322274],[24.760928,60.325376],[24.771802,60.299231],[24.764941,60.271237],[24.784754,60.241505],[24.831403,60.254055]],[[24.675287,60.211031],[24.677472,60.215397],[24.706264,60.225008],[24.715896,60.224721],[24.73432,60.224171],[24.744871,60.220382],[24.750914,60.218211],[24.739162,60.20711],[24.722176,60.202563],[24.70182,60.206242],[24.675287,60.211031]]]] },
  helsinki: { type: 'MultiPolygon', coordinates: [[[[25.19025,60.285681],[25.196279,60.281962],[25.21336,60.290124],[25.22952,60.29784],[25.252892,60.297459],[25.254495,60.295226],[25.253889,60.289631],[25.243865,60.284883],[25.244127,60.278341],[25.252291,60.275751],[25.250902,60.273519],[25.234846,60.271963],[25.22734,60.261104],[25.237452,60.256269],[25.240914,60.246318],[25.226258,60.239731],[25.204389,60.229895],[25.201423,60.218205],[25.220404,60.199737],[25.194217,60.146658],[25.176785,60.093496],[25.158561,59.942453],[24.942299,59.922489],[24.782805,60.09996],[24.835671,60.130414],[24.844412,60.165584],[24.842797,60.19576],[24.846211,60.210572],[24.848062,60.2186],[24.841913,60.2212],[24.831403,60.254055],[24.838646,60.259098],[24.857816,60.253608],[24.872417,60.254143],[24.892824,60.268532],[24.91895,60.273417],[24.927796,60.27507],[24.945653,60.278404],[24.956263,60.276343],[24.965876,60.266308],[24.975627,60.264975],[24.97734,60.26856],[24.982291,60.278917],[25.000148,60.286318],[25.020906,60.289318],[25.053391,60.276016],[25.076645,60.275551],[25.088002,60.271247],[25.082436,60.2497],[25.091377,60.245184],[25.135844,60.237228],[25.159883,60.248817],[25.156817,60.254514],[25.144627,60.25924],[25.142535,60.269779],[25.187656,60.279881],[25.19025,60.285681]]]] },
  vantaa: { type: 'MultiPolygon', coordinates: [[[[25.19025,60.285681],[25.187656,60.279881],[25.142535,60.269779],[25.144627,60.25924],[25.156817,60.254514],[25.159883,60.248817],[25.135844,60.237228],[25.091377,60.245184],[25.082436,60.2497],[25.088002,60.271247],[25.076645,60.275551],[25.053391,60.276016],[25.020906,60.289318],[25.000148,60.286318],[24.982291,60.278917],[24.97734,60.26856],[24.975627,60.264975],[24.965876,60.266308],[24.956263,60.276343],[24.945653,60.278404],[24.927796,60.27507],[24.91895,60.273417],[24.892824,60.268532],[24.872417,60.254143],[24.857816,60.253608],[24.838646,60.259098],[24.831403,60.254055],[24.784754,60.241505],[24.764941,60.271237],[24.771802,60.299231],[24.760928,60.325376],[24.746237,60.322274],[24.749283,60.341783],[24.830456,60.394459],[24.868939,60.401255],[24.868688,60.400046],[24.867615,60.394885],[24.876725,60.38473],[24.905964,60.365123],[24.906898,60.364496],[24.954591,60.332449],[24.984009,60.332928],[25.003892,60.333247],[25.037645,60.342303],[25.048226,60.348276],[25.049221,60.348838],[25.021178,60.367869],[25.0313,60.371585],[25.049185,60.370509],[25.064405,60.369592],[25.066497,60.370178],[25.068742,60.370806],[25.076236,60.372904],[25.084598,60.372212],[25.090379,60.366299],[25.115361,60.360566],[25.151731,60.35928],[25.134435,60.348494],[25.152407,60.34613],[25.152021,60.340266],[25.143236,60.335347],[25.128396,60.334907],[25.117454,60.33561],[25.102188,60.335248],[25.135651,60.320481],[25.169614,60.311486],[25.193068,60.292247],[25.19025,60.285681]]]] },
  kauniainen: { type: 'MultiPolygon', coordinates: [[[[24.675287,60.211031],[24.677472,60.215397],[24.706264,60.225008],[24.715896,60.224721],[24.73432,60.224171],[24.744871,60.220382],[24.750914,60.218211],[24.739162,60.20711],[24.722176,60.202563],[24.70182,60.206242],[24.675287,60.211031]]]] },
};

const ESPOO_WFS = 'https://kartat.espoo.fi/teklaogcweb/wfs.ashx';
const SERVICE_MAP_DIVISIONS = 'https://api.hel.fi/servicemap/v2/administrative_division/';

function boundsIntersect(a, b) {
  return Boolean(a && b) && a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;
}

function pointInBounds(point, bounds) {
  return point[0] >= bounds.west && point[0] <= bounds.east && point[1] >= bounds.south && point[1] <= bounds.north;
}

function orientation(a, b, c) {
  return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
}

function segmentsIntersect(a, b, c, d) {
  return orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b);
}

function geometryIntersectsBounds(geometry, bounds) {
  if (!geometry || !bounds) return false;
  const corners = [
    [bounds.west, bounds.south], [bounds.east, bounds.south],
    [bounds.east, bounds.north], [bounds.west, bounds.north],
  ];
  if (corners.some((corner) => pointInGeometry(corner, geometry))) return true;
  const rectangleEdges = corners.map((corner, index) => [corner, corners[(index + 1) % corners.length]]);
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates || [];
  return polygons.some((polygon) => polygon.some((ring) => ring.some((point, index) => {
    if (pointInBounds(point, bounds)) return true;
    if (!index) return false;
    return rectangleEdges.some(([start, end]) => segmentsIntersect(ring[index - 1], point, start, end));
  })));
}

export function providerIdsForBounds(bounds) {
  const providers = [];
  if (geometryIntersectsBounds(MUNICIPALITY_BOUNDARIES.helsinki, bounds)) providers.push('helsinki');
  if (geometryIntersectsBounds(MUNICIPALITY_BOUNDARIES.espoo, bounds)) providers.push('espoo');
  if (geometryIntersectsBounds(MUNICIPALITY_BOUNDARIES.vantaa, bounds)) providers.push('vantaa');
  if (boundsIntersect(bounds, MUNICIPALITY_COVERAGE.tampere)) providers.push('tampere');
  if (boundsIntersect(bounds, MUNICIPALITY_COVERAGE.turku)) providers.push('turku');
  return providers;
}

export function municipalityForPoint(point) {
  if (!Array.isArray(point) || point.length < 2) return null;
  const latitude = Number(point[0]);
  const longitude = Number(point[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const coordinate = [longitude, latitude];
  if (pointInGeometry(coordinate, MUNICIPALITY_BOUNDARIES.kauniainen)) return 'kauniainen';
  if (pointInGeometry(coordinate, MUNICIPALITY_BOUNDARIES.espoo)) return 'espoo';
  if (pointInGeometry(coordinate, MUNICIPALITY_BOUNDARIES.vantaa)) return 'vantaa';
  if (pointInGeometry(coordinate, MUNICIPALITY_BOUNDARIES.helsinki)) return 'helsinki';
  if (pointInBounds(coordinate, MUNICIPALITY_COVERAGE.tampere)) return 'tampere';
  if (pointInBounds(coordinate, MUNICIPALITY_COVERAGE.turku)) return 'turku';
  return null;
}

export function espooParkingUrl(bounds, count = 2000) {
  const spatial = bounds ? `<ogc:BBOX><ogc:PropertyName>Geometry</ogc:PropertyName><gml:Envelope srsName="EPSG:4326"><gml:lowerCorner>${bounds.west} ${bounds.south}</gml:lowerCorner><gml:upperCorner>${bounds.east} ${bounds.north}</gml:upperCorner></gml:Envelope></ogc:BBOX>` : '';
  const comparison = '<ogc:PropertyIsGreaterThan><ogc:PropertyName>PARKINGSPACES</ogc:PropertyName><ogc:Literal>0</ogc:Literal></ogc:PropertyIsGreaterThan>';
  const filter = `<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml">${spatial ? `<ogc:And>${comparison}${spatial}</ogc:And>` : comparison}</ogc:Filter>`;
  const query = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typeName: 'GIS:InfStreet',
    outputFormat: 'GML2',
    srsName: 'EPSG:4326',
    maxFeatures: String(count),
    filter,
  });
  return `${ESPOO_WFS}?${query}`;
}

export function vantaaParkingUrl(type = 'parking_area') {
  const query = new URLSearchParams({ type, municipality: 'vantaa', geometry: 'true', page_size: '1000' });
  return `${SERVICE_MAP_DIVISIONS}?${query}`;
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '').trim();
}

function tagPattern(name, flags = 'i') {
  return new RegExp(`<(?:(?:[\\w.-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${name}>`, flags);
}

function tagValue(block, name) {
  const match = tagPattern(name).exec(block);
  return match ? decodeXml(match[1]) : '';
}

function numeric(value) {
  const result = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(result) ? result : 0;
}

function parseCoordinateTuples(block) {
  const coordinates = tagPattern('coordinates').exec(block);
  if (coordinates) {
    return decodeXml(coordinates[1]).split(/\s+/).map((tuple) => {
      const values = tuple.split(',').map(Number);
      return values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1]) ? [values[0], values[1]] : null;
    }).filter(Boolean);
  }
  const posList = tagPattern('posList').exec(block);
  if (!posList) return [];
  const values = decodeXml(posList[1]).split(/\s+/).map(Number).filter(Number.isFinite);
  const dimensionMatch = /srsDimension=["'](\d+)["']/i.exec(posList[0]);
  const dimension = Number(dimensionMatch?.[1]) || (values.length % 3 === 0 ? 3 : 2);
  const points = [];
  for (let index = 0; index + 1 < values.length; index += dimension) points.push([values[index], values[index + 1]]);
  return points;
}

function parseBoundary(block, name) {
  const match = tagPattern(name).exec(block);
  return match ? parseCoordinateTuples(match[1]) : [];
}

function parsePolygon(block) {
  const outer = parseBoundary(block, 'outerBoundaryIs');
  if (outer.length < 3) return null;
  const rings = [outer];
  const innerPattern = tagPattern('innerBoundaryIs', 'gi');
  let inner = innerPattern.exec(block);
  while (inner) {
    const ring = parseCoordinateTuples(inner[1]);
    if (ring.length >= 3) rings.push(ring);
    inner = innerPattern.exec(block);
  }
  return rings;
}

function parseGmlGeometry(block) {
  const polygons = [];
  const pattern = tagPattern('Polygon', 'gi');
  let match = pattern.exec(block);
  while (match) {
    const polygon = parsePolygon(match[1]);
    if (polygon) polygons.push(polygon);
    match = pattern.exec(block);
  }
  if (!polygons.length) return null;
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons };
}

function emptySchedule(source) {
  return { byDay: [[], [], [], [], [], [], []], source };
}

function copyRanges(ranges) {
  return ranges.map((range) => ({ start: range.start, end: range.end }));
}

function parseTimeRanges(value) {
  const ranges = [];
  const normalized = String(value || '').replace(/alkaa\s*/gi, '').replace(/p[äa][äa]ttyy\s*/gi, '');
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

export function regionalSchedule(value) {
  const source = String(value || '').replace(/\s+/g, ' ').trim();
  if (!source) return null;
  const namedDays = /kaikkina viikonp[äa]ivin[äa]|joka p[äa]iv[äa]|ma\s*[-–]\s*su/i.test(source) ? [0, 1, 2, 3, 4, 5, 6]
    : /ma\s*[-–]\s*la/i.test(source) ? [1, 2, 3, 4, 5, 6]
      : /ma\s*[-–]\s*pe|arki/i.test(source) ? [1, 2, 3, 4, 5] : null;
  if (namedDays) {
    const ranges = parseTimeRanges(source);
    if (!ranges.length) return null;
    const schedule = emptySchedule(source);
    namedDays.forEach((day) => { schedule.byDay[day] = copyRanges(ranges); });
    return schedule;
  }
  const saturday = /\(([^)]*)\)/.exec(source);
  const weekdayText = saturday ? source.slice(0, saturday.index).replace(/,\s*$/, '') : source;
  const afterSaturday = saturday ? source.slice(saturday.index + saturday[0].length).replace(/^\s*,\s*/, '') : '';
  const weekday = parseTimeRanges(weekdayText);
  const saturdayRanges = saturday ? parseTimeRanges(saturday[1]) : [];
  const sunday = afterSaturday ? parseTimeRanges(afterSaturday) : [];
  if (!weekday.length && !saturdayRanges.length && !sunday.length) return null;
  const schedule = emptySchedule(source);
  for (let day = 1; day <= 5; day += 1) schedule.byDay[day] = copyRanges(weekday);
  schedule.byDay[6] = saturdayRanges;
  schedule.byDay[0] = sunday;
  return schedule;
}

function complementSchedule(value) {
  if (!value) return null;
  const result = emptySchedule(value.source);
  const allowedByDay = Array.from({ length: 7 }, () => []);
  for (let day = 0; day < 7; day += 1) {
    value.byDay[day].forEach((range) => {
      if (range.end > range.start) allowedByDay[day].push({ start: range.start, end: range.end });
      else {
        allowedByDay[day].push({ start: range.start, end: 1440 });
        allowedByDay[(day + 1) % 7].push({ start: 0, end: range.end });
      }
    });
  }
  for (let day = 0; day < 7; day += 1) {
    const allowed = allowedByDay[day].sort((a, b) => a.start - b.start).reduce((merged, range) => {
      const last = merged[merged.length - 1];
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
      else merged.push({ ...range });
      return merged;
    }, []);
    const prohibited = [];
    let cursor = 0;
    allowed.forEach((range) => {
      if (range.start > cursor) prohibited.push({ start: cursor, end: range.start });
      cursor = Math.max(cursor, range.end);
    });
    if (cursor < 1440) prohibited.push({ start: cursor, end: 1440 });
    result.byDay[day] = prohibited;
  }
  return result;
}

function espooPaidSchedule(zone) {
  const schedule = emptySchedule(zone === '1' ? 'ma–pe 8–20, la–su 8–18' : 'ma–pe 8–20, la 8–18');
  for (let day = 1; day <= 5; day += 1) schedule.byDay[day] = [{ start: 480, end: 1200 }];
  schedule.byDay[6] = [{ start: 480, end: 1080 }];
  if (zone === '1') schedule.byDay[0] = [{ start: 480, end: 1080 }];
  return schedule;
}

function espooTimeRules(value) {
  const source = String(value || '').replace(/\s+/g, ' ').trim();
  const stayRules = [];
  source.split(';').forEach((part) => {
    const duration = /aikarajoite\s*(\d+(?:[,.]\d+)?)\s*(h|min)/i.exec(part);
    if (!duration) return;
    const amount = Number(duration[1].replace(',', '.'));
    const maxStayMinutes = Math.round(amount * (/^h$/i.test(duration[2]) ? 60 : 1));
    const ranges = parseTimeRanges(part);
    if (!ranges.length) {
      stayRules.push({ maxStayMinutes, schedule: null });
      return;
    }
    const lower = part.toLowerCase();
    const days = /sunnuntai|\bsu\b/.test(lower) ? [0]
      : /lauantai|\blau\b|\bla\b/.test(lower) ? [6]
        : /arki|maanantai|ma\s*[-–]\s*pe/.test(lower) ? [1, 2, 3, 4, 5]
          : /kaikkina viikonp[äa]ivin[äa]|ma\s*[-–]\s*su/.test(lower) ? [0, 1, 2, 3, 4, 5, 6] : [];
    const schedule = emptySchedule(part.trim());
    days.forEach((day) => { schedule.byDay[day] = copyRanges(ranges); });
    stayRules.push({ maxStayMinutes, schedule: days.length ? schedule : null });
  });
  const always = stayRules.filter((rule) => !rule.schedule).map((rule) => rule.maxStayMinutes);
  return {
    maxStayMinutes: /ei\s+aikarajoit/i.test(source) ? Infinity : always.length ? Math.min(...always) : stayRules.length === 1 ? stayRules[0].maxStayMinutes : null,
    stayRules,
  };
}

function positiveFlag(value) {
  const text = String(value || '').trim().toLowerCase();
  return numeric(value) > 0 || (Boolean(text) && !['0', 'ei', 'no', 'false', 'null'].includes(text));
}

function normalizeEspooProperties(properties, geometry, gmlId) {
  const capacity = numeric(properties.PARKINGSPACES);
  if (capacity <= 0 || positiveFlag(properties.PARKINGPROHIBITED)) return null;
  const estimatedSpaces = capacity;
  const feeDescription = properties.PARKINGFEEDESCRIPTION || '';
  const paid = numeric(properties.PARKINGFEE) > 0 || /€|eur/i.test(feeDescription);
  const zoneMatch = /vy[öo]hyke\s*(\d+)/i.exec(feeDescription);
  const priceMatch = /(\d+(?:[,.]\d+)?)\s*(?:€|eur)\s*\/\s*h/i.exec(feeDescription);
  const structuredZone = String(properties.PARKINGFEE || '').trim();
  const zone = /^[12]$/.test(structuredZone) ? structuredZone : zoneMatch?.[1] || null;
  const timeRules = espooTimeRules(properties.PARKINGTIMES);
  const sourceId = properties.ID || properties.RPASTREETPARTID || gmlId || properties.LABEL;
  const parking = {
    provider: 'espoo-wfs',
    municipality: 'espoo',
    sourceId: String(sourceId || ''),
    kind: paid ? 'paid' : 'free',
    hourlyPrice: paid && priceMatch ? Number(priceMatch[1].replace(',', '.')) : null,
    zone,
    permit: '',
    maxStayMinutes: paid ? timeRules.maxStayMinutes : (timeRules.maxStayMinutes ?? (positiveFlag(properties.SHORTSTAYPARKING) ? 60 : null)),
    maxStayAssumed: !paid && timeRules.maxStayMinutes === null && positiveFlag(properties.SHORTSTAYPARKING),
    stayRules: timeRules.stayRules,
    schedule: paid && zone ? espooPaidSchedule(zone) : null,
    scheduleLabel: properties.PARKINGTIMES || '',
    scheduleMeaning: paid ? 'charge' : 'limit',
    rawLabel: feeDescription || properties.PARKINGTIMES || properties.LABEL || '',
    notes: properties.PARKINGTIMES || '',
    estimatedSpaces,
    attribution: 'City of Espoo / HRI, CC BY 4.0',
  };
  return {
    type: 'Feature',
    id: `espoo:InfStreet:${sourceId}`,
    geometry,
    properties: { ...properties, municipality: 'espoo', parking },
  };
}

export function parseEspooParkingGml(xml) {
  const text = String(xml || '');
  if (/ServiceException|ExceptionReport|ExceptionText/i.test(text)) {
    const message = tagValue(text, 'ServiceException') || tagValue(text, 'ExceptionText') || 'request failed';
    throw new Error(`Espoo WFS: ${message}`);
  }
  const features = [];
  const members = tagPattern('featureMember', 'gi');
  const fields = ['ID', 'RPASTREETPARTID', 'LABEL', 'USETYPETEXT', 'PARKINGSPACES', 'PARKINGTIMES', 'PARKINGFEE', 'PARKINGFEEDESCRIPTION', 'PARKINGPROHIBITED', 'SHORTSTAYPARKING', 'DISABLEDPARKINGSPACES', 'CARSHARINGPARKINGSPACES', 'MOTORCYCLEPARKINGSPACES', 'BUSPARKINGSPACES', 'TRUCKPARKINGSPACES', 'EVCHARGERS', 'PARKANDRIDEPARKINGSPACES'];
  let member = members.exec(text);
  while (member) {
    const block = member[1];
    const geometry = parseGmlGeometry(block);
    if (geometry) {
      const properties = {};
      fields.forEach((field) => { const value = tagValue(block, field); if (value !== '') properties[field] = value; });
      const idMatch = /\bgml:id=["']([^"']+)["']/i.exec(block);
      const gmlId = idMatch ? idMatch[1].replace(/^.*\./, '') : '';
      const feature = normalizeEspooProperties(properties, geometry, gmlId);
      if (feature) features.push(feature);
    }
    member = members.exec(text);
  }
  return features;
}

const TAMPERE_WFS = 'https://geodata.tampere.fi/geoserver/liikennealueet/ows';
const TAMPERE_PARKING_LAYER = 'liikennealueet:pysakointi_pysakointipaikat_polygon_gk24';
// Tampere's WFS publishes only the payment-zone id, not the euro tariff. These
// are the City of Tampere published on-street rates (€/h) per zone, effective
// 1 Feb 2025; refresh them if the city changes its tariffs. This mirrors the
// zone→price convention the Helsinki layer already relies on.
const TAMPERE_ZONE_PRICE = { 1: 3.5, 2: 2.2, 3: 1.4 };

export function tampereParkingUrl(bounds, count = 4000) {
  const query = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: TAMPERE_PARKING_LAYER,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    count: String(count),
  });
  // EPSG:4326 GeoJSON comes back in lon,lat order; pinning the BBOX to the CRS84
  // URN keeps the filter in that same lon,lat order so the two never disagree.
  if (bounds) query.set('bbox', `${bounds.west},${bounds.south},${bounds.east},${bounds.north},urn:ogc:def:crs:OGC:1.3:CRS84`);
  return `${TAMPERE_WFS}?${query}`;
}

function trimText(value) {
  return String(value ?? '').trim();
}

// `suurin_sallittu_pysakointiaika` is a bare hour count as text: "10", "2",
// "0.5" (= 30 min). Anything non-positive means the layer states no limit.
function tampereMaxStayMinutes(value) {
  const hours = Number(trimText(value).replace(',', '.'));
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null;
}

// Tampere and Turku both list a window per day type as text ("8-18", "9-20").
// Build the shared byDay schedule the rules engine reads (index 0 = Sunday), and
// only name days that actually parsed to hours so sentinels like "ei maksua"
// (no charge) drop out of the label instead of reading as a time window.
function paidHoursSchedule(weekdayText, saturdayText, sundayText) {
  const weekday = parseTimeRanges(weekdayText);
  const saturday = parseTimeRanges(saturdayText);
  const sunday = parseTimeRanges(sundayText);
  if (!weekday.length && !saturday.length && !sunday.length) return { schedule: null, label: '' };
  const label = [
    weekday.length && `ma–pe ${trimText(weekdayText)}`,
    saturday.length && `la ${trimText(saturdayText)}`,
    sunday.length && `su ${trimText(sundayText)}`,
  ].filter(Boolean).join(', ');
  return { schedule: { byDay: [sunday, weekday, weekday, weekday, weekday, weekday, saturday], source: label }, label };
}

function tampereHasSchedule(...values) {
  return values.some((value) => trimText(value));
}

// `kohteen_tyyppi` names the space's vehicle/use group. A non-car group wins over
// the pricing rule and maps to a kind outside PARKABLE_KINDS, so EV, disabled,
// taxi, motorcycle and bus bays never surface as ordinary car parking.
function tampereVehicleKind(kohteenTyyppi) {
  if (/linja-auto|kuorma-auto|matkailu/.test(kohteenTyyppi)) return 'coach';
  if (/taksi/.test(kohteenTyyppi)) return 'taxi';
  if (/moottoripy/.test(kohteenTyyppi)) return 'motorcycle';
  if (/\binva/.test(kohteenTyyppi)) return 'disabled';
  if (/lataus|s[äa]hk[öo]auto/.test(kohteenTyyppi)) return 'charging';
  return null;
}

// `rajoitustyyppi` restriction classes that keep ordinary cars out. "asukas- ja
// yrityspysäköinti" alone is permit-only, but combined with disc ("… ja
// kiekkopysäköinti") ordinary cars may still park with a disc, so that case
// falls through to the disc rule below.
function tampereRestrictedKind(rajoitustyyppi) {
  if (/henkil[öo]kunnalle/.test(rajoitustyyppi)) return 'restricted';
  if (/yksityisalue/.test(rajoitustyyppi)) return 'restricted';
  if (/jakeluliikenne/.test(rajoitustyyppi)) return 'loading';
  if (/palvelubusseille/.test(rajoitustyyppi)) return 'coach';
  if (/varattu\s+yritykselle/.test(rajoitustyyppi)) return 'permitOnly';
  if (/asukas-?\s*ja\s*yrityspys/.test(rajoitustyyppi) && !/kiekko/.test(rajoitustyyppi)) return 'permitOnly';
  return null;
}

// `erikoisluvalla_sallittu` is free text. "Sallittu … luvalla" / "Vain …" /
// "Varattu …" restricts a space to permit holders, while "… ei koske …" only
// exempts them from the base rule and leaves ordinary parking intact. It is read
// only when no `rajoitustyyppi` already governs the space.
function tamperePermitOnly(value) {
  if (!value || value === '-') return false;
  if (/ei\s+koske/.test(value)) return false;
  return /\b(?:vain|varattu)\b/.test(value) || /\bsallittu\b/.test(value) || /luvalla\b|tunnuksella\b/.test(value);
}

// Uncertain rows resolve to the stricter reading, matching the Helsinki and
// Vantaa adapters: a vehicle/use group first, then a named restriction, then the
// paid/disc rule, then a permit-only special licence, and only otherwise free.
function tampereKind(properties) {
  const vehicle = tampereVehicleKind(trimText(properties.kohteen_tyyppi).toLowerCase());
  if (vehicle) return vehicle;
  const restriction = trimText(properties.rajoitustyyppi).toLowerCase();
  const restricted = tampereRestrictedKind(restriction);
  if (restricted) return restricted;
  if (/maksullinen/.test(restriction)) return 'paid';
  if (/kiekko/.test(restriction)) return 'disc';
  if (tampereHasSchedule(properties.rajoitus_maksullinen_arkena, properties.rajoitus_maksullinen_lauantaina, properties.rajoitus_maksullinen_sunnuntaina)) return 'paid';
  if (tampereHasSchedule(properties.rajoitus_kiekolla_arkena, properties.rajoitus_kiekolla_lauantaina, properties.rajoitus_kiekolla_sunnuntaina)) return 'disc';
  if (tamperePermitOnly(trimText(properties.erikoisluvalla_sallittu).toLowerCase())) return 'permitOnly';
  return 'free';
}

function normalizeTampereFeature(feature) {
  const geometry = feature?.geometry;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return null;
  const properties = feature.properties || {};
  const sourceId = properties.id ?? feature.id;
  if (sourceId === undefined || sourceId === null || sourceId === '') return null;
  const kind = tampereKind(properties);
  const zoneValue = properties.maksuvyohyke;
  const zone = zoneValue !== null && zoneValue !== undefined && zoneValue !== '' ? String(zoneValue) : null;
  const paid = paidHoursSchedule(properties.rajoitus_maksullinen_arkena, properties.rajoitus_maksullinen_lauantaina, properties.rajoitus_maksullinen_sunnuntaina);
  const disc = paidHoursSchedule(properties.rajoitus_kiekolla_arkena, properties.rajoitus_kiekolla_lauantaina, properties.rajoitus_kiekolla_sunnuntaina);
  const active = kind === 'paid' ? paid : kind === 'disc' ? disc : { schedule: null, label: '' };
  const estimated = Number(properties.paikkamaara);
  const notes = [
    trimText(properties.rajoitusten_lisatiedot),
    trimText(properties.lisatietoa),
    // A disc bay that is also chargeable on some days: name the paid window so
    // the sign, not this single "disc" label, is trusted for those hours.
    kind === 'disc' && paid.schedule ? `Maksullinen osan viikkoa (${paid.label})` : '',
    positiveFlag(properties.yopysakointikielto) ? 'Yöpysäköinti kielletty' : '',
    trimText(properties.talvikunnossapitorajoitus) ? `Talvikunnossapito: ${trimText(properties.talvikunnossapitorajoitus)}` : '',
  ].filter(Boolean).join(' · ');
  return {
    type: 'Feature',
    id: `tampere:pysakointi:${sourceId}`,
    geometry,
    properties: {
      ...properties,
      municipality: 'tampere',
      parking: {
        provider: 'tampere-wfs',
        municipality: 'tampere',
        sourceId: String(sourceId),
        kind,
        hourlyPrice: kind === 'paid' && zone !== null && Object.prototype.hasOwnProperty.call(TAMPERE_ZONE_PRICE, zone) ? TAMPERE_ZONE_PRICE[zone] : null,
        zone,
        permit: trimText(properties.asukas_yrityspysakointialue),
        maxStayMinutes: tampereMaxStayMinutes(properties.suurin_sallittu_pysakointiaika),
        maxStayAssumed: false,
        stayRules: [],
        schedule: active.schedule,
        scheduleLabel: active.label,
        scheduleMeaning: kind === 'paid' ? 'charge' : 'limit',
        rawLabel: [trimText(properties.rajoitustyyppi) || trimText(properties.kohteen_tyyppi), trimText(properties.osoite)].filter(Boolean).join(' · '),
        notes,
        estimatedSpaces: Number.isFinite(estimated) && estimated > 0 ? estimated : null,
        attribution: 'City of Tampere / geodata.tampere.fi, CC BY 4.0',
      },
    },
  };
}

export function parseTampereParking(data) {
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map(normalizeTampereFeature).filter(Boolean);
}

// Turku's OGC API Features endpoint blocks cross-origin browser reads, so its
// paid-parking zones are fetched server-side by the update script and shipped as
// a static snapshot. The layer is three large payment-zone polygons (I/II/III)
// carrying the euro tariff and the paid hours per day type — the same zone-level
// shape as Helsinki's payment zones, drawn here as ordinary tappable areas.
const TURKU_OGC = 'https://turku.asiointi.fi/trimbleogcapi';
const TURKU_ZONE_COLLECTION = 'GIS:Pysakoinnin_maksuvyohykkeet';

export function turkuParkingUrl(limit = 1000) {
  return `${TURKU_OGC}/collections/${encodeURIComponent(TURKU_ZONE_COLLECTION)}/items?f=json&limit=${limit}`;
}

// `maksuvyohykehinta` is text like "3,6 €/h"; take the leading euro amount.
function turkuHourlyPrice(value) {
  const match = /(\d+(?:[.,]\d+)?)\s*€/.exec(String(value ?? ''));
  return match ? Number(match[1].replace(',', '.')) : null;
}

// Drop any Z ordinate the OGC API includes so the stored geometry stays 2-D.
function geometryTo2D(geometry) {
  const ring = (points) => points.map((point) => [point[0], point[1]]);
  if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: geometry.coordinates.map(ring) };
  if (geometry.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geometry.coordinates.map((polygon) => polygon.map(ring)) };
  return geometry;
}

function normalizeTurkuZone(feature) {
  const geometry = feature?.geometry;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return null;
  const properties = feature.properties || {};
  const zone = trimText(properties.maksuvyohyke);
  if (!zone) return null;
  const paid = paidHoursSchedule(properties.maksullisuus_arki, properties.maksullisuus_lauantai, properties.maksullisuus_sunnuntai);
  return {
    type: 'Feature',
    id: `turku:maksuvyohyke:${zone}`,
    geometry: geometryTo2D(geometry),
    properties: {
      municipality: 'turku',
      parking: {
        provider: 'turku-ogc',
        municipality: 'turku',
        sourceId: zone,
        kind: 'paid',
        hourlyPrice: turkuHourlyPrice(properties.maksuvyohykehinta),
        zone,
        permit: '',
        // The zone layer names no maximum stay; paying keeps the space, so the
        // serialisable sentinel renders as "no time limit".
        maxStayMinutes: 'unlimited',
        maxStayAssumed: false,
        stayRules: [],
        schedule: paid.schedule,
        scheduleLabel: paid.label,
        scheduleMeaning: 'charge',
        rawLabel: `Maksuvyöhyke ${zone}`,
        notes: trimText(properties.Lisatieto),
        estimatedSpaces: null,
        attribution: 'City of Turku, CC BY 4.0',
      },
    },
  };
}

export function parseTurkuParking(data) {
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map(normalizeTurkuZone).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

// Turku's `GIS:Lupapysakointialueet` are the resident/company permit districts
// (A–M). They are informational overlays — a permit lets residents park here; a
// visitor still follows the underlying paid/free rule — so they render like
// Helsinki's resident-zone overlay, not as their own parkable areas.
const TURKU_RESIDENT_COLLECTION = 'GIS:Lupapysakointialueet';

export function turkuResidentZonesUrl(limit = 1000) {
  return `${TURKU_OGC}/collections/${encodeURIComponent(TURKU_RESIDENT_COLLECTION)}/items?f=json&limit=${limit}`;
}

// "Lupapysäköintialue D" → "D"; fall back to the whole trimmed string.
function turkuZoneCode(value) {
  const text = trimText(value);
  const match = /([A-ZÅÄÖ0-9]+)\s*$/.exec(text);
  return match ? match[1] : text;
}

function normalizeTurkuResidentZone(feature) {
  const geometry = feature?.geometry;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return null;
  const properties = feature.properties || {};
  const code = turkuZoneCode(properties.Lupapysakointialue);
  if (!code) return null;
  return {
    type: 'Feature',
    id: `turku:lupavyohyke:${code}`,
    geometry: geometryTo2D(geometry),
    properties: {
      municipality: 'turku',
      // The resident-zone overlay reads this field for its label.
      asukaspysakointitunnus: code,
      permitPrice: trimText(properties.Hinta),
      attribution: 'City of Turku, CC BY 4.0',
    },
  };
}

export function parseTurkuResidentZones(data) {
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map(normalizeTurkuResidentZone).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function durationMinutes(value) {
  const text = String(value || '').trim().toLowerCase().replace(',', '.');
  if (!text) return null;
  const hours = /(\d+(?:\.\d+)?)\s*h/.exec(text);
  const minutes = /(\d+)\s*min/.exec(text);
  if (!hours && !minutes) return null;
  return Math.round((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
}

function vantaaKind(type, disc) {
  const value = String(type || '').trim().toLowerCase();
  if (/maksullinen/.test(value)) return 'paid';
  if (/varattu\s+p[äa]ivisin/.test(value)) return 'offPeak';
  if (/ei\s+(?:aika)?rajoitusta/.test(value)) return 'free';
  if (/lyhytaikainen|\d+\s*h\s*[-–]\s*\d+\s*h/.test(value)) return disc ? 'disc' : 'free';
  return 'unknown';
}

function vantaaMaxStay(extra, type) {
  const exact = durationMinutes(extra.aikarajoitus);
  if (exact !== null) return { minutes: exact, assumed: false };
  const numericHours = Number(extra.aikarajoitus_num);
  if (Number.isFinite(numericHours) && numericHours > 0) return { minutes: numericHours * 60, assumed: false };
  const value = String(type || '').toLowerCase();
  // JSON cannot preserve Infinity; this serializable sentinel is deliberately
  // non-numeric and is rendered by the shared rules as "no time limit".
  if (/varattu\s+p[äa]ivisin/.test(value)) return { minutes: 'unlimited', assumed: false };
  if (/ei\s+(?:aika)?rajoitusta/.test(value)) return { minutes: 'unlimited', assumed: false };
  if (/12\s*h\s*[-–]\s*24\s*h/.test(value)) return { minutes: 720, assumed: true };
  if (/4\s*h\s*[-–]\s*11\s*h/.test(value)) return { minutes: 240, assumed: true };
  if (/2\s*h\s*[-–]\s*3\s*h/.test(value)) return { minutes: 120, assumed: true };
  if (/lyhytaikainen/.test(value)) return { minutes: 60, assumed: true };
  return { minutes: null, assumed: false };
}

function vantaaPublishedPrice(extra) {
  const text = [extra?.['lisätiedot'], extra?.lisatiedot, extra?.hintatiedot].filter(Boolean).join(' ');
  const hourly = /(\d+(?:[,.]\d+)?)\s*€\s*\/?\s*(?:h|tunti)/i.exec(text);
  return {
    hourlyPrice: hourly ? Number(hourly[1].replace(',', '.')) : null,
    hasNonHourlyPrice: /\d+(?:[,.]\d+)?\s*€\s*\/\s*(?:kk|vrk|p[äa]iv|day|month)/i.test(text),
  };
}

function vantaaRestrictionKind(notes) {
  const text = String(notes || '');
  const permitExemption = /\b(?:aikarajoitus|maksu|maksullisuus)\s+ei\s+koske\b[^.]*maanomistaja(?:n)?\s+luvalla/i.test(text);
  const permitRequired = /maanomistaja(?:n)?\s+luvalla/i.test(text) && (!permitExemption || /\bvain\b[^.]*maanomistaja(?:n)?\s+luvalla/i.test(text));
  if (permitRequired) return 'permitOnly';

  const partialReservation = /\b\d+\s*(?:ap|autopaikkaa?|paikkaa?)\s+(?:varattu\b|(?:henkil[öo]kunnalle|asiakkaille|asioiville|k[äa]ytt[öo][öo]n|k[äa]ytt[äa]jille|p[äa]iv[äa]kodille)\b)/i.test(text);
  const wholeNoteCustomerOnly = /^\s*(?:[a-zåäö-]+n\s+)?asiakkaille\s*[.!]?\s*$/i.test(text);
  const recipientOnly = !partialReservation
    && (wholeNoteCustomerOnly || /\b(?:vain|varattu)\b[^.]*\b(?:henkil[öo]kunnalle|asiakkaille|asioiville|k[äa]ytt[öo][öo]n|k[äa]ytt[äa]jille|p[äa]iv[äa]kodille)\b/i.test(text));
  if (recipientOnly) return 'restricted';

  const ordinaryCarAllowed = /henkil[öo](?:auto(?:ille|jen)?|\s*-\s*,?\s*(?:ja\s+)?pakettiauto(?:ille|jen))|(?:^|[\s,(])autoille\b/i.test(text);
  const otherVehicleOnly = !ordinaryCarAllowed && (
    /\bsallittu(?:\s+vain)?\b[^.]*\b(?:pakettiautoille|mopoille|moottoripy[öo]rille|kuorma-autoille)\b/i.test(text)
    || /\braskaan\s+liikenteen\s+pys[äa]k[öo]inti\s+sallittu\b/i.test(text)
    || /^\s*raskaan\s+liikenteen\s+pys[äa]k[öo]inti\s*[.!]?\s*$/i.test(text)
  );
  return otherVehicleOnly ? 'restricted' : null;
}

function sanitizeVantaaScheduleNote(notes) {
  return String(notes || '')
    .replace(/\b\d{1,2}\.\d{1,2}\.?\s*[-–]\s*\d{1,2}\.\d{1,2}\.?/g, ' ')
    .replace(/(\d{1,2})\s*[-–]\s*\.\s*(\d{1,2})/g, '$1-$2')
    .replace(/\s+/g, ' ').trim();
}

function vantaaOffPeakRule(notes, fallbackSchedule, fallbackLabel) {
  const noteSource = sanitizeVantaaScheduleNote(notes);
  const noteSchedule = regionalSchedule(noteSource);
  const accessRestricted = Boolean(vantaaRestrictionKind(notes));
  const explicitlyProhibited = /kiel{1,2}etty|varattu/i.test(notes) || accessRestricted;
  const explicitlyAllowed = /sallittu/i.test(notes) && !explicitlyProhibited;
  if (noteSchedule && (explicitlyProhibited || explicitlyAllowed)) {
    const noteHasDayScope = /kaikkina viikonp[äa]ivin[äa]|joka p[äa]iv[äa]|ma\s*[-–]\s*(?:su|la|pe)|arki|arkisin|lauantai|sunnuntai/i.test(noteSource);
    const noteRanges = parseTimeRanges(noteSource);
    const fallbackRanges = parseTimeRanges(fallbackLabel);
    const sameRanges = JSON.stringify(noteRanges) === JSON.stringify(fallbackRanges);
    const ruleSchedule = fallbackSchedule && !noteHasDayScope && sameRanges ? fallbackSchedule : noteSchedule;
    return {
      schedule: explicitlyAllowed ? complementSchedule(ruleSchedule) : ruleSchedule,
      label: String(notes || ''),
    };
  }
  return { schedule: fallbackSchedule, label: String(fallbackLabel || '') };
}

export function normalizeVantaaDivision(division, hourlyPrice = null) {
  const geometry = division?.boundary;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return null;
  const extra = division.extra || {};
  const disc = /kyll[äa]|yes|true|^1$/i.test(String(extra.kiekkopaikka || ''));
  const baseKind = vantaaKind(extra.tyyppi, disc);
  if (baseKind === 'unknown') return null;
  const stay = vantaaMaxStay(extra, extra.tyyppi);
  const scheduleSource = extra.voimassaoloaika;
  const parsedSchedule = regionalSchedule(scheduleSource);
  const notes = String(extra['lisätiedot'] || extra.lisatiedot || '').trim();
  const kind = baseKind === 'offPeak' ? baseKind : vantaaRestrictionKind(notes) || baseKind;
  const offPeakRule = baseKind === 'offPeak' ? vantaaOffPeakRule(notes, parsedSchedule, scheduleSource) : null;
  const schedule = offPeakRule?.schedule || parsedSchedule;
  const sourceId = division.id ?? division.origin_id;
  const rawLabel = [extra.katu, extra.tyyppi].filter(Boolean).join(' · ');
  const publishedPrice = vantaaPublishedPrice(extra);
  const joinedPrice = publishedPrice.hourlyPrice ?? (!publishedPrice.hasNonHourlyPrice ? hourlyPrice : null);
  const stayRules = Number.isFinite(stay.minutes)
    ? [{ maxStayMinutes: stay.minutes, maxStayAssumed: stay.assumed, schedule: parsedSchedule }]
    : [];
  return {
    type: 'Feature',
    id: `servicemap:vantaa:${division.type || 'parking_area'}:${sourceId}`,
    geometry,
    properties: {
      ...extra,
      municipality: 'vantaa',
      source_modified_at: division.modified_at || '',
      parking: {
        provider: 'service-map',
        municipality: 'vantaa',
        sourceId: String(sourceId ?? ''),
        detailRef: division.id || null,
        kind,
        hourlyPrice: kind === 'paid' && Number.isFinite(joinedPrice) ? joinedPrice : null,
        zone: null,
        permit: '',
        maxStayMinutes: stay.minutes,
        maxStayAssumed: stay.assumed,
        stayRules,
        schedule,
        scheduleLabel: offPeakRule?.label || String(scheduleSource || ''),
        scheduleMeaning: kind === 'paid' ? 'charge' : kind === 'offPeak' ? 'prohibition' : 'limit',
        rawLabel,
        notes,
        estimatedSpaces: extra['paikkamäärä'] !== null && extra['paikkamäärä'] !== '' && Number.isFinite(Number(extra['paikkamäärä'])) ? Number(extra['paikkamäärä']) : null,
        attribution: 'Helsinki metropolitan area Service Map, CC BY 4.0',
      },
    },
  };
}

function allText(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => allText(item, output));
  else if (value && typeof value === 'object') Object.keys(value).forEach((key) => allText(value[key], output));
  return output;
}

export function vantaaPayZonePrice(zone) {
  const match = /(\d+(?:[,.]\d+)?)\s*€\s*\/?\s*(?:h|tunti)/i.exec(allText({ name: zone?.name, extra: zone?.extra }).join(' '));
  return match ? Number(match[1].replace(',', '.')) : null;
}

function ringContains(point, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const a = ring[current];
    const b = ring[previous];
    if (((a[1] > point[1]) !== (b[1] > point[1])) && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / ((b[1] - a[1]) || Number.EPSILON) + a[0]) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some((polygon) => ringContains(point, polygon[0]) && !polygon.slice(1).some((hole) => ringContains(point, hole)));
}

function geometryBounds(geometry) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const collect = (value) => {
    if (!Array.isArray(value)) return;
    if (Number.isFinite(value[0]) && Number.isFinite(value[1])) {
      box[0] = Math.min(box[0], value[0]); box[1] = Math.min(box[1], value[1]);
      box[2] = Math.max(box[2], value[0]); box[3] = Math.max(box[3], value[1]);
      return;
    }
    value.forEach(collect);
  };
  collect(geometry?.coordinates);
  return box.every(Number.isFinite) ? box : null;
}

function geometryCenter(geometry) {
  const supplied = Array.isArray(geometry?.bbox) ? geometry.bbox : null;
  const box = supplied && supplied.length >= 4 ? supplied : geometryBounds(geometry);
  return box ? [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] : null;
}

function geometryRings(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.flatMap((polygon) => polygon || []);
}

function geometriesIntersect(first, second) {
  const firstBox = geometryBounds(first);
  const secondBox = geometryBounds(second);
  if (!firstBox || !secondBox || !boundsIntersect(
    { west: firstBox[0], south: firstBox[1], east: firstBox[2], north: firstBox[3] },
    { west: secondBox[0], south: secondBox[1], east: secondBox[2], north: secondBox[3] },
  )) return false;
  const firstRings = geometryRings(first);
  const secondRings = geometryRings(second);
  if (firstRings.some((ring) => ring.some((point) => pointInGeometry(point, second)))) return true;
  if (secondRings.some((ring) => ring.some((point) => pointInGeometry(point, first)))) return true;
  return firstRings.some((firstRing) => secondRings.some((secondRing) => firstRing.some((point, firstIndex) => firstIndex > 0 && secondRing.some((other, secondIndex) => secondIndex > 0 && segmentsIntersect(firstRing[firstIndex - 1], point, secondRing[secondIndex - 1], other)))));
}

function joinUniqueText(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].join(' · ');
}

function mergeCoincidentVantaaFeatures(features) {
  const groups = new Map();
  features.forEach((feature) => {
    const key = JSON.stringify(feature.geometry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(feature);
  });
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const first = group[0];
    const parkingRows = group.map((feature) => feature.properties.parking);
    const rules = parkingRows.flatMap((parking) => parking.stayRules || []).filter((rule, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(rule)) === index);
    const sourceIds = parkingRows.map((parking) => parking.sourceId).sort((a, b) => String(a).localeCompare(String(b), 'en', { numeric: true }));
    const kinds = [...new Set(parkingRows.map((parking) => parking.kind))];
    const kind = kinds.length === 1 ? kinds[0] : ['permitOnly', 'restricted', 'paid', 'offPeak', 'disc', 'free'].find((candidate) => kinds.includes(candidate)) || 'unknown';
    const sameRule = rules.length <= 1;
    return {
      ...first,
      id: `servicemap:vantaa:combined:${sourceIds.join('-')}`,
      properties: {
        ...first.properties,
        parking: {
          ...first.properties.parking,
          sourceId: sourceIds.join(','),
          detailRef: null,
          kind,
          maxStayMinutes: sameRule ? first.properties.parking.maxStayMinutes : null,
          maxStayAssumed: sameRule ? first.properties.parking.maxStayAssumed : false,
          stayRules: rules,
          schedule: sameRule ? first.properties.parking.schedule : null,
          scheduleLabel: joinUniqueText(parkingRows.map((parking) => parking.scheduleLabel)),
          rawLabel: joinUniqueText(parkingRows.map((parking) => parking.rawLabel)),
          notes: joinUniqueText(parkingRows.map((parking) => parking.notes)),
          estimatedSpaces: Math.max(...parkingRows.map((parking) => Number(parking.estimatedSpaces) || 0)) || null,
        },
      },
    };
  });
}

export function normalizeVantaaParking(data, payZones = []) {
  const features = (data?.results || []).map((division) => {
    const zone = payZones.find((candidate) => geometriesIntersect(division.boundary, candidate.boundary));
    return normalizeVantaaDivision(division, zone ? vantaaPayZonePrice(zone) : null);
  }).filter(Boolean);
  return mergeCoincidentVantaaFeatures(features);
}

export function filterFeaturesToBounds(features, bounds) {
  if (!bounds) return features || [];
  return (features || []).filter((feature) => {
    const box = geometryBounds(feature?.geometry);
    return box && boundsIntersect(bounds, { west: box[0], south: box[1], east: box[2], north: box[3] });
  });
}

function localized(value, lang) {
  if (typeof value === 'string') return value;
  return value?.[lang] || value?.fi || value?.sv || value?.en || '';
}

function distanceMeters(a, b) {
  const radius = 6371000;
  const radians = (value) => (value * Math.PI) / 180;
  const latitude = radians(b[0] - a[0]);
  const longitude = radians(b[1] - a[1]);
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(longitude / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function qualifiedPrices(value) {
  const text = String(value || '').replace(/\s+/g, ' ');
  const prices = [];
  const patterns = [
    /(\d+(?:[,.]\d+)?)\s*€\s*\/\s*(\d+(?:[,.]\d+)?)\s*h/gi,
    /€\s*(\d+(?:[,.]\d+)?)\s*\/\s*(\d+(?:[,.]\d+)?)\s*h/gi,
  ];
  patterns.forEach((pattern) => {
    let match = pattern.exec(text);
    while (match) {
      const label = `${match[1]} € / ${match[2]} h`;
      if (!prices.includes(label)) prices.push(label);
      match = pattern.exec(text);
    }
  });
  return prices;
}

function liipiMaximumStayMinutes(method) {
  const hours = [];
  const pattern = /(\d+)H/g;
  let match = pattern.exec(String(method || ''));
  while (match) {
    hours.push(Number(match[1]));
    match = pattern.exec(String(method || ''));
  }
  return hours.length ? Math.max(...hours) * 60 : null;
}

function liipiCarPricingRows(facility) {
  return (facility?.pricing || []).filter((row) => row.capacityType === 'CAR' && row.usage === 'PARK_AND_RIDE');
}

function liipiClockMinutes(value) {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes >= 60 || (hours === 24 && minutes !== 0)) return null;
  return hours * 60 + minutes;
}

function liipiTimeRange(value) {
  const start = liipiClockMinutes(value?.from);
  const end = liipiClockMinutes(value?.until);
  return start === null || end === null ? null : { start, end };
}

function liipiDayType(date) {
  const day = date.getDay();
  return day === 0 ? 'SUNDAY' : day === 6 ? 'SATURDAY' : 'BUSINESS_DAY';
}

function liipiRowsAt(facility, date) {
  const rows = liipiCarPricingRows(facility);
  const scheduled = rows.filter((row) => row.dayType && liipiTimeRange(row.time));
  if (!scheduled.length) return rows;
  const selected = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  const minute = selected.getHours() * 60 + selected.getMinutes();
  const dayType = liipiDayType(selected);
  return rows.filter((row) => {
    const range = liipiTimeRange(row.time);
    if (!row.dayType || !range) return true;
    if (row.dayType !== dayType) return false;
    if (range.end > range.start) return minute >= range.start && minute < range.end;
    return minute >= range.start || minute < range.end;
  });
}

function liipiPrice(facility, lang, date) {
  const method = String(facility.pricingMethod || '');
  if (method === 'PARK_AND_RIDE_247_FREE') return lang === 'fi' ? 'Maksuton' : 'Free';
  const free = /^FREE_(\d+)H$/.exec(method);
  if (free) return lang === 'fi' ? 'Maksuton' : 'Free';
  const allRows = liipiCarPricingRows(facility);
  const rows = liipiRowsAt(facility, date);
  const hasScheduledRows = allRows.some((row) => row.dayType && liipiTimeRange(row.time));
  if (hasScheduledRows && !rows.length) return null;
  const values = rows.map((row) => String(localized(row.price, lang) ?? '').trim()).filter(Boolean);
  if (rows.some((row) => row.price === null) && !values.length) return lang === 'fi' ? 'Maksuton' : 'Free';
  const detail = localized(facility.paymentInfo?.detail, lang);
  const detailedPrices = qualifiedPrices(detail);
  if (detailedPrices.length) return detailedPrices.join(' · ');
  const methodHours = /^PAID_(\d+)H/.exec(method)?.[1];
  const prices = [];
  rows.forEach((row) => {
    const value = String(localized(row.price, lang) ?? '').trim();
    if (!value) return;
    const numericPrice = Number(value.replace(',', '.'));
    const amount = lang === 'fi' ? value.replace('.', ',') : value.replace(',', '.');
    const label = Number.isFinite(numericPrice) && methodHours ? `${amount} € / ${methodHours} h`
      : Number.isFinite(numericPrice) ? `${amount} €`
        : /€/.test(value) ? value : '';
    if (label && !prices.includes(label)) prices.push(label);
  });
  if (prices.length) return prices.join(' · ');
  return /^PAID_/.test(method) ? (lang === 'fi' ? 'Maksullinen' : 'Paid') : null;
}

function formatLiipiClock(value) {
  if (value === 1440) return '24';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : String(hours).padStart(2, '0');
}

function mergeLiipiRanges(ranges) {
  return ranges.sort((a, b) => a.start - b.start || a.end - b.end).reduce((merged, range) => {
    const last = merged[merged.length - 1];
    if (last && last.end > last.start && range.end > range.start && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else if (!last || last.start !== range.start || last.end !== range.end) merged.push({ ...range });
    return merged;
  }, []);
}

function liipiOpeningHours(facility, lang) {
  const openingHours = facility?.openingHours;
  const info = localized(openingHours?.info, lang);
  const byDay = {};
  liipiCarPricingRows(facility).forEach((row) => {
    const range = liipiTimeRange(row.time);
    if (!row.dayType || !range) return;
    if (!byDay[row.dayType]) byDay[row.dayType] = [];
    byDay[row.dayType].push(range);
  });
  if (!Object.keys(byDay).length) {
    const summary = openingHours?.liipyByDayType || openingHours?.byDayType;
    Object.entries(summary || {}).forEach(([dayType, value]) => {
      const range = liipiTimeRange(value);
      if (range) byDay[dayType] = [range];
    });
  }
  const formatRanges = (ranges) => mergeLiipiRanges(ranges || [])
    .map((range) => `${formatLiipiClock(range.start)}–${formatLiipiClock(range.end)}`)
    .join(', ');
  const weekday = formatRanges(byDay.BUSINESS_DAY);
  const saturday = formatRanges(byDay.SATURDAY);
  const sunday = formatRanges(byDay.SUNDAY);
  if (weekday === '00–24' && saturday === weekday && sunday === weekday) return '24/7';
  if (weekday && weekday === saturday && weekday === sunday) return `${lang === 'fi' ? 'Joka päivä' : 'Daily'} ${weekday}`;
  return [
    weekday && `${lang === 'fi' ? 'Ma–pe' : 'Mon–Fri'} ${weekday}`,
    saturday && `${lang === 'fi' ? 'la' : 'Sat'} ${saturday}`,
    sunday && `${lang === 'fi' ? 'su' : 'Sun'} ${sunday}`,
  ].filter(Boolean).join(' · ') || info;
}

function liipiPaymentMethods(methods) {
  const map = { DEBIT_CARD: 'card', CREDIT_CARD: 'card', CONTACTLESS: 'card', COINS: 'cash', NOTES: 'cash', MOBILE_PAYMENT: 'app' };
  const output = [];
  (methods || []).forEach((method) => { const value = map[method]; if (value && !output.includes(value)) output.push(value); });
  return output;
}

function liipiTerms(facility, lang) {
  const detail = localized(facility.paymentInfo?.detail, lang).trim();
  if (qualifiedPrices(detail).length) return detail;
  const extras = [];
  (facility.pricing || []).forEach((row) => {
    if (row.capacityType !== 'CAR' || row.usage !== 'PARK_AND_RIDE') return;
    [['extra', row.priceExtra], ['other', row.priceOther]].forEach(([kind, value]) => {
      const rawValue = String(value ?? '').trim();
      if (!rawValue) return;
      const number = Number(rawValue.replace(',', '.'));
      if (Number.isFinite(number) && number === 0) return;
      const localizedAmount = lang === 'fi' ? rawValue.replace('.', ',') : rawValue.replace(',', '.');
      const amount = Number.isFinite(number) ? `${localizedAmount} €` : rawValue;
      const label = kind === 'extra'
        ? `${lang === 'fi' ? 'Lisähinta' : 'Additional price'}: ${amount}`
        : `${lang === 'fi' ? 'Muu hinta' : 'Other price'}: ${amount}`;
      if (!extras.includes(label)) extras.push(label);
    });
  });
  return [detail, ...extras].filter(Boolean).join(' · ');
}

function liipiCarCapacity(facility, date) {
  const selectedCapacities = liipiRowsAt(facility, date)
    .map((row) => Number(row.maxCapacity))
    .filter((capacity) => Number.isFinite(capacity) && capacity > 0);
  const fallbackCapacities = liipiCarPricingRows(facility)
    .map((row) => Number(row.maxCapacity))
    .filter((capacity) => Number.isFinite(capacity) && capacity > 0);
  const unavailable = (facility?.unavailableCapacities || [])
    .filter((row) => row.capacityType === 'CAR' && row.usage === 'PARK_AND_RIDE')
    .reduce((total, row) => total + (Number(row.capacity) || 0), 0);
  const capacity = selectedCapacities.length ? Math.max(...selectedCapacities)
    : fallbackCapacities.length ? Math.max(...fallbackCapacities)
      : Number(facility?.builtCapacity?.CAR);
  return Number.isFinite(capacity) ? Math.max(0, capacity - unavailable) : capacity;
}

export function liipiFacilities(data, origin, lang = 'fi', date = new Date()) {
  const rows = Array.isArray(data) ? data : data?.results || [];
  return rows.map((facility) => {
    const capacity = liipiCarCapacity(facility, date);
    const center = geometryCenter(facility?.location);
    if (!(capacity > 0) || !center) return null;
    const point = [center[1], center[0]];
    const inactive = ['INACTIVE', 'TEMPORARILY_CLOSED'].includes(facility.status);
    const paymentDetail = localized(facility.paymentInfo?.detail, lang).trim();
    const detailUrl = /^https?:\/\/\S+$/i.test(paymentDetail) ? paymentDetail : '';
    return {
      id: `liipi-${facility.id}`,
      name: localized(facility.name, lang) || `P+R ${facility.id}`,
      point,
      distance: distanceMeters(origin, point),
      openNow: inactive ? false : null,
      openingHours: liipiOpeningHours(facility, lang),
      capacity,
      spacesAvailable: null,
      predictedSpaces: null,
      price: liipiPrice(facility, lang, date),
      maxStayMinutes: liipiMaximumStayMinutes(facility.pricingMethod),
      parkingTerms: detailUrl ? '' : liipiTerms(facility, lang),
      operator: '',
      website: localized(facility.paymentInfo?.url, lang) || localized(facility.openingHours?.url, lang) || detailUrl,
      paymentMethods: liipiPaymentMethods(facility.paymentInfo?.paymentMethods),
      source: 'liipi',
    };
  }).filter((facility) => facility && facility.distance < 8000).sort((a, b) => a.distance - b.distance);
}
