/**
 * JSON 格式化
 */
(function (Toolkit) {
  'use strict';

  var escapeHtml = Toolkit.util.escapeHtml;
  var offsetToPosition = Toolkit.util.offsetToPosition;

  var SAMPLE = '{"code":0,"msg":"ok","data":{"id":1001,"name":"张三","tags":["admin","dev"],"profile":{"age":28,"active":true,"score":95.5,"remark":null}},"list":[{"id":1,"title":"第一条"},{"id":2,"title":"第二条"}]}';

  /**
   * 递归排序对象键名
   */
  function sortObjectKeys(value) {
    if (Array.isArray(value)) {
      return value.map(sortObjectKeys);
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce(function (acc, key) {
        acc[key] = sortObjectKeys(value[key]);
        return acc;
      }, {});
    }
    return value;
  }

  /**
   * 解析 JSON，失败时抛出带行列信息的错误
   */
  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      var match = /position\s+(\d+)/i.exec(e.message);
      var extra = match ? '（第 ' + offsetToPosition(text, parseInt(match[1], 10)) + '）' : '';
      throw new Error(e.message + extra);
    }
  }

  /**
   * JSON 语法高亮
   */
  function highlightJson(text) {
    var pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    return escapeHtml(text).replace(pattern, function (match, str, colon, bool) {
      if (str) {
        return colon
          ? '<span class="tk-key">' + str + '</span>' + colon
          : '<span class="tk-str">' + str + '</span>';
      }
      if (bool) {
        return '<span class="tk-bool">' + match + '</span>';
      }
      return '<span class="tk-num">' + match + '</span>';
    });
  }

  /**
   * 生成单行 HTML：行号 + 折叠按钮 + 高亮后的代码
   */
  function lineHtml(no, code, foldable, placeholder) {
    return '<div class="ln">' +
      '<span class="ln-gutter"><span class="ln-no">' + no + '</span>' +
      '<span class="ln-fold"' + (foldable ? ' data-fold title="折叠 / 展开（Alt + 点击作用于全部子级）"' : '') + '></span></span>' +
      '<span class="ln-code">' + highlightJson(code) + (placeholder || '') + '</span></div>';
  }

  /**
   * 渲染带行号、可折叠的结果
   * 依赖 JSON.stringify 的输出形态：以 { 或 [ 结尾的行开启一个块，单独的 } / ] 行（可带逗号）关闭它，
   * 字符串值一定带引号，所以不会误判；空对象/空数组会输出成 {} / [] 单行，不产生折叠块
   */
  function renderJson(text) {
    var lines = text.split('\n');
    var html = [];
    var stack = [];

    lines.forEach(function (line, i) {
      var no = i + 1;
      var trimmed = line.trim();
      var top = stack[stack.length - 1];

      if (top && /^[\]}],?$/.test(trimmed)) {
        stack.pop();
        var unit = top.isArray ? ' 项' : ' 个字段';
        var placeholder = '<span class="fold-ph"><span class="fold-more" data-fold title="展开">' +
          top.count + unit + '</span>' + escapeHtml(trimmed) + '</span>';
        html[top.index] = lineHtml(top.no, top.line, true, placeholder);
        html.push('</div>', lineHtml(no, line, false), '</div>');
        return;
      }

      // 当前行是父级块的一个直接成员
      if (top) {
        top.count++;
      }

      if (/[\[{]$/.test(trimmed)) {
        html.push('<div class="fold">');
        stack.push({ index: html.length, no: no, line: line, count: 0, isArray: trimmed.slice(-1) === '[' });
        html.push('', '<div class="fold-body">');
        return;
      }

      html.push(lineHtml(no, line, false));
    });

    // 理论上不会出现未闭合的块，兜底按普通行处理，保证结构完整
    while (stack.length) {
      var rest = stack.pop();
      html[rest.index] = lineHtml(rest.no, rest.line, false);
      html.push('</div></div>');
    }

    return '<div class="lined" style="--ln-w:' + String(lines.length).length + '">' + html.join('') + '</div>';
  }

  Toolkit.register({
    id: 'json',
    name: 'JSON 格式化',
    icon: '{ }',
    desc: '格式化、压缩与校验 JSON 文本',
    sample: SAMPLE,
    format: function (text, options) {
      var data = parseJson(text);
      return JSON.stringify(options.sortKeys ? sortObjectKeys(data) : data, null, options.indent);
    },
    minify: function (text, options) {
      var data = parseJson(text);
      return JSON.stringify(options.sortKeys ? sortObjectKeys(data) : data);
    },
    validate: parseJson,
    highlight: highlightJson,
    render: renderJson
  });
})(window.Toolkit);
