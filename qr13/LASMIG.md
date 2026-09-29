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

## 3. Publicera

- Ladda upp **hela mappen** till er webbserver, t.ex. `wangsoderstrom.com/ar/sjukhus/`. **HTTPS krävs** (annars får sidan inte använda kameran).
- QR-koden pekar på den adressen. Tips: låt QR-koden gå till en *omdirigering* på er sajt (t.ex. `wangsoderstrom.com/verk1` → `/ar/sjukhus/`). Då kan ni flytta upplevelsen senare utan att byta den tryckta koden.
- Direktlänk till videon utan kamera: `…/ar/sjukhus/#utan-kamera` (bra för tillgänglighet eller om någon inte vill använda kameran).

## Testa lokalt

I mappen: `python3 -m http.server 8000` → öppna `http://localhost:8000` på datorn (kamera via localhost fungerar). För att testa på mobilen behövs HTTPS – enklast är att ladda upp till en testmapp på servern.

## Beteende

- Startskärm med förklaring och integritetstext (ingen bild sparas – all bildanalys sker i telefonen).
- Videon tonas in när verket hittas, pausas när kameran tappar verket och fortsätter när det hittas igen.
- Startar **utan ljud** (väntrum) – knapp för ljud på/av. Ändras med `soundOnStart`.
- Om kameran nekas eller saknas: meddelande + knappen **Visa utan kamera** som spelar videon vanligt.

## Hållbarhet (5+ år)

- Inga beroenden utanför mappen: inga API-nycklar, abonnemang, CDN eller appar. Det enda som måste leva är er domän + webbhotell med HTTPS.
- Biblioteksversionerna är fastlåsta i `libs/` och uppdateras inte av sig själva – det är avsiktligt.
- Bygger på webbstandarder (getUserMedia, WebGL, `<video>`) som har funnits i alla mobilwebbläsare sedan ~2017.
- Förslag på underhåll: testa en gång per år på en aktuell iPhone och Android. Förnya domän/certifikat. Spara en kopia av hela mappen + originalfoto + originalvideo i ert arkiv.
- Råkar något i framtiden sluta fungera är reservläget (`#utan-kamera`) en vanlig videospelare som i praktiken alltid fungerar.
