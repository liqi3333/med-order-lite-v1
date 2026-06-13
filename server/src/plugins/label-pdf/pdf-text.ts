import zlib from "node:zlib";

function stripDataUrl(value: string): string {
  return value.replace(/^data:application\/pdf;base64,/, "").trim();
}

function decodePdfString(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== "\\") { out += ch; continue; }
    const next = value[++i];
    if (!next) break;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else if (["\\", "(", ")"].includes(next)) out += next;
    else if (/[0-7]/.test(next)) {
      let oct = next;
      for (let j = 0; j < 2 && /[0-7]/.test(value[i + 1] || ""); j += 1) oct += value[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else out += next;
  }
  return out;
}

function decodeHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  if (!clean) return "";
  const bytes = Buffer.from(clean.length % 2 ? `${clean}0` : clean, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return bytes.slice(2).toString("utf16le").replace(/([\u0000-\u00ff])([\u0000-\u00ff])/g, "$2$1");
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.slice(2).toString("utf16le");
  return bytes.toString("utf8");
}

function extractTextFromContent(content: string): string {
  const texts: string[] = [];
  const literal = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(content))) texts.push(decodePdfString(match[0].replace(/\s*Tj$/, "").slice(1, -1)));

  const arrays = /\[([\s\S]*?)\]\s*TJ/g;
  while ((match = arrays.exec(content))) {
    const part = match[1];
    const pieces: string[] = [];
    const literalPieces = /\((?:\\.|[^\\)])*\)|<([0-9a-fA-F\s]+)>/g;
    let piece: RegExpExecArray | null;
    while ((piece = literalPieces.exec(part))) {
      const token = piece[0];
      if (token.startsWith("(")) pieces.push(decodePdfString(token.slice(1, -1)));
      else pieces.push(decodeHexString(piece[1] || ""));
    }
    if (pieces.length) texts.push(pieces.join(""));
  }

  const hex = /<([0-9a-fA-F\s]{4,})>\s*Tj/g;
  while ((match = hex.exec(content))) texts.push(decodeHexString(match[1]));
  return texts.join("\n");
}

function extractStreams(raw: string): string[] {
  const contents: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw))) {
    const streamData = match[1];
    const before = raw.slice(Math.max(0, match.index - 500), match.index);
    if (/\/FlateDecode/.test(before)) {
      try {
        const inflated = zlib.inflateSync(Buffer.from(streamData, "latin1"));
        contents.push(inflated.toString("latin1"));
      } catch {
        contents.push(streamData);
      }
    } else {
      contents.push(streamData);
    }
  }
  return contents;
}

export function extractPdfTextFromBase64(pdfBase64: string): { text: string; notes: string[] } {
  const buffer = Buffer.from(stripDataUrl(pdfBase64), "base64");
  if (buffer.length < 5 || buffer.slice(0, 5).toString("latin1") !== "%PDF-") throw new Error("上传内容不是有效 PDF 文件。仅支持 PDF 说明书导入。");
  const raw = buffer.toString("latin1");
  const notes: string[] = [];
  const streams = extractStreams(raw);
  const parts = streams.map(extractTextFromContent).filter((x) => x.trim());
  let text = parts.join("\n").replace(/\u0000/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) {
    text = extractTextFromContent(raw).replace(/\u0000/g, "").trim();
  }
  if (!text) notes.push("未能从 PDF 中提取到可用文字。该 PDF 可能是扫描件，请使用图片/OCR 导入并粘贴 OCR 文本。");
  else notes.push(`已从文字型 PDF 中提取约 ${text.length} 个字符。请重点核对剂量、规格、频次、禁忌和批准文号。`);
  return { text, notes };
}
