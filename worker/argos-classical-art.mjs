// Offline pixel template derived from the exact approved Argos Orbis image.
// Split into six small source modules to keep reviewable code and avoid external fetches.
import a from './argos-classical-art-part1.mjs';
import b from './argos-classical-art-part2.mjs';
import c from './argos-classical-art-part3.mjs';
import d from './argos-classical-art-part4.mjs';
import e from './argos-classical-art-part5.mjs';
import f from './argos-classical-art-part6.mjs';
export const APPROVED_DAILY_ART_BASE64=a+b+c+d+e+f;
