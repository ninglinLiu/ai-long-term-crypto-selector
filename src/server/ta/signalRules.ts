/**
 * 技术信号规则
 * 实现均线密集判定、突破信号、回踩信号等
 */

import { KlineData } from './klineDataProvider';
import {
  calculateAllIndicators,
  calculateSlopeStd,
} from './indicators';
import {
  CLUSTER_TIGHT_THRESHOLD,
  D_MAX,
  S_MAX,
  BREAKOUT_BUFFER,
  MIN_DENSITY_SCORE_FOR_BREAKOUT,
  DIST_MAX,
  MOVE_MAX,
  VOL_MAX,
  BREAKOUT_SCORE_WEIGHTS,
  MACD_CONFIRMATION_BARS,
  RETEST_TOLERANCE_MULTIPLIER,
  RETEST_MIN_PRICE_OFFSET,
  RETEST_WINDOW_BARS,
  STOP_LOSS_CLUSTER_OFFSET,
  STOP_LOSS_MIN_OFFSET,
  TAKE_PROFIT_R1,
  TAKE_PROFIT_R2,
  USE_BREAKOUT_CLOSE_PRICE,
  SIGNAL_SCORE_WEIGHTS,
} from './taConfig';

export type SignalType = 'cluster_breakout_up' | 'cluster_breakout_down' | 'retest_long' | 'retest_short';
export type Direction = 'long' | 'short';

export interface ClusterInfo {
  index: number; // K 线索引
  clusterMean: number;
  clusterHigh: number;
  clusterLow: number;
  clusterWidth: number;
  densityRatio: number;
  densityScore: number;
}

export interface BreakoutSignal {
  signalType: 'cluster_breakout_up' | 'cluster_breakout_down';
  direction: Direction;
  breakoutBarIndex: number; // 突破 K 线索引
  breakoutBarTime: Date;
  clusterInfo: ClusterInfo;
  breakoutScore: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
}

export interface RetestSignal {
  signalType: 'retest_long' | 'retest_short';
  direction: Direction;
  retestBarIndex: number;
  retestBarTime: Date;
  parentBreakout: BreakoutSignal;
  retestScore: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
}

export type TechnicalSignal = BreakoutSignal | RetestSignal;

/**
 * 计算均线密集区信息
 */
export function calculateClusterInfo(
  index: number,
  ma20: number[],
  ma60: number[],
  ma120: number[],
  ema20: number[],
  ema60: number[],
  ema120: number[]
): ClusterInfo | null {
  // 检查所有均线是否有效
  const maValues = [
    ma20[index],
    ma60[index],
    ma120[index],
    ema20[index],
    ema60[index],
    ema120[index],
  ];
  
  if (maValues.some(v => isNaN(v))) {
    return null;
  }
  
  const clusterMean = maValues.reduce((a, b) => a + b, 0) / maValues.length;
  const clusterHigh = Math.max(...maValues);
  const clusterLow = Math.min(...maValues);
  const clusterWidth = clusterHigh - clusterLow;
  const densityRatio = clusterWidth / clusterMean;
  
  // 计算密集度评分
  const densityScore = 1 - Math.min(densityRatio / D_MAX, 1);
  
  // 可选：考虑均线斜率平坦程度
  // 计算 6 条均线的斜率标准差
  const allMAs = [ma20, ma60, ma120, ema20, ema60, ema120];
  const slopeStds: number[] = [];
  
  for (const ma of allMAs) {
    const slopeStd = calculateSlopeStd(ma, 10);
    if (!isNaN(slopeStd[index])) {
      slopeStds.push(slopeStd[index]);
    }
  }
  
  let flatScore = 1.0;
  if (slopeStds.length > 0) {
    const avgSlopeStd = slopeStds.reduce((a, b) => a + b, 0) / slopeStds.length;
    flatScore = 1 - Math.min(avgSlopeStd / S_MAX, 1);
  }
  
  // 最终密集度评分 = 基础评分 * 平坦度评分
  const finalDensityScore = densityScore * flatScore;
  
  return {
    index,
    clusterMean,
    clusterHigh,
    clusterLow,
    clusterWidth,
    densityRatio,
    densityScore: finalDensityScore,
  };
}

/**
 * 检查 MACD 是否支持突破方向
 */
function checkMACDConfirmation(
  macd: { dif: number[]; dea: number[]; histogram: number[] },
  index: number,
  direction: Direction,
  lookback: number = MACD_CONFIRMATION_BARS
): boolean {
  const startIndex = Math.max(0, index - lookback + 1);
  
  if (direction === 'long') {
    // 多头：检查 MACD 柱是否从 ≤ 0 转为 > 0，或 DIF 上穿 DEA
    for (let i = startIndex; i <= index; i++) {
      if (i > 0) {
        // 检查柱状图转正
        if (
          !isNaN(macd.histogram[i - 1]) &&
          !isNaN(macd.histogram[i]) &&
          macd.histogram[i - 1] <= 0 &&
          macd.histogram[i] > 0
        ) {
          return true;
        }
        // 检查 DIF 上穿 DEA
        if (
          !isNaN(macd.dif[i - 1]) &&
          !isNaN(macd.dea[i - 1]) &&
          !isNaN(macd.dif[i]) &&
          !isNaN(macd.dea[i]) &&
          macd.dif[i - 1] <= macd.dea[i - 1] &&
          macd.dif[i] > macd.dea[i]
        ) {
          return true;
        }
      }
    }
  } else {
    // 空头：检查 MACD 柱是否从 ≥ 0 转为 < 0，或 DIF 下穿 DEA
    for (let i = startIndex; i <= index; i++) {
      if (i > 0) {
        // 检查柱状图转负
        if (
          !isNaN(macd.histogram[i - 1]) &&
          !isNaN(macd.histogram[i]) &&
          macd.histogram[i - 1] >= 0 &&
          macd.histogram[i] < 0
        ) {
          return true;
        }
        // 检查 DIF 下穿 DEA
        if (
          !isNaN(macd.dif[i - 1]) &&
          !isNaN(macd.dea[i - 1]) &&
          !isNaN(macd.dif[i]) &&
          !isNaN(macd.dea[i]) &&
          macd.dif[i - 1] >= macd.dea[i - 1] &&
          macd.dif[i] < macd.dea[i]
        ) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * 计算突破力度评分
 */
function calculateBreakoutScore(
  klines: KlineData[],
  clusterInfo: ClusterInfo,
  breakoutIndex: number,
  direction: Direction
): number {
  const clusterMean = clusterInfo.clusterMean;
  const clusterWidth = clusterInfo.clusterWidth;
  const breakoutClose = klines[breakoutIndex].close;
  const prevClose = breakoutIndex > 0 ? klines[breakoutIndex - 1].close : breakoutClose;
  
  // 1. 距离评分：突破距离相对于密集区宽度
  const distFromMean = Math.abs(breakoutClose - clusterMean);
  const distRatio = clusterWidth > 0 ? distFromMean / clusterWidth : 0;
  const sDist = Math.min(distRatio / DIST_MAX, 1);
  
  // 2. 幅度评分：突破幅度（暂时不用 ATR，后续可加）
  const moveRatio = Math.abs(breakoutClose - prevClose) / prevClose;
  const sMove = Math.min(moveRatio / 0.02, 1); // 假设 2% 为最大值
  
  // 3. 成交量评分
  const volumes = klines.slice(Math.max(0, breakoutIndex - 20), breakoutIndex + 1).map(k => k.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const currentVolume = klines[breakoutIndex].volume;
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  const sVolume = Math.min(volumeRatio / VOL_MAX, 1);
  
  // 加权求和
  const breakoutScore =
    BREAKOUT_SCORE_WEIGHTS.distance * sDist +
    BREAKOUT_SCORE_WEIGHTS.move * sMove +
    BREAKOUT_SCORE_WEIGHTS.volume * sVolume;
  
  return Math.min(breakoutScore, 1);
}

/**
 * 计算止损和止盈价格
 */
function calculateStopLossAndTakeProfit(
  entryPrice: number,
  clusterInfo: ClusterInfo,
  direction: Direction
): { stopLoss: number; takeProfit1: number; takeProfit2: number } {
  let stopLoss: number;
  
  if (direction === 'long') {
    // 多头：止损在密集区下方
    const offset = Math.max(
      clusterInfo.clusterWidth * STOP_LOSS_CLUSTER_OFFSET,
      clusterInfo.clusterMean * STOP_LOSS_MIN_OFFSET
    );
    stopLoss = clusterInfo.clusterLow - offset;
  } else {
    // 空头：止损在密集区上方
    const offset = Math.max(
      clusterInfo.clusterWidth * STOP_LOSS_CLUSTER_OFFSET,
      clusterInfo.clusterMean * STOP_LOSS_MIN_OFFSET
    );
    stopLoss = clusterInfo.clusterHigh + offset;
  }
  
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  
  let takeProfit1: number;
  let takeProfit2: number;
  
  if (direction === 'long') {
    takeProfit1 = entryPrice + riskPerUnit * TAKE_PROFIT_R1;
    takeProfit2 = entryPrice + riskPerUnit * TAKE_PROFIT_R2;
  } else {
    takeProfit1 = entryPrice - riskPerUnit * TAKE_PROFIT_R1;
    takeProfit2 = entryPrice - riskPerUnit * TAKE_PROFIT_R2;
  }
  
  return { stopLoss, takeProfit1, takeProfit2 };
}

/**
 * 扫描向上突破信号
 */
export function scanBreakoutUp(
  klines: KlineData[],
  indicators: ReturnType<typeof calculateAllIndicators>,
  lookback: number
): BreakoutSignal | null {
  const { closes, ma20, ma60, ma120, ema20, ema60, ema120, macd } = indicators;
  
  // 从最新 K 线向前扫描
  for (let t1 = klines.length - 1; t1 >= lookback; t1--) {
    // 检查前一根 K 线 t0 是否为均线密集区
    const t0 = t1 - 1;
    const clusterInfo = calculateClusterInfo(t0, ma20, ma60, ma120, ema20, ema60, ema120);
    
    if (!clusterInfo || clusterInfo.densityScore < MIN_DENSITY_SCORE_FOR_BREAKOUT) {
      continue;
    }
    
    // 检查是否满足向上突破条件
    const closeT0 = closes[t0];
    const closeT1 = closes[t1];
    
    // 条件1：t0 收盘价在密集区上沿或以下
    if (closeT0 > clusterInfo.clusterHigh) {
      continue;
    }
    
    // 条件2：t1 收盘价突破密集区上沿（带缓冲）
    const breakoutThreshold = clusterInfo.clusterHigh * (1 + BREAKOUT_BUFFER);
    if (closeT1 <= breakoutThreshold) {
      continue;
    }
    
    // 条件3：MACD 辅助确认
    if (!checkMACDConfirmation(macd, t1, 'long')) {
      continue;
    }
    
    // 计算突破力度评分
    const breakoutScore = calculateBreakoutScore(klines, clusterInfo, t1, 'long');
    
    // 计算入场价、止损、止盈
    const entryPrice = USE_BREAKOUT_CLOSE_PRICE ? closeT1 : (t1 < klines.length - 1 ? klines[t1 + 1].open : closeT1);
    const { stopLoss, takeProfit1, takeProfit2 } = calculateStopLossAndTakeProfit(
      entryPrice,
      clusterInfo,
      'long'
    );
    
    return {
      signalType: 'cluster_breakout_up',
      direction: 'long',
      breakoutBarIndex: t1,
      breakoutBarTime: new Date(klines[t1].openTime),
      clusterInfo,
      breakoutScore,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
    };
  }
  
  return null;
}

/**
 * 扫描向下突破信号
 */
export function scanBreakoutDown(
  klines: KlineData[],
  indicators: ReturnType<typeof calculateAllIndicators>,
  lookback: number
): BreakoutSignal | null {
  const { closes, ma20, ma60, ma120, ema20, ema60, ema120, macd } = indicators;
  
  // 从最新 K 线向前扫描
  for (let t1 = klines.length - 1; t1 >= lookback; t1--) {
    // 检查前一根 K 线 t0 是否为均线密集区
    const t0 = t1 - 1;
    const clusterInfo = calculateClusterInfo(t0, ma20, ma60, ma120, ema20, ema60, ema120);
    
    if (!clusterInfo || clusterInfo.densityScore < MIN_DENSITY_SCORE_FOR_BREAKOUT) {
      continue;
    }
    
    // 检查是否满足向下突破条件
    const closeT0 = closes[t0];
    const closeT1 = closes[t1];
    
    // 条件1：t0 收盘价在密集区下沿或以上
    if (closeT0 < clusterInfo.clusterLow) {
      continue;
    }
    
    // 条件2：t1 收盘价跌破密集区下沿（带缓冲）
    const breakoutThreshold = clusterInfo.clusterLow * (1 - BREAKOUT_BUFFER);
    if (closeT1 >= breakoutThreshold) {
      continue;
    }
    
    // 条件3：MACD 辅助确认
    if (!checkMACDConfirmation(macd, t1, 'short')) {
      continue;
    }
    
    // 计算突破力度评分
    const breakoutScore = calculateBreakoutScore(klines, clusterInfo, t1, 'short');
    
    // 计算入场价、止损、止盈
    const entryPrice = USE_BREAKOUT_CLOSE_PRICE ? closeT1 : (t1 < klines.length - 1 ? klines[t1 + 1].open : closeT1);
    const { stopLoss, takeProfit1, takeProfit2 } = calculateStopLossAndTakeProfit(
      entryPrice,
      clusterInfo,
      'short'
    );
    
    return {
      signalType: 'cluster_breakout_down',
      direction: 'short',
      breakoutBarIndex: t1,
      breakoutBarTime: new Date(klines[t1].openTime),
      clusterInfo,
      breakoutScore,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
    };
  }
  
  return null;
}

/**
 * 扫描回踩信号（多头回踩）
 */
export function scanRetestLong(
  klines: KlineData[],
  indicators: ReturnType<typeof calculateAllIndicators>,
  breakoutSignal: BreakoutSignal
): RetestSignal | null {
  const { closes } = indicators;
  const startIndex = breakoutSignal.breakoutBarIndex + 1;
  const endIndex = Math.min(startIndex + RETEST_WINDOW_BARS, klines.length);
  
  for (let i = startIndex; i < endIndex; i++) {
    const low = klines[i].low;
    const close = closes[i];
    const clusterInfo = breakoutSignal.clusterInfo;
    
    // 计算回踩容差
    const tolerance = Math.max(
      clusterInfo.clusterWidth * RETEST_TOLERANCE_MULTIPLIER,
      clusterInfo.clusterMean * RETEST_MIN_PRICE_OFFSET
    );
    
    // 条件1：最低价接近均线密集区
    const distFromMean = Math.abs(low - clusterInfo.clusterMean);
    if (distFromMean > tolerance) {
      continue;
    }
    
    // 条件2：收盘价仍在密集区下沿之上（未跌回密集区）
    if (close < clusterInfo.clusterLow) {
      continue;
    }
    
    // 计算回踩评分（根据回踩深度和 K 线形态）
    const retestDepth = Math.abs(low - clusterInfo.clusterMean) / clusterInfo.clusterWidth;
    const retestScore = 1 - Math.min(retestDepth, 1); // 回踩越浅，评分越高
    
    // 计算入场价、止损、止盈
    const entryPrice = close;
    const { stopLoss, takeProfit1, takeProfit2 } = calculateStopLossAndTakeProfit(
      entryPrice,
      clusterInfo,
      'long'
    );
    
    return {
      signalType: 'retest_long',
      direction: 'long',
      retestBarIndex: i,
      retestBarTime: new Date(klines[i].openTime),
      parentBreakout: breakoutSignal,
      retestScore,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
    };
  }
  
  return null;
}

/**
 * 扫描回顶信号（空头回顶）
 */
export function scanRetestShort(
  klines: KlineData[],
  indicators: ReturnType<typeof calculateAllIndicators>,
  breakoutSignal: BreakoutSignal
): RetestSignal | null {
  const { closes } = indicators;
  const startIndex = breakoutSignal.breakoutBarIndex + 1;
  const endIndex = Math.min(startIndex + RETEST_WINDOW_BARS, klines.length);
  
  for (let i = startIndex; i < endIndex; i++) {
    const high = klines[i].high;
    const close = closes[i];
    const clusterInfo = breakoutSignal.clusterInfo;
    
    // 计算回顶容差
    const tolerance = Math.max(
      clusterInfo.clusterWidth * RETEST_TOLERANCE_MULTIPLIER,
      clusterInfo.clusterMean * RETEST_MIN_PRICE_OFFSET
    );
    
    // 条件1：最高价接近均线密集区
    const distFromMean = Math.abs(high - clusterInfo.clusterMean);
    if (distFromMean > tolerance) {
      continue;
    }
    
    // 条件2：收盘价仍在密集区上沿之下（未涨回密集区）
    if (close > clusterInfo.clusterHigh) {
      continue;
    }
    
    // 计算回顶评分
    const retestDepth = Math.abs(high - clusterInfo.clusterMean) / clusterInfo.clusterWidth;
    const retestScore = 1 - Math.min(retestDepth, 1);
    
    // 计算入场价、止损、止盈
    const entryPrice = close;
    const { stopLoss, takeProfit1, takeProfit2 } = calculateStopLossAndTakeProfit(
      entryPrice,
      clusterInfo,
      'short'
    );
    
    return {
      signalType: 'retest_short',
      direction: 'short',
      retestBarIndex: i,
      retestBarTime: new Date(klines[i].openTime),
      parentBreakout: breakoutSignal,
      retestScore,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
    };
  }
  
  return null;
}

/**
 * 计算信号综合评分
 */
export function calculateSignalScore(signal: TechnicalSignal): number {
  if (signal.signalType === 'retest_long' || signal.signalType === 'retest_short') {
    // 回踩信号
    const weights = SIGNAL_SCORE_WEIGHTS.retest;
    return (
      weights.density * signal.parentBreakout.clusterInfo.densityScore +
      weights.breakout * signal.parentBreakout.breakoutScore +
      weights.retest * signal.retestScore
    );
  } else {
    // 突破信号
    const weights = SIGNAL_SCORE_WEIGHTS.breakout;
    return (
      weights.density * signal.clusterInfo.densityScore +
      weights.breakout * signal.breakoutScore
    );
  }
}

