// =====================================================================
//  INSTÄLLNINGAR – det här är den enda filen du normalt behöver ändra.
// =====================================================================
export const CONFIG = {
  // Spårningsfil som genereras från fotot av verket (se verktyg/kompilera.html)
  target: "innehall/verk.mind",

  // Videon som visas ovanpå verket (MP4, H.264, "faststart")
  video: "innehall/video.mp4",
  poster: "innehall/poster.jpg",

  // Videons proportioner: höjd / bredd. 16:9 = 0.5625, 4:3 = 0.75, 1:1 = 1
  videoAspect: 0.75,

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

  // Texter
  text: {
    title: "Ett dolt lager",
    intro: "Rikta telefonens kamera mot konstverket för att se det som finns under ytan.",
    start: "Starta",
    noCamera: "Visa utan kamera",
    privacy: "Kameran används bara i din telefon. Ingen bild sparas eller skickas.",
    loading: "Laddar …",
    scan: "Rikta kameran mot verket",
    soundOn: "Ljud på",
    soundOff: "Ljud av",
    close: "Stäng",
    cameraError: "Kameran kunde inte startas. Du kan titta på verket utan kamera i stället.",
  },
};
