// Original SVG artwork, drawn for Age of Chess. No third-party game assets.
let serial = 0;
export function crest(owner = 1) {
  return `<svg viewBox="0 0 64 72" aria-hidden="true" class="crest"><path d="M5 7L32 1 59 7v32Q55 59 32 70 9 59 5 39Z" fill="${owner === 1 ? "#294d62" : "#713b35"}" stroke="#c5a66a" stroke-width="3"/><path d="M13 14L32 9 51 14v22Q47 52 32 61 17 52 13 36Z" fill="none" stroke="#c5a66a" opacity=".5"/><path d="M20 38l12-18 12 18-12-5Z M24 44h16M32 35v17" fill="#e2c88b" stroke="#e2c88b" stroke-width="2"/></svg>`;
}

export function unitSVG(unit, extraClass = "") {
  const types = "PNBRQK",
    type = types[Math.abs(unit) - 1],
    north = unit > 0;
  const id = `u${serial++}`,
    cloth = north ? "#3d7086" : "#993f39",
    light = north ? "#83b6c4" : "#d88565";
  const metal = `url(#${id}steel)`,
    gold = `url(#${id}gold)`,
    cloak = `url(#${id}cloth)`;
  const boots = `<path d="M43 113l-5 25-11 5 1 5h26l3-34M62 113l7 28 15 2 2 5H64l-13-30" fill="#332c28" stroke="#171e20" stroke-width="2"/><path d="M40 127l14 3m12-1l10-2" stroke="#b7a17d" stroke-width="3"/>`;
  const torso = `<path d="M38 61Q53 54 67 63l11 54-24 8-27-11Z" fill="${cloak}" stroke="#20262a" stroke-width="2"/><path d="M41 64l25-1 3 29-32 1Z" fill="${metal}"/><path d="M40 69l12 7 13-9M40 80l12 6 14-6" fill="none" stroke="#c9d0c9" stroke-width="2"/><path d="M31 99l42 1 1 7-44-1Z" fill="#362e25"/><rect x="48" y="98" width="10" height="9" rx="1" fill="${gold}"/><path d="M35 112l6-14m8 23l2-13m12 12l-5-11" stroke="${light}" opacity=".6"/>`;
  const helmet = `<path d="M38 46q0-24 15-24 18 1 18 23l-9 14H44Z" fill="${metal}" stroke="#283138" stroke-width="2"/><path d="M37 39h36v6H37Z" fill="#cbd0c5"/><path d="M43 45h22v7H43Z" fill="#1b2427"/><path d="M55 41v19" stroke="#b9c0b8" stroke-width="4"/><path d="M40 31q15-10 27 1" fill="none" stroke="#e0e3d4" opacity=".7"/>`;
  const shield = `<g class="shield"><path d="M27 72L8 77l1 29 18 18 18-20-1-27Z" fill="${cloth}" stroke="${gold}" stroke-width="4"/><path d="M27 81l-10 19 10-6 9 6Z" fill="#e2c88b"/><path d="M26 96v16" stroke="#e2c88b" stroke-width="3"/></g>`;
  const arm = `<path d="M65 65q11-5 17 14l5 16-12 6-10-17" fill="${metal}" stroke="#263137" stroke-width="2"/><circle cx="83" cy="96" r="6" fill="#d3ae82"/>`;
  let body = "";
  if (type === "P")
    body = `${boots}${torso}${helmet}${shield}<g class="weapon"><path d="M83 140L93 12" stroke="#7e5d36" stroke-width="5"/><path d="M93 2l-7 19 7-3 6 5Z" fill="${metal}" stroke="#d9d8c4"/>${arm}</g>`;
  if (type === "R")
    body = `${boots}<path d="M30 64L21 122l66 1-17-58" fill="#292f32"/>${torso}${helmet}<path d="M36 63l-8 15 13 4m26-18l13 15-11 4" fill="${metal}" stroke="#d8ccaa" stroke-width="2"/>${shield}<g class="weapon"><path d="M82 100l4-72 7-14 5 15-7 72Z" fill="${metal}" stroke="#d6d5bd"/><path d="M75 98l25 3" stroke="#cca95e" stroke-width="5"/><path d="M85 102l-1 15" stroke="#4d3824" stroke-width="6"/>${arm}</g>`;
  if (type === "B")
    body = `${boots}<path d="M33 58Q18 87 23 121l50 6-6-64" fill="${cloak}"/>${torso}<path d="M32 47Q33 14 54 20 73 21 74 54l-17 12Z" fill="${cloak}" stroke="#242c28" stroke-width="2"/><path d="M45 32Q62 27 65 48L56 58 44 50Z" fill="#c8a581"/><path d="M47 40l14-1" stroke="#533f35" stroke-width="3"/><path d="M18 74L11 37l8-2 13 35" fill="#634a31"/><path d="M13 44L6 16m11 27L14 13m5 28l2-23" stroke="#d2c09b" stroke-width="2"/><g class="weapon"><path d="M83 29Q119 78 82 123" fill="none" stroke="#c49b62" stroke-width="5"/><path d="M83 30l12 48-13 45" fill="none" stroke="#e2dac5"/><path d="M65 76l50 3-8-4m8 4l-8 3" fill="none" stroke="#d8c59d" stroke-width="2"/>${arm}</g>`;
  if (type === "Q")
    body = `<path d="M42 54Q32 79 18 145l34-4 43 5-29-91" fill="${cloak}" stroke="#263436" stroke-width="2"/><path d="M48 68L35 143l20-5 12 4-8-74" fill="#c7c0a0"/><path d="M30 126l-5 13m14-39l-6 29m35-24l15 32" stroke="${light}" opacity=".5"/><path d="M34 46Q31 17 54 16 73 19 72 51l-18 16Z" fill="${cloak}" stroke="${gold}" stroke-width="2"/><path d="M45 28q16-2 17 15l-6 12-12-8Z" fill="#d2ae88"/><path d="M43 38l18-2" stroke="#6c5142" stroke-width="2"/><path d="M53 61v38m-7-9h14" stroke="#e0c37a" stroke-width="3"/><g class="weapon"><path d="M87 141V29" stroke="#9c7a48" stroke-width="5"/><path d="M86 11l-10 13 10 13 11-13Z" fill="${gold}"/><circle class="gem" cx="87" cy="24" r="5" fill="#c8eecc"/><path d="M63 69l12 24 13-6" fill="none" stroke="${cloth}" stroke-width="14"/><circle cx="87" cy="87" r="5" fill="#d2ae88"/></g>`;
  if (type === "K")
    body = `<path d="M35 56Q17 71 14 128l38-10 38 12-14-66Z" fill="${cloak}" stroke="${gold}" stroke-width="2"/>${boots}${torso}<path d="M37 30q16-12 30 2l-4 22-10 9-13-14Z" fill="#c9a47e"/><path d="M41 47l12 13 11-12-3 16-10 5-11-11Z" fill="#473a2e"/><path d="M37 32l-5-18 13 7 8-15 8 15 12-7-5 20Z" fill="${gold}" stroke="#e4c983" stroke-width="2"/><circle cx="53" cy="27" r="3" fill="${cloth}"/><path d="M39 41h8m11 0h7" stroke="#534034" stroke-width="2"/><g class="royal-sceptre"><path d="M91 111V43" stroke="#ceac63" stroke-width="5"/><circle cx="91" cy="34" r="10" fill="${gold}"/><path d="M91 19v-9m-5 4h10" stroke="#e4c983" stroke-width="3"/>${arm}</g>`;
  if (type === "N")
    body = `<g class="mount"><path d="M28 93l-9 24 1 26H9l1-30 5-28M58 101l13 18-4 23h12l2-26-9-25" fill="#4a342b" stroke="#242727" stroke-width="3"/><path d="M73 87l14 29 11 21-9 5-14-17-18-23" fill="#73533e" stroke="#252a2b" stroke-width="3"/><path d="M14 81Q33 67 67 81l16-35 16-9 17 17-10 17-16-5-7 28q-13 25-43 11l-22-5Z" fill="#896344" stroke="#262d2d" stroke-width="3"/><path d="M88 45l-4-20 12 11 7-6 2 14" fill="#493a30"/><path d="M78 51l-12 26 13-6 7-28" fill="#392f2a"/><path d="M101 54h5" stroke="#eee0b9" stroke-width="3"/><path d="M93 45l-3 17 17 3m-17-3L58 78" fill="none" stroke="#d3b579" stroke-width="2"/><path d="M29 80l29-4 6 28-36 8Z" fill="${cloak}" stroke="${gold}" stroke-width="2"/><path d="M17 83Q0 81 4 111" fill="none" stroke="#3d3028" stroke-width="7"/></g><g transform="translate(6,-10) scale(.8)">${torso}${helmet}<path d="M49 102l23 10-5 25 13 5H62l-4-24-21-11" fill="${metal}" stroke="#283036" stroke-width="2"/><g class="weapon"><path d="M76 81L123 2" stroke="#b39766" stroke-width="4"/><path d="M126-4l-2 19-8-4Z" fill="${metal}"/>${arm}</g>${shield}</g>`;
  return `<svg class="unit-art unit-${type} ${extraClass}" viewBox="0 0 124 158" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}steel" x1="0" x2="1"><stop stop-color="#718082"/><stop offset=".4" stop-color="#d1d4c8"/><stop offset=".55" stop-color="#9daaaa"/><stop offset="1" stop-color="#4e5d62"/></linearGradient><linearGradient id="${id}gold"><stop stop-color="#8f703c"/><stop offset=".45" stop-color="#ead49a"/><stop offset="1" stop-color="#aa844b"/></linearGradient><linearGradient id="${id}cloth"><stop stop-color="${light}"/><stop offset=".35" stop-color="${cloth}"/><stop offset="1" stop-color="${north ? "#223f52" : "#592b2c"}"/></linearGradient></defs><ellipse cx="59" cy="150" rx="44" ry="6" fill="#0c1315" opacity=".3"/><g class="figure">${body}</g></svg>`;
}

export const ICONS = {
  sword: '<path d="M5 19L18 6l1-4-4 1L2 16m1-4l9 9m-7-4l-3 3"/>',
  bow: '<path d="M5 3q23 9 0 18L10 12Z M2 12h19m-4-4l4 4-4 4"/>',
  crown: '<path d="M3 7l4 12h10l4-12-6 4-3-7-3 7Z M7 22h10"/>',
  book: '<path d="M12 5Q7 1 2 4v16q5-3 10 1 5-4 10-1V4q-5-3-10 1v16"/>',
  music:
    '<path d="M9 18V5l12-3v13M9 8l12-3"/><ellipse cx="5" cy="18" rx="4" ry="3"/><ellipse cx="17" cy="15" rx="4" ry="3"/>',
  mute: '<path d="M9 18V5l12-3v13M9 8l12-3M2 2l20 20"/><ellipse cx="5" cy="18" rx="4" ry="3"/>',
  undo: '<path d="M8 4L2 10l6 6M3 10h11a7 7 0 010 14"/>',
  flip: '<path d="M4 9V4h5M4 4l7 7M20 15v5h-5m5 0l-7-7M16 3a10 10 0 016 10M8 21a10 10 0 01-6-10"/>',
  settings:
    '<circle cx="12" cy="12" r="4"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4M4 4l3 3m10 10l3 3M4 20l3-3M17 7l3-3"/>',
  flag: '<path d="M5 23V2q7-4 14 1v12q-7-5-14-1"/>',
  arrow: '<path d="M3 12h18m-7-7l7 7-7 7"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  download: '<path d="M12 2v13m-5-5l5 5 5-5M3 15v6h18v-6"/>',
  spark: '<path d="M12 1l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/>',
};
export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
