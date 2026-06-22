# JSONL 可读性增强扩展 — 设计文档

日期:2026-06-22
状态:已确认,待实现

## 目标

一个 VSCode 扩展,提高 JSONL(每行一个 JSON 对象)文件的可读性。通过三件事实现:给 `.jsonl` 文件语法高亮、按需打开一个"展开 + 可折叠"的只读预览、预览随原文件实时同步。

非目标(YAGNI):表格视图、就地修改文档、字段筛选/排序、跨记录搜索。

## 核心约束

- 原 `.jsonl` 文件**绝不被修改**。所有"展开"只发生在只读虚拟文档里。
- 预览必须能优雅处理坏数据(非法 JSON 行),不能整体失败。
- 大文件不能卡死编辑器。

## 功能设计

### 1. 语言注册与语法高亮

- 注册语言 id `jsonl`,关联扩展名 `.jsonl`、`.ndjson`、`.jsonlines`。
- 提供 TextMate grammar(`jsonl.tmLanguage.json`),通过 `include` 复用 JSON 的着色规则(`source.json`),使每行 JSON 都能正确上色。
- 语言配置(`language-configuration.json`):括号匹配 `{}` `[]`、引号自动闭合。纯 JSONL 无注释,不配置行注释。

### 2. 美化预览(核心,只读、旁开)

- 命令 `jsonl.openPreview`,标题 **`JSONL: 打开美化预览`**。
  - 入口:命令面板、编辑器标题栏图标(`editor/title`,`when: resourceLangId == jsonl`)、编辑器右键菜单。
- 实现:注册 `TextDocumentContentProvider`,scheme = `jsonl-pretty`。预览 URI 由原文件 URI 派生(例如把原路径编码进 query),side-by-side(`ViewColumn.Beside`)打开。
- 预览文档语言设为 **jsonc**(带注释的 JSON):既能高亮 `//` 注释,又不破坏 JSON 折叠。
- 内容生成(见纯函数 `formatJsonl`):
  - 逐行解析。每条合法记录:前置一行标注 `// ─── 记录 #N ───`(N 从 1 计),随后是 `JSON.stringify(obj, null, 2)` 的多行缩进结果,记录之间空一行。
  - **空行**:跳过(不计入记录号)。
  - **非法 JSON 行**:不丢弃。输出 `// ⚠ 第 {行号} 行不是合法 JSON`,随后原样保留该行原文。

### 3. 折叠

- 预览是 jsonc 文档,VSCode 内置折叠直接生效:可折叠每条记录、每个嵌套对象/数组。
- 额外命令 `jsonl.collapseAllInPreview`,标题 **`JSONL: 预览中全部折叠`** —— 对预览编辑器执行 `editor.foldAll`,得到每条记录折成摘要的"概览"视图。

### 4. 实时同步

- 监听原文档 `workspace.onDidChangeTextDocument`。当变化的文档是某个已打开预览的源文件时,触发该预览 Provider 的 `onDidChange` 事件,VSCode 重新调用 `provideTextDocumentContent` 刷新内容。
- 预览关闭后解除对应监听(避免泄漏)。

### 5. 大文件保护

- 可配置项:
  - `jsonl.preview.maxBytes`(默认 `5242880`,即 5 MB)
  - `jsonl.preview.maxRecords`(默认 `50000`)
- 超过任一阈值:只渲染到上限为止,并在预览顶部加注释 `// ⚠ 文件过大,仅显示前 {N} 条记录(共约 {M} 行)`。

## 代码结构

```
jsonl-viewer/
├── package.json              # 扩展清单:languages / grammars / commands / menus / configuration
├── language-configuration.json
├── syntaxes/jsonl.tmLanguage.json
├── src/
│   ├── format.ts             # 纯函数 formatJsonl —— 解析+展开+标注+截断。无 vscode 依赖。
│   ├── previewProvider.ts    # TextDocumentContentProvider + URI 派生 + 同步刷新
│   └── extension.ts          # activate/deactivate:注册命令、Provider、监听(薄胶水层)
├── src/test/
│   └── format.test.ts        # format.ts 单元测试
├── tsconfig.json
├── esbuild.js                # 打包
└── .vscodeignore
```

### `formatJsonl` 接口

```ts
interface FormatOptions {
  maxBytes: number;
  maxRecords: number;
}
interface FormatResult {
  text: string;        // 生成的 jsonc 文本
  truncated: boolean;
  recordCount: number;
}
function formatJsonl(input: string, options: FormatOptions): FormatResult;
```

- 设计为无 `vscode` 依赖的纯函数,便于直接单元测试。

## 测试策略

`format.test.ts` 覆盖:

1. 多条正常记录 → 正确编号、缩进、分隔。
2. 含嵌套对象/数组的记录 → 缩进正确。
3. 夹杂空行 → 空行跳过,记录号连续。
4. 非法 JSON 行 → 输出警告注释 + 原文保留,且不影响后续记录解析。
5. 超 `maxBytes` / `maxRecords` → `truncated = true`,顶部截断提示,内容截至上限。
6. 空输入 → 空结果,不报错。

扩展层(命令注册、Provider、同步)为薄胶水,优先靠手动验证(打开示例 `.jsonl` → 运行预览 → 改原文件看刷新 → 全部折叠)。

## 工具链

- TypeScript + esbuild 打包。
- `@vscode/test-cli` / `mocha` 跑单元测试(或对纯函数用更轻量的 node 测试)。
- `vsce package` 产出 `.vsix` 供本地安装验证。

## 项目位置

独立目录 `~/work/jsonl-viewer`,独立 git 仓库。
