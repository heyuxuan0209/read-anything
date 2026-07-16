#!/usr/bin/env node
// 网页正文抓取（零 npm 依赖，Node 18+ / 系统 curl）：经 r.jina.ai 只读代理取正文。
// 免 key、合规（Jina 官方公开服务）、免费档 20 RPM，交互式使用足够。
//
// 网络层用 curl 子进程而非 Node fetch：curl 天然读 http_proxy/https_proxy 环境变量，
// Node fetch（undici）不读——国内用户几乎都挂着代理，fetch 直连 jina.ai 会被重置
// （实测踩坑：同一环境 curl 通、fetch ECONNRESET）。
//
// 加固点（来自 knowledge-workbench 项目实战）：
// 1. Jina 会把上游 403/404 包装成 200 返回 → 靠元数据头 Warning 行识破
// 2. X-Remove-Selector 从源头剔除导航/cookie 同意组件（否则整段文案被当正文抓走）
// 3. 正文 < 300 字判定为验证页/占位页 → 如实失败，不把垃圾交给解读层
// 4. Markdown 噪音清洗：图片标记、行内链接降纯文本、组件占位符
//
// 用法: node fetch-article.mjs <url>
// 输出: JSON { ok, title, body, error }

import { execFile } from 'child_process';
import { promisify } from 'util';

const pexec = promisify(execFile);

const url = process.argv[2];
if (!url) {
  console.log(JSON.stringify({ ok: false, error: '用法: node fetch-article.mjs <url>' }));
  process.exit(1);
}

try {
  const { stdout: raw } = await pexec('curl', [
    '-sS', '-L', '--max-time', '30',
    '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    '-H', 'X-Remove-Selector: header, footer, nav, aside, [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i]',
    `https://r.jina.ai/${url}`,
  ], { maxBuffer: 16 * 1024 * 1024 });

  // Jina 把上游错误包成 200，靠 Warning 行识别
  const upstreamError = raw.match(/^Warning:\s*Target URL returned error (\d+.*)$/m)?.[1];
  if (upstreamError) throw new Error(`目标站点对 Jina Reader 返回 ${upstreamError.trim()}`);

  // 注意 [ \t] 不能写 \s：\s 匹配换行，标题为空时会吞掉换行误抓下一行元数据
  const title = raw.match(/^Title:[ \t]*(.+)$/m)?.[1]?.trim() || null;
  const marker = raw.indexOf('Markdown Content:');
  const body = (marker >= 0 ? raw.slice(marker + 'Markdown Content:'.length) : raw)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                    // 图片整体删除
    .replace(/\[\[[^\]]*\]\]\([^)]*\)/g, '')                 // [[#占位符#]](url) cookie 组件
    .replace(/^\s*\*?\s*\[[^\]]{0,12}\]\([^)]*\)\s*$/gm, '') // 短链接列表行（导航条）
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')                 // 行内链接降为纯文本
    .replace(/\[#[^\]]*#\]/g, '')                            // [#GPC_BANNER_ICON#] 类占位符
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 门槛 300 字：验证页/占位页会伪装成成功返回，真实文章正文极少短于此
  if (body.length < 300) throw new Error('未提取到有效正文（疑似验证页/占位页/登录墙）');

  console.log(JSON.stringify({ ok: true, title, body }));
} catch (err) {
  const reason = (err.stderr || err.message || '').toString().trim().slice(0, 300);
  console.log(JSON.stringify({ ok: false, error: reason }));
  process.exit(1);
}
