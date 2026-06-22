import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatJsonl } from '../format.ts';

const OPTS = { maxBytes: 5_242_880, maxRecords: 50_000 };

test('多条正常记录:编号、缩进、分隔', () => {
  const input = '{"a":1}\n{"b":2}';
  const r = formatJsonl(input, OPTS);
  assert.equal(r.recordCount, 2);
  assert.equal(r.truncated, false);
  assert.ok(r.text.includes('// ─── 记录 #1 ───'));
  assert.ok(r.text.includes('// ─── 记录 #2 ───'));
  assert.ok(r.text.includes('  "a": 1'));
  assert.ok(r.text.includes('  "b": 2'));
});

test('嵌套对象/数组缩进正确', () => {
  const input = '{"x":{"y":[1,2]}}';
  const r = formatJsonl(input, OPTS);
  assert.ok(r.text.includes('  "x": {'));
  assert.ok(r.text.includes('    "y": ['));
});

test('空行跳过且记录号连续', () => {
  const input = '{"a":1}\n\n   \n{"b":2}';
  const r = formatJsonl(input, OPTS);
  assert.equal(r.recordCount, 2);
  assert.ok(r.text.includes('记录 #1'));
  assert.ok(r.text.includes('记录 #2'));
  assert.ok(!r.text.includes('记录 #3'));
});

test('非法 JSON 行:警告注释 + 原文保留,且不影响后续', () => {
  const input = '{"a":1}\nnot json\n{"b":2}';
  const r = formatJsonl(input, OPTS);
  assert.equal(r.recordCount, 2);
  assert.ok(r.text.includes('// ⚠ 第 2 行不是合法 JSON'));
  assert.ok(r.text.includes('not json'));
  assert.ok(r.text.includes('记录 #2'));
});

test('超 maxRecords 截断', () => {
  const input = Array.from({ length: 10 }, (_, i) => `{"i":${i}}`).join('\n');
  const r = formatJsonl(input, { maxBytes: 5_242_880, maxRecords: 3 });
  assert.equal(r.truncated, true);
  assert.equal(r.recordCount, 3);
  assert.ok(r.text.startsWith('// ⚠ 文件过大'));
});

test('超 maxBytes 截断', () => {
  const input = Array.from({ length: 100 }, (_, i) => `{"i":${i}}`).join('\n');
  const r = formatJsonl(input, { maxBytes: 20, maxRecords: 50_000 });
  assert.equal(r.truncated, true);
  assert.ok(r.recordCount >= 1);
  assert.ok(r.text.startsWith('// ⚠ 文件过大'));
});

test('空输入', () => {
  const r = formatJsonl('', OPTS);
  assert.equal(r.recordCount, 0);
  assert.equal(r.truncated, false);
  assert.equal(r.text, '');
});
