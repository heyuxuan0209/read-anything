# read-anything · 读不完的收藏，让 AI 替你读懂

> Too much saved, too little read — let your AI read it for you.

**English** · [中文](#中文)

```
你：https://www.xiaoyuzhoufm.com/episode/xxxx 这期讲了啥
它：（本地转写音频 + shownotes → 访谈拆解：两位嘉宾各自观点、分歧点、金句带时间戳）
你：他们在 Agent 记忆那段具体怎么说的？
它：（只基于转写回答，标时间戳；没提到的如实说没提到）
```

## English

Is your bookmarks folder full of things you "plan to get to someday" — tens of thousands of words of long-form deep dives, an hour-long English podcast, a forty-minute Bilibili video, dozens of X threads… that just gather dust because you can't finish them, or can't even get through them?

read-anything helps you understand them fast: drop in a link, and a few minutes later you get a Chinese explainer that spells out "what this actually says," and you can keep asking follow-up questions about it. It all happens inside your AI agent, the results land as markdown, and they accumulate into your own knowledge base.

### The specific hassle it solves

- **Saved it but no time to read** → in a few minutes you get an explainer that "makes sense even without the original"
- **It's English / video / audio, and a pain to get through** → auto-transcription + a structured Chinese explainer straight out
- **Want to dig into details** → converse over the material; answers are based only on the source, never made up
- **Read it and forgot it, scattered everywhere** → explainers land as markdown, accumulating into your own system
- **Don't want to bounce between a dozen web tools** → one link, all inside your agent

### Formats it can handle

Web pages / blogs / single WeChat public-account articles / YouTube / Bilibili / Xiaoyuzhou podcasts / X posts /
**local recordings** (meeting recordings, voice memos — just drop the file path for m4a/mp3/wav) / plain text
(including pasted meeting notes, speech-to-text transcripts).

English content produces a Chinese explainer directly (no need to translate first and then read); videos, podcasts, and local recordings without captions go through local transcription (faster-whisper — audio never leaves your machine, zero API cost).

Document links behind a login wall like Feishu/Notion can't be fetched (it will tell you so honestly) — just export the text transcript from Miaoji and paste it in, and it will break it down all the same.

### Six reading perspectives (+ your own)

| 你想要 | 用哪个模板 |
|---|---|
| 完整读懂，不看原文也行 | 精读稿（默认） |
| 30 秒判断值不值得细读 | 快扫 |
| 播客 / 对谈，按人拆观点 | 访谈拆解 |
| 会议录音/纪要，拆决策·待办·分歧 | 会议纪要 |
| arXiv / 技术报告 | 论文拆解 |
| 从内容里挖可写的选题和素材 | 选题素材 |

Not enough? Drop one of your own .md files into `templates/` and it becomes a new template — just say "use my xx template."

### One principle: if it can't get it, it says so

Fetch failures, only getting a summary, audio that didn't transcribe — it tells you all of it honestly, and never forces out a polished-looking explainer from incomplete material. Transcription output is labeled "may contain transcription errors," and quoted highlights remind you to check against the original. Every sentence you read is traceable.

### Install

**Claude Code** (one command):

```bash
git clone https://github.com/heyuxuan0209/read-anything.git ~/.claude/skills/read-anything
```

Once installed, in any session just drop a link and say "analyze this" to trigger it; update with
`git -C ~/.claude/skills/read-anything pull`. To install it only for a specific project, clone into that
project's `.claude/skills/read-anything`.

**Other agents (Codex / Cursor / Gemini CLI / OpenClaw…)**: the core logic all lives in
`PLAYBOOK.md` (a pure-markdown playbook) + `scripts/` (plain command-line tools, JSON in and out),
with no dependency on any Claude feature. The way to wire it into any agent follows the same pattern — **clone + paste a paragraph into your
agent's instruction file**:

```bash
git clone https://github.com/heyuxuan0209/read-anything.git ~/.agent-skills/read-anything
```

Paste this into the file below (only the filename differs across agents):

```markdown
## read-anything（链接/录音 → 中文解读）
当我丢链接、音频文件，或粘贴长文/纪要并要求「分析 / 解读 / 讲了啥」时，
按 ~/.agent-skills/read-anything/PLAYBOOK.md 执行（路由、模板、降级规则都在里面）。
```

| Agent | 指令文件 |
|---|---|
| Codex CLI | `~/.codex/AGENTS.md`（全局）或项目根 `AGENTS.md` |
| Cursor | 项目 `.cursor/rules/` 下新建规则（或旧版 `.cursorrules`） |
| Gemini CLI | `~/.gemini/GEMINI.md`（全局）或项目根 `GEMINI.md` |
| 其他 / 懒得配 | 每次直接说「按 ~/.agent-skills/read-anything/PLAYBOOK.md 处理这个链接」 |

Honest boundary: the scripts guarantee every agent gets the same clean material; **the quality of the explainer is determined by the model you use**,
and consistent results across models is not promised.

### Dependencies

| 依赖 | 是否必需 | 用途 |
|---|---|---|
| Node.js 18+ | 必需 | 三个抓取脚本的运行时（零 npm 依赖） |
| yt-dlp | 可选 | YouTube/B站（`brew install yt-dlp`） |
| faster-whisper | 可选 | 播客/无字幕视频本地转写（`pip install faster-whisper`，首次自动下载 ~460MB 模型） |

Missing an optional dependency won't cause an error — the corresponding content degrades automatically and **explicitly tells you it degraded**.

Accessing YouTube from within China requires setting the `YOUTUBE_PROXY_URL` environment variable (e.g. `http://127.0.0.1:7890`).

### File structure

```
read-anything/
├── SKILL.md          # Claude Code 触发入口（薄壳）
├── PLAYBOOK.md       # 通用剧本：路由/材料规范/降级链/诚实守则（agent 无关）★
├── templates/        # 解读模板（精读/快扫/访谈/会议/论文/选题素材 + 你自己的）
└── scripts/          # fetch-article / fetch-xiaoyuzhou / vtt-to-text（零依赖）+ transcribe.py（可选）
```

### Relationship to NotebookLM

It can converse around your material the way NotebookLM does, but without uploading to any cloud service, without switching web pages; audio is transcribed locally and never leaves your machine, and the output is your own markdown file.

### Origins

Distilled from the "instant analysis" pipeline of the personal knowledge management system [knowledge-workbench](https://github.com/heyuxuan0209/knowledge-workbench) — that one is a full "collect → understand → accumulate → create" workbench, and this is the standalone, shareable version of its "understand one piece of content" step. The hardening points in the scripts (seeing through Jina's fake 200s, the 300-character junk threshold, mis-heard-name warnings for captions, the podcast-without-transcript disclaimer, etc.) all come from real pitfalls, with the reasons kept in the comments.

---

## 中文

收藏夹里是不是躺着一堆「打算有空再看」的东西——几万字的深度长文、
一小时的英文播客、四十分钟的 B 站视频、几十条的 X thread……
结果一直吃灰，读不完也读不动。

read-anything 帮你把它们快速读懂：丢一个链接进来，几分钟后拿到一篇
讲清楚「这到底说了什么」的中文解读，还能就着它继续追问。全程在你的
AI agent 里完成，解读结果落成 markdown，沉淀进你自己的知识库。

### 它解决的那个具体麻烦

- **收藏了没时间读** → 几分钟给你一篇「不看原文也懂」的解读
- **是英文 / 视频 / 音频，读起来费劲** → 自动转写 + 直接产出中文结构化解读
- **想追问细节** → 就着材料对话，答案只基于原文，不编造
- **读完就忘、散落各处** → 解读落成 markdown，沉淀进你自己的系统
- **不想在十几个网页工具间来回切** → 一个链接，全程在你的 agent 里

### 吃得下这些格式

网页 / 博客 / 公众号单篇 / YouTube / B站 / 小宇宙播客 / X 帖子 /
**本地录音**（会议录音、语音备忘录，m4a/mp3/wav 直接丢文件路径）/ 纯文本
（含粘贴的会议纪要、语音转文字稿）。

英文内容直接产出中文解读（不用先翻译再读）；无字幕的视频、播客和本地
录音走本地转写（faster-whisper，音频不出本机、零 API 费）。

飞书/Notion 等登录墙后的文档链接抓不到（会如实告诉你）——从妙记导出
文字记录粘贴进来即可，照样拆解。

### 六种解读视角（+ 你自己的）

| 你想要 | 用哪个模板 |
|---|---|
| 完整读懂，不看原文也行 | 精读稿（默认） |
| 30 秒判断值不值得细读 | 快扫 |
| 播客 / 对谈，按人拆观点 | 访谈拆解 |
| 会议录音/纪要，拆决策·待办·分歧 | 会议纪要 |
| arXiv / 技术报告 | 论文拆解 |
| 从内容里挖可写的选题和素材 | 选题素材 |

不够用？往 `templates/` 丢一个你自己的 .md 就是新模板，说一句「用我的 xx 模板」即可。

### 一个原则：拿不到就说拿不到

抓取失败、只拿到摘要、音频没转成——都如实告诉你，绝不拿残缺材料硬编
一篇像模像样的解读。转写产物标注「可能存在听写误差」，引用金句提醒你
核对原文。你读到的每一句都有据可查。

### 安装

**Claude Code**（一条命令）：

```bash
git clone https://github.com/heyuxuan0209/read-anything.git ~/.claude/skills/read-anything
```

装完在任何会话里丢个链接说「分析一下」即可触发；更新用
`git -C ~/.claude/skills/read-anything pull`。只装到某个项目就克隆到
项目的 `.claude/skills/read-anything`。

**其他 agent（Codex / Cursor / Gemini CLI / OpenClaw…）**：核心逻辑全在
`PLAYBOOK.md`（纯 markdown 剧本）+ `scripts/`（普通命令行工具，JSON 进出），
不依赖任何 Claude 特性。所有 agent 的接法都是同一个模式——**克隆 + 在你的
agent 指令文件里贴一段话**：

```bash
git clone https://github.com/heyuxuan0209/read-anything.git ~/.agent-skills/read-anything
```

往下面这个文件里贴这段（各家只是文件名不同）：

```markdown
## read-anything（链接/录音 → 中文解读）
当我丢链接、音频文件，或粘贴长文/纪要并要求「分析 / 解读 / 讲了啥」时，
按 ~/.agent-skills/read-anything/PLAYBOOK.md 执行（路由、模板、降级规则都在里面）。
```

| Agent | 指令文件 |
|---|---|
| Codex CLI | `~/.codex/AGENTS.md`（全局）或项目根 `AGENTS.md` |
| Cursor | 项目 `.cursor/rules/` 下新建规则（或旧版 `.cursorrules`） |
| Gemini CLI | `~/.gemini/GEMINI.md`（全局）或项目根 `GEMINI.md` |
| 其他 / 懒得配 | 每次直接说「按 ~/.agent-skills/read-anything/PLAYBOOK.md 处理这个链接」 |

诚实边界：脚本保证各家 agent 拿到同样干净的材料；**解读质量由你所用模型决定**，
不承诺跨模型效果一致。

### 依赖

| 依赖 | 是否必需 | 用途 |
|---|---|---|
| Node.js 18+ | 必需 | 三个抓取脚本的运行时（零 npm 依赖） |
| yt-dlp | 可选 | YouTube/B站（`brew install yt-dlp`） |
| faster-whisper | 可选 | 播客/无字幕视频本地转写（`pip install faster-whisper`，首次自动下载 ~460MB 模型） |

缺可选依赖不报错——对应内容自动降级并**显式告知你降级了**。

国内网络访问 YouTube 需设置 `YOUTUBE_PROXY_URL` 环境变量（如 `http://127.0.0.1:7890`）。

### 文件结构

```
read-anything/
├── SKILL.md          # Claude Code 触发入口（薄壳）
├── PLAYBOOK.md       # 通用剧本：路由/材料规范/降级链/诚实守则（agent 无关）★
├── templates/        # 解读模板（精读/快扫/访谈/会议/论文/选题素材 + 你自己的）
└── scripts/          # fetch-article / fetch-xiaoyuzhou / vtt-to-text（零依赖）+ transcribe.py（可选）
```

### 和 NotebookLM 的关系

能像 NotebookLM 那样围着材料对话，但不用上传给任何云服务、不切网页，
音频本地转写不出本机，产物是你自己的 markdown 文件。

### 出处

从个人知识管理系统 [knowledge-workbench](https://github.com/heyuxuan0209/knowledge-workbench)
的「即时分析」链路提炼——那边是完整的「采集 → 理解 → 沉淀 → 创作」工作台，
这里是其中「读懂一条内容」环节的独立可分享版。脚本里的加固点（Jina 伪 200
识破、300 字垃圾门槛、字幕误听人名警示、播客无转写声明等）都来自真实踩坑，
注释里保留了原因。

## 🔗 关注我 · Follow me

边做 AI 产品边把一手经验和思考公开分享，欢迎关注、来聊。<br>
I build AI products in public and share the notes here — come say hi:

<table>
  <tr>
    <td align="center"><b>小红书 · Xiaohongshu</b></td>
    <td align="center"><b>公众号 · WeChat</b></td>
    <td align="center"><b>视频号 · Channels</b></td>
    <td align="center"><b>抖音 · Douyin</b></td>
  </tr>
  <tr>
    <td align="center"><img src="assets/qr-xiaohongshu.jpg" width="200" alt="小红书 杰西卡"></td>
    <td align="center"><img src="assets/qr-wechat.jpg" width="200" alt="公众号 杰西卡聊AI"></td>
    <td align="center"><img src="assets/qr-shipinhao.jpg" width="200" alt="视频号 杰西卡"></td>
    <td align="center"><img src="assets/qr-douyin.jpg" width="200" alt="抖音 杰西卡"></td>
  </tr>
</table>

## License & 二开须知 · Contributing

MIT — 见 [LICENSE](LICENSE)。欢迎 **Star / Fork / Issue**，也欢迎二次开发、魔改、接进你自己的产品或工作流。**唯一的请求**：二开或转载时**注明出处**，并 **@ 一下我**（公众号 / 小红书「**杰西卡聊AI**」，主页见上）——让顺着来的人能找到源头，就是最好的感谢 🙏。

MIT licensed — see [LICENSE](LICENSE). **Star / Fork / Issues welcome**, and feel free to remix, modify, or build it into your own product or workflow. **One ask:** if you fork/remix or repost, please **credit the source and @ me** (Jessica · 杰西卡聊AI). That's the best thank-you 🙏.
