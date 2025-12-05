/**
 * API 路由：获取单个资产的详细信息
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const assetId = params.id;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        dailyMarketData: {
          orderBy: { date: 'desc' },
          take: 365, // 最近 365 天
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

    if (!asset) {
      return NextResponse.json(
        { error: '资产未找到' },
        { status: 404 }
      );
    }

    const latestSnapshot = asset.factorSnapshots[0];
    const latestSuggestion = asset.portfolioSuggestions[0];
    const rawFactors = latestSnapshot?.rawFactors
      ? JSON.parse(latestSnapshot.rawFactors)
      : null;

    return NextResponse.json({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      priceHistory: asset.dailyMarketData.map((d) => ({
        date: d.date.toISOString().split('T')[0],
        price: d.price,
        marketCap: d.marketCap,
        volume: d.volume,
      })),
      latestData: asset.dailyMarketData[0]
        ? {
            price: asset.dailyMarketData[0].price,
            marketCap: asset.dailyMarketData[0].marketCap,
            volume: asset.dailyMarketData[0].volume,
            date: asset.dailyMarketData[0].date.toISOString().split('T')[0],
          }
        : null,
      scores: latestSnapshot
        ? {
            valuationScore: latestSnapshot.valuationScore,
            momentumScore: latestSnapshot.momentumScore,
            liquidityScore: latestSnapshot.liquidityScore,
            riskScore: latestSnapshot.riskScore,
            totalScore: latestSnapshot.totalScore,
          }
        : null,
      rawFactors,
      targetWeight: latestSuggestion?.targetWeight || 0,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}




