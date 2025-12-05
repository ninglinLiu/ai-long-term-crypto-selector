/**
 * API 路由：获取最新报告
 */

import { NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const reportsDir = join(process.cwd(), 'reports');

    // 获取最新的报告文件
    const files = await readdir(reportsDir);
    const reportFiles = files
      .filter((f) => f.startsWith('portfolio-') && f.endsWith('.md'))
      .sort()
      .reverse();

    if (reportFiles.length === 0) {
      return NextResponse.json(
        { error: '未找到报告文件，请先运行 generate-report' },
        { status: 404 }
      );
    }

    const latestReport = reportFiles[0];
    const reportPath = join(reportsDir, latestReport);
    const content = await readFile(reportPath, 'utf-8');

    return NextResponse.json({
      filename: latestReport,
      date: latestReport.replace('portfolio-', '').replace('.md', ''),
      content,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}




