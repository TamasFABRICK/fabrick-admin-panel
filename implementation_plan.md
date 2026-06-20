# Identifikácia koreňovej príčiny (Root Cause Analysis) pre PDF Generátor

Cieľom tohto dokumentu je zhrnúť zistenia z hĺbkovej analýzy pretrvávajúceho problému: v produkčnom PDF generátore sa pri zvolenej tehle (napr. DS085_2.jpg) zobrazujú pri väzbách naďalej "sivé placeholdery".

## 1. Audit Gitu a lokálnych súborov
- **Git Repository:** Súbory (napr. `stretcher.svg`, `flemish.svg`) **boli** korektne vytvorené a úspešne odoslané na `origin/main` v repozitári `fabrick-admin-panel`. Log to jasne potvrdzuje.
- **Obsah súborov:** Súbory nie sú poškodené a neobsahujú textové halucinácie. Ich obsahom sú validné SVG kódy, ktoré vznikli presnou matematickou extrakciou priamo z frontendového React komponentu `BondSVG`.

## 2. Audit Docker architektúry
- Súbor `docker-compose.prod.yml` mapuje iba `public/uploads` a zdieľaný volume `bricks_data`. Zložka `public/bonds` mapovaná nie je, čo je správne.
- `Dockerfile` jasne vykonáva inštrukciu `COPY --from=builder /app/public ./public`, takže produkčný kontajner garantovane získava nové `.svg` súbory z buildu. Caching tu teda nie je vinníkom.

## 3. Koreňová Príčina (Root Cause)
Kameňom úrazu nie je sieťový prenos ani zastaralá cache, ale samotný pôvod vyextrahovaných grafík. Komponent `BondSVG` (`brick-generator/src/App.jsx`), z ktorého boli tieto SVG kódy vydolované, bol vo frontende navrhnutý **len ako statická dizajnová ikonka pre výber menu** – nepoužíva grafické cesty (`<path>`), ale prosté obdĺžniky (`<rect>`) a najmä **statické hexadeximálne farby**:
```javascript
const SC = '#4b5563' // Tmavosivá farba "tehly"
const SBG = '#e5e7eb' // Svetlosivá farba "škáry"
```
PDF generátor číta a vkladá presne tento SVG kód. Zákazník očakáva, že v PDFku uvidí náhľad väzby so zafarbením a textúrou vybranej tehly (napr. `DS085_2.jpg`) a s farbou zvolenej škáry. Avšak naše aktuálne SVG súbory vôbec nepodporujú textúrovanie. Vizuál "sivých placeholderov" je reálnym a presným odrazom toho, ako sú tieto ikony definované priamo v zdrojovom kóde aplikácie.

## User Review Required

> [!IMPORTANT]
> Problém nie je v devops nasadení, ale v grafickej povahe samotných SVG ikon, ktoré nie sú dynamicky textúrované. Máme niekoľko možností riešenia. Prosím, zvoľte preferovaný smer pre návrh finálneho plánu (alebo poskytnite iné inštrukcie):

### Možnosť 1: Dynamické farbenie SVG v backende (Odporúčané)
Upravím PDF Endpoint na backende tak, aby pri čítaní SVG súboru neurobil len kópiu, ale zmenil atribúty. Do SVG by sme dynamicky injektovali vybranú farbu škáry (z `jointColor`) a namiesto sivej výplne `#4b5563` by sme vytvorili `<pattern>` definíciu odkazujúcu na `brickThumbUrl` (textúru tehly).

### Možnosť 2: Ponechanie sivých ikon a zmena dizajnových očakávaní
Dizajn PDF dokumentu upravíme tak, aby bolo jasné, že miniatúra slúži len na zobrazenie "nákresu" uloženia tehál (schematický pohľad) a nie na presnú simuláciu farby.

### Možnosť 3: Návrat ku Canvas snapshotom (WebGL riešenie)
Ak chceme dokonalú a realistickú kópiu scény aj s tieňovaním, musíme vyriešiť predtým zlyhaný pokus s odfotením 3D canvasu, napr. obetovaním výkonu a explicitným zapnutím `preserveDrawingBuffer: true` priamo v engine Three.js.
