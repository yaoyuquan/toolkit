/**
 * 开发者工具箱入口
 * 负责菜单渲染、hash 路由、主题切换与面板初始化
 * 工具本身在 js/tools/ 下各自注册，这里不关心具体实现
 */
(function (Toolkit) {
  'use strict';

  var escapeHtml = Toolkit.util.escapeHtml;

  var panels = {};

  /**
   * 渲染左侧菜单
   */
  function renderNav() {
    var nav = document.getElementById('nav');
    nav.innerHTML = Toolkit.tools.map(function (tool) {
      return '<a class="nav-item" href="#' + tool.id + '" data-id="' + tool.id + '">' +
        '<span class="nav-icon">' + escapeHtml(tool.icon) + '</span>' +
        '<span>' + tool.name + '</span></a>';
    }).join('');
  }

  /**
   * 根据 hash 切换工具
   */
  function activate(id) {
    var tool = Toolkit.tools.filter(function (item) {
      return item.id === id;
    })[0] || Toolkit.tools[0];

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
      var tool = Toolkit.get(id);
      if (tool) {
        panels[id] = new Toolkit.Panel(root, tool);
      }
    });

    activate((location.hash || '').slice(1));
    window.addEventListener('hashchange', function () {
      activate(location.hash.slice(1));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.Toolkit);
