# JSONL 可读性增强扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 VSCode 扩展,给 `.jsonl` 文件语法高亮,并能旁开一个"展开 + 可折叠"的只读预览,随原文件实时同步。

**Architecture:** 核心是无 `vscode` 依赖的纯函数 `formatJsonl`,把 JSONL 文本转成带注释分隔的多行 jsonc 文本(单元测试覆盖)。`previewProvider.ts` 用 `TextDocumentContentProvider` 暴露只读虚拟文档并随原文件刷新。`extension.ts` 是注册命令/Provider/监听的薄胶水层。语言与语法通过 `package.json` 的 contributes 声明。

**Tech Stack:** TypeScript、VSCode Extension API、esbuild(打包)、Node.js 内置 `node:test`(单元测试)、`@vscode/vsce`(打包 .vsix)。

## Global Constraints

- 原 `.jsonl` 文件绝不被修改;所有展开只在只读虚拟文档中发生。
- `formatJsonl` 必须无 `vscode` 依赖(纯函数,可直接被 `node:test` 导入)。
- 预览文档语言 id 为 `jsonc`。
- 虚拟文档 scheme 为 `jsonl-pretty`。
- 关联扩展名:`.jsonl`、`.ndjson`、`.jsonlines`。
- 记录编号 N 从 1 计;空行跳过且不计入记录号。
- 配置项默认值:`jsonl.preview.maxBytes` = `5242880`,`jsonl.preview.maxRecords` = `50000`。
- 缩进:2 空格(`JSON.stringify(obj, null, 2)`)。
- 提交信息以下面这行结尾:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

```
jsonl-viewer/
├── package.json              # 扩展清单 + 脚本 + 依赖
├── tsconfig.json
├── esbuild.js                # 打包脚本
├── .vscodeignore
├── language-configuration.json
├── syntaxes/jsonl.tmLanguage.json
├── src/
│   ├── format.ts             # 纯函数 formatJsonl(无 vscode 依赖)
│   ├── previewProvider.ts    # TextDocumentContentProvider + URI 派生 + 刷新
│   └── extension.ts          # activate/deactivate 胶水层
├── src/test/
│   └── format.test.ts        # format.ts 单元测试(node:test)
└── samples/
    └── example.jsonl         # 手动验证用样例
```

---

## Task 1: 项目脚手架与构建工具链

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.js`
- Create: `.vscodeignore`

**Interfaces:**
- Consumes: 无
- Produces: npm 脚本 `compile`(esbuild 打包到 `dist/extension.js`)、`test`(运行 `node --test`)。`package.json` 的 `main` 指向 `./dist/extension.js`,`engines.vscode` = `^1.85.0`。

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "jsonl-viewer",
  "displayName": "JSONL Viewer",
  "description": "提高 JSONL 文件可读性:语法高亮 + 可折叠的展开预览",
  "version": "0.0.1",
  "publisher": "local",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages", "Visualization"],
  "main": "./dist/extension.js",
  "scripts": {
    "compile": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "vscode:prepublish": "npm run compile",
    "test": "node --test"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.21.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "out",
    "rootDir": "."
  },
  "exclude": ["node_modules", "dist", "out"]
}
```

- [ ] **Step 3: 创建 `esbuild.js`**

```js
const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    sourcemap: true,
    logLevel: 'info',
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: 创建 `.vscodeignore`**

```
.vscode/**
src/**
out/**
node_modules/**
esbuild.js
tsconfig.json
docs/**
samples/**
**/*.map
```

- [ ] **Step 5: 安装依赖并验证构建工具可用**

Run: `cd ~/work/jsonl-viewer && npm install`
Expected: 成功安装,生成 `node_modules/` 与 `package-lock.json`,无 error。

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json esbuild.js .vscodeignore package-lock.json
git commit -m "chore: 扩展脚手架与构建工具链

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `formatJsonl` 纯函数(TDD)

**Files:**
- Create: `src/format.ts`
- Test: `src/test/format.test.ts`

**Interfaces:**
- Consumes: 无(纯函数,仅用 JS 内置)。
- Produces:
  ```ts
  export interface FormatOptions { maxBytes: number; maxRecords: number; }
  export interface FormatResult { text: string; truncated: boolean; recordCount: number; }
  export function formatJsonl(input: string, options: FormatOptions): FormatResult;
  ```
  行为契约:
  - 每条合法记录输出 `// ─── 记录 #N ───\n` + `JSON.stringify(obj, null, 2)`,记录之间用一个空行分隔。
  - 空行(trim 后为空)跳过,不计入 N。
  - 非法 JSON 行输出 `// ⚠ 第 {1-based 行号} 行不是合法 JSON\n` + 原始行内容(去尾部换行)。非法行**不**增加 recordCount,但占用截断计数(按"已处理条目"计)——见下:截断按"合法记录数 ≥ maxRecords"或"已消费字节 ≥ maxBytes"触发。
  - 截断:遍历时累计已消费输入字节(按行的 UTF-8 字节,用 `Buffer.byteLength`)。当 `recordCount >= maxRecords` 或累计字节 `>= maxBytes` 时停止处理后续行,设 `truncated = true`,并在输出**最前面**加一行 `// ⚠ 文件过大,仅显示前 {recordCount} 条记录\n`。
  - 空输入(或全空行):`text` 为 `''`(或仅含可能的截断提示——空输入不触发截断),`truncated = false`,`recordCount = 0`。

- [ ] **Step 1: 写失败测试 `src/test/format.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `cd ~/work/jsonl-viewer && node --test`
Expected: FAIL —— 找不到 `../format.ts` / `formatJsonl` 未定义。

- [ ] **Step 3: 实现 `src/format.ts`**

```ts
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
      blocks.push(`// ─── 记录 #${recordCount} ───\n${JSON.stringify(obj, null, 2)}`);
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
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `cd ~/work/jsonl-viewer && node --test`
Expected: PASS —— 7 个测试全部通过。

注:`node --test` 直接运行 `.ts` 需 Node ≥ 22(内置类型剥离)。若环境 Node 较低导致无法加载 `.ts`,改用 `node --test --experimental-strip-types`;仍不行则在本步把测试与源改为 `.js` 导入或加 `tsx`。先尝试 `node --test`。

- [ ] **Step 5: Commit**

```bash
git add src/format.ts src/test/format.test.ts
git commit -m "feat: formatJsonl 纯函数(展开/标注/截断)+ 单元测试

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 语言注册、语法高亮与语言配置

**Files:**
- Modify: `package.json`(新增 `contributes.languages`、`contributes.grammars`)
- Create: `language-configuration.json`
- Create: `syntaxes/jsonl.tmLanguage.json`
- Create: `samples/example.jsonl`

**Interfaces:**
- Consumes: Task 1 的 `package.json`。
- Produces: 语言 id `jsonl`(供 Task 4 的菜单 `when: resourceLangId == jsonl` 使用)。

- [ ] **Step 1: 创建 `language-configuration.json`**

```json
{
  "brackets": [["{", "}"], ["[", "]"]],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" },
    { "open": "\"", "close": "\"" }
  ],
  "surroundingPairs": [["{", "}"], ["[", "]"], ["\"", "\""]]
}
```

- [ ] **Step 2: 创建 `syntaxes/jsonl.tmLanguage.json`(复用 JSON 着色)**

```json
{
  "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  "name": "JSON Lines",
  "scopeName": "source.jsonl",
  "patterns": [{ "include": "source.json" }]
}
```

- [ ] **Step 3: 在 `package.json` 的顶层加入 `contributes`**

在 `package.json` 中(与 `main`、`scripts` 同级)新增:

```json
  "contributes": {
    "languages": [
      {
        "id": "jsonl",
        "aliases": ["JSON Lines", "jsonl"],
        "extensions": [".jsonl", ".ndjson", ".jsonlines"],
        "configuration": "./language-configuration.json"
      }
    ],
    "grammars": [
      {
        "language": "jsonl",
        "scopeName": "source.jsonl",
        "path": "./syntaxes/jsonl.tmLanguage.json"
      }
    ]
  }
```

- [ ] **Step 4: 创建 `samples/example.jsonl`(手动验证用)**

```
{"id":1,"name":"Ada","tags":["math","cs"],"meta":{"active":true}}
{"id":2,"name":"Linus","tags":["kernel"],"meta":{"active":false}}

not a json line
{"id":3,"name":"Grace","nested":{"a":{"b":[1,2,3]}}}
```

- [ ] **Step 5: 编译验证清单合法**

Run: `cd ~/work/jsonl-viewer && npm run compile`
Expected: esbuild 成功输出 `dist/extension.js`(此时 `src/extension.ts` 尚未创建则会失败——若失败,本步仅验证 `package.json` 为合法 JSON:`node -e "require('./package.json')"` 应无报错;`extension.ts` 在 Task 5 创建)。

- [ ] **Step 6: Commit**

```bash
git add package.json language-configuration.json syntaxes/jsonl.tmLanguage.json samples/example.jsonl
git commit -m "feat: 注册 jsonl 语言、语法高亮与语言配置

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 预览 Provider 与 URI 派生

**Files:**
- Create: `src/previewProvider.ts`

**Interfaces:**
- Consumes: `formatJsonl`、`FormatResult`(来自 `./format`);`vscode` API。
- Produces:
  ```ts
  export const PREVIEW_SCHEME = 'jsonl-pretty';
  export function toPreviewUri(source: vscode.Uri): vscode.Uri;
  export function toSourceUri(preview: vscode.Uri): vscode.Uri;
  export class JsonlPreviewProvider implements vscode.TextDocumentContentProvider {
    readonly onDidChange: vscode.Event<vscode.Uri>;
    provideTextDocumentContent(uri: vscode.Uri): Promise<string>;
    refresh(sourceUri: vscode.Uri): void;
    dispose(): void;
  }
  ```
  URI 派生约定:预览 URI = `jsonl-pretty:<源文件 basename>.pretty.jsonc?source=<encodeURIComponent(源 uri.toString())>`。`toSourceUri` 从 query `source` 还原。

- [ ] **Step 1: 实现 `src/previewProvider.ts`**

```ts
import * as vscode from 'vscode';
import { formatJsonl } from './format';

export const PREVIEW_SCHEME = 'jsonl-pretty';

export function toPreviewUri(source: vscode.Uri): vscode.Uri {
  const base = source.path.split('/').pop() ?? 'document';
  return vscode.Uri.parse(
    `${PREVIEW_SCHEME}:${base}.pretty.jsonc?source=${encodeURIComponent(source.toString())}`
  );
}

export function toSourceUri(preview: vscode.Uri): vscode.Uri {
  const params = new URLSearchParams(preview.query);
  const source = params.get('source');
  if (!source) {
    throw new Error('预览 URI 缺少 source 参数');
  }
  return vscode.Uri.parse(decodeURIComponent(source));
}

export class JsonlPreviewProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const sourceUri = toSourceUri(uri);
    const config = vscode.workspace.getConfiguration('jsonl.preview');
    const maxBytes = config.get<number>('maxBytes', 5_242_880);
    const maxRecords = config.get<number>('maxRecords', 50_000);

    let text: string;
    try {
      const doc = await vscode.workspace.openTextDocument(sourceUri);
      text = doc.getText();
    } catch {
      const bytes = await vscode.workspace.fs.readFile(sourceUri);
      text = Buffer.from(bytes).toString('utf8');
    }

    const result = formatJsonl(text, { maxBytes, maxRecords });
    return result.text === '' ? '// (空文件,无可显示的记录)' : result.text;
  }

  refresh(sourceUri: vscode.Uri): void {
    this._onDidChange.fire(toPreviewUri(sourceUri));
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
```

- [ ] **Step 2: 编译验证类型**

Run: `cd ~/work/jsonl-viewer && npx tsc --noEmit -p tsconfig.json`
Expected: 与 `previewProvider.ts` 相关无类型错误(`extension.ts` 尚未创建,不应有该文件报错;若 tsc 因缺 `extension.ts` 无报错则通过)。

- [ ] **Step 3: Commit**

```bash
git add src/previewProvider.ts
git commit -m "feat: JSONL 预览 Provider 与 URI 派生

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 扩展激活、命令与实时同步

**Files:**
- Create: `src/extension.ts`
- Modify: `package.json`(新增 `commands`、`menus`、`configuration`、`activationEvents`)

**Interfaces:**
- Consumes: `JsonlPreviewProvider`、`PREVIEW_SCHEME`、`toPreviewUri`(来自 `./previewProvider`);`vscode` API。
- Produces: 命令 `jsonl.openPreview`、`jsonl.collapseAllInPreview`;扩展 `activate`/`deactivate` 导出。

- [ ] **Step 1: 实现 `src/extension.ts`**

```ts
import * as vscode from 'vscode';
import { JsonlPreviewProvider, PREVIEW_SCHEME, toPreviewUri } from './previewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new JsonlPreviewProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, provider),
    provider
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jsonl.openPreview', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('请先打开一个 JSONL 文件');
        return;
      }
      const previewUri = toPreviewUri(editor.document.uri);
      const doc = await vscode.workspace.openTextDocument(previewUri);
      await vscode.languages.setTextDocumentLanguage(doc, 'jsonc');
      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
        preserveFocus: false,
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jsonl.collapseAllInPreview', async () => {
      await vscode.commands.executeCommand('editor.foldAll');
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.scheme === PREVIEW_SCHEME) {
        return;
      }
      provider.refresh(e.document.uri);
    })
  );
}

export function deactivate(): void {}
```

- [ ] **Step 2: 在 `package.json` 的 `contributes` 中追加命令、菜单与配置**

在已有 `contributes` 对象内追加(与 `languages`、`grammars` 同级):

```json
    "commands": [
      { "command": "jsonl.openPreview", "title": "JSONL: 打开美化预览", "icon": "$(open-preview)" },
      { "command": "jsonl.collapseAllInPreview", "title": "JSONL: 预览中全部折叠" }
    ],
    "menus": {
      "editor/title": [
        { "command": "jsonl.openPreview", "when": "resourceLangId == jsonl", "group": "navigation" }
      ],
      "editor/context": [
        { "command": "jsonl.openPreview", "when": "resourceLangId == jsonl", "group": "navigation" }
      ]
    },
    "configuration": {
      "title": "JSONL Viewer",
      "properties": {
        "jsonl.preview.maxBytes": {
          "type": "number",
          "default": 5242880,
          "description": "预览渲染的最大字节数,超过则截断。"
        },
        "jsonl.preview.maxRecords": {
          "type": "number",
          "default": 50000,
          "description": "预览渲染的最大记录数,超过则截断。"
        }
      }
    }
```

并在 `package.json` 顶层(与 `main` 同级)加:

```json
  "activationEvents": ["onLanguage:jsonl"],
```

- [ ] **Step 3: 编译整个扩展**

Run: `cd ~/work/jsonl-viewer && npm run compile`
Expected: PASS —— esbuild 成功输出 `dist/extension.js`,无错误。

- [ ] **Step 4: 类型检查**

Run: `cd ~/work/jsonl-viewer && npx tsc --noEmit -p tsconfig.json`
Expected: PASS —— 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/extension.ts package.json
git commit -m "feat: 扩展激活、预览/折叠命令与实时同步

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 手动验证与打包

**Files:**
- Modify: 无(验证 + 打包)
- Create: `README.md`(扩展说明)

**Interfaces:**
- Consumes: 全部前序任务。
- Produces: 可安装的 `jsonl-viewer-0.0.1.vsix`。

- [ ] **Step 1: 写 `README.md`**

```markdown
# JSONL Viewer

提高 JSONL(每行一个 JSON 对象)文件的可读性。

## 功能
- `.jsonl` / `.ndjson` / `.jsonlines` 语法高亮。
- 命令 **JSONL: 打开美化预览**:旁开一个只读预览,把每条记录展开成缩进 JSON,可折叠每条记录与嵌套结构;原文件不被修改,且随原文件实时刷新。
- 命令 **JSONL: 预览中全部折叠**:把每条记录折成摘要,得到概览视图。
- 非法 JSON 行不会丢失,会标注并保留原文。

## 配置
- `jsonl.preview.maxBytes`(默认 5 MB)、`jsonl.preview.maxRecords`(默认 50000):超过则截断,避免大文件卡顿。
```

- [ ] **Step 2: 在 Extension Development Host 手动验证**

操作:在 VSCode 打开 `~/work/jsonl-viewer`,按 F5 启动 Extension Development Host;在新窗口打开 `samples/example.jsonl`。
Expected 逐项确认:
- (a) 文件有 JSON 语法高亮。
- (b) 标题栏出现预览图标;运行"JSONL: 打开美化预览",旁边开出展开后的 jsonc 预览,记录编号 #1/#2/#3 正确,非法行显示 `// ⚠ 第 N 行不是合法 JSON` 且保留 `not a json line`。
- (c) 预览中可折叠每条记录与嵌套对象;运行"JSONL: 预览中全部折叠"后全部折起。
- (d) 在原文件改一条记录并(无需保存)观察预览随之刷新。
- (e) 原文件内容未被改动。

- [ ] **Step 3: 打包 .vsix**

Run: `cd ~/work/jsonl-viewer && npx @vscode/vsce package`
Expected: 生成 `jsonl-viewer-0.0.1.vsix`。若报缺 `repository`/`LICENSE` 警告,可忽略或按提示加最小字段;打包成功即可。

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: 扩展 README 与使用说明

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- 语言注册与高亮 → Task 3 ✓
- 美化预览(只读旁开、jsonc、注释分隔、坏行保留)→ Task 2(格式)+ Task 4(Provider)+ Task 5(命令)✓
- 折叠(内置 + 全部折叠命令)→ Task 5 ✓
- 实时同步 → Task 5 `onDidChangeTextDocument` ✓
- 大文件保护(maxBytes/maxRecords + 截断提示)→ Task 2(逻辑)+ Task 5(配置项)✓
- 纯函数 + 单元测试 → Task 2 ✓
- esbuild / vsce → Task 1 / Task 6 ✓

**2. Placeholder scan:** 无 TBD/TODO;每个代码步骤含完整代码;测试含真实断言。Task 3 Step 5 与 Task 4 Step 2 含"若失败"的条件说明,均给出确定的备选命令,非占位符。

**3. Type consistency:** `FormatOptions`/`FormatResult`/`formatJsonl` 在 Task 2 定义,Task 4 一致引用;`PREVIEW_SCHEME`/`toPreviewUri`/`JsonlPreviewProvider`/`refresh` 在 Task 4 定义,Task 5 一致引用;命令 id `jsonl.openPreview`/`jsonl.collapseAllInPreview` 在 Task 5 代码与 package.json 一致。
