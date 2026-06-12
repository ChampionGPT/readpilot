// input: 环境变量 READPILOT_DATA_DIR
// output: DATA_DIR, BOOKS_DIR 等共享路径常量
// pos: 配置层 — 所有模块共用的路径定义唯一来源
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import path from 'path';

/** 数据根目录（通过环境变量可配置，默认为项目根目录下的 data/） */
export const DATA_DIR = process.env.READPILOT_DATA_DIR || path.join(process.cwd(), 'data');

/** 书籍数据目录 */
export const BOOKS_DIR = path.join(DATA_DIR, 'books');

/** 数据库文件路径 */
export const DB_PATH = path.join(DATA_DIR, 'readpilot.db');
