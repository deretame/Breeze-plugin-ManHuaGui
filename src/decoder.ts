/**
 * 漫画柜阅读页图片 URL 解密器。
 *
 * 解密流程：
 * 1. 从阅读页 HTML 的 packed script 中提取 base64 大字符串。
 * 2. 用 LZString.decompressFromBase64 解压并按 "|" split，得到单词表。
 * 3. 用 Dean Edwards Packer 还原模板，得到 SMH.imgData({...}).preInit() 中的 JSON。
 * 4. 根据 JSON 中的 path / files / cid / sl 拼接真实图片 URL。
 */

// ---------------------------------------------------------------------------
// LZ-string minimal decompressFromBase64 (MIT, adapted from pieroxy/lz-string)
// ---------------------------------------------------------------------------

const keyStrBase64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

function getBaseValue(alphabet: string, character: string): number {
  const idx = alphabet.indexOf(character);
  if (idx === -1) throw new Error(`Invalid base64 character: ${character}`);
  return idx;
}

function _decompress(
  length: number,
  resetValue: number,
  getNextValue: (idx: number) => number,
): string {
  const dictionary: string[] = [];
  const result: string[] = [];
  const data = {
    val: getNextValue(0),
    position: resetValue,
    index: 1,
  };
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let entry = "";
  let c: string | number;
  let bits = 0;
  let maxpower = Math.pow(2, 2);
  let power = 1;

  for (let i = 0; i < 3; i += 1) {
    dictionary[i] = String(i);
  }

  while (power !== maxpower) {
    const resb = data.val & data.position;
    data.position >>= 1;
    if (data.position === 0) {
      data.position = resetValue;
      data.val = getNextValue(data.index++);
    }
    bits |= (resb > 0 ? 1 : 0) * power;
    power <<= 1;
  }

  switch (bits) {
    case 0:
      bits = 0;
      maxpower = Math.pow(2, 8);
      power = 1;
      while (power !== maxpower) {
        const resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = String.fromCharCode(bits);
      break;
    case 1:
      bits = 0;
      maxpower = Math.pow(2, 16);
      power = 1;
      while (power !== maxpower) {
        const resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = String.fromCharCode(bits);
      break;
    case 2:
      return "";
    default:
      return "";
  }

  dictionary[3] = String(c);
  let w = String(c);
  result.push(String(c));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (data.index > length) return "";
    bits = 0;
    maxpower = Math.pow(2, numBits);
    power = 1;
    while (power !== maxpower) {
      const resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch ((c = bits)) {
      case 0:
        bits = 0;
        maxpower = Math.pow(2, 8);
        power = 1;
        while (power !== maxpower) {
          const resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        dictionary[dictSize++] = String.fromCharCode(bits);
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 1:
        bits = 0;
        maxpower = Math.pow(2, 16);
        power = 1;
        while (power !== maxpower) {
          const resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        dictionary[dictSize++] = String.fromCharCode(bits);
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 2:
        return result.join("");
    }

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits++;
    }

    if (dictionary[c]) {
      entry = String(dictionary[c]);
    } else if (c === dictSize && typeof w === "string") {
      entry = w + w.charAt(0);
    } else {
      return null as unknown as string;
    }

    result.push(entry);
    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn--;
    w = entry;

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits++;
    }
  }
}

function decompressFromBase64(input: string): string | null {
  if (!input) return "";
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, "");
  return _decompress(clean.length, 32, (index) =>
    getBaseValue(keyStrBase64, clean.charAt(index)),
  );
}

// ---------------------------------------------------------------------------
// Dean Edwards Packer unpacker (支持 base-36 / base-62)
// ---------------------------------------------------------------------------

// Dean Edwards Packer 使用的字符集：0-9, a-z, A-Z
const PACKER_CHARS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function toPackerBase(n: number, radix: number): string {
  if (n === 0) return "0";
  let result = "";
  let num = n;
  while (num > 0) {
    const remainder = num % radix;
    const char =
      remainder > 35
        ? String.fromCharCode(remainder + 29)
        : PACKER_CHARS[remainder];
    result = char + result;
    num = Math.floor(num / radix);
  }
  return result;
}

function unpackPacker(packed: string, words: string[], a: number): string {
  const c = words.length;
  const d: Record<string, string> = {};
  const toBase = (n: number) => toPackerBase(n, a);

  for (let i = 0; i < c; i++) {
    const key = toBase(i);
    d[key] = words[i] || key;
  }

  let result = packed;
  // 从大到小替换，避免短 key 误匹配长 key 的一部分
  for (let i = c - 1; i >= 0; i--) {
    const key = toBase(i);
    const value = d[key];
    if (value === key) continue;
    const regex = new RegExp(
      `\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "g",
    );
    result = result.replace(regex, value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// extract packed data from reading page HTML
// ---------------------------------------------------------------------------

function extractPackedScript(html: string): string | null {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1];
    if (content.includes("function(p,a,c,k,e,d)")) {
      return content;
    }
  }
  return null;
}

function extractBase64String(script: string): string | null {
  // 匹配较长的 base64 字符串，并且后面跟着 ['\x73\x70\x6c\x69\x63']('\x7c') 或 .splice('|')
  const regex = /['"]([A-Za-z0-9+/=]{200,})['"]\s*(?:\[|\.splice)/;
  const m = script.match(regex);
  return m?.[1] ?? null;
}

function extractTemplateAndBase(
  script: string,
): { template: string; base: number } | null {
  // Packer 调用形如：
  // }('TEMPLATE',62,67,'BASE64'['\x73\x70\x6c\x69\x63']('\x7c'),0,{})
  // 或 }('TEMPLATE',36,50,'BASE64'.splice('|'),0,{})
  const m = script.match(/}\('((?:\\.|[^'\\])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,/);
  if (m) {
    return {
      template: m[1].replace(/\\'/g, "'"),
      base: Number(m[2]),
    };
  }
  const m2 = script.match(/}\("((?:\\.|[^"\\])*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,/);
  if (m2) {
    return {
      template: m2[1].replace(/\\"/g, '"'),
      base: Number(m2[2]),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export type ImageData = {
  bid: number;
  bname: string;
  bpic: string;
  cid: number;
  cname: string;
  files: string[];
  finished: boolean;
  len: number;
  path: string;
  status: number;
  block_cc: string;
  nextId?: number;
  prevId?: number;
  sl: { e: number; m: string };
};

export function decodeImageData(html: string): ImageData {
  const script = extractPackedScript(html);
  if (!script) throw new Error("未找到 packed script");

  const base64 = extractBase64String(script);
  if (!base64) throw new Error("未找到 base64 字符串");

  const decoded = decompressFromBase64(base64);
  if (!decoded) throw new Error("LZString 解压失败");

  const words = decoded.split("|");
  const packInfo = extractTemplateAndBase(script);
  if (!packInfo) throw new Error("未找到 Packer 模板");

  const unpacked = unpackPacker(packInfo.template, words, packInfo.base);

  const jsonMatch = unpacked.match(
    /SMH\.imgData\((\{[\s\S]*?\})\)\.preInit\(\)/,
  );
  if (!jsonMatch) throw new Error("未找到 SMH.imgData JSON");

  const data = JSON.parse(jsonMatch[1]) as ImageData;
  return data;
}

export function buildImageUrlFromData(
  path: string,
  file: string,
  cid: number,
  sl: { e: number; m: string },
): string {
  // 漫画柜图片实际访问地址：去掉 .webp 后缀，使用 i.hamreus.com + cid + md5
  const baseFile = file.replace(/\.webp$/i, "");
  return `https://i.hamreus.com${path}${baseFile}?cid=${cid}&md5=${sl.m}`;
}

export function decodeImageUrls(html: string): string[] {
  const data = decodeImageData(html);
  return data.files.map((file) =>
    buildImageUrlFromData(data.path, file, data.cid, data.sl),
  );
}
