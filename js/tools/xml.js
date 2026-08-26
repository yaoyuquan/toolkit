/**
 * XML 格式化
 */
(function (Toolkit) {
  'use strict';

  var escapeHtml = Toolkit.util.escapeHtml;

  var SAMPLE = '<?xml version="1.0" encoding="UTF-8"?><users total="2"><!-- 用户列表 --><user id="1001" active="true"><name>张三</name><email>zhangsan@example.com</email><roles><role>admin</role><role>dev</role></roles></user><user id="1002" active="false"><name>李四</name><email>lisi@example.com</email><remark><![CDATA[备注 <含特殊字符> & 符号]]></remark></user></users>';

  /**
   * 用浏览器内置解析器校验 XML，出错时抛出解析器给出的原因
   */
  function validateXml(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    var error = doc.getElementsByTagName('parsererror')[0];
    if (error) {
      var reason = (error.textContent || '未知错误').replace(/\s+/g, ' ').trim();
      throw new Error(reason);
    }
    return doc;
  }

  /**
   * 把 XML 拆成「声明 / 注释 / CDATA / 标签 / 文本」词元
   */
  function tokenizeXml(text) {
    var pattern = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<[?!][\s\S]*?>|<\/?[^<>]+>|[^<]+/g;
    return text.match(pattern) || [];
  }

  /**
   * XML 美化：按层级重新缩进，纯文本内容与其父标签保持同一行
   */
  function formatXml(text, indent) {
    validateXml(text);
    var tokens = tokenizeXml(text);
    var lines = [];
    var depth = 0;
    var i;

    for (i = 0; i < tokens.length; i++) {
      var token = tokens[i].trim();
      if (!token) {
        continue;
      }

      var isClose = /^<\//.test(token);
      var isSelfClose = /\/>$/.test(token);
      var isMeta = /^<[?!]/.test(token);
      var isOpen = /^<[^/?!]/.test(token) && !isSelfClose;

      if (isClose) {
        depth = Math.max(depth - 1, 0);
      }

      // 形如 <tag>文本</tag> 的组合合并到一行
      if (isOpen && i + 2 < tokens.length && !/^</.test(tokens[i + 1]) && /^<\//.test(tokens[i + 2].trim())) {
        lines.push(indent.repeat(depth) + token + tokens[i + 1].trim() + tokens[i + 2].trim());
        i += 2;
        continue;
      }

      lines.push(indent.repeat(depth) + token);

      if (isOpen && !isMeta) {
        depth++;
      }
    }

    return lines.join('\n');
  }

  /**
   * XML 压缩：去掉标签之间的空白，CDATA 内容原样保留
   */
  function minifyXml(text) {
    validateXml(text);
    return text.replace(/(<!\[CDATA\[[\s\S]*?\]\]>)|>\s+</g, function (match, cdata) {
      return cdata ? cdata : '><';
    }).trim();
  }

  /**
   * XML 语法高亮
   */
  function highlightXml(text) {
    var escaped = escapeHtml(text);
    var pattern = /&lt;!--[\s\S]*?--&gt;|&lt;!\[CDATA\[[\s\S]*?\]\]&gt;|&lt;[\s\S]*?&gt;/g;
    return escaped.replace(pattern, function (token) {
      if (/^&lt;!--/.test(token) || /^&lt;!\[CDATA\[/.test(token)) {
        return '<span class="tk-comment">' + token + '</span>';
      }
      // 标签内部：属性名 = 属性值
      var inner = token.replace(/([\w:.-]+)=("[^"]*"|'[^']*')/g, function (all, name, value) {
        return '<span class="tk-attr">' + name + '</span>=<span class="tk-str">' + value + '</span>';
      });
      return '<span class="tk-tag">' + inner + '</span>';
    });
  }

  Toolkit.register({
    id: 'xml',
    name: 'XML 格式化',
    icon: '</>',
    desc: '格式化、压缩与校验 XML 文本',
    sample: SAMPLE,
    format: function (text, options) {
      return formatXml(text, options.indent);
    },
    minify: function (text) {
      return minifyXml(text);
    },
    validate: validateXml,
    highlight: highlightXml
  });
})(window.Toolkit);
