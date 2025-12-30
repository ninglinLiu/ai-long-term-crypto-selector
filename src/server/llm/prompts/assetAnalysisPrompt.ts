/**
 * 单个资产分析 Prompt
 * 用于生成单个资产的 AI 分析报告
 */

import { FactorScores, RawFactors } from '../../factors/factorDefinitions';

export interface AssetAnalysisInput {
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap?: number;
  volume24h?: number;
  scores: FactorScores;
  rawFactors: RawFactors;
  historicalReturns?: {
    return90d: number;
    return180d: number;
    return365d: number;
  };
}

/**
 * 生成资产分析的 Prompt
 */
export function buildAssetAnalysisPrompt(input: AssetAnalysisInput): string {
  const {
    symbol,
    name,
    currentPrice,
    marketCap,
    volume24h,
    scores,
    rawFactors,
    historicalReturns,
  } = input;

  const marketCapStr = marketCap
    ? `$${(marketCap / 1e9).toFixed(2)}B`
    : '未知';
  const volumeStr = volume24h
    ? `$${(volume24h / 1e6).toFixed(2)}M`
    : '未知';

  const returnsStr = historicalReturns
    ? `
- 90天收益率: ${(historicalReturns.return90d * 100).toFixed(2)}%
- 180天收益率: ${(historicalReturns.return180d * 100).toFixed(2)}%
- 365天收益率: ${(historicalReturns.return365d * 100).toFixed(2)}%`
    : '';

  return `请分析以下加密货币资产，提供专业的投资建议：

## 资产基本信息
- 名称: ${name} (${symbol})
- 当前价格: $${currentPrice.toFixed(4)}
- 市值: ${marketCapStr}
- 24h 成交量: ${volumeStr}${returnsStr}

## 因子得分（0-5分）
- **估值得分**: ${scores.valuationScore.toFixed(2)}/5.0
  - log(市值): ${rawFactors.logMarketCap.toFixed(2)}
  - FDV/市值比: ${rawFactors.fdvToMarketCapRatio.toFixed(2)}
  - 价格/365天高点: ${(rawFactors.priceToHigh365d * 100).toFixed(2)}%

- **动量得分**: ${scores.momentumScore.toFixed(2)}/5.0
  - 90天波动率: ${(rawFactors.volatility90d * 100).toFixed(2)}%
  - 180天波动率: ${(rawFactors.volatility180d * 100).toFixed(2)}%

- **流动性得分**: ${scores.liquidityScore.toFixed(2)}/5.0
  - 成交量/市值比: ${(rawFactors.volumeToMarketCapRatio * 100).toFixed(2)}%
  - 30天平均成交量: $${(rawFactors.avgDailyVolume30d / 1e6).toFixed(2)}M

- **风险得分**: ${scores.riskScore.toFixed(2)}/5.0（风险越低得分越高）
  - 365天波动率: ${(rawFactors.volatility365d * 100).toFixed(2)}%
  - 最大回撤: ${(rawFactors.maxDrawdown365d * 100).toFixed(2)}%

- **总分**: ${scores.totalScore.toFixed(2)}/5.0

## 分析要求

请从以下角度提供分析：

1. **综合评估**：基于因子得分，评估该资产的长期投资价值
2. **优势分析**：指出该资产的主要优势（估值、动量、流动性、风险等方面）
3. **风险提示**：识别主要风险因素，特别是波动率和回撤风险
4. **投资建议**：给出是否适合长期持有的建议，以及建议的配置比例
5. **市场展望**：简要分析该资产在当前市场环境下的表现预期

请用中文回答，语言专业但易懂，适合长期投资者阅读。`;
}








