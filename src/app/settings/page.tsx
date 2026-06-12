/**
 * input: 无路径参数
 * output: 渲染 /settings 设置页 — 当前仅含微信读书集成卡片，后续可扩展
 * pos: 应用设置入口；ReadPilot 全局配置面板
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
import { WereadSettingsCard } from '@/components/features/settings/WereadSettingsCard';

export default function SettingsPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 sm:p-10 space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-on-surface">设置</h1>
        <p className="text-on-surface-variant mt-1">管理 ReadPilot 的外部集成与偏好。</p>
      </header>
      <WereadSettingsCard />
    </main>
  );
}
