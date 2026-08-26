# 开发者工具箱

纯静态的前端小工具集合，左侧导航 + 右侧工作区，无任何依赖，双击 `index.html` 即可使用。

## 目录结构

```
index.html      页面结构（每个工具一个 section.panel）
css/style.css   样式与主题变量
js/app.js       菜单渲染、hash 路由、各工具逻辑
```

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

1. `js/app.js` 的 `TOOLS` 数组中追加一项：`{ id: 'base64', name: 'Base64', icon: '64', desc: '...' }`
2. `index.html` 中复制一份 `<section class="panel" data-tool="base64" hidden>`，改掉 `data-tool`
3. `js/app.js` 的 `HANDLERS` 中补上同名 key，实现 `format` / `minify` / `validate` / `highlight` 与 `sample`

菜单和路由会自动生效，无需改动其它代码。
