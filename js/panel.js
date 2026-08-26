/**
 * 面板控制：按钮响应、输入输出、状态提示
 * 每个 section.panel 对应一个实例，处理逻辑由注册的工具提供
 */
(function (Toolkit) {
  'use strict';

  var indentOf = Toolkit.util.indentOf;
  var statText = Toolkit.util.statText;
  var copyText = Toolkit.util.copyText;
  var toast = Toolkit.util.toast;

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

  Toolkit.Panel = Panel;
})(window.Toolkit);
