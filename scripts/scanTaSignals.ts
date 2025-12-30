/**
 * 技术面信号扫描 CLI 脚本
 * 运行：pnpm scan-ta
 */

import { scanAllSignals } from '../src/server/ta/scanSignals';

async function main() {
  try {
    await scanAllSignals();
    process.exit(0);
  } catch (error: any) {
    console.error('[错误] 扫描技术面信号失败:', error);
    process.exit(1);
  }
}

main();



