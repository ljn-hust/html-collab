# html-collab

[English](#english) · [中文](#中文)

---

## English

Single-file HTML format for LLM–human collaborative document editing.

**This project documents itself.** Download [`index.html`](./index.html) and open it in Chrome — that file *is* the documentation, and it's built with html-collab.

### What it does

One `.html` file holds LLM-generated content, human annotations (comments + inline edits), and everything an AI needs to produce the next revision. No server, no install, no account.

The format is designed for three scenarios:

- **LLM → Human → LLM** — Generate a document, annotate it in Chrome, hand it back for revision. Repeat.
- **Human → Human via AI relay** — Send the file to a colleague. Their AI automatically finds the skill instructions embedded in the file and picks up exactly where yours left off — no shared infrastructure required.
- **Async distributed teams** — Pass a single file across time zones and AI tools. The file carries its own onboarding instructions for any compatible AI (Claude Code, OpenClaw, or any skill-compatible environment).

### Quick start

**As a human reviewer (Chrome):**
1. Open any html-collab `.html` file in Chrome
2. Select text → **+ Comment** · Hover paragraph → **✎ Edit**
3. `Ctrl+S` to save — hand the file back to your AI

**As an LLM:**
Load the skill and follow the GENERATE / READ / REVISE instructions:
- Local: `skill/SKILL.md`
- Remote: https://raw.githubusercontent.com/ljn-hust/html-collab/main/skill/SKILL.md

The skill is compatible with **Claude Code** and **OpenClaw**.

### Build from source

```bash
node dev/build.js                                              # → dist/collab-template.html
node --test dev/tests/build.test.js dev/tests/utils.test.js   # run tests
```

### License

MIT

---

## 中文

基于单 HTML 文件的 LLM–人类协作文档编辑格式。

**本项目用自身来记录自己。** 下载 [`index.html`](./index.html) 并在 Chrome 中打开——那个文件本身就是项目文档，且正是用 html-collab 格式构建的。

### 它能做什么

一个 `.html` 文件同时承载：LLM 生成的内容、人类批注（评论 + 内联编辑），以及 AI 生成下一轮修订所需的一切。无需服务器、无需安装、无需账号。

该格式针对三种场景设计：

- **LLM → 人 → LLM** — 生成文档，在 Chrome 中批注，交回 AI 修订，循环往复。
- **人传人，AI 接力** — 将文件发给同事，他们的 AI 会自动读取文件内嵌的 skill 说明，无缝接续上一轮工作，无需任何共享基础设施。
- **分布式异步团队** — 跨时区、跨 AI 工具传递同一个文件。文件自带 AI 上手说明，兼容任何支持 skill 的环境（Claude Code、OpenClaw 等）。

### 快速开始

**作为人类审阅者（Chrome）：**
1. 在 Chrome 中打开任意 html-collab `.html` 文件
2. 选中文字 → **+ Comment** 批注 · 悬停段落 → **✎ Edit** 编辑
3. `Ctrl+S` 保存，将文件交回给 AI

**作为 LLM：**
加载 skill 并按照 GENERATE / READ / REVISE 指令操作：
- 本地路径：`skill/SKILL.md`
- 远程地址：https://raw.githubusercontent.com/ljn-hust/html-collab/main/skill/SKILL.md

该 skill 兼容 **Claude Code** 和 **OpenClaw**。

### 从源码构建

```bash
node dev/build.js                                              # → dist/collab-template.html
node --test dev/tests/build.test.js dev/tests/utils.test.js   # 运行测试
```

### 许可证

MIT

<img width="1710" height="894" alt="image" src="https://github.com/user-attachments/assets/fbd07a7d-9970-4c63-a9a2-fd966dad0069" />
