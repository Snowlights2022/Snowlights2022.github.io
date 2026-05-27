# 3D 模型目录

将你的 `.step` / `.stp` 文件放置在此处。

## 使用方法

在你的 Markdown 文章中，使用以下代码嵌入 STEP 模型：

```html
<div class="step-viewer-container"
     data-src="/assets/models/your-model.step">
  <div class="step-canvas-wrapper">
    <div class="step-loading">Loading 3D model...</div>
  </div>
  <div class="step-controls">
    <button class="step-btn-reset">🔄 Reset View</button>
    <button class="step-btn-autorotate">🔄 Auto Rotate</button>
    <button class="step-btn-wireframe">🔲 Wireframe</button>
    <span class="step-info"></span>
  </div>
</div>
```

将 `your-model.step` 替换为实际的文件名。
