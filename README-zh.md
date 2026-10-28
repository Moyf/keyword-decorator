# Keyword Decorator

[![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=Downloads&query=%24%5B%22keyword-decorator%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=keyword-decorator) [![Release](https://img.shields.io/github/v/release/Moyf/keyword-decorator?label=Release)](https://github.com/Moyf/keyword-decorator/releases) [![GitHub Issues](https://img.shields.io/github/issues/Moyf/keyword-decorator?label=Issues)](https://github.com/Moyf/keyword-decorator/issues) [![Stars](https://img.shields.io/github/stars/Moyf/keyword-decorator?logo=github&label=Stars)](https://github.com/Moyf/keyword-decorator/stargazers)

[English](README.md) | 中文

在 Obsidian 的编辑器和阅读视图中为关键词添加视觉标记。规则可以应用文字样式、Emoji、Lucide 图标、库内图片或粘贴的 SVG，而不改动笔记原文。

![](assets/demo-decorations.png)

## 使用

打开 **设置 → Keyword Decorator** 新建规则，选择**关键词（每行一个）**或**正则表达式**，再挑选外观。一行匹配一个关键词，多行共享同一外观。修改自动保存，预览随输入实时更新。

## 亮点

### 为大量规则而生的工作台

![](assets/demo-workbench.png)

规则工作台为拥有几十条规则的库而设计：

- **分组**：整理规则、折叠展开、整组启停。共享组样式由组内规则继承，规则单独设置的字段优先，↶ 可恢复继承。
- **快速排序**：拖动单条规则、多选集合或整个分组；也支持「上移／下移」按钮和 `Alt + ↑ / ↓`。越靠前的规则优先处理重叠匹配。
- **多选**：Ctrl/Cmd 点击切换选择，Shift 点击选择可见范围，然后整批拖动——支持跨分组，并保留原有相对顺序。
- **批量添加**：粘贴关键词行、表格列或 JSON 规则数组，预览后逐条生成可独立编辑的规则。
- **导入导出**：完整保留规则顺序、分组与开关；分组导出可单独添加一个分组并自动处理 ID 冲突。
- 自动保存、筛选、复制、删除撤销，以及双栏独立滚动的响应式布局都是内置能力。

### 文字样式之外的装饰

- **Emoji 短码**：内置分组把 `:smile:` 转为 😄，共 1,914 个离线别名，由捆绑词典驱动。未知短码保持原样；开启**隐藏匹配文字**后只显示 Emoji，光标移入匹配即可编辑原短码。
- **Lucide 图标**：关键字筛选、图标预览与名称提示；默认继承规则文字颜色，可关闭。
- **库内图片与 SVG**：按名称或路径搜索库内图片（带缩略图）、直接粘贴完整 SVG，或使用图片直链；宽高、圆角与隐藏文字均可配置，尺寸支持 px 与 em（不写单位按 px），宽高一致且圆角为尺寸的一半即可呈现圆形。加载失败时恢复显示原文。

### 整行样式与仅首次装饰

开启「把样式附加到整行」后，会为匹配所在的整个逻辑行上色（自动换行仍算同一行）。旁边的「整篇笔记内仅生效一次」可让高频出现的角色名等关键词只在第一次出现时添加装饰。正则的 `^`／`$` 锚点在编辑与阅读视图中均按逻辑行一致匹配。

### 精确的边界

装饰只作用于实时预览和阅读视图的 Markdown 笔记正文；源码模式默认显示原文，可单独开启。链接（显示文本、网址、别名、裸链接）、代码、公式、属性、标签、嵌入及格式标记始终跳过；标题、列表、引用、Callout 正文和表格仍可装饰。自定义 CSS 限定在正文范围内，`&` 定位当前规则的匹配：

```css
& {
  border-bottom: 2px dashed currentColor;
  border-radius: 4px;
  padding: 0 4px;
}
```

## 功能详情

### 装饰范围

装饰仅影响实时预览和阅读视图的 Markdown 笔记正文。源码模式默认显示原文，可通过「对源码视图添加装饰」单独开启，并沿用实时预览的内容排除规则。Quick Switcher、建议列表、悬浮预览和设置等界面不受影响。

链接的显示文本、网址、双链别名、引用和裸网址均不装饰；代码、公式、属性、标签、嵌入及格式标记也会跳过。标题、列表、引用、Callout 正文和表格仍可装饰，整行样式同样避开受保护内容。

自定义 CSS 仅限正文范围和已启用的装饰编辑器，忽略 `@import`、`@font-face`、`@keyframes` 等全局指令。

### 规则工作台

打开 **设置 → Keyword Decorator** 管理规则：

- 总开关暂停全部装饰，单规则开关暂停单条规则。
- 拖动手柄调整优先级，也可聚焦手柄后按 `Alt + ↑ / ↓`，或使用编辑区箭头按钮。Esc 可取消拖动。新建规则后直接聚焦「关键词」输入框。
- Ctrl/Cmd 点击切换选择，Shift 点击选择可见的连续范围，Ctrl/Cmd + Shift 点击追加范围。拖动任一已选规则的手柄可整批移动，支持跨分组并保留原有相对顺序。
- 复制规则可复用其外观；删除规则会提供短期撤销。
- 按名称或关键词筛选规则；列表与编辑区等宽且独立滚动。可收起编辑区只浏览规则，再次选中即恢复。内容宽度不超过 620 CSS px 时改为单列导航，按住修饰键选择时保留列表。

### 分组与外观

使用文件夹加号按钮创建分组。双击组名折叠／展开，单击组名编辑且不移动列表位置。可整组启停、跨组拖动规则、拖动整组排序；分组编辑区提供「上移／下移」按钮，首尾位置自动禁用不可用方向。规则编辑区可切换所属分组。未分组规则优先，其后按分组及组内顺序匹配。

分组编辑区的「导出分组」仅导出该组的规则、顺序、共享样式和开关；「新建分组」旁的「导入分组」会追加新组，重复导入也生成独立分组并重新关联规则，保留现有内容和总开关，支持空分组。

点击组名配置共享样式：规则未设置的字段继承分组，明确关闭或清空的字段优先使用自身配置，↶ 恢复继承，也可在规则编辑区重置全部外观字段。禁用分组不会覆盖每条规则自己的开关。完整导出保留分组、分组顺序和外观。

Lucide 图标支持关键字筛选、预览与名称，默认继承文字颜色，可关闭。各装饰类型分别记忆内容；背景可选包含前缀。

### Emoji 短码

默认的 **Emoji shortcodes** 分组在编辑器和阅读视图中把 `:smile:` 显示为 😄、`:heart:` 显示为 ❤️、`:happy:` 显示为 😄。它由单条规则驱动，通过捆绑的本地词典识别 1,914 个别名：无需图片、额外运行时依赖或网络连接，外观跟随系统 Emoji 字体，未知短码保留原样，不含 Discord 服务器自定义表情及动图。

这是一个特殊内置分组，在列表中标记「内置」。点击组名即可控制「启用转换」和「隐藏匹配文字」，没有普通规则列表或匹配方式选择器；普通规则只有关键词和正则两项。分组在现有规则之后添加一次，保留其优先级；已有预设会被识别，并保留原有外观及关闭状态。

「隐藏匹配文字」默认开启：光标移入匹配即可编辑原短码，关闭开关则同时显示 Emoji 与短码。笔记始终保留原始 Markdown。内置分组仍可调整排序以改变优先级；新建的普通规则会放在内置组之外。

别名数据来自 [gemoji](https://github.com/github/gemoji)，并额外添加了 `happy` 别名。固定来源与许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

### 图片与 SVG

选择「库内图片」可按名称或完整路径搜索并显示缩略图；选择器保存完整库内路径，不同文件夹中的同名文件不会混淆。也可以手动输入库内路径或 wikilink。

选择「SVG 代码」粘贴完整的 `<svg>…</svg>` 元素，展示前会移除活动内容和外部引用。宽高与圆角支持 px 与 em 配置，图片在框内保持比例。

选择「图片 URL」可粘贴 HTTP／HTTPS 图片直链，含带查询参数的链接。网络图片与库内图片共享尺寸和隐藏文字控制。预览直接从图片所在主机加载，不发送 referrer；链接无效或加载失败时保留原文可读。

普通规则的「隐藏匹配文字」默认关闭。对 Emoji、图片和 SVG 装饰开启后只保留装饰本身，编辑时光标进入匹配范围会恢复原文显示，底层 Markdown 不变。

插件完全本地运行。以 `https://` 或 `http://` 开头的图片 URL 在显示时会连接对应主机；使用库内图片或粘贴 SVG 可避免这些网络请求。无需账号，无遥测，无付费服务。

### 批量添加

使用列表的「批量添加」按钮，每行生成一条独立规则：

```text
Obsidian
Review
Important
```

粘贴表格的制表符分隔列，可为每条规则指定名称、关键词和可选的库内图片：

```tsv
名称	关键词	图片路径（可选）
```

第一行也是数据，无需表头。也接受 JSON 规则数组或此前导出的规则包。添加前会预览规则数量并提示错误，可选择继承所选规则的外观。

「关键词」规则中的多行共享同一外观；「批量添加」生成的是可单独编辑的独立规则。新关键词模式中逗号按文字匹配；旧规则的逗号分隔含义保留，编辑时会显示为多行。

### 导入导出

导出会复制或下载包含规则、优先级和总开关状态的 JSON 包；包含规则 ID 映射的旧版导出也能识别。导入自动校验粘贴的 JSON 或所选文件，默认追加新内容，也可明确选择更新相同 ID 或替换全部，仅在需要清空时显示确认；编辑时摘要和底部操作保持可见。

### 性能

编辑器匹配仅限可见内容；规则变化时重新编译匹配器，保存防抖并串行化；图片解析有缓存，禁用的规则跳过匹配。请避免复杂正则——JavaScript 无法在 UI 线程上安全中断病态表达式。校验细节与开发命令见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 安装

插件上架后可直接从 [Obsidian 插件市场](https://obsidian.md/plugins?id=keyword-decorator)安装。

也可以通过 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 安装，使用链接：`https://github.com/Moyf/keyword-decorator`。

## 致谢

- 基于 [NothingIsLost](https://github.com/nothingislost) 的 [Dynamic Highlights](https://github.com/nothingislost/obsidian-dynamic-highlights) ❤️ —— Keyword Decorator 是对该项目的全新重构与扩展
- Emoji 别名数据来自 GitHub 的 [gemoji](https://github.com/github/gemoji)，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)

## 来自 Moy 的更多插件

如果你欣赏我的插件设计和质量，可以看看我的其他 Obsidian 插件：

| 插件名称 | 简介 | 数据 |
| --- | --- | --- |
| [Yearly Glance](https://github.com/Moyf/yearly-glance) | 年度一览，一眼纵览你全年的关键事件。 | [![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=downloads&query=%24%5B%22yearly-glance%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=yearly-glance) [![GitHub Stars](https://img.shields.io/github/stars/Moyf/yearly-glance?logo=github&label=Stars)](https://github.com/Moyf/yearly-glance/stargazers) |
| [Easy Copy](https://github.com/Moyf/easy-copy) | 轻松复制格式文本，或快速生成优雅的链接。 | [![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=downloads&query=%24%5B%22easy-copy%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=easy-copy) [![GitHub Stars](https://img.shields.io/github/stars/Moyf/easy-copy?logo=github&label=Stars)](https://github.com/Moyf/easy-copy/stargazers) |
| [Better Links](https://github.com/Moyf/better-links) | 悬浮式弹窗，提升你的链接编辑体验。 | [![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=downloads&query=%24%5B%22better-links%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=better-links) [![GitHub Stars](https://img.shields.io/github/stars/Moyf/better-links?logo=github&label=Stars)](https://github.com/Moyf/better-links/stargazers) |
| [Style Context](https://github.com/Moyf/style-context) | 将你的 Obsidian 背景设成任意库内图片。 | [![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=downloads&query=%24%5B%22style-context%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=style-context) [![GitHub Stars](https://img.shields.io/github/stars/Moyf/style-context?logo=github&label=Stars)](https://github.com/Moyf/style-context/stargazers) |
| [Colorful Highlights](https://github.com/Moyf/colorful-highlights) | 彩色高亮效果增强，提供多种样式，或自定义新配色。 | [![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=downloads&query=%24%5B%22colorful-highlights%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=colorful-highlights) [![GitHub Stars](https://img.shields.io/github/stars/Moyf/colorful-highlights?logo=github&label=Stars)](https://github.com/Moyf/colorful-highlights/stargazers) |
| [Single Choice Property](https://github.com/Moyf/single-choice-property) | 让选定的列表属性始终只保留一个值。 | [![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=downloads&query=%24%5B%22single-choice-property%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=single-choice-property) [![GitHub Stars](https://img.shields.io/github/stars/Moyf/single-choice-property?logo=github&label=Stars)](https://github.com/Moyf/single-choice-property/stargazers) |

> 全部插件见 [Moy 的 Obsidian Community 页面](https://community.obsidian.md/users/moyf)。

参与开发的友情插件：[Note Toolbar](https://github.com/chrisgurney/obsidian-note-toolbar) & [Typify](https://github.com/leike-dev/Obsidian-Typify) ❤️

## 支持

如果觉得 Keyword Decorator 好用，欢迎[请我喝杯咖啡（Ko-fi）](https://ko-fi.com/moy) ☕

## 开发

```sh
pnpm install
```

将 `.env.example` 复制为 `.env`，并把 `VAULT_PATH` 指向一个包含 `.obsidian` 的 Obsidian 库。复制脚本优先读取进程环境变量，其次查找仓库及父目录中的 `.env`；相对路径按命中的 `.env` 所在目录解析。

```sh
pnpm run test
pnpm run lint
pnpm run build:local
```

构建产物在 `dist/`。本地构建只复制插件资产，不会覆盖库中的 `data.json`。重新加载插件后打开设置即可；Hot Reload 生效时可用 `pnpm run build:local:set` 一键构建并打开设置页。

## 许可

MIT。基于 NothingIsLost 的原始作品。
