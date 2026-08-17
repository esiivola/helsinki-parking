# Pysäköintikartta

Selkeä, mobiilikäyttöön suunniteltu karttapalvelu Helsingin, Espoon, Vantaan, Tampereen ja Turun pysäköinnin tarkistamiseen.

**[Avaa pysäköintikartta](https://esiivola.github.io/helsinki-parking/)**

## Mitä palvelu näyttää

- Kadunvarsipaikkojen maksullisuus ja aikarajat Helsingissä, Espoossa, Vantaalla, Tampereella ja Turussa
- Lähialueen pysäköintihallit, yleiset pysäköintialueet ja liityntäpysäköinti
- Helsingin tilapäiset poikkeukset, siirtokehotukset sekä maksu- ja asukaspysäköintivyöhykkeet
- Suomen- ja englanninkielinen käyttöliittymä

Kauniaisista ei ole saatavilla vastaavaa avointa kadunvarsipysäköinnin sääntöaineistoa. Kartta näyttää siellä saatavilla olevat LIIPI- ja OpenStreetMap-pysäköintikohteet, mutta ei päättele kadunvarsisääntöjä Helsingin, Espoon tai Vantaan aineistoista.

Liikennemerkki ja paikalla oleva opastus ratkaisevat aina. Avoin data voi olla puutteellista tai vanhentunutta.

## Alueellinen kattavuus

| Tieto | Helsinki | Espoo | Vantaa | Tampere | Turku | Kauniainen |
| --- | --- | --- | --- | --- | --- | --- |
| Kadunvarsipaikkojen alueet ja säännöt | Kyllä | Kyllä | Kyllä | Kyllä | Vyöhyketasolla | Ei avointa sääntöaineistoa |
| Pysäköintilaitokset ja liityntäpysäköinti | LIIPI, Palvelukartta ja OSM | LIIPI, Palvelukartta ja OSM | LIIPI, Palvelukartta ja OSM | OSM | OSM | LIIPI ja OSM, lähteiden kattavuuden mukaan |
| Erillinen maksuvyöhykekerros | Helsinki | Ei | Ei | Ei | Ei | Ei |
| Asukaspysäköintivyöhykkeet | Helsinki | Ei | Ei | Ei | Ei | Ei |
| Tilapäiset työt ja siirtokehotukset | Helsinki | Ei | Ei | Ei | Ei | Ei |

Espoon, Vantaan ja Tampereen maksullisuus sekä aikarajat tulevat suoraan niiden pysäköintialueiden ominaisuustiedoista. Tampereen tiedot haetaan suoraan kaupungin WFS-rajapinnasta karttaa selatessa; Turun aineisto haetaan päivitysajossa valmiiksi, koska rajapinta ei salli selainkutsuja. Turun kattavuus on vyöhyketasolla: kartalla näkyvät keskustan kolme maksuvyöhykettä hintoineen ja maksullisine aikoineen sekä asukas- ja yrityspysäköinnin lupavyöhykkeet (A–M) omana karttatasonaan. Taulukon maksuvyöhykekerros tarkoittaa erillistä karttatasoa, joka on saatavilla vain Helsingistä.

## Tietolähteet

Palvelu yhdistää seuraavia avoimia aineistoja:

- [Helsingin pysäköintipaikat](https://hri.fi/data/fi/dataset/helsingin-kantakaupungin-ja-asukaspysakointivyohykkeiden-pysakointipaikat), maksu- ja asukaspysäköintivyöhykkeet sekä tilapäiset liikennejärjestelyt
- [Espoon yleisten alueiden rekisteri](https://hri.fi/data/en_GB/dataset/espoon-kaupungin-yleisten-alueiden-rekisteri), josta käytetään pysäköintitiedot sisältävää katualueaineistoa
- [Pääkaupunkiseudun Palvelukartta](https://hri.fi/data/en/dataset/paakaupunkiseudun-palvelukartan-rest-rajapinta), josta käytetään Vantaan pysäköintialueiden sääntöjä ja alueellisia pysäköintikohteita
- [Tampereen pysäköintipaikat](https://data.tampere.fi/data/dataset/tampereen-keskustan-maksulliset-pysakointialueet), josta käytetään maksuvyöhykkeet, aikarajat sekä maksu- ja kiekkoajat
- [Turun pysäköinnin maksuvyöhykkeet](https://www.avoindata.fi/data/fi/dataset/turun-kaupungin-pysakoinnin-maksuvyohykkeet), josta käytetään keskustan maksuvyöhykkeet, tuntihinnat ja maksulliset ajat
- [Fintraffic LIIPI](https://parking.fintraffic.fi/docs/index.html), josta käytetään pysäköintilaitosten ja liityntäpysäköinnin tietoja
- [OpenStreetMap](https://www.openstreetmap.org/copyright), jota käytetään täydentävänä pysäköintikohteiden lähteenä

Kaupunkien, HRI:n, Palvelukartan ja Fintrafficin tässä käytetyt avoimet aineistot julkaistaan Creative Commons Nimeä 4.0 -lisenssillä (CC BY 4.0). OpenStreetMapin tiedot ovat Open Data Commons Open Database License -lisenssin (ODbL) alaisia. Lähdekohtaiset nimeämiset ja päivitystiedot näytetään myös palvelun tietopaneelissa.

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

Espoon, Vantaan, Tampereen ja Turun tekstipohjaisten sääntöjen kääntymisen voi tarkistaa kaupungeittain:

```bash
npm run audit:regional             # hakee jokaisen kaupungin aineiston ja listaa
                                   # eri sääntömerkkijonot -> tulkittu sääntö,
                                   # ja merkitsee jäsentymättömän hinta-/aikatiedon
```

Audit ryhmittelee kunkin lähteen eri maksu-/aikamerkkijonot ja näyttää, miksi kukin kääntyy (tai ei käänny) toiminnalliseksi säännöksi — samalla periaatteella kuin Helsingin säännöt käytiin läpi käsin.

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
