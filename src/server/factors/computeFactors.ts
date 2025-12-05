/**
 * 因子计算引擎
 * 从历史数据计算各种投资因子
 */

import { prisma } from '../db/client';
import { RawFactors, FactorScores, FactorCalculationParams, DEFAULT_FACTOR_PARAMS } from './factorDefinitions';

/**
 * 计算单个资产的原始因子
 */
export async function computeRawFactors(
  assetId: string,
  date: Date,
  params: FactorCalculationParams = DEFAULT_FACTOR_PARAMS
): Promise<RawFactors | null> {
  // 获取历史数据（至少需要 365 天）
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - 1);
  startDate.setDate(startDate.getDate() - 30); // 多取 30 天用于计算

  const marketData = await prisma.dailyMarketData.findMany({
    where: {
      assetId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  if (marketData.length < params.returnWindows.long) {
    console.warn(`[computeRawFactors] 数据不足: ${assetId}, 需要 ${params.returnWindows.long} 天，实际 ${marketData.length} 天`);
    return null;
  }

  // 获取最新数据
  const latestData = marketData[marketData.length - 1];
  const currentPrice = latestData.price;
  const currentMarketCap = latestData.marketCap || 0;
  const currentVolume = latestData.volume || 0;

  // 1. 估值因子
  const logMarketCap = currentMarketCap > 0 ? Math.log(currentMarketCap) : 0;
  const fdvToMarketCapRatio = currentMarketCap > 0 && latestData.fdv ? latestData.fdv / currentMarketCap : 1;
  
  // 计算 365 天最高价
  const prices365d = marketData
    .slice(-params.returnWindows.long)
    .map((d) => d.high || d.price)
    .filter((p) => p > 0);
  const high365d = prices365d.length > 0 ? Math.max(...prices365d) : currentPrice;
  const priceToHigh365d = high365d > 0 ? currentPrice / high365d : 0;

  // 2. 动量因子 - 收益率
  const prices = marketData.map((d) => d.price).filter((p) => p > 0);
  const return90d = calculateReturn(prices, params.returnWindows.short);
  const return180d = calculateReturn(prices, params.returnWindows.medium);
  const return365d = calculateReturn(prices, params.returnWindows.long);

  // 3. 动量因子 - 波动率
  const volatility90d = calculateVolatility(prices, params.volatilityWindows.short);
  const volatility180d = calculateVolatility(prices, params.volatilityWindows.medium);

  // 4. 流动性因子
  const volumeToMarketCapRatio = currentMarketCap > 0 ? (currentVolume / currentMarketCap) : 0;
  
  // 计算 30 天平均成交量
  const volumes30d = marketData
    .slice(-params.liquidityWindow)
    .map((d) => d.volume || 0)
    .filter((v) => v > 0);
  const avgDailyVolume30d = volumes30d.length > 0 
    ? volumes30d.reduce((sum, v) => sum + v, 0) / volumes30d.length 
    : 0;

  // 5. 风险因子
  const volatility365d = calculateVolatility(prices, params.volatilityWindows.long);
  const maxDrawdown365d = calculateMaxDrawdown(prices);

  return {
    logMarketCap,
    fdvToMarketCapRatio,
    priceToHigh365d,
    return90d,
    return180d,
    return365d,
    volatility90d,
    volatility180d,
    volumeToMarketCapRatio,
    avgDailyVolume30d,
    volatility365d,
    maxDrawdown365d,
  };
}

/**
 * 计算收益率
 */
function calculateReturn(prices: number[], window: number): number {
  if (prices.length < window + 1) return 0;
  const startPrice = prices[prices.length - window - 1];
  const endPrice = prices[prices.length - 1];
  if (startPrice <= 0) return 0;
  return (endPrice - startPrice) / startPrice;
}

/**
 * 计算波动率（年化）
 */
function calculateVolatility(prices: number[], window: number): number {
  if (prices.length < window + 1) return 0;
  
  const returns: number[] = [];
  for (let i = prices.length - window; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  if (returns.length === 0) return 0;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // 年化波动率（假设 365 天）
  return stdDev * Math.sqrt(365);
}

/**
 * 计算最大回撤
 */
function calculateMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  let maxDrawdown = 0;
  let peak = prices[0];

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
    } else {
      const drawdown = (peak - prices[i]) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }

  return maxDrawdown;
}

/**
 * 标准化因子得分（0-5 分）
 * 使用分位数方法或简单线性映射
 */
export function normalizeFactorScores(
  rawFactors: RawFactors,
  allAssetsFactors: RawFactors[] // 用于计算分位数
): FactorScores {
  // 估值得分：综合考虑 logMarketCap（越大越好）、fdvToMarketCapRatio（越小越好）、priceToHigh365d（越大越好）
  const valuationScore = calculateValuationScore(rawFactors, allAssetsFactors);

  // 动量得分：综合考虑收益率（越大越好）和波动率（越小越好）
  const momentumScore = calculateMomentumScore(rawFactors, allAssetsFactors);

  // 流动性得分：成交量相关指标（越大越好）
  const liquidityScore = calculateLiquidityScore(rawFactors, allAssetsFactors);

  // 风险得分：波动率和回撤（越小越好，所以得分越高）
  const riskScore = calculateRiskScore(rawFactors, allAssetsFactors);

  // 总分：加权平均（可根据策略调整权重）
  const totalScore = (
    valuationScore * 0.25 +
    momentumScore * 0.30 +
    liquidityScore * 0.20 +
    riskScore * 0.25
  );

  return {
    valuationScore,
    momentumScore,
    liquidityScore,
    riskScore,
    totalScore: Math.min(5, Math.max(0, totalScore)), // 限制在 0-5 之间
  };
}

/**
 * 计算估值得分
 */
function calculateValuationScore(factors: RawFactors, allFactors: RawFactors[]): number {
  if (allFactors.length === 0) return 2.5;

  // logMarketCap 分位数（越大越好）
  const logMarketCaps = allFactors.map((f) => f.logMarketCap).filter((v) => !isNaN(v) && isFinite(v));
  const logMarketCapPercentile = getPercentile(factors.logMarketCap, logMarketCaps);

  // fdvToMarketCapRatio 分位数（越小越好，所以取反）
  const fdvRatios = allFactors.map((f) => f.fdvToMarketCapRatio).filter((v) => !isNaN(v) && isFinite(v));
  const fdvRatioPercentile = 1 - getPercentile(factors.fdvToMarketCapRatio, fdvRatios);

  // priceToHigh365d 分位数（越大越好）
  const priceToHighs = allFactors.map((f) => f.priceToHigh365d).filter((v) => !isNaN(v) && isFinite(v));
  const priceToHighPercentile = getPercentile(factors.priceToHigh365d, priceToHighs);

  // 加权平均
  return (logMarketCapPercentile * 0.3 + fdvRatioPercentile * 0.3 + priceToHighPercentile * 0.4) * 5;
}

/**
 * 计算动量得分
 */
function calculateMomentumScore(factors: RawFactors, allFactors: RawFactors[]): number {
  if (allFactors.length === 0) return 2.5;

  // 收益率分位数（越大越好）
  const returns365d = allFactors.map((f) => f.return365d).filter((v) => !isNaN(v) && isFinite(v));
  const returnPercentile = getPercentile(factors.return365d, returns365d);

  // 波动率分位数（越小越好，所以取反）
  const volatilities = allFactors.map((f) => f.volatility180d).filter((v) => !isNaN(v) && isFinite(v));
  const volatilityPercentile = 1 - getPercentile(factors.volatility180d, volatilities);

  // 加权平均
  return (returnPercentile * 0.7 + volatilityPercentile * 0.3) * 5;
}

/**
 * 计算流动性得分
 */
function calculateLiquidityScore(factors: RawFactors, allFactors: RawFactors[]): number {
  if (allFactors.length === 0) return 2.5;

  // volumeToMarketCapRatio 分位数（越大越好）
  const volumeRatios = allFactors.map((f) => f.volumeToMarketCapRatio).filter((v) => !isNaN(v) && isFinite(v));
  const volumeRatioPercentile = getPercentile(factors.volumeToMarketCapRatio, volumeRatios);

  // avgDailyVolume30d 分位数（越大越好）
  const avgVolumes = allFactors.map((f) => f.avgDailyVolume30d).filter((v) => !isNaN(v) && isFinite(v));
  const avgVolumePercentile = getPercentile(factors.avgDailyVolume30d, avgVolumes);

  // 加权平均
  return (volumeRatioPercentile * 0.5 + avgVolumePercentile * 0.5) * 5;
}

/**
 * 计算风险得分（风险越低得分越高）
 */
function calculateRiskScore(factors: RawFactors, allFactors: RawFactors[]): number {
  if (allFactors.length === 0) return 2.5;

  // 波动率分位数（越小越好，所以取反）
  const volatilities = allFactors.map((f) => f.volatility365d).filter((v) => !isNaN(v) && isFinite(v));
  const volatilityPercentile = 1 - getPercentile(factors.volatility365d, volatilities);

  // 最大回撤分位数（越小越好，所以取反）
  const drawdowns = allFactors.map((f) => f.maxDrawdown365d).filter((v) => !isNaN(v) && isFinite(v));
  const drawdownPercentile = 1 - getPercentile(factors.maxDrawdown365d, drawdowns);

  // 加权平均
  return (volatilityPercentile * 0.5 + drawdownPercentile * 0.5) * 5;
}

/**
 * 计算分位数（0-1）
 */
function getPercentile(value: number, array: number[]): number {
  if (array.length === 0) return 0.5;
  if (array.length === 1) return value >= array[0] ? 1 : 0;

  const sorted = [...array].sort((a, b) => a - b);
  const index = sorted.findIndex((v) => v >= value);
  
  if (index === -1) return 1; // 值大于所有元素
  if (index === 0) return value <= sorted[0] ? 0 : 0.01;
  
  // 线性插值
  const lower = sorted[index - 1];
  const upper = sorted[index];
  if (upper === lower) return index / sorted.length;
  
  const ratio = (value - lower) / (upper - lower);
  return (index - 1 + ratio) / sorted.length;
}




