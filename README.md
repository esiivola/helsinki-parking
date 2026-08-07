# Helsingin pysäköintikartta

Selkeä, mobiilikäyttöön suunniteltu karttapalvelu Helsingin kadunvarsipysäköinnin tarkistamiseen.

**[Avaa pysäköintikartta](https://esiivola.github.io/helsinki-parking/)**

## Mitä palvelu näyttää

- Kadunvarsipaikkojen maksullisuus ja aikarajat valittuna ajankohtana
- Tilapäiset poikkeukset ja siirtokehotukset
- Lähialueen pysäköintihallit
- Maksu- ja asukaspysäköintivyöhykkeet
- Suomen- ja englanninkielinen käyttöliittymä

Liikennemerkki ratkaisee aina. Avoin data voi olla puutteellista tai vanhentunutta.

## Tietolähteet

Palvelu hyödyntää Helsingin kaupungin, HRI:n, Palvelukartan, Fintrafficin ja OpenStreetMapin avoimia aineistoja. Tarkemmat lähde- ja lisenssitiedot löytyvät palvelun tietopaneelista.

## Paikallinen kehitys

Edellytyksenä on Node.js 22.

```bash
npm ci
npm run dev
```

Testit ja tuotantoversio:

```bash
npm test
npm run build
```

`main`-haaraan viedyt muutokset testataan, rakennetaan ja julkaistaan automaattisesti GitHub Pagesiin.

## Tekijä

[Eero Siivola](https://esiivola.github.io/)
