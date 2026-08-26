/**
 * 开发者工具箱
 * 左侧菜单 + 右侧工作区，通过 hash 路由切换工具
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 工具注册表
   * 新增工具时：这里加一项，并在 index.html 中补一个同 id 的 section.panel
   * ------------------------------------------------------------------ */
  var TOOLS = [
    { id: 'json', name: 'JSON 格式化', icon: '{ }', desc: '格式化、压缩与校验 JSON 文本' },
    { id: 'xml', name: 'XML 格式化', icon: '</>', desc: '格式化、压缩与校验 XML 文本' },
    { id: 'mybatis', name: 'MyBatis SQL', icon: 'SQL', desc: '把 MyBatis 日志还原成可直接执行的 SQL' }
  ];

  var SAMPLES = {
    json: '{"code":0,"msg":"ok","data":{"id":1001,"name":"张三","tags":["admin","dev"],"profile":{"age":28,"active":true,"score":95.5,"remark":null}},"list":[{"id":1,"title":"第一条"},{"id":2,"title":"第二条"}]}',
    xml: '<?xml version="1.0" encoding="UTF-8"?><users total="2"><!-- 用户列表 --><user id="1001" active="true"><name>张三</name><email>zhangsan@example.com</email><roles><role>admin</role><role>dev</role></roles></user><user id="1002" active="false"><name>李四</name><email>lisi@example.com</email><remark><![CDATA[备注 <含特殊字符> & 符号]]></remark></user></users>',
    mybatis: [
      "2026-08-26 11:09:52.659 DEBUG 215200 --- [  container-339] c.u.s.c.dao.CommonDao.getCodeNameValue   : ==>  Preparing: SELECT SC.VALUE code,SC.NAME name FROM S_CODE SC WHERE SC.CODE_TYPE = ? AND SC.ISACTIVE = '0' AND SC.CODE_STATUS = '1' ",
      "2026-08-26 11:09:52.659 DEBUG 215200 --- [  container-339] c.u.s.c.dao.CommonDao.getCodeNameValue   : ==> Parameters: channelType(String)",
      "2026-08-26 11:09:52.660 DEBUG 215200 --- [  container-339] c.u.s.c.dao.CommonDao.getCodeNameValue   : <==      Total: 6",
      "2026-08-26 11:09:53.101 DEBUG 215200 --- [  container-339] c.u.s.c.dao.OrderDao.insertOrder         : ==>  Preparing: INSERT INTO T_ORDER (ID, USER_NAME, AMOUNT, REMARK, CREATE_TIME) VALUES (?, ?, ?, ?, ?)",
      "2026-08-26 11:09:53.102 DEBUG 215200 --- [  container-339] c.u.s.c.dao.OrderDao.insertOrder         : ==> Parameters: 1001(Long), 张三, 李四(String), 128.50(BigDecimal), null, 2026-08-26 11:09:53.0(Timestamp)",
      "2026-08-26 11:09:53.104 DEBUG 215200 --- [  container-339] c.u.s.c.dao.OrderDao.insertOrder         : <==    Updates: 1"
    ].join('\n')
  };

  /* ==================================================================
   * 通用工具函数
   * ================================================================== */

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

  /* ==================================================================
   * JSON 处理
   * ================================================================== */

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

  /* ==================================================================
   * XML 处理
   * ================================================================== */

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

  /* ==================================================================
   * MyBatis 日志还原 SQL
   * ================================================================== */

  // 这些类型在 SQL 中不加引号，其余一律按字符串处理
  var RAW_TYPES = /^(Integer|Long|Short|Byte|Double|Float|BigDecimal|BigInteger|Number)$/;

  var PREPARING_RE = /Preparing:\s*([\s\S]*)$/;
  var PARAMETERS_RE = /Parameters:\s*([\s\S]*)$/;
  var RESULT_RE = /<==\s*(Total|Updates):\s*(\d+)/;
  var MAPPER_RE = /\]\s*([\w.$]+)\s*:/;

  /**
   * 拆分参数串
   * 参数值本身可能带有「, 」（例如 "张三, 李四(String)"），
   * 因此按「以 (类型) 结尾」来判断一个参数是否结束
   */
  function splitParameters(text) {
    if (!text || !text.trim()) {
      return [];
    }
    var parts = text.trim().split(', ');
    var params = [];
    var buffer = '';
    var i;

    for (i = 0; i < parts.length; i++) {
      buffer = buffer === '' ? parts[i] : buffer + ', ' + parts[i];
      if (buffer === 'null' || /\([A-Za-z][\w.$]*\)$/.test(buffer)) {
        params.push(buffer);
        buffer = '';
      }
    }
    if (buffer !== '') {
      params.push(buffer);
    }
    return params;
  }

  function quoteLiteral(value) {
    return "'" + value.replace(/'/g, "''") + "'";
  }

  /**
   * 把「值(类型)」转换成 SQL 字面量
   */
  function toSqlLiteral(param) {
    var trimmed = param.trim();
    if (trimmed === '' || trimmed === 'null') {
      return 'NULL';
    }

    var match = /^([\s\S]*)\(([A-Za-z][\w.$]*)\)$/.exec(trimmed);
    if (!match) {
      return quoteLiteral(trimmed);
    }

    var value = match[1];
    var type = match[2];
    if (RAW_TYPES.test(type)) {
      return value;
    }
    if (type === 'Boolean') {
      return value.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
    }
    return quoteLiteral(value);
  }

  /**
   * 依次把占位符替换成参数值，引号内的 ? 不参与替换
   */
  function applyParameters(sql, literals) {
    var out = '';
    var used = 0;
    var quote = null;
    var i;

    for (i = 0; i < sql.length; i++) {
      var ch = sql.charAt(i);
      if (quote) {
        out += ch;
        if (ch === quote) {
          quote = null;
        }
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        out += ch;
        continue;
      }
      if (ch === '?') {
        out += used < literals.length ? literals[used] : '?';
        used++;
        continue;
      }
      out += ch;
    }

    return { sql: out, placeholders: used };
  }

  /* ---------- SQL 排版 ---------- */

  // 另起一行顶格的主关键字，长短语排在前面以便优先匹配
  var SQL_MAIN_KEYWORDS = [
    'ON DUPLICATE KEY UPDATE', 'INSERT INTO', 'DELETE FROM', 'SELECT DISTINCT',
    'GROUP BY', 'ORDER BY', 'UNION ALL', 'INTERSECT', 'RETURNING', 'SELECT',
    'UPDATE', 'VALUES', 'HAVING', 'OFFSET', 'EXCEPT', 'WHERE', 'LIMIT',
    'UNION', 'FROM', 'SET'
  ];

  var SQL_JOIN_KEYWORDS = [
    'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'STRAIGHT_JOIN',
    'CROSS JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'JOIN'
  ];

  // 另起一行并缩进一级的关键字
  var SQL_SUB_KEYWORDS = ['AND', 'OR', 'ON'];

  // 后面跟逗号列表的关键字，列表项需要逐项换行
  var SQL_LIST_KEYWORDS = ['SELECT DISTINCT', 'SELECT', 'SET', 'FROM', 'GROUP BY', 'ORDER BY'];

  // 只参与大写与高亮、不参与换行的关键字
  var SQL_OTHER_KEYWORDS = [
    'INSERT', 'INTO', 'DELETE', 'CREATE', 'ALTER', 'TABLE', 'DROP', 'BETWEEN',
    'DISTINCT', 'EXISTS', 'LIKE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'NULL', 'TRUE', 'FALSE', 'DESC', 'ASC', 'NOT', 'AS', 'IN', 'IS', 'BY'
  ];

  // 函数名：大写但左括号要紧贴，与 IN (...) / VALUES (...) 区分开
  var SQL_FUNCTIONS = [
    'COUNT', 'SUM', 'MAX', 'MIN', 'AVG', 'COALESCE', 'IFNULL', 'NVL', 'CONCAT',
    'SUBSTR', 'SUBSTRING', 'TRIM', 'UPPER', 'LOWER', 'ROUND', 'CAST', 'NOW',
    'SYSDATE', 'TO_CHAR', 'TO_DATE', 'DATE_FORMAT'
  ];

  /**
   * 把关键字列表拍平成查找表，多词短语按单词拆开
   */
  function toKeywordSet(lists) {
    var set = {};
    lists.forEach(function (list) {
      list.forEach(function (phrase) {
        phrase.split(' ').forEach(function (word) {
          set[word] = true;
        });
      });
    });
    return set;
  }

  // 用于统一大写
  var SQL_KEYWORD_SET = toKeywordSet([SQL_MAIN_KEYWORDS, SQL_JOIN_KEYWORDS, SQL_SUB_KEYWORDS, SQL_OTHER_KEYWORDS, SQL_FUNCTIONS]);

  // 用于判断左括号前是否留空格，函数名不在其中
  var SQL_SYNTAX_SET = toKeywordSet([SQL_MAIN_KEYWORDS, SQL_JOIN_KEYWORDS, SQL_SUB_KEYWORDS, SQL_OTHER_KEYWORDS]);

  var SQL_TOKEN_RE = /\s+|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|--[^\n]*|\/\*[\s\S]*?\*\/|<=|>=|<>|!=|\|\||[(),;]|[\w$#.]+|\S/g;

  function isSqlWord(token) {
    return /^[\w$#.]+$/.test(token);
  }

  function repeatIndent(unit, level) {
    return level > 0 ? new Array(level + 1).join(unit) : '';
  }

  function tokenizeSql(sql) {
    return (sql.match(SQL_TOKEN_RE) || []).filter(function (token) {
      return !/^\s+$/.test(token);
    });
  }

  /**
   * 从 index 处尝试匹配一个（可能由多个单词组成的）关键字
   */
  function matchKeyword(tokens, index, keywords) {
    var i;
    for (i = 0; i < keywords.length; i++) {
      var words = keywords[i].split(' ');
      var matched = true;
      var j;
      for (j = 0; j < words.length; j++) {
        var token = tokens[index + j];
        if (!token || token.toUpperCase() !== words[j]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        return keywords[i];
      }
    }
    return null;
  }

  /**
   * 判断关键字后面的列表是否有多项，只有多项才值得逐项换行
   */
  function hasListComma(tokens, index) {
    var depth = 0;
    var i;
    for (i = index; i < tokens.length; i++) {
      var token = tokens[i];
      if (token === '(') {
        depth++;
      } else if (token === ')') {
        if (depth === 0) {
          break;
        }
        depth--;
      } else if (token === ';') {
        break;
      } else if (token === ',' && depth === 0) {
        return true;
      } else if (depth === 0 && isSqlWord(token) &&
        (matchKeyword(tokens, i, SQL_MAIN_KEYWORDS) || matchKeyword(tokens, i, SQL_JOIN_KEYWORDS))) {
        break;
      }
    }
    return false;
  }

  /**
   * SQL 排版：主关键字顶格、条件与连接缩进、列表逐项换行、子查询独立成块
   * 字符串字面量与注释内的内容原样保留
   */
  function formatSql(sql, indentUnit) {
    var tokens = tokenizeSql(sql);
    var lines = [];
    var line = '';
    var depth = 0;
    // 当前逗号列表的缩进层级，-1 表示不在列表中
    var listLevel = -1;
    var frames = [];
    // BETWEEN a AND b 中的 AND 不能拆行
    var pendingBetween = false;
    // 负号等需要与下一个词紧贴
    var stickNext = false;
    // 最近一个主关键字，用于区分 INSERT INTO 表名后的列清单与函数调用
    var lastMain = '';
    var i = 0;

    function flush() {
      var text = line.replace(/\s+$/, '');
      if (text !== '') {
        lines.push(text);
      }
      line = '';
    }

    function newLine(level) {
      flush();
      line = repeatIndent(indentUnit, level);
    }

    function append(token, noSpace) {
      if (line.trim() === '') {
        line += token;
        return;
      }
      var last = line.charAt(line.length - 1);
      line += (noSpace || stickNext || last === '(' || last === '.') ? token : ' ' + token;
    }

    while (i < tokens.length) {
      var token = tokens[i];

      if (token === '(') {
        // 函数调用的左括号紧贴函数名，INSERT INTO 表名后的列清单仍留空格
        var previous = i > 0 ? tokens[i - 1] : '';
        var glue = isSqlWord(previous) && !SQL_SYNTAX_SET[previous.toUpperCase()] && lastMain !== 'INSERT INTO';
        append('(', glue);
        stickNext = false;
        frames.push({ listLevel: listLevel, block: false });
        depth++;
        // 子查询独立成块
        if (matchKeyword(tokens, i + 1, ['SELECT DISTINCT', 'SELECT'])) {
          frames[frames.length - 1].block = true;
          listLevel = -1;
          newLine(depth);
        }
        i++;
        continue;
      }

      if (token === ')') {
        var frame = frames.pop() || { listLevel: -1, block: false };
        depth = Math.max(depth - 1, 0);
        if (frame.block) {
          newLine(depth);
        }
        append(')', true);
        listLevel = frame.listLevel;
        stickNext = false;
        i++;
        continue;
      }

      if (token === ',') {
        append(',', true);
        stickNext = false;
        if (depth === 0 && listLevel >= 0) {
          newLine(listLevel);
        }
        i++;
        continue;
      }

      if (token === ';') {
        append(';', true);
        stickNext = false;
        i++;
        continue;
      }

      if (isSqlWord(token)) {
        var upper = token.toUpperCase();
        var main = matchKeyword(tokens, i, SQL_MAIN_KEYWORDS);
        var join = main ? null : matchKeyword(tokens, i, SQL_JOIN_KEYWORDS);
        var sub = (main || join) ? null : matchKeyword(tokens, i, SQL_SUB_KEYWORDS);

        // BETWEEN 的 AND 按普通词处理
        if (sub === 'AND' && pendingBetween) {
          pendingBetween = false;
          append(upper);
          stickNext = false;
          i++;
          continue;
        }
        if (upper === 'BETWEEN') {
          pendingBetween = true;
        }

        var phrase = main || join || sub;
        if (phrase) {
          newLine(sub ? depth + 1 : depth);
          append(phrase);
          stickNext = false;
          i += phrase.split(' ').length;
          if (main) {
            lastMain = main;
          }

          if (main && SQL_LIST_KEYWORDS.indexOf(main) >= 0) {
            listLevel = depth + 1;
            // FROM 后面第一项跟在关键字后，SELECT / SET 则整列另起
            if (main !== 'FROM' && hasListComma(tokens, i)) {
              newLine(listLevel);
            }
          } else if (main) {
            listLevel = -1;
          }
          continue;
        }

        // 其余关键字只统一大写，不换行
        append(SQL_KEYWORD_SET[upper] ? upper : token);
        stickNext = false;
        i++;
        continue;
      }

      // 紧跟在运算符、左括号或逗号后的负号与数字连写
      if (token === '-' && (line.trim() === '' || /[=(,<>+\-*/]$/.test(line.replace(/\s+$/, '')))) {
        append('-');
        stickNext = true;
        i++;
        continue;
      }

      append(token);
      stickNext = false;
      i++;
    }

    flush();
    return lines.join('\n');
  }

  /**
   * 解析日志文本，抽出每条语句的 Preparing / Parameters / 执行结果
   */
  function parseMybatisLog(text) {
    var lines = text.split(/\r?\n/);
    var statements = [];
    var current = null;
    var i;

    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) {
        continue;
      }

      var prepared = PREPARING_RE.exec(line);
      if (prepared) {
        var mapper = MAPPER_RE.exec(line);
        current = {
          mapper: mapper ? mapper[1] : '',
          sql: prepared[1].trim(),
          params: null,
          result: ''
        };
        statements.push(current);
        continue;
      }

      var parameters = PARAMETERS_RE.exec(line);
      if (parameters && current && current.params === null) {
        current.params = splitParameters(parameters[1]);
        continue;
      }

      var result = RESULT_RE.exec(line);
      if (result && current) {
        current.result = result[1] + ': ' + result[2];
        continue;
      }

      // 没有日志前缀的续行，认为是上一条 Preparing 的 SQL 换行
      if (current && current.params === null && !/Preparing:|Parameters:|<==/.test(line)) {
        current.sql += ' ' + line.trim();
      }
    }

    return statements;
  }

  /**
   * 主入口：日志 -> 最终 SQL
   */
  function mybatisToSql(text, options) {
    var statements = parseMybatisLog(text);
    if (!statements.length) {
      throw new Error('未识别到日志，请粘贴包含 "Preparing:" 的 MyBatis DEBUG 日志');
    }

    var blocks = [];
    var warnings = [];

    statements.forEach(function (item, index) {
      var params = item.params || [];
      var literals = params.map(toSqlLiteral);
      var applied = applyParameters(item.sql, literals);
      var sql = applied.sql;
      var no = index + 1;

      if (item.params === null) {
        warnings.push('第 ' + no + ' 条缺少 Parameters 行，占位符未替换');
      } else if (applied.placeholders !== literals.length) {
        warnings.push('第 ' + no + ' 条占位符 ' + applied.placeholders + ' 个、参数 ' + literals.length + ' 个，数量不一致');
      }

      // 默认排版，仅在明确关闭时输出单行 SQL
      if (options.prettySql !== false) {
        sql = formatSql(sql, options.indent);
      }

      var lines = [];
      if (options.withComment !== false) {
        var head = '-- [' + no + ']';
        if (item.mapper) {
          head += ' ' + item.mapper;
        }
        if (item.result) {
          head += '  (' + item.result + ')';
        }
        lines.push(head);
      }
      lines.push(sql.replace(/;\s*$/, '') + ';');
      blocks.push(lines.join('\n'));
    });

    var message = '✓ 已还原 ' + statements.length + ' 条 SQL';
    if (warnings.length) {
      message = '⚠ 已还原 ' + statements.length + ' 条，' + warnings.join('；');
    }

    return {
      text: blocks.join('\n\n'),
      message: message,
      type: warnings.length ? 'err' : 'ok'
    };
  }

  /**
   * SQL 语法高亮
   */
  function highlightSql(text) {
    var keywords = SQL_MAIN_KEYWORDS
      .concat(SQL_JOIN_KEYWORDS, SQL_SUB_KEYWORDS, SQL_OTHER_KEYWORDS, SQL_FUNCTIONS)
      .join('|')
      .replace(/ /g, '\\s+');
    var pattern = new RegExp(
      "(--[^\\n]*)|('(?:''|[^'])*')|\\b(" + keywords + ")\\b|\\b\\d+(?:\\.\\d+)?\\b",
      'gi'
    );
    return escapeHtml(text).replace(pattern, function (match, comment, literal, keyword) {
      if (comment) {
        return '<span class="tk-comment">' + comment + '</span>';
      }
      if (literal) {
        return '<span class="tk-str">' + literal + '</span>';
      }
      if (keyword) {
        return '<span class="tk-tag">' + match + '</span>';
      }
      return '<span class="tk-num">' + match + '</span>';
    });
  }

  /* ==================================================================
   * 面板控制
   * ================================================================== */

  function Panel(root, handlers) {
    this.root = root;
    this.handlers = handlers;
    this.input = root.querySelector('[data-role="input"]');
    this.output = root.querySelector('[data-role="output"]');
    this.status = root.querySelector('[data-role="status"]');
    this.inStat = root.querySelector('[data-role="inStat"]');
    this.outStat = root.querySelector('[data-role="outStat"]');
    this.indentSelect = root.querySelector('[data-role="indent"]');
    this.result = '';
    this.bind();
  }

  /**
   * 收集当前面板上的所有选项：缩进 + 全部复选框
   */
  Panel.prototype.options = function () {
    var options = {
      indent: indentOf(this.indentSelect ? this.indentSelect.value : '2')
    };
    this.root.querySelectorAll('input[type="checkbox"][data-role]').forEach(function (box) {
      options[box.getAttribute('data-role')] = box.checked;
    });
    return options;
  };

  Panel.prototype.bind = function () {
    var self = this;

    this.root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-action]');
      if (button) {
        self.run(button.getAttribute('data-action'));
      }
    });

    this.input.addEventListener('input', function () {
      self.inStat.textContent = statText(self.input.value);
    });

    // 支持把文件拖进输入框
    var pane = this.input.closest('.pane');
    ['dragenter', 'dragover'].forEach(function (type) {
      pane.addEventListener(type, function (event) {
        event.preventDefault();
        pane.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      pane.addEventListener(type, function () {
        pane.classList.remove('dragover');
      });
    });
    pane.addEventListener('drop', function (event) {
      event.preventDefault();
      var file = event.dataTransfer.files[0];
      if (!file) {
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        self.input.value = String(reader.result);
        self.inStat.textContent = statText(self.input.value);
        self.run('format');
      };
      reader.readAsText(file);
    });

    // Ctrl / Cmd + Enter 触发格式化
    this.input.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        self.run('format');
      }
    });
  };

  Panel.prototype.setStatus = function (message, type) {
    this.status.textContent = message;
    this.status.className = 'status' + (type ? ' ' + type : '');
  };

  Panel.prototype.setResult = function (text, html) {
    this.result = text;
    this.output.innerHTML = html;
    this.outStat.textContent = statText(text);
  };

  Panel.prototype.run = function (action) {
    var raw = this.input.value.trim();

    if (action === 'clear') {
      this.input.value = '';
      this.inStat.textContent = statText('');
      this.setResult('', '');
      this.setStatus('');
      return;
    }

    if (action === 'sample') {
      this.input.value = this.handlers.sample;
      this.inStat.textContent = statText(this.input.value);
      this.run('format');
      return;
    }

    if (action === 'copy') {
      if (!this.result) {
        this.setStatus('没有可复制的结果', 'err');
        return;
      }
      copyText(this.result, function (ok) {
        toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择复制');
      });
      return;
    }

    if (!raw) {
      this.setResult('', '');
      this.setStatus('请先输入内容', 'err');
      return;
    }

    try {
      var options = this.options();

      if (action === 'validate') {
        this.handlers.validate(raw);
        this.setStatus('✓ 语法正确', 'ok');
        return;
      }

      // 处理函数可以返回字符串，也可以返回 { text, message, type } 以自定义状态提示
      var result = action === 'minify'
        ? this.handlers.minify(raw, options)
        : this.handlers.format(raw, options);
      var isPlain = typeof result === 'string';
      var text = isPlain ? result : result.text;
      var fallback = action === 'minify' ? '✓ 压缩完成' : '✓ 格式化完成';

      this.setResult(text, this.handlers.highlight(text));
      this.setStatus(isPlain ? fallback : (result.message || fallback), isPlain ? 'ok' : (result.type || 'ok'));
    } catch (e) {
      this.setResult('', '');
      this.setStatus('✗ ' + e.message, 'err');
    }
  };

  /* ==================================================================
   * 剪贴板与提示
   * ================================================================== */

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

  /* ==================================================================
   * 初始化
   * ================================================================== */

  var HANDLERS = {
    json: {
      sample: SAMPLES.json,
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
    },
    xml: {
      sample: SAMPLES.xml,
      format: function (text, options) {
        return formatXml(text, options.indent);
      },
      minify: function (text) {
        return minifyXml(text);
      },
      validate: validateXml,
      highlight: highlightXml
    },
    mybatis: {
      sample: SAMPLES.mybatis,
      format: mybatisToSql,
      minify: mybatisToSql,
      validate: parseMybatisLog,
      highlight: highlightSql
    }
  };

  var panels = {};

  /**
   * 渲染左侧菜单
   */
  function renderNav() {
    var nav = document.getElementById('nav');
    nav.innerHTML = TOOLS.map(function (tool) {
      return '<a class="nav-item" href="#' + tool.id + '" data-id="' + tool.id + '">' +
        '<span class="nav-icon">' + escapeHtml(tool.icon) + '</span>' +
        '<span>' + tool.name + '</span></a>';
    }).join('');
  }

  /**
   * 根据 hash 切换工具
   */
  function activate(id) {
    var tool = TOOLS.filter(function (item) {
      return item.id === id;
    })[0] || TOOLS[0];

    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('active', item.getAttribute('data-id') === tool.id);
    });
    document.querySelectorAll('.panel').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-tool') !== tool.id;
    });

    document.getElementById('mainTitle').textContent = tool.name;
    document.getElementById('mainDesc').textContent = tool.desc;
    document.title = tool.name + ' - 开发者工具箱';
  }

  /**
   * 主题切换，选择保存在 localStorage
   */
  function initTheme() {
    var btn = document.getElementById('themeBtn');
    var icon = document.getElementById('themeIcon');
    var label = document.getElementById('themeText');

    function apply(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      icon.textContent = theme === 'dark' ? '☀' : '🌙';
      label.textContent = theme === 'dark' ? '浅色模式' : '深色模式';
    }

    var saved = 'light';
    try {
      saved = localStorage.getItem('toolkit-theme') || 'light';
    } catch (e) {
      saved = 'light';
    }
    apply(saved);

    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem('toolkit-theme', next);
      } catch (e) {
        // 隐私模式下写入失败可忽略
      }
    });
  }

  function init() {
    renderNav();
    initTheme();

    document.querySelectorAll('.panel').forEach(function (root) {
      var id = root.getAttribute('data-tool');
      panels[id] = new Panel(root, HANDLERS[id]);
    });

    activate((location.hash || '').slice(1));
    window.addEventListener('hashchange', function () {
      activate(location.hash.slice(1));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
