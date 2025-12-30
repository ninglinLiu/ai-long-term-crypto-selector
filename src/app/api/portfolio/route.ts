/**
 * API 路由：获取最新组合建议
 */

import { NextResponse } from 'next/server';
import { getLatestPortfolioSuggestion } from '@/server/strategy/portfolio';

export async function GET() {
  try {
    const portfolio = await getLatestPortfolioSuggestion();

    if (!portfolio) {
      return NextResponse.json(
        { error: '未找到组合建议，请先运行 recompute-factors' },
        { status: 404 }
      );
    }

    return NextResponse.json(portfolio);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}








