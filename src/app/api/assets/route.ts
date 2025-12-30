/**
 * API 路由：获取所有资产的最新数据
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET() {
  try {
    // 获取所有资产及其最新数据
    const assets = await prisma.asset.findMany({
      include: {
        dailyMarketData: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        factorSnapshots: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        portfolioSuggestions: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    const result = assets.map((asset) => {
      const latestData = asset.dailyMarketData[0];
      const latestSnapshot = asset.factorSnapshots[0];
      const latestSuggestion = asset.portfolioSuggestions[0];

      return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        price: latestData?.price || 0,
        marketCap: latestData?.marketCap || null,
        volume24h: latestData?.volume || null,
        valuationScore: latestSnapshot?.valuationScore || null,
        momentumScore: latestSnapshot?.momentumScore || null,
        liquidityScore: latestSnapshot?.liquidityScore || null,
        riskScore: latestSnapshot?.riskScore || null,
        totalScore: latestSnapshot?.totalScore || null,
        targetWeight: latestSuggestion?.targetWeight || 0,
        lastUpdated: latestData?.date || null,
      };
    });

    // 按总分降序排序
    result.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}








