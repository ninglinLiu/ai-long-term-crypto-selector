/**
 * 技术面信号扫描核心逻辑
 * 遍历白名单资产和周期，计算指标并生成信号
 */

import { prisma } from '../db/client';
import { WHITELIST_SYMBOLS } from '../constants/assets';
import { BinanceKlineProvider } from './klineDataProvider';
import { getTradingPairConfig, isTechnicalAnalysisSupported } from './marketConfig';
import { calculateAllIndicators } from './indicators';
import {
  scanBreakoutUp,
  scanBreakoutDown,
  scanRetestLong,
  scanRetestShort,
  calculateSignalScore,
  BreakoutSignal,
  RetestSignal,
} from './signalRules';
import { SCAN_LOOKBACK_BARS, DEFAULT_KLINE_LIMIT } from './taConfig';
import type { Timeframe } from './klineDataProvider';

/**
 * 扫描单个资产单个周期的技术信号
 */
export async function scanAssetTimeframe(
  assetId: string,
  assetSymbol: string,
  timeframe: Timeframe
): Promise<void> {
  // 检查是否支持技术面分析
  if (!isTechnicalAnalysisSupported(assetSymbol as any)) {
    console.log(`[扫描] ${assetSymbol} (${timeframe}): 暂不支持技术面分析，跳过`);
    return;
  }

  const config = getTradingPairConfig(assetSymbol as any);
  const klineProvider = new BinanceKlineProvider();

  try {
    // 获取 K 线数据
    console.log(`[扫描] ${assetSymbol} (${timeframe}): 获取 K 线数据...`);
    const klines = await klineProvider.fetchKlines(
      config.tradingPair,
      timeframe,
      DEFAULT_KLINE_LIMIT
    );

    if (klines.length < 120) {
      console.warn(`[扫描] ${assetSymbol} (${timeframe}): K 线数据不足（${klines.length} 根），跳过`);
      return;
    }

    // 计算技术指标
    console.log(`[扫描] ${assetSymbol} (${timeframe}): 计算技术指标...`);
    const indicators = calculateAllIndicators(klines);

    // 扫描突破信号
    const breakoutUp = scanBreakoutUp(klines, indicators, SCAN_LOOKBACK_BARS);
    const breakoutDown = scanBreakoutDown(klines, indicators, SCAN_LOOKBACK_BARS);

    // 选择最近的突破信号（向上或向下）
    let latestBreakout: BreakoutSignal | null = null;
    if (breakoutUp && breakoutDown) {
      latestBreakout = breakoutUp.breakoutBarIndex > breakoutDown.breakoutBarIndex ? breakoutUp : breakoutDown;
    } else if (breakoutUp) {
      latestBreakout = breakoutUp;
    } else if (breakoutDown) {
      latestBreakout = breakoutDown;
    }

    // 如果有突破信号，检查是否有回踩信号
    let retestSignal: RetestSignal | null = null;
    if (latestBreakout) {
      if (latestBreakout.direction === 'long') {
        retestSignal = scanRetestLong(klines, indicators, latestBreakout);
      } else {
        retestSignal = scanRetestShort(klines, indicators, latestBreakout);
      }
    }

    // 优先保存回踩信号（如果有），否则保存突破信号
    const signalToSave = retestSignal || latestBreakout;

    if (!signalToSave) {
      console.log(`[扫描] ${assetSymbol} (${timeframe}): 未发现技术信号`);
      return;
    }

    // 计算综合评分
    const signalScore = calculateSignalScore(signalToSave);

    // 准备保存到数据库的数据
    const signalData: any = {
      assetId,
      timeframe,
      signalType: signalToSave.signalType,
      direction: signalToSave.direction,
      source: retestSignal ? 'retest' : 'cluster_breakout',
      densityScore: retestSignal
        ? signalToSave.parentBreakout.clusterInfo.densityScore
        : signalToSave.clusterInfo.densityScore,
      breakoutScore: retestSignal ? signalToSave.parentBreakout.breakoutScore : signalToSave.breakoutScore,
      retestScore: retestSignal ? signalToSave.retestScore : null,
      signalScore,
      breakoutBarTime: retestSignal ? signalToSave.retestBarTime : signalToSave.breakoutBarTime,
      entryPrice: signalToSave.entryPrice,
      stopLoss: signalToSave.stopLoss,
      takeProfit1: signalToSave.takeProfit1,
      takeProfit2: signalToSave.takeProfit2,
      clusterMean: retestSignal
        ? signalToSave.parentBreakout.clusterInfo.clusterMean
        : signalToSave.clusterInfo.clusterMean,
      clusterHigh: retestSignal
        ? signalToSave.parentBreakout.clusterInfo.clusterHigh
        : signalToSave.clusterInfo.clusterHigh,
      clusterLow: retestSignal
        ? signalToSave.parentBreakout.clusterInfo.clusterLow
        : signalToSave.clusterInfo.clusterLow,
      parentSignalId: retestSignal ? null : null, // 暂时不关联，后续可优化
      extraJson: JSON.stringify({
        clusterWidth: retestSignal
          ? signalToSave.parentBreakout.clusterInfo.clusterWidth
          : signalToSave.clusterInfo.clusterWidth,
        densityRatio: retestSignal
          ? signalToSave.parentBreakout.clusterInfo.densityRatio
          : signalToSave.clusterInfo.densityRatio,
      }),
    };

    // 检查是否已存在该资产该周期的信号（保留最新的）
    const existing = await prisma.technicalSignal.findFirst({
      where: {
        assetId,
        timeframe,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existing) {
      // 如果新信号的突破时间更新，则更新记录
      if (signalData.breakoutBarTime > existing.breakoutBarTime) {
        await prisma.technicalSignal.update({
          where: { id: existing.id },
          data: signalData,
        });
        console.log(`[扫描] ${assetSymbol} (${timeframe}): 更新技术信号 (评分: ${signalScore.toFixed(2)})`);
      } else {
        console.log(`[扫描] ${assetSymbol} (${timeframe}): 已有更新信号，跳过`);
      }
    } else {
      // 创建新记录
      await prisma.technicalSignal.create({
        data: signalData,
      });
      console.log(`[扫描] ${assetSymbol} (${timeframe}): 创建技术信号 (评分: ${signalScore.toFixed(2)})`);
    }
  } catch (error: any) {
    console.error(`[扫描] ${assetSymbol} (${timeframe}): 错误 -`, error.message);
  }
}

/**
 * 扫描所有资产所有周期的技术信号
 */
export async function scanAllSignals(): Promise<void> {
  console.log('[扫描] 开始扫描技术面信号...');
  const timeframes: Timeframe[] = ['1h', '4h', '1d'];

  // 获取所有资产
  const assets = await prisma.asset.findMany({
    where: {
      symbol: {
        in: WHITELIST_SYMBOLS,
      },
    },
  });

  const assetMap = new Map(assets.map(a => [a.symbol, a]));

  // 遍历每个资产和周期
  for (const symbol of WHITELIST_SYMBOLS) {
    const asset = assetMap.get(symbol);
    if (!asset) {
      console.warn(`[扫描] 资产 ${symbol} 不在数据库中，跳过`);
      continue;
    }

    for (const timeframe of timeframes) {
      await scanAssetTimeframe(asset.id, symbol, timeframe);
      // 添加小延迟，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('[扫描] 技术面信号扫描完成');
}



