// =====================================================================
//  INSTÄLLNINGAR – det här är den enda filen du normalt behöver ändra.
// =====================================================================
export const CONFIG = {
  // Spårningsfil som genereras från fotot av verket (se verktyg/kompilera.html)
  target: "innehall/verk.mind",

  // Videon som visas ovanpå verket (MP4, H.264, "faststart")
  video: "innehall/video.mp4",
  poster: "innehall/poster.jpg",

  // Genomskinlighet (alfa):
  //   "none"     – vanlig video, ingen genomskinlighet
  //   "packed"   – EN mp4 där vänster halva är färg och höger halva är alfa
  //                (vitt = synligt, svart = genomskinligt). Rekommenderas –
  //                halvorna kan aldrig hamna ur synk.
  //   "separate" – två mp4-filer: färg i `video` och alfa i `alphaVideo`
  //   "chroma"   – greenscreen: allt i videon som har färgen i `chromaKey.color`
  //                blir genomskinligt (justera med inställningarna nedan)
  alphaMode: "chroma",
  alphaVideo: "innehall/video-alpha.mp4",

  // Greenscreen-inställningar (används bara när alphaMode är "chroma")
  chromaKey: {
    color: "#0400f4",   // färgen som ska bort, t.ex. "#00b140" (studiogrön) eller "#0047bb" (blå)
    similarity: 0.15,    // hur lik färgen måste vara för att tas bort (högre = mer tas bort)
    smoothness: 0.15,   // mjukhet i kanten (högre = mjukare övergång)
    spill: 0.25,         // tar bort grönt skimmer i kanterna (högre = mer)
  },

  // Videons proportioner: höjd / bredd. 16:9 = 0.5625, 4:3 = 0.75, 1:1 = 1
  // I läget "packed": ange proportionerna för EN halva (inte hela filen).
  videoAspect: 1.5,

  // Bakgrundsbild på startsidan ("" = ingen) och färgen runt den
  startBackground: "innehall/bakgrund.png",
  startBackgroundColor: "#b3b3b3",
  startTextOffset: 0,   // flytta texten: negativt = uppåt, positivt = nedåt (i % av skärmhöjden, t.ex. -3)

  // Sikthjälp: en blek version av verket visas medan kameran letar,
  // så att man ser vad man ska sikta på. Tom sträng "" = bara hörnmarkeringar.
  guideImage: "innehall/verk.jpg",
  guideOpacity: 0.35,   // 0–1, hur synlig sikthjälpen är

  // Storlek och placering relativt verket. 1 = exakt verkets bredd.
  // offsetX/offsetY i verkets bredder (0.1 = 10 % av bredden). Y uppåt.
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,

  // Starta med ljud? I väntrum är det ofta bäst att börja tyst.
  soundOnStart: false,

  // Loopa videon?
  loop: true,

  // Hur mjukt videon tonas in/ut (sekunder)
  fade: 0.6,

  // Stabilisering av spårningen. Lägre filterMinCF = stabilare men trögare.
  filterMinCF: 0.0001,
  filterBeta: 0.001,

  // Stabilitet – hur lätt filmen "släpper":
  missTolerance: 30,    // antal missade bildrutor innan verket räknas som tappat (MindAR-standard: 5)
  warmupTolerance: 3,   // antal bildrutor verket måste synas innan filmen visas (standard: 5)
  lostGrace: 3,         // sekunder filmen ligger kvar och spelar på senaste position när verket tappats
  cameraWidth: 1280,    // önskad kamerabredd i pixlar (högre = bättre igenkänning, lite tyngre). 0 = telefonens standard

  // Tekster (dansk)
  text: {
    title: "Et skjult lag",
    intro: "Ret telefonens kamera mod motivet for at se, hvad der gemmer sig.",
    start: "Start",
    noCamera: "Se uden kamera",
    privacy: "Kameraet bruges kun på din telefon. Der gemmes eller sendes ingen billeder.",
    loading: "Indlæser …",
    scan: "Ret kameraet mod værket",
    soundOn: "Lyd til",
    soundOff: "Lyd fra",
    close: "Luk",
    cameraError: "Kameraet kunne ikke startes. Du kan se værket uden kamera i stedet.",
  },
};
