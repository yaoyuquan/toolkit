/**
 * 公共工具函数：文本处理、剪贴板、轻提示
 */
(function (Toolkit) {
  'use strict';

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * 根据下拉框取值返回缩进字符串
   */
  function indentOf(value) {
    return value === 'tab' ? '\t' : ' '.repeat(parseInt(value, 10) || 2);
  }

  /**
   * 统计文本行数与字符数
   */
  function statText(text) {
    if (!text) {
      return '0 行 · 0 字符';
    }
    return text.split('\n').length + ' 行 · ' + text.length + ' 字符';
  }

  /**
   * 把字符偏移量换算成「行:列」，用于定位 JSON 语法错误
   */
  function offsetToPosition(text, offset) {
    var before = text.slice(0, offset);
    var line = before.split('\n').length;
    var col = offset - before.lastIndexOf('\n');
    return line + ' 行 ' + col + ' 列';
  }

  function repeatIndent(unit, level) {
    return level > 0 ? new Array(level + 1).join(unit) : '';
  }

  function copyText(text, callback) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        callback(true);
      }, function () {
        callback(fallbackCopy(text));
      });
      return;
    }
    callback(fallbackCopy(text));
  }

  /**
   * file:// 等非安全上下文下的兜底复制方案
   */
  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  var toastTimer = null;

  function toast(message) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, 1800);
  }

  Toolkit.util = {
    escapeHtml: escapeHtml,
    indentOf: indentOf,
    statText: statText,
    offsetToPosition: offsetToPosition,
    repeatIndent: repeatIndent,
    copyText: copyText,
    toast: toast
  };
})(window.Toolkit);
