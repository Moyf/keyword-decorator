# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 🐛 Fixed

- **Decoration scope**: Restrict keyword decorations and custom rule CSS to Markdown note bodies, excluding Quick Switcher, suggestions and other rendered UI. Skip link text and destinations, code, math, properties, tags, embeds and formatting syntax in the editor.
- **Editing updates**: Map existing decorations through document changes while debounced matching runs, and refresh when the syntax tree or editor mode changes.

### 🚀 Added

- **Source mode toggle**: Add an opt-in setting for source-mode decorations, disabled by default for new and existing configurations.

<details>
<summary>中文说明（点击展开）</summary>

### 🐛 修复

- **装饰范围**：将关键词装饰和规则自定义 CSS 限定在 Markdown 笔记正文，排除 Quick Switcher、建议列表等界面。编辑器内跳过链接显示文本与网址、代码、公式、属性、标签、嵌入和格式标记。
- **编辑更新**：延迟匹配期间随文档变化映射现有装饰，并在语法树或编辑模式变化时刷新，避免删除文本后装饰位置失效。

### 🚀 新增

- **源码视图开关**：增加「对源码视图添加装饰」，新配置和现有配置均默认关闭。

</details>
