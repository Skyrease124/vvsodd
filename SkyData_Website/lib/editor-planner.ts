// SkyData Editor: turns an edit request ("make it brighter and black and white") into an edit plan, a list of
// {command, params} steps for the PhotoCraft engine. Free, offline and deterministic: common phrases only.
// The engine (public/editor-engine) checks every command and parameter against its own allow-list again.
// Ported from the Creative Engine prototype (branch claude/creative-engine-poc, web/planner.js).

// `mask` is filled in by the Editor page (lib/cutout.ts) for cutout steps (skydata.*) before they run.
export type EditStep = { command: string; params?: Record<string, unknown>; mask?: { width: number; height: number; data: Uint8Array } };
export type EditContext = { width: number; height: number };
// `complete` is false when part of the request matched no phrase (the Editor then asks SkyData's AI planner).
export type EditPlan = { undo: true; steps?: undefined; reply?: undefined; complete?: undefined } | { undo?: undefined; steps: EditStep[]; reply: string; complete: boolean };
type Rule = {
  re: RegExp;
  test?: (text: string) => boolean;
  say?: string | ((text: string, ctx: EditContext) => string);
  steps?: (text: string, ctx: EditContext) => EditStep[];
  special?: 'undo' | 'unsupported';
  why?: string;
  needsSize?: boolean;
};

const num = (text: string, fallback: number) => {
  const m = text.match(/(-?\d+(?:\.\d+)?)\s*(%|px|percent|degrees?|°)?/);
  return m ? Number(m[1]) : fallback;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function centredCrop(ctx: EditContext, ratioW: number, ratioH: number): EditStep {
  const { width: w, height: h } = ctx;
  let cw = w;
  let ch = Math.round((w * ratioH) / ratioW);
  if (ch > h) {
    ch = h;
    cw = Math.round((h * ratioW) / ratioH);
  }
  return { command: 'image.crop', params: { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), width: cw, height: ch } };
}

const COLOURS: Record<string, string> = { white: '#ffffff', black: '#000000', grey: '#808080', gray: '#808080', red: '#d32f2f', blue: '#1e63d6', green: '#2e7d32', yellow: '#f5c518', pink: '#f48fb1', purple: '#7b1fa2', orange: '#ef6c00' };
const COLOUR_WORD = new RegExp(`\\b(${Object.keys(COLOURS).join('|')})\\b`);
// A part of a people photo: the person is found on the device (lib/cutout.ts) when the step runs.
const part = (region: string, steps: EditStep[]): EditStep => ({ command: 'skydata.region', params: { region, steps } });
const BW = /\b(black (and|&|n) white|b ?& ?w|gr[ae]yscale|monochrome)\b/;

// Each rule: a pattern, the steps it produces, and the words shown back to the user.
const RULES: Rule[] = [
  { re: /\b(undo|go back|revert)\b/, special: 'undo' },
  // People photos: background and parts of the person. These come first so "black and white background" changes only the background.
  { re: /\b(remove|delete|erase|cut out|take out|get rid of|lose|drop)\s+(the |my |this |that |all the )?(background|backdrop)\b|\b(transparent|no|without( a| the)?) background\b|\bbackground (removed|gone)\b|\bcut me out\b/, say: 'removed the background (see-through; Download PNG keeps it that way)', steps: () => [{ command: 'skydata.removeBackground', params: {} }] },
  { re: /\b(colou?r splash|splash of colou?r)\b|\b(background|backdrop)\b.*\b(black (and|&|n) white|b ?& ?w|gr[ae]yscale|monochrome)\b|\b(black (and|&|n) white|b ?& ?w|gr[ae]yscale|monochrome)\b.*\b(background|backdrop)\b/, say: 'black-and-white background, person in colour', steps: () => [part('background', [{ command: 'image.adjustments.blackWhite', params: {} }])] },
  { re: /\b(background|backdrop)\b/, test: (t) => COLOUR_WORD.test(t) && !BW.test(t) && !/\b(blur|darker|darken|brighter|brighten)\b/.test(t), say: (t) => `${t.match(COLOUR_WORD)![1]} background`, steps: (t) => [{ command: 'skydata.removeBackground', params: { color: COLOURS[t.match(COLOUR_WORD)![1]] } }] },
  { re: /\b(blur\w*|bokeh|soften|soft|out of focus)\b.*\b(background|backdrop)\b|\b(background|backdrop)\b.*\bblur\w*|\bbokeh\b|\bportrait mode\b/, needsSize: true, say: 'blurred the background', steps: (t, ctx) => [part('background', [{ command: 'filter.blur.gaussianBlur', params: { radius: clamp(Math.round(Math.max(ctx.width, ctx.height) / 90), 4, 40) } }])] },
  { re: /\b(dark\w*|dim\w*)\b.*\b(background|backdrop)\b|\b(background|backdrop)\b.*\b(dark\w*|dim\w*)\b/, say: 'darker background', steps: () => [part('background', [{ command: 'image.adjustments.exposure', params: { exposure: -1 } }])] },
  { re: /\b(bright\w*|light\w*)\b.*\b(background|backdrop)\b|\b(background|backdrop)\b.*\b(bright\w*|light\w*)\b/, say: 'brighter background', steps: () => [part('background', [{ command: 'image.adjustments.exposure', params: { exposure: 0.7 } }])] },
  { re: /\b(smooth\w*|soften|clear\w*|even)\b.*\bskin\b|\bskin\b.*\b(smooth\w*|soft\w*)\b|\b(retouch\w*|airbrush\w*|touch ?up)\b/, needsSize: true, say: 'smoothed the skin', steps: (t, ctx) => [part('skin', [{ command: 'filter.blur.surfaceBlur', params: { radius: clamp(Math.round(Math.max(ctx.width, ctx.height) / 220), 3, 12), threshold: 14 } }])] },
  { re: /\b(bright\w*|light\w*)\b.*\b(face|my face)\b|\b(face)\b.*\b(bright\w*|light\w*)\b/, say: 'brightened the face', steps: () => [part('face', [{ command: 'image.adjustments.exposure', params: { exposure: 0.35 } }])] },
  { re: /\b(pop|stand out)\b.*\b(me|person|subject|him|her|them)\b|\b(make|let) (me|the person) (pop|stand out)\b/, say: 'made the person stand out (background darker and softer)', steps: () => [part('background', [{ command: 'image.adjustments.exposure', params: { exposure: -0.6 } }, { command: 'image.adjustments.hueSaturation', params: { saturation: -25 } }])] },
  { re: /\b(auto|enhance|fix|improve|better)\b/, say: 'auto-enhanced (tone, colour, a little vibrance)', steps: () => [{ command: 'image.autoTone' }, { command: 'image.autoColor' }, { command: 'image.adjustments.vibrance', params: { vibrance: 15 } }] },
  { re: /\b(sepia|vintage|old[- ]?(school|photo)|retro)\b/, say: 'sepia tone', steps: () => [{ command: 'image.adjustments.desaturate' }, { command: 'image.adjustments.photoFilter', params: { filter: 'sepia', density: 80 } }] },
  { re: /\b(black (and|&|n) white|b ?& ?w|grayscale|greyscale|monochrome|mono)\b/, say: 'black and white', steps: () => [{ command: 'image.adjustments.blackWhite', params: {} }] },
  { re: /\b(negative|invert)\b/, say: 'inverted colours', steps: () => [{ command: 'image.adjustments.invert' }] },
  { re: /\b(brighter|brighten|lighter|lighten)\b/, say: (t) => `brighter (+${clamp(num(t, 30), 1, 150)})`, steps: (t) => [{ command: 'image.adjustments.brightnessContrast', params: { brightness: clamp(num(t, 30), 1, 150) } }] },
  { re: /\b(darker|darken|dimmer)\b/, say: (t) => `darker (−${clamp(Math.abs(num(t, 30)), 1, 150)})`, steps: (t) => [{ command: 'image.adjustments.brightnessContrast', params: { brightness: -clamp(Math.abs(num(t, 30)), 1, 150) } }] },
  { re: /\b(less|lower|reduce|decrease)\b.*\bcontrast\b|\bflatter\b/, say: 'less contrast', steps: (t) => [{ command: 'image.adjustments.brightnessContrast', params: { contrast: -clamp(Math.abs(num(t, 25)), 1, 50) } }] },
  { re: /\bcontrast\b|\bpunchier\b/, say: 'more contrast', steps: (t) => [{ command: 'image.adjustments.brightnessContrast', params: { contrast: clamp(num(t, 25), 1, 100) } }] },
  { re: /\b(less|lower|reduce|decrease)\b.*\b(saturat\w*|colou?r)\b|\b(muted|desaturate|washed out|faded)\b/, say: 'muted colours', steps: (t) => [{ command: 'image.adjustments.hueSaturation', params: { saturation: -clamp(Math.abs(num(t, 40)), 1, 100) } }] },
  { re: /\b(saturat\w*|vibran\w*|vivid|colou?rful|pop)\b/, say: 'more vibrant colours', steps: (t) => [{ command: 'image.adjustments.vibrance', params: { vibrance: clamp(num(t, 40), 1, 100) } }] },
  { re: /\b(warmer|warm|golden)\b/, say: 'warmer', steps: () => [{ command: 'image.adjustments.photoFilter', params: { filter: 'warming85', density: 35 } }] },
  { re: /\b(cooler|cool|colder|cold|blue tone)\b/, say: 'cooler', steps: () => [{ command: 'image.adjustments.photoFilter', params: { filter: 'cooling80', density: 35 } }] },
  { re: /\b(exposure|overexpose|underexpose)\b/, say: (t) => `exposure ${num(t, 1) >= 0 ? '+' : ''}${clamp(num(t, 1), -5, 5)} stops`, steps: (t) => [{ command: 'image.adjustments.exposure', params: { exposure: clamp(num(t, 1), -5, 5) } }] },
  { re: /\b(motion blur)\b/, say: 'motion blur', steps: (t) => [{ command: 'filter.blur.motionBlur', params: { angle: 0, distance: clamp(num(t, 20), 1, 200) } }] },
  { re: /\b(blur|blurry|soften|soft focus)\b/, say: (t) => `blurred (radius ${clamp(num(t, 4), 0.1, 100)})`, steps: (t) => [{ command: 'filter.blur.gaussianBlur', params: { radius: clamp(num(t, 4), 0.1, 100) } }] },
  { re: /\b(denoise|reduce noise|less noise|noise reduction|clean up)\b/, say: 'noise reduced', steps: () => [{ command: 'filter.noise.reduceNoise', params: { strength: 6 } }] },
  { re: /\b(sharpen|sharper|crisper|crisp)\b/, say: 'sharpened', steps: () => [{ command: 'filter.sharpen.unsharpMask', params: { amount: 80, radius: 1.5, threshold: 0 } }] },
  { re: /\b(grain|film grain|noise)\b/, say: 'film grain', steps: () => [{ command: 'filter.noise.addNoise', params: { amount: 8, distribution: 'gaussian', monochromatic: true } }] },
  { re: /\b(pixelate|pixelated|mosaic|8[- ]?bit)\b/, say: 'pixelated', steps: (t) => [{ command: 'filter.pixelate.mosaic', params: { cellSize: clamp(num(t, 12), 2, 200) } }] },
  { re: /\b(oil paint\w*|painting|painted)\b/, say: 'oil-paint effect', steps: () => [{ command: 'filter.stylize.oilPaint', params: {} }] },
  { re: /\b(emboss\w*)\b/, say: 'embossed', steps: () => [{ command: 'filter.stylize.emboss', params: {} }] },
  { re: /\b(posteri[sz]e|poster)\b/, say: 'posterised', steps: (t) => [{ command: 'image.adjustments.posterize', params: { levels: clamp(num(t, 5), 2, 255) } }] },
  { re: /\b(flip|mirror)\b.*\b(vertical\w*|upside)\b/, say: 'flipped vertically', steps: () => [{ command: 'image.imageRotation.flipCanvasVertical' }] },
  { re: /\b(upside down|rotate 180|180)\b/, say: 'rotated 180°', steps: () => [{ command: 'image.imageRotation.180' }] },
  { re: /\brotate\b.*\b(left|counter ?clockwise|anti ?clockwise|ccw)\b/, say: 'rotated 90° left', steps: () => [{ command: 'image.imageRotation.90ccw' }] },
  { re: /\brotate\b.*\b(\d+(\.\d+)?)\s*(degrees?|°)/, say: (t) => `rotated ${num(t.replace(/^.*?rotate/, ''), 0)}°`, steps: (t) => [{ command: 'image.rotation.arbitrary', params: { angle: clamp(num(t.replace(/^.*?rotate/, ''), 0), -359, 359), direction: 'cw' } }] },
  { re: /\b(rotate|turn)\b/, say: 'rotated 90° right', steps: () => [{ command: 'image.imageRotation.90cw' }] },
  { re: /\b(flip|mirror)\b/, say: 'mirrored', steps: () => [{ command: 'image.imageRotation.flipCanvasHorizontal' }] },
  { re: /\b(square|1:1|instagram)\b/, needsSize: true, say: 'cropped to a centred square', steps: (t, ctx) => [centredCrop(ctx, 1, 1)] },
  { re: /\b(16:9|widescreen|youtube)\b/, needsSize: true, say: 'cropped to 16:9', steps: (t, ctx) => [centredCrop(ctx, 16, 9)] },
  { re: /\b(9:16|story|stories|tiktok|reel)\b/, needsSize: true, say: 'cropped to 9:16', steps: (t, ctx) => [centredCrop(ctx, 9, 16)] },
  { re: /\b(4:5|portrait crop)\b/, needsSize: true, say: 'cropped to 4:5', steps: (t, ctx) => [centredCrop(ctx, 4, 5)] },
  {
    re: /\b(resize|smaller|shrink|scale|width|wide)\b/,
    needsSize: true,
    say: (t, ctx) => {
      const s = resizeTo(t, ctx);
      return `resized to ${s.width}×${s.height}`;
    },
    steps: (t, ctx) => [{ command: 'image.imageSize', params: resizeTo(t, ctx) }],
  },
];

function resizeTo(text: string, ctx: EditContext) {
  const { width: w, height: h } = ctx;
  const pct = text.match(/(\d+(?:\.\d+)?)\s*(%|percent)/);
  const px = text.match(/(\d{2,5})\s*(px|pixels?)?\s*(wide|width)?/);
  let width = Math.round(w / 2);
  if (pct) width = Math.round((w * clamp(Number(pct[1]), 1, 100)) / 100);
  else if (px) width = clamp(Number(px[1]), 16, w);
  return { width, height: Math.max(1, Math.round((h * width) / w)), resample: 'bicubic' };
}

/** Split a chat message into clauses ("a, b and then c") and match each one. */
export function planWithRules(message: string, ctx: EditContext | null): EditPlan {
  const text = message.toLowerCase().replace(/[’']/g, '');
  const clauses = text.split(/,|;|\band then\b|\bthen\b|\band\b(?! white)|\bplus\b|\balso\b/).map((c) => c.trim()).filter(Boolean);
  const steps: EditStep[] = [];
  const said: string[] = [];
  const unknown: string[] = [];
  for (const clause of clauses) {
    const rule = RULES.find((r) => r.re.test(clause) && (!r.test || r.test(clause)));
    if (!rule) {
      unknown.push(clause);
      continue;
    }
    if (rule.special === 'undo') return { undo: true };
    if (rule.special === 'unsupported') return { steps: [], reply: rule.why ?? '', complete: true };
    if (rule.needsSize && !ctx?.width) {
      unknown.push(clause);
      continue;
    }
    steps.push(...rule.steps!(clause, ctx!));
    said.push(typeof rule.say === 'function' ? rule.say(clause, ctx!) : rule.say ?? '');
  }
  if (steps.length === 0) {
    return { steps: [], reply: `I could not match "${message}" to an edit yet. Try: brighter, darker, more contrast, black and white, sepia, warmer, cooler, vibrant, blur 4, sharpen, rotate left, flip, square crop, 9:16, resize 50%, oil paint, pixelate, auto enhance.`, complete: false };
  }
  const extra = unknown.length ? ` (I skipped: ${unknown.map((u) => `"${u}"`).join(', ')})` : '';
  return { steps, reply: `Done: ${said.join(', ')}${extra}.`, complete: unknown.length === 0 };
}
