# 即时分析剧本（Instant Analysis Playbook）

任意链接（网页 / 博客 / YouTube / B站 / 小宇宙播客 / X 帖子）或纯文本 →
抓取/转写 → 中文结构化解读 → 基于材料的多轮问答。

本文件与具体 AI 工具无关：任何能执行 shell 命令的 agent 按此剧本操作即可。
下文的 `scripts/`、`templates/` 均相对于本文件所在目录。

---

## 流程总览

```
① 识别输入类型 → ② 按路由表抓取材料 → ③ 组装材料块（元数据规范）
→ ④ 选模板生成解读 → ⑤ 进入对话模式（基于材料问答）
```

全程遵守「诚实守则」（见下），每一级降级都必须显式声明。

---

## ① 输入类型识别

| 输入特征 | 类型 |
|---|---|
| `xiaoyuzhoufm.com/episode/` | 小宇宙播客单集 |
| `youtube.com` / `youtu.be` | YouTube 视频 |
| `bilibili.com` / `b23.tv` | B站视频 |
| `x.com` / `twitter.com` | X 帖子 |
| 其他 http(s) 链接 | 网页/博客/文章 |
| 非链接 | 纯文本，直接作为材料 |

---

## ② 抓取路由表

### 网页 / 博客 / 文章（含公众号单篇）

```bash
node scripts/fetch-article.mjs "<url>"
```

输出 JSON `{ok, title, body, error}`。经 r.jina.ai 只读代理，免 key；
脚本内置：上游错误识破（Jina 会把 403/404 包成 200）、300 字垃圾门槛、噪音清洗。

失败 → 如实报告脚本返回的原因，请用户直接粘贴正文。不要换个方式硬抓。

### YouTube

```bash
# 元数据（标题/频道/日期）——必取，见材料规范
yt-dlp --dump-json --skip-download --no-playlist "<url>"   # 取 title / channel / upload_date

# 字幕（人工字幕优先，自动字幕兜底）。语言列表写精确值，不要用 "en.*" 通配——
# 通配会连带拉取自动翻译版字幕（en-de/en-fr…），实测会触发 429 限流
yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "en,zh-Hans,zh" \
  --sub-format vtt -o "/tmp/read-anything/%(id)s" --no-playlist "<url>"
node scripts/vtt-to-text.mjs /tmp/read-anything/<id>.<lang>.vtt --timestamps
# 上面两种语言都没拉到时，看 --dump-json 输出的 subtitles/automatic_captions 字段选原始语言
```

代理：yt-dlp 天然读 `http_proxy/https_proxy` 环境变量；设置了 `YOUTUBE_PROXY_URL`
而 shell 未配代理时，显式加 `--proxy "$YOUTUBE_PROXY_URL"`。

已知坑：Homebrew 装的 `yt-dlp` 在 Python 升级后可能报 `bad interpreter`（shebang
指向已删除的旧 python），此时改用 `python3 -m yt_dlp`（参数完全相同）。

降级链：无字幕 → ASR 兜底（见下）→ 仍失败 → 基于标题+简介解读，显式声明。

### B站

元数据：`yt-dlp --dump-json --skip-download "<url>"`。
字幕接口需要登录态，不抓；正文直接走 ASR 兜底；ASR 不可用 → 基于标题+简介，显式声明。

### 小宇宙播客

```bash
node scripts/fetch-xiaoyuzhou.mjs "<episode_url>"
```

输出 JSON `{ok, title, author, publishedAt, durationMin, audioUrl, shownotes}`。
拿到 `audioUrl` 后走 ASR 兜底转写；正文 = 转写（如有）+ shownotes。

### ASR 兜底（可选增强，YouTube 无字幕 / B站 / 小宇宙共用）

先探测：`python3 -c "import faster_whisper"`。不可用则跳过 ASR，直接诚实降级。

```bash
mkdir -p /tmp/read-anything/audio
# YouTube / B站：
yt-dlp -f bestaudio -o "/tmp/read-anything/audio/a.%(ext)s" --no-playlist "<url>"
# 小宇宙：直接下载 audioUrl（直链可能是 m4a 或 mp3，后缀不影响解码——PyAV 按内容探测）
curl -sL -o /tmp/read-anything/audio/a.m4a "<audioUrl>"

# 转写（只转前 15 分钟，small 模型约等 5 分钟；免 ffmpeg）
python3 scripts/transcribe.py /tmp/read-anything/audio/a.m4a --max-seconds 900
```

注意：
- 转写前告知用户「本地转写约需几分钟」；音频不出本机、零 API 费
  （实测参考：faster-whisper small，CPU int8，15 分钟音频约转 5 分钟）
- 长节目音频直链可达上百 MB（实测 123 分钟播客 mp3 = 113MB），下载本身也要时间
- 下载失败重试 1 次（隔 5 秒，B站会临时限速）；再失败如实降级
- 结束后清理 `/tmp/read-anything/`
- 进阶（本 skill 不内置）：whisperX + pyannote 可做说话人分离，但 CPU 上同样
  15 分钟音频约需 21 分钟（实测 M1 Pro），开启前把成本告知用户

### X / Twitter

1. 先试 `node scripts/fetch-article.mjs "<url>"`（Jina 对部分帖子可行）
2. 失败且本机装有 agent-reach 等社交抓取工具 → 借道
3. 都不行 → 如实说明 X 反爬严格，请用户粘贴帖子全文（推文短，粘贴成本低）

---

## ③ 材料组装规范

解读前必须组装带元数据的材料块。**元数据缺失时写「未知」，不许省略该行**——
模型必须知道"没有"，否则会从字幕语音里猜人名（真实案例：Thariq Shihipar
被自动字幕误听成 "Tarik Shaupar"，缺元数据时解读稿把错名当真）。

```
【元数据】
- 原题：<原标题 或 未知>
- 作者/演讲者：<姓名 或 未知（正文中的人名可能是自动字幕的误听，请谨慎对待）>
- 平台/场合：<平台名 或 未知>
- 链接：<url 或 无>
- 日期：<YYYY-MM-DD 或 未知>
<降级时加一行> ⚠️ <降级说明，用下方话术模板>
【正文/字幕】
<正文 / 转写 / 字幕文本>
```

超长内容截断策略：字幕/转写取前 2 万字、文章取前 8 千字（前段足以支撑解读；
agent 上下文充裕时可放宽），截断必须在产物中声明「内容过长，已截取前段解读」。

---

## ④ 模板路由与生成

模板在 `templates/` 目录，一个文件一个模板。**用户自定义 = 往目录里丢自己的 .md**。

| 内容特征 | 默认模板 |
|---|---|
| 播客 / 对谈 / 圆桌 | `interview.md` |
| arXiv / 论文 / 技术报告 | `paper.md` |
| 用户说「快扫 / 值不值得读」 | `brief.md` |
| 用户说「选题 / 提素材 / 攒弹药」 | `ideas.md` |
| 其他一切 | `deep-read.md`（默认） |

用户一句话可覆盖（「用快扫」「用我的 xx 模板」）。生成前读取所选模板文件，
按其规则和结构输出。**输出语言默认简体中文**（这是"自动转写成中文"环节：
不产出逐字译文，直接用中文写解读；用户要逐字全译时再单独翻译）。

术语处理：Agent / RAG / LLM / Prompt / Token / Transformer 等通用术语保留英文；
Embedding→嵌入、Fine-tuning→微调；其余术语首次出现附英文。

产物默认直接输出；用户要求保存时落成 markdown 文件（文件名 = 中文标题）。

---

## ⑤ 对话模式

解读稿输出后进入问答。规则：

- 回答**只基于材料**；材料里没有的，明确说「材料中没有提到」，不编造
- 材料是降级材料（仅摘要/shownotes/标题+简介）时，每次回答都要提醒
  「我没有读到原文/完整内容」，不要假装读过
- 引用金句尽量带时间戳（字幕/转写材料有时间戳时）
- 用户追问超出材料范围且需要外部信息时，说明这超出了本材料，
  问用户是否要另行检索（不要混入未经声明的外部知识冒充材料内容）

---

## 诚实守则（所有环节共享，优先级高于模板）

1. 只写材料里真实存在的内容，不编造不外推；无法确认的标「存疑」
2. 每一级降级都显式声明，并给出原链接让用户可自行核实
3. 抓取/转写失败时如实合并报告各层原因，不猜测、不掩盖第一手错误信息
4. ASR 转写产物必须标注「音频转写生成，可能存在少量听写误差」；
   展示转写原文时只加标点分段，**严禁增删改字词**（同音字错误保留原样）。
   whisper small 中文同音字误差是实测常态（"Momenta"→"萌萌塔"、
   "数据驱动"→"数据去动"）：解读时按上下文默默纠正即可，但**引用金句、
   人名、产品名、数字前必须核对原节目/原视频**，核对不了就不引用
5. 拿不到转写只有 shownotes 时，材料头部必须加显式声明（见话术模板），
   防止解读稿基于大纲脑补出"完整内容"的假象

### 降级话术模板（直接复用，不要即兴改写弱化）

- 播客无转写：
  `【重要声明】本次未能获取音频转写，以下仅为节目 shownotes（大纲/简介），不代表节目完整内容。解读时请明确基于 shownotes 的局限性，不要推测正文细节。`
- 视频无字幕无转写：
  `无法获取视频字幕，音频转写也失败（<原因>），以下基于标题与简介，请自行查看原视频核实：<url>`
- 网页抓取失败：
  `无法获取原文（<原因>），请直接粘贴正文，或自行查看原文：<url>`
- 转写截断：
  `节目共 <N> 分钟，以下为前 15 分钟转写，可能存在少量听写误差`

---

## 环境自检（首次使用或失败排查时）

| 依赖 | 检测 | 缺失时 |
|---|---|---|
| Node 18+ | `node --version` | 必需（三个抓取脚本的运行时） |
| curl | 系统自带（macOS/Linux/Win10+） | 必需（抓取脚本的网络层，天然支持代理环境变量） |
| yt-dlp | `yt-dlp --version`（报 bad interpreter 时用 `python3 -m yt_dlp`） | YouTube/B站不可用，其余路由不受影响 |
| faster-whisper | `python3 -c "import faster_whisper"` | 无 ASR，播客/无字幕视频降级为 shownotes/简介 |
| YOUTUBE_PROXY_URL | 环境变量 | 网络可直连 YouTube 则不需要 |
