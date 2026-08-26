/**
 * MyBatis 日志还原 SQL
 */
(function (Toolkit) {
  'use strict';

  var escapeHtml = Toolkit.util.escapeHtml;
  var repeatIndent = Toolkit.util.repeatIndent;

  var SAMPLE = [
    "2026-08-26 11:09:52.659 DEBUG 215200 --- [  container-339] c.u.s.c.dao.CommonDao.getCodeNameValue   : ==>  Preparing: SELECT SC.VALUE code,SC.NAME name FROM S_CODE SC WHERE SC.CODE_TYPE = ? AND SC.ISACTIVE = '0' AND SC.CODE_STATUS = '1' ",
    "2026-08-26 11:09:52.659 DEBUG 215200 --- [  container-339] c.u.s.c.dao.CommonDao.getCodeNameValue   : ==> Parameters: channelType(String)",
    "2026-08-26 11:09:52.660 DEBUG 215200 --- [  container-339] c.u.s.c.dao.CommonDao.getCodeNameValue   : <==      Total: 6",
    "2026-08-26 11:09:53.101 DEBUG 215200 --- [  container-339] c.u.s.c.dao.OrderDao.insertOrder         : ==>  Preparing: INSERT INTO T_ORDER (ID, USER_NAME, AMOUNT, REMARK, CREATE_TIME) VALUES (?, ?, ?, ?, ?)",
    "2026-08-26 11:09:53.102 DEBUG 215200 --- [  container-339] c.u.s.c.dao.OrderDao.insertOrder         : ==> Parameters: 1001(Long), 张三, 李四(String), 128.50(BigDecimal), null, 2026-08-26 11:09:53.0(Timestamp)",
    "2026-08-26 11:09:53.104 DEBUG 215200 --- [  container-339] c.u.s.c.dao.OrderDao.insertOrder         : <==    Updates: 1"
  ].join('\n');

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

  Toolkit.register({
    id: 'mybatis',
    name: 'MyBatis SQL',
    icon: 'SQL',
    desc: '把 MyBatis 日志还原成可直接执行的 SQL',
    sample: SAMPLE,
    format: mybatisToSql,
    minify: mybatisToSql,
    validate: parseMybatisLog,
    highlight: highlightSql
  });
})(window.Toolkit);
