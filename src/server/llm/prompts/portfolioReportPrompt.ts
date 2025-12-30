/**
 * 组合报告 Prompt
 * 用于生成整体投资组合的 AI 分析报告
 */

import { PortfolioSuggestionResult } from '../../strategy/portfolio';

/**
 * 生成组合报告的 Prompt
 */
export function buildPortfolioReportPrompt(
  portfolio: PortfolioSuggestionResult,
  marketContext?: {
    totalMarketCap?: number;
    btcDominance?: number;
    marketSentiment?: string;
  }
): string {
  const { date, allocations, summary } = portfolio;

  // 构建资产列表
  const assetList = allocations
    .map(
      (alloc) =>
        `- **${alloc.symbol}** (${alloc.name}): ${(alloc.adjustedWeight * 100).toFixed(1)}% ` +
        `(得分: ${alloc.totalScore.toFixed(2)}/5.0)`
    )
    .join('\n');

  // 按权重排序
  const topHoldings = allocations
    .sort((a, b) => b.adjustedWeight - a.adjustedWeight)
    .slice(0, 5)
    .map((a) => `${a.symbol} (${(a.adjustedWeight * 100).toFixed(1)}%)`)
    .join(', ');

  const marketContextStr = marketContext
    ? `
## 市场环境
- 总市值: ${marketContext.totalMarketCap ? `$${(marketContext.totalMarketCap / 1e12).toFixed(2)}T` : '未知'}
- BTC 主导地位: ${marketContext.btcDominance ? `${marketContext.btcDominance.toFixed(2)}%` : '未知'}
- 市场情绪: ${marketContext.marketSentiment || '中性'}`
    : '';

  return `请生成一份专业的加密货币投资组合分析报告。

## 组合概览
- **生成日期**: ${date.toISOString().split('T')[0]}
- **资产池总数**: ${summary.totalAssets} 个
- **选中资产数**: ${summary.selectedAssets} 个
- **平均得分**: ${summary.averageScore.toFixed(2)}/5.0
- **总配置权重**: ${(portfolio.adjustedTotalWeight * 100).toFixed(1)}%
- **前5大持仓**: ${topHoldings}${marketContextStr}

## 资产配置详情
${assetList}

## 报告要求

请生成一份 Markdown 格式的投资组合分析报告，包含以下部分：

### 1. 执行摘要
- 简要总结本次组合建议的核心观点
- 整体配置策略（集中/分散、风险偏好等）

### 2. 组合分析
- 分析当前配置的合理性
- 权重分配的考量（为什么某些资产权重更高）
- 组合的分散化程度

### 3. 资产点评
- 对主要持仓（权重 > 2%）进行简要点评
- 说明选择这些资产的理由

### 4. 风险提示
- 组合层面的风险（集中度风险、相关性风险等）
- 市场整体风险提示

### 5. 投资建议
- 本次调仓建议（如有）
- 长期持有策略建议
- 后续关注要点

### 6. 市场展望
- 对加密货币市场的整体看法
- 关键风险因素和机会

请用中文撰写，语言专业、客观，适合长期投资者阅读。报告应具有可操作性，避免过于技术化的术语。`;
}








