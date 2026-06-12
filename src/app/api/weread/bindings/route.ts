// input: 无
// output: GET 返回当前所有 weread_bindings 行（前端 hydrate 用）
// pos: 绑定列表只读接口 — LibraryView 首屏 hydrate 用
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextResponse } from 'next/server';
import { getAllBindings } from '@/lib/db';

export async function GET() {
  return NextResponse.json({ bindings: getAllBindings() });
}
