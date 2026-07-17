#!/usr/bin/env node
// 网页正文抓取（零 npm 依赖，Node 18+ / 系统 curl）。
// 通用网页经 r.jina.ai 只读代理取正文；公众号文章走本机直抓专线（见下）。
// Jina 免 key、合规（官方公开服务）、免费档 20 RPM，交互式使用足够。
//
// 网络层用 curl 子进程而非 Node fetch：curl 天然读 http_proxy/https_proxy 环境变量，
// Node fetch（undici）不读——国内用户几乎都挂着代理，fetch 直连 jina.ai 会被重置
// （实测踩坑：同一环境 curl 通、fetch ECONNRESET）。
//
// 加固点（来自 knowledge-workbench 项目实战）：
// 1. Jina 会把上游错误包装成 200 返回 → 靠元数据头 Warning 行识破
// 2. X-Remove-Selector 从源头剔除导航/cookie 同意组件（否则整段文案被当正文抓走）
// 3. 正文 < 300 字判定为验证页/占位页 → 如实失败，不把垃圾交给解读层
// 4. Markdown 噪音清洗：图片标记、行内链接降纯文本、组件占位符
// 5. 公众号专线（2026-07-17 实测）：微信对 Jina 的数据中心 IP 返回验证页，
//    但对本机 IP 的直抓通常放行——mp.weixin.qq.com 先本机 curl 直抓 + js_content
//    提取，失败再落 Jina；两层都失败时合并报告原因，不掩盖第一手信息
//
// 用法: node fetch-article.mjs <url>
// 输出: JSON { ok, title, body, via, error }

import { execFile } from 'child_process';
import { promisify } from 'util';

const pexec = promisify(execFile);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

const url = process.argv[2];
if (!url) {
  console.log(JSON.stringify({ ok: false, error: '用法: node fetch-article.mjs <url>' }));
  process.exit(1);
}

function htmlToText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// 公众号直抓：正文固定在 id="js_content" 容器里，标题在 id="activity-name"
async function fetchWeixinDirect(target) {
  const { stdout: html } = await pexec('curl', [
    '-sSL', '--max-time', '20', '-A', UA, target,
  ], { maxBuffer: 32 * 1024 * 1024 });

  const title = html.match(/<h1[^>]*id="activity-name"[^>]*>([\s\S]*?)<\/h1>/)?.[1]
    ?.replace(/<[^>]+>/g, '').trim() || null;

  let block = html.match(/<div[^>]+id="js_content"[\s\S]*?<\/div>\s*<script/)?.[0] || '';
  let body = htmlToText(block);
  // 非贪婪匹配偶尔在嵌套 div 提前截断 → 退而取 js_content 起点后的整段再清洗
  if (body.length < 300) {
    const start = html.indexOf('id="js_content"');
    if (start >= 0) body = htmlToText(html.slice(start, start + 200000));
  }
  if (body.length < 300) {
    throw new Error('直抓未提取到正文（可能是验证页「环境异常」，或文章已删除/需登录）');
  }
  return { title, body };
}

async function fetchViaJina(target) {
  const { stdout: raw } = await pexec('curl', [
    '-sS', '-L', '--max-time', '30', '-A', UA,
    '-H', 'X-Remove-Selector: header, footer, nav, aside, [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i]',
    `https://r.jina.ai/${target}`,
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
  return { title, body };
}

try {
  const isWeixin = /^https?:\/\/mp\.weixin\.qq\.com\//.test(url.trim());

  if (isWeixin) {
    let directError;
    try {
      const r = await fetchWeixinDirect(url.trim());
      console.log(JSON.stringify({ ok: true, via: 'weixin-direct', ...r }));
      process.exit(0);
    } catch (err) {
      directError = err.message;
    }
    try {
      const r = await fetchViaJina(url.trim());
      console.log(JSON.stringify({ ok: true, via: 'jina', ...r }));
      process.exit(0);
    } catch (jinaError) {
      throw new Error(`公众号直抓失败（${directError}）；Jina 兜底同样失败（${jinaError.message}）。请在微信里打开文章复制正文粘贴进来`);
    }
  }

  const r = await fetchViaJina(url.trim());
  console.log(JSON.stringify({ ok: true, via: 'jina', ...r }));
} catch (err) {
  const reason = (err.stderr || err.message || '').toString().trim().slice(0, 400);
  console.log(JSON.stringify({ ok: false, error: reason }));
  process.exit(1);
}
