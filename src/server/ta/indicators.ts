/**
 * 技术指标计算
 * 实现 MA, EMA, MACD 等常用指标
 */

import { KlineData } from './klineDataProvider';

/**
 * 简单移动平均线 (SMA)
 */
export function calculateMA(prices: number[], period: number): number[] {
  const ma: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ma.push(NaN); // 数据不足，返回 NaN
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / period);
    }
  }
  
  return ma;
}

/**
 * 指数移动平均线 (EMA)
 */
export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      ema.push(prices[i]); // 第一个值使用价格本身
    } else if (i < period - 1) {
      // 在周期不足时，使用简单平均
      const sum = prices.slice(0, i + 1).reduce((a, b) => a + b, 0);
      ema.push(sum / (i + 1));
    } else {
      // EMA = (价格 - 前一日EMA) *  multiplier + 前一日EMA
      const prevEMA = ema[i - 1];
      ema.push((prices[i] - prevEMA) * multiplier + prevEMA);
    }
  }
  
  return ema;
}

/**
 * MACD 指标
 * @param prices 价格数组（通常为收盘价）
 * @param fastPeriod 快线周期（默认 12）
 * @param slowPeriod 慢线周期（默认 26）
 * @param signalPeriod 信号线周期（默认 9）
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  dif: number[]; // DIF (快线 - 慢线)
  dea: number[]; // DEA (信号线，DIF 的 EMA)
  histogram: number[]; // Histogram (DIF - DEA)
} {
  // 计算快线和慢线的 EMA
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // DIF = 快线 EMA - 慢线 EMA
  const dif: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      dif.push(NaN);
    } else {
      dif.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  // DEA = DIF 的 EMA（信号线）
  const dea = calculateEMA(dif.filter(v => !isNaN(v)), signalPeriod);
  
  // 对齐 DEA 数组（前面补 NaN）
  const deaAligned: number[] = [];
  let deaIndex = 0;
  for (let i = 0; i < dif.length; i++) {
    if (isNaN(dif[i])) {
      deaAligned.push(NaN);
    } else {
      if (deaIndex < dea.length) {
        deaAligned.push(dea[deaIndex]);
        deaIndex++;
      } else {
        deaAligned.push(NaN);
      }
    }
  }
  
  // Histogram = DIF - DEA
  const histogram: number[] = [];
  for (let i = 0; i < dif.length; i++) {
    if (isNaN(dif[i]) || isNaN(deaAligned[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(dif[i] - deaAligned[i]);
    }
  }
  
  return { dif, dea: deaAligned, histogram };
}

/**
 * 计算所有技术指标
 */
export function calculateAllIndicators(klines: KlineData[]): {
  closes: number[];
  ma20: number[];
  ma60: number[];
  ma120: number[];
  ema20: number[];
  ema60: number[];
  ema120: number[];
  macd: {
    dif: number[];
    dea: number[];
    histogram: number[];
  };
} {
  const closes = klines.map(k => k.close);
  
  return {
    closes,
    ma20: calculateMA(closes, 20),
    ma60: calculateMA(closes, 60),
    ma120: calculateMA(closes, 120),
    ema20: calculateEMA(closes, 20),
    ema60: calculateEMA(closes, 60),
    ema120: calculateEMA(closes, 120),
    macd: calculateMACD(closes, 12, 26, 9),
  };
}

/**
 * 计算均线斜率（用于评估平坦程度）
 * @param maValues 均线值数组
 * @param lookback 回看周期
 */
export function calculateSlopeStd(maValues: number[], lookback: number = 10): number[] {
  const slopeStd: number[] = [];
  
  for (let i = 0; i < maValues.length; i++) {
    if (i < lookback) {
      slopeStd.push(NaN);
      continue;
    }
    
    // 计算最近 lookback 根 K 线的斜率
    const slopes: number[] = [];
    for (let j = i - lookback + 1; j <= i; j++) {
      if (j > 0 && !isNaN(maValues[j]) && !isNaN(maValues[j - 1])) {
        const slope = (maValues[j] - maValues[j - 1]) / maValues[j - 1];
        slopes.push(slope);
      }
    }
    
    if (slopes.length === 0) {
      slopeStd.push(NaN);
      continue;
    }
    
    // 计算斜率的标准差
    const mean = slopes.reduce((a, b) => a + b, 0) / slopes.length;
    const variance = slopes.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / slopes.length;
    slopeStd.push(Math.sqrt(variance));
  }
  
  return slopeStd;
}



