/**
 * input: 无路径参数
 * output: 渲染 /settings 设置页 — 数据目录、AI Agent、微信读书配置
 * pos: 应用设置入口；ReadPilot 全局配置面板
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
import { AgentSettingsCard } from '@/components/features/settings/AgentSettingsCard';
import { DataPathSettings } from '@/components/features/settings/DataPathSettings';
import { WereadSettingsCard } from '@/components/features/settings/WereadSettingsCard';

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 sm:p-10">
      <header>
        <h1 className="font-serif text-3xl font-bold text-on-surface">设置</h1>
        <p className="text-on-surface-variant mt-1">管理 ReadPilot 的外部集成与偏好。</p>
      </header>
      <DataPathSettings />
      <AgentSettingsCard />
      <WereadSettingsCard />
    </main>
  );
}
