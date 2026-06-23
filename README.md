# JSONL Viewer

提高 JSONL(每行一个 JSON 对象)文件的可读性。

## 功能
- `.jsonl` / `.ndjson` / `.jsonlines` 语法高亮。
- 命令 **JSONL: 打开美化预览**:旁开一个只读预览,把每条记录展开成缩进 JSON,可折叠每条记录与嵌套结构;原文件不被修改,且随原文件实时刷新。长行在预览中自动换行(仅作用于预览)。
- 预览标题栏的**折叠/展开切换按钮**:点一下全部折叠成概览,再点一下全部展开;命令面板亦有 **JSONL: 预览中全部折叠 / 全部展开**。
- 命令 **JSONL: 当前字段作为 Markdown 预览**(预览标题栏 `$(markdown)` 按钮 / 右键菜单):把光标所在字段的字符串值用 VSCode 自带 Markdown 预览渲染成富文本,适合 `content`、`text` 等存放 Markdown 的字段;值不像 Markdown 时会提示。
- 非法 JSON 行不会丢失,会标注并保留原文。

## 配置
- `jsonl.preview.maxBytes`(默认 5 MB)、`jsonl.preview.maxRecords`(默认 50000):超过则截断,避免大文件卡顿。
