import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractStringValueAt, looksLikeMarkdown } from '../markdownField.ts';

test('对象值:光标在值上,解码转义换行', () => {
  const line = '  "content": "# 标题\\n- a"';
  assert.equal(extractStringValueAt(line, 20), '# 标题\n- a');
});

test('对象值:光标落在 key 上时仍取值', () => {
  const line = '  "content": "# 标题\\n- a"';
  assert.equal(extractStringValueAt(line, 5), '# 标题\n- a');
});

test('数组元素:单字符串行', () => {
  assert.equal(extractStringValueAt('    "**bold**",', 8), '**bold**');
});

test('值中含冒号不被误切', () => {
  assert.equal(extractStringValueAt('  "url": "http://a:8080/x"', 18), 'http://a:8080/x');
});

test('无字符串的行返回 undefined', () => {
  assert.equal(extractStringValueAt('  {', 2), undefined);
});

test('looksLikeMarkdown 命中常见语法', () => {
  assert.equal(looksLikeMarkdown('# 标题'), true);
  assert.equal(looksLikeMarkdown('- a\n- b'), true);
  assert.equal(looksLikeMarkdown('see **bold**'), true);
  assert.equal(looksLikeMarkdown('[x](https://a)'), true);
  assert.equal(looksLikeMarkdown('```js\ncode\n```'), true);
});

test('looksLikeMarkdown 普通文本/邮箱不误判', () => {
  assert.equal(looksLikeMarkdown('just a normal sentence id 42'), false);
  assert.equal(looksLikeMarkdown('a@b.com'), false);
});
