import { PIXEL_COUNT } from "../model";
import { ellipse, line, polygon, type Point } from "../raster";

export const PART = { tail: 1, farLeg: 2, body: 3, head: 4, frontLeg: 5, hindLeg: 6 } as const;
export interface BaseSprite {
  silhouette: Uint8Array;
  parts: Uint8Array;
  outline: Uint8Array;
  shadows: Uint8Array;
  highlights: Uint8Array;
  crest: Uint8Array;
  details: Uint8Array;
}

/**
 * Hand-authored 96×96 anatomy, not extracted/downsampled concept art.
 * Part order supplies occlusion. Lighting/creases are deliberately placed pixel clusters.
 */
export function createBaseSprite(): BaseSprite {
  const parts = new Uint8Array(PIXEL_COUNT);
  const shape = (points: readonly Point[], part: number) => polygon(parts, points, part);
  // Curled prehensile tail, tapering to the raised tip.
  shape([[74,46],[81,48],[86,54],[90,62],[91,72],[88,81],[82,87],[73,90],
    [65,89],[60,85],[58,80],[59,75],[62,72],[65,72],[64,76],[63,79],
    [65,83],[71,85],[78,83],[83,78],[85,71],[84,64],[80,58],[75,56]], PART.tail);
  // Far foreleg and hind leg.
  shape([[40,44],[40,49],[34,54],[27,55],[25,58],[22,57],[22,55],[20,55],
    [21,53],[24,52],[23,50],[25,49],[28,51],[32,50],[34,45]], PART.farLeg);
  shape([[70,51],[76,52],[76,60],[80,65],[78,68],[74,66],[71,68],[69,67],
    [70,64],[66,63],[66,59]], PART.farLeg);
  // Arched torso and tapered neck.
  shape([[29,33],[36,32],[43,37],[52,36],[65,37],[76,40],[82,46],[83,53],
    [80,60],[72,64],[58,63],[48,59],[39,53],[33,43]], PART.body);
  // Wedge head, chin and crown.
  shape([[6,32],[11,28],[16,25],[18,20],[23,19],[26,16],[30,17],[33,19],
    [38,20],[42,24],[43,29],[40,33],[37,38],[31,42],[24,40],[20,37],
    [11,39],[7,37],[6,35]], PART.head);
  // Near hind haunch, bent leg and separately splayed adhesive toe pads.
  shape([[71,50],[78,51],[82,56],[81,62],[76,67],[74,70],[76,71],[78,71],
    [79,73],[77,74],[73,72],[72,74],[71,77],[69,77],[69,74],[68,72],
    [65,74],[63,74],[62,72],[65,70],[69,70],[70,67],[70,61],[67,57]], PART.hindLeg);
  // Near foreleg, elbow and toes.
  shape([[38,42],[43,44],[46,49],[45,55],[40,61],[37,63],[36,66],[39,67],
    [39,69],[37,70],[34,68],[33,71],[31,72],[29,71],[30,67],[28,68],
    [25,68],[24,66],[27,64],[30,64],[33,61],[35,57],[37,52],[35,47]], PART.frontLeg);
  for (const [x, y] of [[25,66],[31,71],[38,69]] as Point[]) ellipse(parts, x, y, 1.4, 1.2, PART.frontLeg);
  for (const [x, y] of [[63,73],[70,76],[78,73]] as Point[]) ellipse(parts, x, y, 1.4, 1.2, PART.hindLeg);

  const crest = new Uint8Array(PIXEL_COUNT);
  const headCrest: Point[] = [[18,20],[21,19],[24,18],[27,17],[30,18],[33,20],[36,21],[39,23]];
  for (const [x, y] of headCrest) {
    polygon(crest, [[x-1,y+2],[x,y-3],[x+1,y-2],[x+3,y+3]]);
  }
  // Continuous row of small back crests.
  for (let x = 42; x < 80; x += 3) {
    const y = Math.round(36 + ((x - 51) / 27) ** 2 * 5);
    polygon(crest, [[x-1,y+2],[x,y-2],[x+1,y-1],[x+2,y+3]]);
  }
  for (let i = 0; i < PIXEL_COUNT; i++) if (crest[i] && !parts[i]) parts[i] = PART.body;
  const silhouette = Uint8Array.from(parts, (value) => value ? 255 : 0);
  const outline = new Uint8Array(PIXEL_COUNT);
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const i = y * 96 + x;
      if (parts[i] && (x === 0 || y === 0 || x === 95 || y === 95 ||
        !parts[i-1] || !parts[i+1] || !parts[i-96] || !parts[i+96])) outline[i] = 255;
    }
  }

  const shadows = new Uint8Array(PIXEL_COUNT);
  ellipse(shadows, 62, 53, 18, 9, 55);
  polygon(shadows, [[43,40],[49,42],[52,47],[48,53],[44,50],[41,44]], 50);
  polygon(shadows, [[8,35],[24,35],[33,31],[40,28],[39,36],[30,42],[19,38]], 105);
  polygon(shadows, [[31,38],[35,40],[43,53],[51,58],[64,60],[75,58],[81,53],
    [82,63],[59,65],[43,57]], 90);
  polygon(shadows, [[36,45],[40,49],[40,55],[34,63],[33,68],[30,68],[32,61],[35,55]], 90);
  polygon(shadows, [[69,54],[73,56],[75,61],[72,67],[71,72],[67,72],[70,66]], 100);
  polygon(shadows, [[83,53],[88,61],[88,73],[83,82],[72,87],[63,85],[61,80],
    [61,86],[72,91],[85,87],[91,76],[91,64]], 105);
  for (let i = 0; i < PIXEL_COUNT; i++) {
    if (parts[i] === PART.farLeg) shadows[i] = 135;
    if (!parts[i] || outline[i]) shadows[i] = 0;
  }
  const highlights = new Uint8Array(PIXEL_COUNT);
  ellipse(highlights, 60, 44, 17, 4, 65);
  ellipse(highlights, 14, 32, 5, 2, 115);
  polygon(highlights, [[9,31],[21,25],[24,21],[32,22],[38,26],[31,28],[22,28],[13,33]], 150);
  polygon(highlights, [[37,34],[43,39],[58,38],[71,41],[77,44],[67,43],[55,41],[44,43]], 140);
  ellipse(highlights, 75, 55, 4, 3, 115);
  line(highlights, [40,47], [42,53], 100);
  line(highlights, [42,55], [36,62], 100);
  line(highlights, [88,63], [88,73], 115);
  line(highlights, [84,79], [79,84], 115);
  line(highlights, [70,87], [64,85], 110);
  for (let i = 0; i < PIXEL_COUNT; i++) if (!parts[i] || outline[i]) highlights[i] = 0;

  // Value-coded detail palette: 1 dark ink, 2 warm lid, 3 amber, 4 gold, 5 white, 6 cream.
  const details = new Uint8Array(PIXEL_COUNT);
  ellipse(details, 25, 28, 5.4, 5.8, 1);
  ellipse(details, 25, 28, 4.4, 4.8, 2);
  ellipse(details, 25, 28, 3.5, 4.2, 3);
  ellipse(details, 26, 27, 2.5, 3.5, 4);
  polygon(details, [[25,23],[27,24],[27,31],[26,33],[25,31]], 1);
  line(details, [23,24], [23,26], 5);
  details[25*96+24] = 5;
  details[32*96+10] = 1; // Nostril.
  line(details, [8,35], [19,35], 1);
  line(details, [20,35], [24,34], 1);
  line(details, [11,36], [23,36], 6);
  line(details, [30,35], [34,33], 2);
  line(details, [37,39], [41,43], 2);
  line(details, [72,56], [75,58], 2);
  line(details, [73,58], [73,62], 2);
  // Authored scale clusters follow facial, dorsal and tail anatomy, never random noise.
  const scales: Point[] = [[15,29],[18,28],[20,24],[29,21],[33,23],[35,25],[16,33],[19,32],
    [31,37],[33,39],[36,41],[46,41],[49,40],[54,41],[58,41],[63,42],[68,43],[73,45],
    [48,53],[51,55],[57,56],[62,57],[68,58],[78,54],[77,57],
    [86,61],[87,66],[87,71],[85,76],[81,81],[75,85],[67,85],[62,79],
    [39,49],[42,51],[39,56],[35,61],[72,64]];
  for (const [x,y] of scales) {
    details[y*96+x] = 6;
    if (parts[y*96+x+1]) details[y*96+x+1] = 2;
  }
  // Small, deliberately placed diamond scales with local shading.
  for (const [x,y] of [[44,47],[50,49],[56,47],[62,50],[68,47],[72,51],
    [47,54],[55,55],[63,56],[33,32],[17,30],[80,59],[86,70]] as Point[]) {
    details[y*96+x] = 2;
    details[(y-1)*96+x] = 6;
    details[y*96+x+1] = 6;
  }
  for (let i = 0; i < PIXEL_COUNT; i++) if (!parts[i]) details[i] = 0;
  return { silhouette, parts, outline, shadows, highlights, crest, details };
}
