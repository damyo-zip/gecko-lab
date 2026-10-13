import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// Authored pixel logo. No concept art is modified and no external image service is used.
const logo = [
  "................", "..........cc....", ".....gggg.cc....", "....gggggg......",
  "...gggggggg.....", "..gggggggggg....", "..gg..gg..ggg...", "..gg..gg..ggg...",
  "..gg..ggggggg...", "..ggggggggggg...", "...ggggggggg....", "....ggggggg.....",
  ".....ggggg......", "................", "................", "................",
];
const colors = { ".": [17, 27, 25], g: [168, 207, 142], c: [228, 188, 122] };
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const label = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([size, label, data, crc]);
}
mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = colors[logo[Math.floor(y * 16 / size)][Math.floor(x * 16 / size)]];
      rows.set(color, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 2;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
  writeFileSync("public/icons/icon-" + size + ".png", png);
}
