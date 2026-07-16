# read-anything · 即时分析

丢一个链接给你的 AI agent，得到一篇**基于真实原文/转写的中文结构化解读**，
然后像 NotebookLM 一样围绕这份材料继续追问。

支持：网页 / 博客 / 公众号单篇 / YouTube / B站 / 小宇宙播客 / X 帖子 / 纯文本。

```
你：https://www.xiaoyuzhoufm.com/episode/xxxx 分析一下
Agent：（抓取 shownotes + 本地转写前 15 分钟音频 → 输出访谈拆解稿）
你：两位嘉宾在 Agent 记忆问题上的分歧是什么？
Agent：（只基于转写材料回答，带时间戳）
```

## 和 NotebookLM 的关系（先说清楚边界）

**如果你的材料主要是英文 PDF、能直接导入的 YouTube，且访问 Google 无障碍——
直接用 NotebookLM，它的多源管理和 UI 更成熟，本工具不和它抢。**

本工具做的是 NotebookLM 够不到的部分：

1. **中文内容生态的最后一公里**：小宇宙播客（NotebookLM 导不进）、B站无字幕视频、
   公众号文章、SPA 反爬页——靠 `__NEXT_DATA__` 解析、Jina 加固抓取、本地 ASR 解决
2. **内容不出本机**：播客/视频音频用本地 faster-whisper 转写，不上传给任何云服务
3. **模板可定制**：五种内置解读模板（精读/快扫/访谈/论文/选题素材），
   自定义 = 往 `templates/` 丢一个 .md；产物是 markdown，直接进你的知识库
4. **长在工作流里**：你已经在终端/编辑器里用 agent 干活，无需切去另一个网页 app

## 安装

**Claude Code**：整个文件夹放进 `~/.claude/skills/`（全局）或项目 `.claude/skills/`。

**其他 agent（Codex CLI / Cursor / OpenClaw / Gemini CLI…）**：核心逻辑全在
`PLAYBOOK.md`（纯 markdown 剧本）+ `scripts/`（普通命令行工具，JSON 进出），
不依赖任何 Claude 特性。接法任选：
- 在你的 agent 指令文件（AGENTS.md / rules）里写：「用户丢链接要求分析时，
  按 <路径>/PLAYBOOK.md 执行」
- 或每次直接说：「按这个文件夹里的 PLAYBOOK.md 处理这个链接」

诚实边界：脚本保证各家 agent 拿到同样干净的材料；**解读质量由你所用模型决定**，
不承诺跨模型效果一致。

## 依赖

| 依赖 | 是否必需 | 用途 |
|---|---|---|
| Node.js 18+ | 必需 | 三个抓取脚本的运行时（零 npm 依赖） |
| yt-dlp | 可选 | YouTube/B站（`brew install yt-dlp`） |
| faster-whisper | 可选 | 播客/无字幕视频本地转写（`pip install faster-whisper`，首次自动下载 ~460MB 模型） |

缺可选依赖不报错——对应内容自动降级并**显式告知你降级了**（这是本工具的
核心纪律：拿不到的内容如实说，不脑补。详见 `PLAYBOOK.md` 诚实守则）。

国内网络访问 YouTube 需设置 `YOUTUBE_PROXY_URL` 环境变量（如 `http://127.0.0.1:7890`）。

## 文件结构

```
read-anything/
├── SKILL.md          # Claude Code 触发入口（薄壳）
├── PLAYBOOK.md       # 通用剧本：路由/材料规范/降级链/诚实守则（agent 无关）★
├── templates/        # 解读模板（deep-read / brief / interview / paper / ideas + 你自己的）
└── scripts/          # fetch-article / fetch-xiaoyuzhou / vtt-to-text（零依赖）+ transcribe.py（可选）
```

## 出处

从个人知识管理系统 knowledge-workbench 的「即时分析」链路提炼。脚本里的加固点
（Jina 伪 200 识破、300 字垃圾门槛、字幕误听人名警示、播客无转写声明等）
都来自真实踩坑，注释里保留了原因。

## License

MIT — 见 [LICENSE](LICENSE)。欢迎自取、修改、把 `templates/` 换成你自己的模板。
