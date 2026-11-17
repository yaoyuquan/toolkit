#!/usr/bin/env node
/**
 * 单文件打包：把 index.html 引用的本地 CSS / JS 全部内联，输出 dist/toolkit.html。
 * 无任何依赖，直接 `node build.js` 即可。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'toolkit.html');

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    throw new Error('找不到引用的文件: ' + rel);
  }
  return fs.readFileSync(file, 'utf8');
}

function isLocal(href) {
  return !/^([a-z]+:)?\/\//i.test(href) && !href.startsWith('data:');
}

// 防止内联内容里的 </script、</style 提前结束标签
function escapeClosing(code, tag) {
  return code.replace(new RegExp('</(' + tag + ')', 'gi'), '<\\/$1');
}

let html = read('index.html');
let cssCount = 0;
let jsCount = 0;

html = html.replace(
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi,
  (tag) => {
    const m = tag.match(/\bhref=["']([^"']+)["']/i);
    if (!m || !isLocal(m[1])) return tag;
    cssCount++;
    const css = escapeClosing(read(m[1]), 'style');
    return '<style>\n' + css + '\n</style>';
  }
);

html = html.replace(
  /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
  (tag, before, src, after) => {
    if (!isLocal(src)) return tag;
    jsCount++;
    const js = escapeClosing(read(src), 'script');
    const attrs = (before + after).replace(/\s+/g, ' ').trim();
    return '<script' + (attrs ? ' ' + attrs : '') + '>\n/* ' + src + ' */\n' + js + '\n</script>';
  }
);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`已生成 ${path.relative(ROOT, OUT_FILE)}（${kb} KB，内联 CSS ${cssCount} 个、JS ${jsCount} 个）`);
