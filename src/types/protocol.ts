// input: 无外部依赖
// output: AI 输出协议类型定义（PRP §4.3 输出协议规范）
// pos: 类型库 — AI 返回数据的数据契约
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

/** AI 输出的单个内容节 */
export interface PageSection {
    type: 'translation' | 'quiz' | 'chat_animation' | 'flow_animation' | 'glossary' | 'text';
    data: Record<string, any>;
}

/** AI 的完整页面渲染指令 */
export interface RenderPageAction {
    action: 'render_page';
    moduleId: string;
    pageId: string;
    sections: PageSection[];
}

/** AI 的进度更新指令 */
export interface UpdateProgressAction {
    action: 'update_progress';
    moduleId: string;
    pageId: string;
    status: 'unlocked' | 'completed';
}

/** AI 输出协议：所有可能的结构化动作 */
export type AIAction = RenderPageAction | UpdateProgressAction;

/** SSE 事件载荷 */
export interface SSEEvent {
    type: 'text_stream' | 'text' | 'component' | 'progress' | 'error' | 'tool_progress' | 'result';
    data: string;
}
