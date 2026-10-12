/**
 * 分隔条：在每个 .editor 的两个面板之间插入可左右拖动的分隔条
 * 比例对所有工具共用，保存在 localStorage，双击分隔条恢复 1:1
 */
(function (Toolkit) {
  'use strict';

  var STORAGE_KEY = 'toolkit-split';
  var MIN = 15;
  var MAX = 85;
  var STEP = 2;

  var ratio = 50;

  function clamp(value) {
    return Math.min(MAX, Math.max(MIN, value));
  }

  /**
   * 比例写入根节点的 CSS 变量，所有工具的编辑区同步生效
   */
  function apply(value) {
    ratio = clamp(value);
    var style = document.documentElement.style;
    style.setProperty('--split-l', ratio + 'fr');
    style.setProperty('--split-r', (100 - ratio) + 'fr');
    document.querySelectorAll('.splitter').forEach(function (bar) {
      bar.setAttribute('aria-valuenow', String(Math.round(ratio)));
    });
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, String(ratio));
    } catch (e) {
      // 隐私模式下写入失败可忽略
    }
  }

  function load() {
    try {
      var saved = parseFloat(localStorage.getItem(STORAGE_KEY));
      if (!isNaN(saved)) {
        apply(saved);
      }
    } catch (e) {
      // 读取失败则使用默认比例
    }
  }

  function bind(editor) {
    var panes = editor.querySelectorAll(':scope > .pane');
    if (panes.length !== 2) {
      return;
    }

    var bar = document.createElement('div');
    bar.className = 'splitter';
    bar.setAttribute('role', 'separator');
    bar.setAttribute('aria-orientation', 'vertical');
    bar.setAttribute('aria-valuemin', String(MIN));
    bar.setAttribute('aria-valuemax', String(MAX));
    bar.setAttribute('aria-valuenow', String(Math.round(ratio)));
    bar.setAttribute('tabindex', '0');
    bar.title = '左右拖动调整宽度，双击恢复';
    editor.insertBefore(bar, panes[1]);

    bar.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      bar.setPointerCapture(event.pointerId);
      bar.classList.add('dragging');
      document.body.classList.add('resizing');
    });

    bar.addEventListener('pointermove', function (event) {
      if (!bar.hasPointerCapture(event.pointerId)) {
        return;
      }
      var rect = editor.getBoundingClientRect();
      apply((event.clientX - rect.left) / rect.width * 100);
    });

    function stop(event) {
      if (!bar.hasPointerCapture(event.pointerId)) {
        return;
      }
      bar.releasePointerCapture(event.pointerId);
      bar.classList.remove('dragging');
      document.body.classList.remove('resizing');
      save();
    }
    bar.addEventListener('pointerup', stop);
    bar.addEventListener('pointercancel', stop);

    bar.addEventListener('dblclick', function () {
      apply(50);
      save();
    });

    bar.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        apply(ratio - STEP);
      } else if (event.key === 'ArrowRight') {
        apply(ratio + STEP);
      } else {
        return;
      }
      event.preventDefault();
      save();
    });
  }

  Toolkit.initSplitter = function () {
    load();
    document.querySelectorAll('.editor').forEach(bind);
  };
})(window.Toolkit);
