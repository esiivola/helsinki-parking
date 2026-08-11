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

Palvelu hyödyntää Helsingin kaupungin, HRI:n, Palvelukartan ja OpenStreetMapin avoimia aineistoja. Tarkemmat lähde- ja lisenssitiedot löytyvät palvelun tietopaneelista.

## Pysäköintiluokkien tulkinta

`src/parking-rules.js` kääntää avoimen datan kentät (`luokka`, `tyyppi`, `kesto`, `voimassaolo`, `asukaspysakointitunnus`) näytettäviksi kategorioiksi. Epäselvä tieto tulkitaan aina tiukemman vaihtoehdon mukaan: lyhyempi aikaraja, maksullinen tunti, paikka jota ei luvata.

`voimassaolo` tarkoittaa eri asiaa eri luokissa, ja se käsitellään sen mukaan:

| Luokka | `voimassaolo` | Näytetään |
| --- | --- | --- |
| Maksulliset | maksullisuusajat | maksullisuuden päättymishetki |
| Luokka 9 | pysäköintikieltoaika | kielletty kiellon aikana, maksuton sen ulkopuolella |
| Maksuttomat ja kiekkopaikat | aikarajan voimassaoloaika | aikaraja ja sen voimassaoloaika |

Kiekkopaikan aikarajaa ei ilmoiteta raukeavaksi kellonajan perusteella: aineisto ei sitä kerro, ja liikennemerkki ratkaisee.

`src/fixtures/parking-classification-cases.json` sisältää jokaisen aineistossa esiintyvän kenttäyhdistelmän, ja `src/parking-rules.test.js` ajaa säännöt niiden yli.

```bash
npm run audit:parking              # hakee koko aineiston, raportoi ja päivittää koekokoelman
npm run audit:parking -- --check   # pelkkä tarkistus ilman kirjoituksia
```

Ajo epäonnistuu, jos aineistoon ilmestyy luokka, tyyppi tai aikaraja jolle ei ole sääntöä. Kun aineisto on muuttunut, aja `npm run audit:parking` ja sen jälkeen `npm test`: testit kertovat kategoriakohtaisina eroina, mitä muutos teki kartalle.

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
