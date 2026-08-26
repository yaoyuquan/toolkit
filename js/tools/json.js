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
    highlight: highlightJson
  });
})(window.Toolkit);
