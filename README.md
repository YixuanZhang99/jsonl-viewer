# JSONL Viewer

提高 JSONL(每行一个 JSON 对象)文件的可读性。

## 功能
- `.jsonl` / `.ndjson` / `.jsonlines` 语法高亮。
- 命令 **JSONL: 打开美化预览**:旁开一个只读预览,把每条记录展开成缩进 JSON,可折叠每条记录与嵌套结构;原文件不被修改,且随原文件实时刷新。
- 命令 **JSONL: 预览中全部折叠**:把每条记录折成摘要,得到概览视图。
- 非法 JSON 行不会丢失,会标注并保留原文。

## 配置
- `jsonl.preview.maxBytes`(默认 5 MB)、`jsonl.preview.maxRecords`(默认 50000):超过则截断,避免大文件卡顿。
