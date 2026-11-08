// 引き継ぎの文字（14夜目）：セーブを縮めて文字にし、別の端末で貼りつけて読みこむ。DOM非依存（ブラウザとNodeの CompressionStream を使う）
import type { GameState } from './state';
import { serialize, deserialize } from './save';

const HEAD_Z = 'RIMINA1:'; // 縮めたもの（deflate-raw ＋ base64url）
const HEAD_RAW = 'RIMINA0:'; // 縮められない端末（そのまま base64url）

function toB64(u8: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < u8.length; i += step) bin += String.fromCharCode(...u8.subarray(i, i + step));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(t: string): Uint8Array {
  const s = t.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
async function pipe(data: Uint8Array, stream: unknown): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}
function canZip(): boolean { return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'; }

/** セーブを引き継ぎの文字に（長いが、そのままコピーできる） */
export async function encodeTransfer(s: GameState): Promise<string> {
  const raw = new TextEncoder().encode(serialize(s));
  if (canZip()) {
    try { return HEAD_Z + toB64(await pipe(raw, new CompressionStream('deflate-raw' as CompressionFormat))); } catch { /* 縮められないときはそのまま */ }
  }
  return HEAD_RAW + toB64(raw);
}

/** 引き継ぎの文字を読みこむ（前後の空白・改行・途中の改行は無視する）。壊れていれば例外 */
export async function decodeTransfer(text: string): Promise<GameState> {
  const t = text.replace(/\s+/g, '');
  if (t.startsWith('{')) return deserialize(t); // 書き出したファイルの中身をそのまま貼った
  let body: Uint8Array;
  if (t.startsWith(HEAD_Z)) {
    if (!canZip()) throw new Error('この端末のブラウザでは、縮めた文字を読めません。ブラウザを新しくしてください');
    try { body = await pipe(fromB64(t.slice(HEAD_Z.length)), new DecompressionStream('deflate-raw' as CompressionFormat)); }
    catch { throw new Error('文字が途中で切れているか、まちがっています。最後までコピーできているか確かめてください'); }
  } else if (t.startsWith(HEAD_RAW)) body = fromB64(t.slice(HEAD_RAW.length));
  else throw new Error('引き継ぎの文字ではありません（「RIMINA」で始まる文字を貼りつけてください）');
  return deserialize(new TextDecoder().decode(body));
}
