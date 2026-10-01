// Stands in for the design kit's pixel-ui.js when baking in Node. The kit draws text with the Silkscreen
// web font through a canvas; the world art only uses it for the motel's sign, so this draws the same
// capitals from a small bitmap copy of Silkscreen's 5-pixel-high letters.
const GLYPHS = {
  A: ['0110', '1001', '1111', '1001', '1001'], E: ['1111', '1000', '1110', '1000', '1111'],
  L: ['1000', '1000', '1000', '1000', '1111'], M: ['10001', '11011', '10101', '10001', '10001'],
  O: ['0110', '1001', '1001', '1001', '0110'], T: ['11111', '00100', '00100', '00100', '00100']
};
const width = str => [...str].reduce((n, c) => n + (GLYPHS[c]?.[0].length ?? 3) + 1, -1);

// text(sprite, string, x, y, colour, size, shadow colour, align 'l' | 'c' | 'r'); the top of the capitals sits at y + 1.
export function text(s, str, x, y, color, size = 8, shadow = null, align = 'l') {
  let cx = align === 'c' ? x - (width(str) >> 1) : align === 'r' ? x - width(str) : x;
  for (const c of str) {
    const g = GLYPHS[c];
    if (g) g.forEach((row, j) => [...row].forEach((bit, i) => {
      if (bit !== '1') return;
      if (shadow) s.set(cx + i, y + 2 + j, shadow);
      s.set(cx + i, y + 1 + j, color);
    }));
    cx += (g?.[0].length ?? 3) + 1;
  }
}
