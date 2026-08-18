import { describe, expect, it } from 'vitest';
import { isGeneralParkingFeature } from './parking-rules.js';
import { EVENT_PARKING_LOTS, linkedEventsUrl, overlappingEvent } from './special-parking.js';

describe('event-conditional parking lots', () => {
  it('ships the P-jäähalli lot as a disc-parkable polygon with an event config', () => {
    expect(EVENT_PARKING_LOTS).toHaveLength(1);
    const lot = EVENT_PARKING_LOTS[0];
    expect(lot.id).toBe('helsinki:event-lot:jaahalli');
    expect(lot.geometry.type).toBe('MultiPolygon');
    // Default reading is free-with-disc, so it renders as an ordinary car spot.
    expect(lot.properties.parking).toMatchObject({ kind: 'disc', maxStayMinutes: 240, municipality: 'helsinki' });
    expect(isGeneralParkingFeature(lot)).toBe(true);
    const cfg = lot.properties.parking.eventParking;
    expect(cfg.checkVenues).toContain('tprek:41176');
    expect(cfg.checkVenues).toContain('tprek:20888');
    expect(cfg.free.fi && cfg.free.en && cfg.event.fi && cfg.event.en).toBeTruthy();
    expect(cfg.links.length).toBeGreaterThanOrEqual(3);
    cfg.links.forEach((link) => { expect(link.url).toMatch(/^https:\/\//); expect(link.name.fi && link.name.en).toBeTruthy(); });
  });

  it('builds a Linked Events query for the chosen local day and venues', () => {
    const url = new URL(linkedEventsUrl(['tprek:41176', 'tprek:20888'], new Date(2026, 7, 18, 23, 30)));
    expect(url.hostname).toBe('api.hel.fi');
    expect(url.pathname).toContain('/linkedevents/v1/event');
    expect(url.searchParams.get('location')).toBe('tprek:41176,tprek:20888');
    expect(url.searchParams.get('start')).toBe('2026-08-18');
    expect(url.searchParams.get('end')).toBe('2026-08-18');
  });

  it('flags an event only when it covers the parking moment (from 2h before to 1h after)', () => {
    const game = { start_time: '2026-08-18T18:00:00Z', end_time: '2026-08-18T20:00:00Z', name: { fi: 'HIFK–Lukko', en: 'HIFK–Lukko' } };
    const events = [game];
    // During and in the 2h lead-in / 1h wind-down.
    expect(overlappingEvent(events, new Date('2026-08-18T18:30:00Z'))).toBe(game);
    expect(overlappingEvent(events, new Date('2026-08-18T16:15:00Z'))).toBe(game);
    expect(overlappingEvent(events, new Date('2026-08-18T20:45:00Z'))).toBe(game);
    // Well before and well after → no event.
    expect(overlappingEvent(events, new Date('2026-08-18T12:00:00Z'))).toBeNull();
    expect(overlappingEvent(events, new Date('2026-08-18T22:30:00Z'))).toBeNull();
    // Empty / missing inputs are safe.
    expect(overlappingEvent([], new Date())).toBeNull();
    expect(overlappingEvent(null, new Date())).toBeNull();
    expect(overlappingEvent([{ start_time: 'not-a-date' }], new Date())).toBeNull();
  });
});
