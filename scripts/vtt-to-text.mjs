#!/usr/bin/env node
// VTT 字幕 → 干净纯文本（零依赖）。处理 YouTube 自动字幕的滚动重复问题：
// 自动字幕每条 cue 会重复上一条的尾部，直接拼接会得到大量重复行，需去重。
//
// 用法: node vtt-to-text.mjs <file.vtt> [--timestamps]
// --timestamps: 每行带 [mm:ss] 起始时间（供精读稿引用金句时标注出处）

import { readFileSync } from 'fs';

const file = process.argv[2];
const withTs = process.argv.includes('--timestamps');
if (!file) {
  console.error('用法: node vtt-to-text.mjs <file.vtt> [--timestamps]');
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');
const blocks = raw.split(/\n\n+/);
const out = [];
let lastLine = '';

for (const block of blocks) {
  const lines = block.split('\n');
  const tsLine = lines.find(l => l.includes('-->'));
  if (!tsLine) continue;
  const start = tsLine.match(/^([\d:.]+)\s*-->/)?.[1] || '';

  for (let line of lines) {
    if (line.includes('-->') || /^(WEBVTT|Kind:|Language:|NOTE|STYLE|\d+)$/.test(line.trim())) continue;
    line = line.replace(/<[^>]+>/g, '').trim(); // 去掉 <00:00:01.000><c> 类内联标签
    if (!line || line === lastLine) continue;   // 滚动字幕去重
    lastLine = line;
    if (withTs && start) {
      const p = start.split(':');
      const mmss = p.length === 3 ? `${p[0] === '00' ? '' : p[0] + ':'}${p[1]}:${p[2].slice(0, 2)}` : start;
      out.push(`[${mmss}] ${line}`);
    } else {
      out.push(line);
    }
  }
}

console.log(out.join('\n'));
