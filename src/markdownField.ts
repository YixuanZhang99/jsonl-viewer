/**
 * 从美化预览的一行文本中,抽取光标所在的 JSON 字符串值并解码。
 *
 * 预览由 `JSON.stringify(obj, null, 2)` 生成,任意字符串值(即便含换行)都被
 * 转义压在同一物理行,例如 `  "content": "# 标题\n- a"`。因此按行抽取即可。
 *
 * 规则:扫描该行所有 JSON 字符串字面量;取光标所在的那个;若光标落在
 * `"key": "value"` 的 key 上(或不在任何字符串内),则改取该行最后一个字符串(即值)。
 */
export function extractStringValueAt(line: string, character: number): string | undefined {
  const spans: { start: number; end: number; raw: string }[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      const start = i;
      i++;
      while (i < line.length) {
        if (line[i] === '\\') {
          i += 2;
          continue;
        }
        if (line[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      spans.push({ start, end: i, raw: line.slice(start, i) });
    } else {
      i++;
    }
  }

  if (spans.length === 0) {
    return undefined;
  }

  let chosen = spans.find((s) => character >= s.start && character <= s.end);
  if (!chosen) {
    chosen = spans[spans.length - 1];
  } else if (spans.length > 1 && chosen === spans[0]) {
    // 光标在 key 上 → 改取值(最后一个字符串)
    chosen = spans[spans.length - 1];
  }

  try {
    const parsed = JSON.parse(chosen.raw);
    return typeof parsed === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** 启发式判断一段文本是否像 Markdown。命中任一常见语法即视为 Markdown。 */
export function looksLikeMarkdown(text: string): boolean {
  const patterns: RegExp[] = [
    /^#{1,6}\s/m, // 标题
    /^\s*[-*+]\s/m, // 无序列表
    /^\s*\d+\.\s/m, // 有序列表
    /^\s*>\s/m, // 引用
    /\*\*[^*]+\*\*/, // 加粗
    /(^|[^*])\*[^*\s][^*]*\*/, // 斜体
    /\[[^\]]+\]\([^)]+\)/, // 链接
    /`[^`]+`/, // 行内代码
    /```/, // 代码块围栏
    /^\s*\|.+\|\s*$/m, // 表格
  ];
  return patterns.some((re) => re.test(text));
}
