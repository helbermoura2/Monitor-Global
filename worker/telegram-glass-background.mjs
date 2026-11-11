// Preserve the unpainted tsunami strip in an ancillary PNG chunk so bulletin-only
// edits restore the exact archived cartography, even during a map/ShakeMap outage.
const tag=new TextEncoder().encode('mgBg');
const u32=(n)=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n);return b;};
const join=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
export function captureBackground(rgba,width){return rgba.slice(1240*width*4,1435*width*4);}
export async function attachBackground(png,raw){const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());const body=join(tag,compressed);return join(png.slice(0,-12),u32(compressed.length),body,u32(crc(body)),png.slice(-12));}
export async function restoreBackground(png,image){for(let at=8;at+12<=png.length;){const size=new DataView(png.buffer,png.byteOffset+at,4).getUint32(0);if(at+12+size>png.length)break;if(tag.every((v,i)=>png[at+4+i]===v)){const data=png.slice(at+8,at+8+size);if(data.length>1500000)throw Error('Invalid glass background');const raw=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());if(raw.length!==195*1080*4)throw Error('Invalid glass background dimensions');image.rgba.set(raw,1240*1080*4);return raw;}at+=size+12;}throw Error('Archived glass background unavailable');}
