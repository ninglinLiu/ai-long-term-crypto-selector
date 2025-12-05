/**
 * 因子定义
 * 定义所有用于长期投资的因子及其含义
 */

/**
 * 原始因子值（计算后的原始数值）
 */
export interface RawFactors {
  // 估值因子
  logMarketCap: number; // log(市值)
  fdvToMarketCapRatio: number; // FDV / MarketCap（稀释风险）
  priceToHigh365d: number; // 当前价格 / 过去 365 天最高价（折价程度）

  // 动量因子
  return90d: number; // 90 天收益率
  return180d: number; // 180 天收益率
  return365d: number; // 365 天收益率
  volatility90d: number; // 90 天波动率
  volatility180d: number; // 180 天波动率

  // 流动性因子
  volumeToMarketCapRatio: number; // 24h 成交量 / 市值
  avgDailyVolume30d: number; // 过去 30 天平均日成交量

  // 风险因子
  volatility365d: number; // 365 天波动率
  maxDrawdown365d: number; // 过去 365 天最大回撤
}

/**
 * 因子得分（标准化后的 0-5 分）
 */
export interface FactorScores {
  valuationScore: number; // 估值得分 (0-5)
  momentumScore: number; // 动量得分 (0-5)
  liquidityScore: number; // 流动性得分 (0-5)
  riskScore: number; // 风险得分 (0-5，风险越低得分越高)
  totalScore: number; // 总分 (0-5)
}

/**
 * 因子计算参数
 */
export interface FactorCalculationParams {
  // 收益率计算窗口（天数）
  returnWindows: {
    short: number; // 90 天
    medium: number; // 180 天
    long: number; // 365 天
  };
  // 波动率计算窗口（天数）
  volatilityWindows: {
    short: number; // 90 天
    medium: number; // 180 天
    long: number; // 365 天
  };
  // 流动性计算窗口（天数）
  liquidityWindow: number; // 30 天
}

/**
 * 默认因子计算参数
 */
export const DEFAULT_FACTOR_PARAMS: FactorCalculationParams = {
  returnWindows: {
    short: 90,
    medium: 180,
    long: 365,
  },
  volatilityWindows: {
    short: 90,
    medium: 180,
    long: 365,
  },
  liquidityWindow: 30,
};

/**
 * 因子说明文档
 */
export const FACTOR_DESCRIPTIONS = {
  valuation: {
    logMarketCap: '市值对数，反映资产规模',
    fdvToMarketCapRatio: '完全稀释估值/市值，反映代币稀释风险（越小越好）',
    priceToHigh365d: '当前价格/365天最高价，反映折价程度（越大越好）',
  },
  momentum: {
    return90d: '90天收益率，反映短期趋势',
    return180d: '180天收益率，反映中期趋势',
    return365d: '365天收益率，反映长期趋势',
    volatility90d: '90天波动率，反映短期波动',
    volatility180d: '180天波动率，反映中期波动',
  },
  liquidity: {
    volumeToMarketCapRatio: '24h成交量/市值，反映交易活跃度',
    avgDailyVolume30d: '30天平均日成交量，反映持续流动性',
  },
  risk: {
    volatility365d: '365天波动率，反映长期波动风险',
    maxDrawdown365d: '365天最大回撤，反映下行风险',
  },
};




