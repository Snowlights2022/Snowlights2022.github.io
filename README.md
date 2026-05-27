# Snowlights2022.github.io

个人 GitHub Pages 博客，基于 Jekyll + Minima 主题构建。

## 功能特性

- **LaTeX 数学公式渲染** — 基于 [KaTeX](https://katex.org/)，支持行内 (`$...$`) 和独立块 (`$$...$$`) 数学公式
- **STEP 3D 模型查看器** — 基于 [Three.js](https://threejs.org/) + [occt-import-js](https://github.com/nicolo-ribaudo/occt-import-js)，支持 `.step`/`.stp` CAD 模型的交互式渲染和轨道控制

### 使用数学公式

行内公式：`$E = mc^2$` → $E = mc^2$

独立块公式：
```
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

### 嵌入 STEP 模型

将你的 `.step` 文件放置在 `docs/assets/models/` 目录中，然后在文章中添加：

```html
<div class="step-viewer-container" data-src="/assets/models/your-model.step">
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

交互控制：拖动旋转、滚轮缩放、右键平移。