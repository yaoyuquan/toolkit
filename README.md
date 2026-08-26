# 开发者工具箱

纯静态的前端小工具集合，左侧导航 + 右侧工作区，无任何依赖，双击 `index.html` 即可使用。

## 目录结构

```
index.html            页面结构（每个工具一个 section.panel）
css/style.css         样式与主题变量
js/toolkit.js         全局命名空间与工具注册表
js/util.js            公共函数：文本处理、剪贴板、轻提示
js/panel.js           面板控制：按钮响应、输入输出、状态提示
js/app.js             入口：菜单渲染、hash 路由、主题切换
js/tools/json.js      JSON 格式化
js/tools/xml.js       XML 格式化
js/tools/mybatis.js   MyBatis 日志还原 SQL
```

脚本用普通 `<script>` 按序加载，没有用 ES module —— `file://` 下 module 会被 CORS 拦掉，双击就打不开了。文件之间通过全局的 `Toolkit` 对象通信：`js/util.js` 往 `Toolkit.util` 挂公共函数，`js/panel.js` 挂 `Toolkit.Panel`，每个工具调 `Toolkit.register()` 把自己登记进去，`js/app.js` 只认注册表、不认识任何具体工具。

## 已有工具

| 菜单        | hash       | 功能                                             |
| ----------- | ---------- | ------------------------------------------------ |
| JSON 格式化 | `#json`    | 格式化 / 压缩 / 校验，可选键名排序               |
| XML 格式化  | `#xml`     | 格式化 / 压缩 / 校验，保留注释与 CDATA           |
| MyBatis SQL | `#mybatis` | 把 `Preparing` / `Parameters` 日志还原成最终 SQL |

### MyBatis SQL 说明

把 MyBatis 的 DEBUG 日志整段粘进去即可，支持一次贴多条语句：

- 按参数类型决定是否加引号，`Integer`/`Long`/`BigDecimal` 等数值类型不加引号，其余按字符串处理，`null` 输出 `NULL`
- 参数值里带 `, ` 的情况（如 `张三, 李四(String)`）能正确切分，不会错位
- SQL 里原有引号中的 `?` 不会被当成占位符替换，值里的单引号自动转义成 `''`
- 占位符与参数数量对不上时状态栏给出告警，未替换的 `?` 原样保留
- 默认对结果做 SQL 排版（可在工具条关闭，关闭后输出单行）：
  - 主关键字顶格，`AND` / `OR` / `ON` 缩进一级，`SELECT`、`SET` 的多项列表逐项换行
  - 子查询在括号内独立成块并整体缩进
  - 关键字统一大写，函数名与左括号紧贴（`COUNT(*)`），`IN (...)` / `VALUES (...)` 保留空格
  - `BETWEEN a AND b` 的 `AND` 不拆行；字符串字面量与注释内的内容原样保留

通用能力：缩进可选（2 空格 / 4 空格 / Tab）、语法高亮、一键复制、拖拽文件到输入框、`Ctrl + Enter` 快捷格式化、深浅色主题切换（记忆在 localStorage）。

## 新增一个工具

1. 新建 `js/tools/base64.js`，照着现有工具的骨架写：

```js
(function (Toolkit) {
  'use strict';

  var escapeHtml = Toolkit.util.escapeHtml;

  // 具体实现……

  Toolkit.register({
    id: 'base64',
    name: 'Base64',
    icon: '64',
    desc: '编码与解码 Base64',
    sample: SAMPLE,
    format: function (text, options) { /* 返回字符串，或 { text, message, type } */ },
    minify: function (text, options) { },
    validate: function (text) { },
    highlight: function (text) { return escapeHtml(text); }
  });
})(window.Toolkit);
```

2. `index.html` 中复制一份 `<section class="panel" data-tool="base64" hidden>`，改掉 `data-tool`，按需调整工具条按钮
3. `index.html` 底部在 `js/app.js` 之前加一行 `<script src="js/tools/base64.js"></script>`

菜单顺序就是脚本加载顺序，路由和面板绑定都会自动生效。工具条上的按钮通过 `data-action` 触发（`format` / `minify` / `validate` / `sample` / `clear` / `copy`），复选框的 `data-role` 会自动收进 `options` 传给处理函数。
