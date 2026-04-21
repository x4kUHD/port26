// Test calculations
const vp = {w: 400, h: 800}
const gap = 32;
const SLICE_COUNT = 10;
const activeSize = Math.min(0.7 * vp.w, 0.7 * vp.h);
console.log('activeSize', activeSize);
const inactiveH = Math.max(20, (vp.h - activeSize) / 2 - gap);
console.log('inactiveH', inactiveH);
let off = 0;
const active = 1;
for (let i = 0; i < active; i++) off += inactiveH + gap;
off += activeSize / 2;
console.log('ty', vp.h / 2 - off);
