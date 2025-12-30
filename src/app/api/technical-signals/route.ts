/**
 * API 路由：获取技术面信号
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { SIGNAL_STRENGTH_THRESHOLDS } from '@/server/ta/taConfig';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const timeframe = searchParams.get('timeframe');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};
    if (assetId) {
      where.assetId = assetId;
    }
    if (timeframe) {
      where.timeframe = timeframe;
    }

    const signals = await prisma.technicalSignal.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    const result = signals.map((signal) => {
      // 计算信号强度等级
      let strength: 'strong' | 'medium' | 'weak' | 'very_weak' = 'very_weak';
      if (signal.signalScore >= SIGNAL_STRENGTH_THRESHOLDS.strong) {
        strength = 'strong';
      } else if (signal.signalScore >= SIGNAL_STRENGTH_THRESHOLDS.medium) {
        strength = 'medium';
      } else if (signal.signalScore >= SIGNAL_STRENGTH_THRESHOLDS.weak) {
        strength = 'weak';
      }

      return {
        id: signal.id,
        assetId: signal.assetId,
        assetSymbol: signal.asset.symbol,
        assetName: signal.asset.name,
        timeframe: signal.timeframe,
        signalType: signal.signalType,
        direction: signal.direction,
        source: signal.source,
        densityScore: signal.densityScore,
        breakoutScore: signal.breakoutScore,
        retestScore: signal.retestScore,
        signalScore: signal.signalScore,
        strength,
        breakoutBarTime: signal.breakoutBarTime,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit1: signal.takeProfit1,
        takeProfit2: signal.takeProfit2,
        clusterMean: signal.clusterMean,
        clusterHigh: signal.clusterHigh,
        clusterLow: signal.clusterLow,
        createdAt: signal.createdAt,
        updatedAt: signal.updatedAt,
        extraJson: signal.extraJson ? JSON.parse(signal.extraJson) : null,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}



