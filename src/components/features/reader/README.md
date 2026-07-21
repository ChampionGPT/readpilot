<!-- input: 阅读视图状态、章节页面、标注运行时消息与用户导航操作 -->
<!-- output: 轻量阅读器头部、章节时间线、正文 iframe、右侧工具 rail 与共享辅助面板 -->
<!-- pos: 组件层 — 三栏布局中央区域的沉浸式阅读功能 -->

# Reader components

阅读页切章使用带 generation 的 front/back iframe 槽位：新页加载期间旧页保持完整可见，仅显示不遮挡正文的小型进度指示；新页 load 后先以透明状态加入，下一动画帧再让新页淡入、旧页淡出，旧页在 `transitionend` 后卸载（170ms timer 仅作兜底）。快速 A→B→C 时，过期 load、动画帧和 timer 均不能抢占当前页，卸载会清理调度。目录、标注、排版的外壳始终挂载，通过宽度、透明度和位移过渡开合；关闭时使用 `inert` 与 `aria-hidden` 隔离焦点和辅助技术，并保留最后面板内容至 200ms 退出完成后再卸载。所有导航入口同步关闭面板。标注抽屉按书与页面重新挂载，只接受同源、当前活动 iframe、当前 `pageId` 的运行时消息；GET 使用 AbortController 与 generation 保证 latest-request-wins，失败显示可重试错误，首次请求完成前展示骨架屏，不提前闪现空态。

`ReaderApp` 负责 Hub/章节阅读模式、iframe 生命周期，以及唯一的 `activePanel`（目录、标注、排版）状态。
`EpubReaderHeader` 只保留返回、章节身份与上下章导航；`ReadingUtilityRail` 以正文版心旁的悬浮圆形按钮列
提供 Lucide 图标和文字 tooltip，并让目录、受控的 `AnnotationDrawer` 和排版复用同一个辅助面板槽位；相关解读
与伴读页“回到原文”作为目录抽屉内的次级导航分区，不额外占用 rail 入口。
目录面板包含章节搜索、书籍身份和当前章高亮。Reader 内容根使用 container query：只有中央阅读容器足以同时容纳
正文最小宽度和约 464px 抽屉时才占位重排，否则使用 overlay。层级固定为 iframe、加载遮罩、抽屉、rail；rail
始终可见。左右方向键用于切章，输入控件或可编辑内容聚焦时不触发；Escape 优先关闭辅助面板。标注删除只有在
API 成功后才更新列表，失败会显示可见错误。`ChapterTimeline` 继续负责 Hub 的章节进度与导航。

章节 HTML 会加载 `public/annotator/annotator.js`。新建选区时，运行时必须在工具栏动作完成前
保留克隆的 `Range`；清理旧工具栏、二级面板和想法编辑器不得释放该选区。保存成功、取消、
问 AI、已有标注修改/删除成功或显式关闭后才释放选区与编辑状态。高亮与智能标记通过
annotations API 保存原文，问 AI 通过 `rp-ask-ai` 消息发送非空 quote。

选区首层工具栏固定提供高亮、想法、标记、复制、问 AI 与分享；线型、颜色、无样式和删除统一收进高亮二级面板。分享通过 `rp-share` 把非空原文、想法、语义类型和页面 ID 交给父层。`ReaderApp` 补全书名、作者、章节后打开 `ShareComposer`，在浏览器本地生成暖纸、杂志、墨迹三套 SVG，并提供横竖比例、想法与水印开关。图片只在本地转为 PNG，按环境能力显示系统分享、复制图片、保存 PNG，复制原文作为最低降级；dialog 支持 Escape、焦点进入/返回与移动端全屏布局。

`rp-share` 只接受同源、当前活动 iframe 且 pageId 与当前章节一致的消息；切页会立即清空旧 iframe 引用。三套 SVG 使用独立排版分支和 grapheme 安全换行，预览以 data URL `object-contain` 缩放，避免固定像素 SVG 撑破 Composer。PNG 在选项变化后 debounce 预生成，保留上一可用 Blob，并以 SVG version 防止旧异步结果覆盖；version 不匹配时图片动作保持禁用，避免导出旧模板。系统分享失败会显示明确提示，不会脱离用户手势自动调用剪贴板或下载；用户可通过独立的“复制图片”或“保存 PNG”按钮重试。
