export interface FormatOptions {
  maxBytes: number;
  maxRecords: number;
}

export interface FormatResult {
  text: string;
  truncated: boolean;
  recordCount: number;
}

export function formatJsonl(input: string, options: FormatOptions): FormatResult {
  const lines = input.split('\n');
  const blocks: string[] = [];
  let recordCount = 0;
  let consumedBytes = 0;
  let truncated = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    const trimmed = raw.trim();

    if (trimmed === '') {
      consumedBytes += Buffer.byteLength(raw) + 1;
      continue;
    }

    if (recordCount >= options.maxRecords || consumedBytes >= options.maxBytes) {
      truncated = true;
      break;
    }

    consumedBytes += Buffer.byteLength(raw) + 1;

    try {
      const obj = JSON.parse(trimmed);
      recordCount++;
      blocks.push(`// ─── 记录 ${recordCount} ───\n${JSON.stringify(obj, null, 2)}`);
    } catch {
      blocks.push(`// ⚠ 第 ${lineNo} 行不是合法 JSON\n${raw.replace(/\r$/, '')}`);
    }
  }

  let text = blocks.join('\n\n');
  if (truncated) {
    text = `// ⚠ 文件过大,仅显示前 ${recordCount} 条记录\n${text}`;
  }

  return { text, truncated, recordCount };
}
