// @vitest-environment jsdom
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { describe, expect, it } from 'vitest';
import { ParkingPanel, spotMeta } from './main.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(feature, { zone = null, lang = 'fi', at = new Date(2026, 7, 10, 10, 55), exceptions = [], serviceMap = null } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const selected = { point: [60.17, 24.94], feature, meta: spotMeta(feature, zone, lang), zone, resident: '' };
  act(() => {
    createRoot(host).render(<ParkingPanel selected={selected} lang={lang} exceptions={exceptions} serviceMap={serviceMap} parkingTime={at} onClose={() => {}} />);
  });
  const read = (selector) => [...host.querySelectorAll(selector)].map((node) => node.textContent.trim());
  return {
    headline: host.querySelector('.parking-summary h2')?.textContent.trim(),
    note: host.querySelector('.parking-summary p')?.textContent.trim(),
    state: host.querySelector('.parking-summary')?.className,
    facts: read('.card-key-facts > div'),
    details: read('.detail-rows > div'),
  };
}

describe('parking detail card', () => {
  it('states a conservative limit for a short-term space with no published kesto', () => {
    // The case in the field report: the Service Map only says "Ilmainen,
    // pysäköinti sallittu 30 min, 1 h, 2 h tai 4 h", which cannot be read as a
    // promise of four hours.
    const card = render({ properties: { luokka: 1, luokka_nimi: 'Ilmainen lyhytaikainen pysäköinti' } });
    expect(card.headline).toBe('Maksuton');
    expect(card.note).toBe('enintään 1 h');
    expect(card.state).toContain('free');
    expect(card.facts).toEqual(['Enintään1 h · paikkaluokan oletus']);
    expect(card.details).toEqual(['PaikkaluokkaIlmainen lyhytaikainen pysäköinti']);
  });

  it('uses the published limit when the city states one', () => {
    const card = render({ properties: { luokka: 8, luokka_nimi: 'Ilman asukas-/yritystunnusta ilmainen lyhytaikainen pysäköinti. Käytä pysäköintikiekkoa.', kesto: '4 h', voimassaolo: '8-20', asukaspysakointitunnus: 'N' } }, { zone: '1' });
    expect(card.headline).toBe('Maksuton kiekolla');
    expect(card.note).toBe('enintään 4 h klo 8–20');
    expect(card.facts).toEqual(['Enintään4 h', 'AsukastunnusN']);
    expect(card.details).toContain('Aikaraja voimassaMa–pe 8–20');
  });

  it('shows the price and the end of the chargeable period on a paid space', () => {
    const card = render({ properties: { luokka: 6, luokka_nimi: 'Maksullinen vyöhykehinta', voimassaolo: '9-21, (9-18)' } }, { zone: '1' });
    expect(card.headline).toBe('4 €/h');
    expect(card.note).toBe('Maksullinen klo 21:00 asti');
    expect(card.state).toContain('paid');
    expect(card.details).toEqual(['Maksuvyöhyke1', 'Maksulliset ajatMa–pe 9–21 · la 9–18', 'PaikkaluokkaMaksullinen vyöhykehinta']);
  });

  it('reports a class 9 space as forbidden while its no-parking window runs', () => {
    const properties = { luokka: 9, luokka_nimi: 'Pysäköinti sallittu pysäköintikieltoajan ulkopuolella', voimassaolo: '8-17' };
    const banned = render({ properties });
    expect(banned.headline).toBe('Pysäköinti kielletty');
    expect(banned.state).toContain('unavailable');
    expect(banned.details).toContain('PysäköintikieltoMa–pe 8–17');
    const allowed = render({ properties }, { at: new Date(2026, 7, 10, 19, 0) });
    expect(allowed.headline).toBe('Maksuton');
    expect(allowed.note).toBe('Maksu alkaa ti klo 08:00');
  });

  it('never presents the Service Map class text as this space\'s own rule', () => {
    // The Service Map ships one description per class: all 2005 spaces in class 1
    // read "Ilmainen, pysäköinti sallittu 30 min, 1 h, 2 h tai 4 h". Showing it as
    // the official rule for the tapped space is what made the card misleading.
    const serviceMap = {
      name: { fi: 'Ilmainen, pysäköinti sallittu 30 min, 1 h, 2 h tai 4 h' },
      extra: { validity_period: 'ma-pe 8-17' },
    };
    const card = render({ properties: { luokka: 1, luokka_nimi: 'Ilmainen lyhytaikainen pysäköinti' } }, { serviceMap });
    expect(card.details.join(' ')).not.toContain('30 min, 1 h, 2 h tai 4 h');
    expect(card.details).toEqual(['PaikkaluokkaIlmainen lyhytaikainen pysäköinti']);
  });

  it('still trusts the Service Map when it states a prohibition', () => {
    const serviceMap = { name: { fi: 'Pysäköintikielto' } };
    const card = render({ properties: { luokka: 1 } }, { serviceMap });
    expect(card.headline).toBe('Pysäköinti kielletty');
    expect(card.state).toContain('unavailable');
  });

  it('lists the window a disc limit applies in without claiming it lifts', () => {
    const card = render({ properties: { luokka: 8, luokka_nimi: 'Ilman asukas-/yritystunnusta ilmainen lyhytaikainen pysäköinti. Käytä pysäköintikiekkoa.', kesto: '4 h', voimassaolo: '8-20' } }, { at: new Date(2026, 7, 10, 22, 0) });
    expect(card.headline).toBe('Maksuton kiekolla');
    expect(card.note).toBe('enintään 4 h klo 8–20');
    expect(card.details).toContain('Aikaraja voimassaMa–pe 8–20');
    expect(card.note).not.toContain('ei aikarajaa');
  });

  it('keeps the English card in step with the Finnish one', () => {
    const card = render({ properties: { luokka: 1 } }, { lang: 'en' });
    expect([card.headline, card.note]).toEqual(['Free', 'maximum 1 h']);
    expect(card.facts).toEqual(['Maximum1 h · assumed from the parking class']);
  });

  it('shows a regional source note without inventing a Helsinki price', () => {
    const card = render({ properties: { parking: {
      provider: 'service-map', municipality: 'vantaa', kind: 'paid', hourlyPrice: null,
      maxStayMinutes: null, schedule: null, rawLabel: 'Tikkurilan kirjasto · Maksullinen',
      notes: 'Maksullinen. 1. tunti maksuton.', estimatedSpaces: 16,
    } } });
    expect(card.headline).toBe('Maksullinen');
    expect(card.note).toBe('maksulliset ajat tarkistettava');
    expect(card.details).toContain('Paikkamäärä16');
    expect(card.details).toContain('Aineiston sääntöTikkurilan kirjasto · Maksullinen');
    expect(card.details).toContain('Lisätieto aineistossaMaksullinen. 1. tunti maksuton.');
    expect(card.headline).not.toContain('4 €/h');
  });
});
