# JSONL Viewer

提高 JSONL(每行一个 JSON 对象)文件的可读性:语法高亮 + 逐条展开、可折叠的美化预览 + 把 Markdown 字段渲染成富文本。

支持 `.jsonl` / `.ndjson` / `.jsonlines`。

## 快速上手

1. **安装**:扩展面板右上角 `···` → **Install from VSIX…** → 选 `jsonl-viewer-0.0.1.vsix`(其它安装方式见下文)。
2. **打开**任意 `.jsonl` 文件 —— 立即获得 JSON 语法高亮(右下角语言显示 *JSON Lines*)。
3. **美化预览**:点编辑器右上角 **打开美化预览** 按钮(或右键 → *JSONL: 打开美化预览*)。右侧旁开一列只读预览,每条记录展开成缩进 JSON,长行自动换行,改源文件时实时刷新。
4. **折叠概览**:点预览标题栏的 **⊟** 折叠按钮 → 全部记录折成概览;图标变 **⊞**,再点 → 全部展开。
5. **渲染 Markdown 字段**:把光标放到某个值是 Markdown 的字段上(如 `content`),点预览标题栏 **$(markdown)** 按钮 → 右侧用 VSCode 自带 Markdown 预览渲染成富文本。

> 想先体验?用仓库里的 `samples/example.jsonl`,里面有正常记录、空行、非法行,以及一条 `id:5` 的 Markdown 字段记录。

## 安装

**方式 A — 安装 .vsix(推荐)**
```bash
code --install-extension jsonl-viewer-0.0.1.vsix
```
若没有 `code` 命令:VSCode 里 ⇧⌘P → `Shell Command: Install 'code' command in PATH`,或用扩展面板的 *Install from VSIX…*。

**方式 B — 从源码打包**
```bash
git clone https://github.com/YixuanZhang99/jsonl-viewer.git
cd jsonl-viewer
npm install
npx @vscode/vsce package      # 生成 jsonl-viewer-<版本>.vsix
```

**方式 C — F5 开发宿主(改代码时)**
用 VSCode 打开本项目文件夹 → 按 **F5** → 在弹出的「扩展开发宿主」窗口里使用。

## 功能

| 功能 | 触发方式 | 效果 |
| --- | --- | --- |
| 语法高亮 | 打开 `.jsonl`/`.ndjson`/`.jsonlines` 即生效 | 每行按 JSON 语法着色 |
| 打开美化预览 | 标题栏按钮 / 右键 / `JSONL: 打开美化预览` | 旁开只读预览,逐条展开缩进 JSON,带 `// ─── 记录 #N ───` 分隔;长行自动换行;随源文件实时刷新 |
| 折叠 / 展开切换 | 预览标题栏 **⊟ / ⊞** 按钮 | 一键全部折叠成概览,再点全部展开;命令面板亦有 *预览中全部折叠 / 全部展开* |
| 字段作为 Markdown 预览 | 光标置于字段值 → 标题栏 **$(markdown)** 按钮 / 右键 / `JSONL: 当前字段作为 Markdown 预览` | 把该字符串值用 VSCode 自带 Markdown 预览渲染(标题/加粗/列表/代码块/链接);值不像 Markdown 时会提示 |

非法 JSON 行不会丢失,会标注为 `// ⚠ 第 N 行不是合法 JSON` 并保留原文;空行自动跳过且记录编号保持连续。预览只读,不会修改原文件。

## 配置

在设置中搜索 `jsonl`:

| 设置项 | 默认 | 说明 |
| --- | --- | --- |
| `jsonl.preview.maxBytes` | 5 MB | 预览渲染的最大字节数,超过则截断,避免大文件卡顿 |
| `jsonl.preview.maxRecords` | 50000 | 预览渲染的最大记录数,超过则截断 |

## 开发

```bash
npm install
npm run compile      # esbuild 打包到 dist/
npm run watch        # 监听增量编译
npm test             # 运行纯逻辑单元测试(node --test)
```

按 **F5** 启动扩展开发宿主调试。许可证:[MIT](./LICENSE)。
