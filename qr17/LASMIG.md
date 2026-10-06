# Ett dolt lager – webb-AR för konstverket

Besökaren scannar QR-koden → hamnar på er hemsida → trycker **Starta** → riktar kameran mot verket → en video läggs exakt ovanpå verket och följer det. Ingen app behövs. Fungerar i Safari (iOS) och Chrome (Android).

Allt ligger lokalt i mappen – inga externa tjänster, CDN:er eller konton. Så länge mappen ligger på en webbserver med HTTPS fungerar den.

## Mappens innehåll

| Fil / mapp | Vad |
|---|---|
| `index.html`, `app.js`, `style.css` | Själva upplevelsen |
| `config.js` | **Allt du normalt ändrar**: filnamn, storlek/placering, ljud, texter |
| `innehall/verk.mind` | Spårningsfil som genereras från ett foto av verket |
| `innehall/video.mp4`, `poster.jpg` | Videon (och stillbild för reservläget) |
| `innehall/verk.jpg` | Fotot spårningsfilen gjordes av (behövs inte på servern, men spara det) |
| `verktyg/kompilera.html` | Gör om ett foto till `verk.mind` |
| `libs/` | MindAR 1.2.5 + three.js 0.160 (MIT-licens), fastlåsta versioner |

Just nu ligger **platshållare** i `innehall/` – byt dem mot ert material.

## 1. Byt fotot av verket

1. Fotografera verket rakt framifrån, jämnt ljus, inga reflexer. Beskär så bara verket syns. 1000–2000 px brett räcker.
2. Ladda upp hela mappen till servern (eller kör lokalt, se nedan) och öppna `verktyg/kompilera.html`.
3. Välj fotot → **Skapa spårningsfil** → `verk.mind` laddas ner. Lägg den i `innehall/`.

**Vad spårar bra:** detaljrika, kontrastrika ytor med oregelbundna former. **Vad spårar dåligt:** stora enfärgade fält, upprepade mönster, blanka/glaserade ytor under lysrör, mycket mörka verk. Är verket svårt kan man lägga till ett grafiskt element (t.ex. en skylt med mönster bredvid) och spåra det i stället.

Viktigt: spårningen jämför med *fotot*. Om verket ändras (inramning, ljussättning på plats) – fotografera det på plats i sin slutliga miljö och kompilera om.

## 2. Byt videon

- Format: **MP4, H.264, AAC-ljud**, med `faststart`. Håll den under ~15 MB (mobilnät i väntrum).
- Proportioner: ange i `config.js` → `videoAspect` (höjd/bredd). Om videon har samma proportioner som verket och `scale: 1` täcker den verket exakt.
- Rekommenderad export med ffmpeg:
  ```
  ffmpeg -i original.mov -vf "scale=1280:-2" -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 23 -movflags +faststart -c:a aac -b:a 128k video.mp4
  ffmpeg -i video.mp4 -frames:v 1 -q:v 3 poster.jpg
  ```
- Vill ni att videon ska "växa ut" ur verket, gör den större (`scale: 1.3`) eller flytta den (`offsetY: 0.2`).

## 2b. Video med genomskinlighet (alfa)

Vanlig MP4 (H.264) kan inte bära alfa, och iPhone/Android stödjer inga gemensamma alfa-format. Därför lagras alfan som en **gråskalebild**: vitt = synligt, svart = genomskinligt, grått = halvgenomskinligt. Sidan slår ihop färg och alfa i realtid.

Exportera först från ert redigeringsprogram en fil **med alfa**, t.ex. **ProRes 4444** (.mov) från After Effects/Premiere/Resolve/Blender. Välj sedan ett av två lägen i `config.js`:

### Läge "packed" (rekommenderas) – en fil, färg och alfa sida vid sida

```
ffmpeg -i original_med_alfa.mov -filter_complex "[0:v]format=rgba,split[c][a];[a]alphaextract,format=yuv420p[m];[c]format=yuv420p[c2];[c2][m]hstack" -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 20 -movflags +faststart -c:a aac -b:a 128k video.mp4
```

I `config.js`:
```
alphaMode: "packed",
videoAspect: 0.75,   // proportionerna för EN halva, t.ex. 960×720 → 0.75
```
Fördel: halvorna kan aldrig glida isär i tid. Filen blir dubbelt så bred – håll varje halva ≤ 1280 px bred (dvs. hela filen ≤ 2560 px) så att alla telefoner klarar den.

### Läge "separate" – två filer

```
ffmpeg -i original_med_alfa.mov -vf "format=rgba,format=yuv420p" -c:v libx264 -profile:v main -crf 20 -movflags +faststart -c:a aac -b:a 128k video.mp4
ffmpeg -i original_med_alfa.mov -vf "format=rgba,alphaextract,format=yuv420p" -c:v libx264 -profile:v main -crf 20 -movflags +faststart -an video-alpha.mp4
```

I `config.js`:
```
alphaMode: "separate",
alphaVideo: "innehall/video-alpha.mp4",
```
Sidan håller de två videorna i synk, men på äldre telefoner kan kanten ibland "släpa" en bildruta. Använd "packed" om det syns.

Har ni redan en färgvideo och en svartvit mask som separata filer (t.ex. från Blender) kan de packas ihop direkt:
```
ffmpeg -i farg.mp4 -i mask.mp4 -filter_complex "[0:v][1:v]hstack" -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 20 -movflags +faststart -map 0:a? -c:a aac video.mp4
```

**Testa direkt:** `innehall/exempel-alfa-packed.mp4` är en testfil (en pulserande cirkel). Sätt `video: "innehall/exempel-alfa-packed.mp4"` och `alphaMode: "packed"` för att se hur det ser ut.

### Läge "chroma" – greenscreen direkt i sidan

Ingen förberedelse behövs: filma/animera mot grön (eller blå) bakgrund, exportera en vanlig MP4, och sidan tar bort färgen i realtid.

I `config.js`:
```
alphaMode: "chroma",
chromaKey: {
  color: "#00b140",   // bakgrundsfärgen – plocka den med pipett i ett bildprogram
  similarity: 0.4,    // öka om det blir kvar grönt i bakgrunden, minska om motivet börjar försvinna
  smoothness: 0.08,   // öka för mjukare kanter
  spill: 0.1,         // öka om kanterna har ett grönt skimmer
},
```
Tänk på: **allt i videon som har samma färg försvinner** – även gröna detaljer i motivet. Använd blå bakgrund om motivet innehåller grönt (och tvärtom). Jämn belysning på bakgrunden ger renast resultat. För hårstrån, rök, glas och mjuka skuggor blir "packed" alltid snyggare, eftersom alfan då görs i redigeringsprogrammet.

**Testa direkt:** `innehall/exempel-greenscreen.mp4` – sätt `video: "innehall/exempel-greenscreen.mp4"`, `alphaMode: "chroma"` och `color: "#00b140"`.

Tips: färgen bakom helt genomskinliga partier spelar ingen roll, men i halvgenomskinliga kanter (mjuka skuggor, glöd) ser det bäst ut om ni exporterar med *straight* (inte premultiplied) alfa.

## 3. Publicera (GitHub Pages)

Upplevelsen ligger på **https://ar.wangsoderstrom.com/qr13/**, som hostas gratis av GitHub Pages (repot `wangsoderstrom/ar`, grenen `main`). HTTPS-certifikatet förnyas automatiskt.

- **DNS (hos Cargo):** CNAME `ar` → `wangsoderstrom.github.io.` – rör inte den.
- **Uppdatera en fil:** gå till repot på github.com → öppna mappen (t.ex. `qr13/innehall`) → *Add file → Upload files* → dra in filen med samma namn → *Commit changes*. Sidan uppdateras inom någon minut. Gamla versioner finns kvar under *History* om ni vill backa.
- **Nytt verk:** ladda upp en kopia av mappen med nytt namn, t.ex. `qr14`, → `https://ar.wangsoderstrom.com/qr14/`.
- **Direktlänk till videon utan kamera:** `https://ar.wangsoderstrom.com/qr13/#utan-kamera` (bra för tillgänglighet eller om någon inte vill använda kameran).
- Om ni någon gång vill flytta till ett annat webbhotell: ladda upp mappen där och peka om `ar` hos Cargo. QR-koden behöver inte ändras.

## Testa lokalt

I mappen: `python3 -m http.server 8000` → öppna `http://localhost:8000` på datorn (kamera via localhost fungerar). För att testa på mobilen behövs HTTPS – enklast är att ladda upp till en testmapp på servern.

## Beteende

- Startskärm med förklaring och integritetstext (ingen bild sparas – all bildanalys sker i telefonen).
- Videon tonas in när verket hittas, pausas när kameran tappar verket och fortsätter när det hittas igen.
- Startar **utan ljud** (väntrum) – knapp för ljud på/av. Ändras med `soundOnStart`.
- Om kameran nekas eller saknas: meddelande + knappen **Visa utan kamera** som spelar videon vanligt.

## Hållbarhet (5+ år)

- Inga beroenden utanför mappen: inga API-nycklar, abonnemang, CDN eller appar. Det enda som måste leva är domänen wangsoderstrom.com (och GitHub Pages, eller annan värd med HTTPS).
- Biblioteksversionerna är fastlåsta i `libs/` och uppdateras inte av sig själva – det är avsiktligt.
- Bygger på webbstandarder (getUserMedia, WebGL, `<video>`) som har funnits i alla mobilwebbläsare sedan ~2017.
- Förslag på underhåll: testa en gång per år på en aktuell iPhone och Android. Förnya domän/certifikat. Spara en kopia av hela mappen + originalfoto + originalvideo i ert arkiv.
- Råkar något i framtiden sluta fungera är reservläget (`#utan-kamera`) en vanlig videospelare som i praktiken alltid fungerar.
