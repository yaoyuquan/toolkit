/**
 * 全局命名空间与工具注册表
 * 每个工具文件通过 Toolkit.register 把自己登记进来，菜单与路由据此生成
 */
window.Toolkit = (function () {
  'use strict';

  var tools = [];

  return {
    // 公共工具函数，由 util.js 填充
    util: {},

    // 面板构造函数，由 panel.js 填充
    Panel: null,

    // 已注册的工具，顺序即菜单顺序
    tools: tools,

    /**
     * 注册一个工具
     * 必填 id / name / icon / desc，以及 format 与 highlight 两个处理函数
     */
    register: function (tool) {
      tools.push(tool);
      return tool;
    },

    /**
     * 按 id 取工具，取不到返回 null
     */
    get: function (id) {
      var i;
      for (i = 0; i < tools.length; i++) {
        if (tools[i].id === id) {
          return tools[i];
        }
      }
      return null;
    }
  };
})();
