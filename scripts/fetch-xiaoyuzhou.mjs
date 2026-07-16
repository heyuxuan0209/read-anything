#!/usr/bin/env node
// 小宇宙播客单集抓取（零 npm 依赖，Node 18+ / 系统 curl）。
// 单集页是 SSR，__NEXT_DATA__ 里有完整元数据 + 音频直链（m4a/mp3），免登录。
// 网络层用 curl（读代理环境变量；Node fetch 不读，见 fetch-article.mjs 注释）。
//
// 同步指引：knowledge-workbench backend（content-ingestion.js ingestXiaoyuzhou）
// 有一份并行实现。对页面结构（__NEXT_DATA__）、风控（短时密集请求 503）、
// 音频字段（enclosure.url / media.source.url）的认知变更，两边需通过 handoff
// 文档互相同步——同一逻辑多份拷贝必然漂移（2026-07-16 backend 路由表漂移的教训）。
//
// 用法: node fetch-xiaoyuzhou.mjs <episode_url>
// 输出: JSON { ok, title, author, publishedAt, durationMin, audioUrl, shownotes, error }

import { execFile } from 'child_process';
import { promisify } from 'util';

const pexec = promisify(execFile);

const url = process.argv[2];
if (!url || !url.includes('xiaoyuzhoufm.com')) {
  console.log(JSON.stringify({ ok: false, error: '用法: node fetch-xiaoyuzhou.mjs <小宇宙单集链接>' }));
  process.exit(1);
}

// 小宇宙对短时密集请求返回 503（backend 2026-07-16 实测），间隔 8 秒重试一次可消化。
// curl 加 -f：HTTP 4xx/5xx 按失败处理（退出码 22），进入重试
async function fetchPage(target) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pexec('curl', [
        '-sSf', '-L', '--max-time', '15',
        '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        target,
      ], { maxBuffer: 16 * 1024 * 1024 });
    } catch (err) {
      if (attempt >= 1) throw err;
      await new Promise(r => setTimeout(r, 8000));
    }
  }
}

try {
  const { stdout: html } = await fetchPage(url.trim());

  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
  if (!m) throw new Error('小宇宙页面结构变化，未找到数据块（__NEXT_DATA__）');

  const ep = JSON.parse(m[1])?.props?.pageProps?.episode;
  if (!ep?.title) throw new Error('数据块里没有单集信息（可能是会员专享或已下架）');

  const shownotes = (ep.shownotes || ep.description || '')
    .replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  console.log(JSON.stringify({
    ok: true,
    title: ep.title,
    author: [ep.podcast?.title, ep.podcast?.author].filter(Boolean).join(' · ') || null,
    publishedAt: ep.pubDate?.slice(0, 10) || null,
    durationMin: ep.duration ? Math.round(ep.duration / 60) : null,
    audioUrl: ep.enclosure?.url || ep.media?.source?.url || null,
    shownotes,
  }));
} catch (err) {
  const reason = (err.stderr || err.message || '').toString().trim().slice(0, 300);
  console.log(JSON.stringify({ ok: false, error: `小宇宙页面抓取失败：${reason}` }));
  process.exit(1);
}
