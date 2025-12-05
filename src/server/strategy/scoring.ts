/**
 * 评分策略
 * 定义如何从因子得分计算最终评分和权重建议
 */

import { FactorScores } from '../factors/factorDefinitions';

/**
 * 评分规则配置
 */
export interface ScoringRules {
  // 总分阈值对应的权重
  weightThresholds: Array<{
    minScore: number; // 最小总分（包含）
    maxScore?: number; // 最大总分（不包含，如果未设置则无上限）
    targetWeight: number; // 目标权重（0-1，如 0.04 表示 4%）
  }>;
  // 是否允许负权重（做空）
  allowNegativeWeights: boolean;
  // 最小权重（低于此值则设为 0）
  minWeightThreshold: number;
}

/**
 * 默认评分规则
 */
export const DEFAULT_SCORING_RULES: ScoringRules = {
  weightThresholds: [
    { minScore: 4.0, targetWeight: 0.04 }, // 总分 ≥ 4.0 → 4%
    { minScore: 3.5, maxScore: 4.0, targetWeight: 0.02 }, // 3.5 ≤ 总分 < 4.0 → 2%
    { minScore: 3.0, maxScore: 3.5, targetWeight: 0.01 }, // 3.0 ≤ 总分 < 3.5 → 1%
    { minScore: 0, maxScore: 3.0, targetWeight: 0 }, // 总分 < 3.0 → 0%（不持有）
  ],
  allowNegativeWeights: false,
  minWeightThreshold: 0.005, // 0.5%，低于此值设为 0
};

/**
 * 根据因子得分计算目标权重
 */
export function calculateTargetWeight(
  scores: FactorScores,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): number {
  const totalScore = scores.totalScore;

  // 找到匹配的阈值规则
  for (const threshold of rules.weightThresholds) {
    if (totalScore >= threshold.minScore) {
      if (threshold.maxScore === undefined || totalScore < threshold.maxScore) {
        let weight = threshold.targetWeight;

        // 如果不允许负权重，确保权重 >= 0
        if (!rules.allowNegativeWeights && weight < 0) {
          weight = 0;
        }

        // 如果权重低于最小阈值，设为 0
        if (weight < rules.minWeightThreshold) {
          weight = 0;
        }

        return weight;
      }
    }
  }

  // 如果没有匹配的规则，返回 0
  return 0;
}

/**
 * 权重分配策略
 * 确保所有权重之和不超过 1.0（100%）
 */
export interface WeightAllocationResult {
  assetWeights: Map<string, number>; // assetId -> weight
  totalWeight: number;
  adjustedWeights: Map<string, number>; // 调整后的权重（归一化）
}

/**
 * 归一化权重分配
 * 如果总权重超过 1.0，按比例缩放
 */
export function normalizeWeights(
  assetWeights: Map<string, number>,
  maxTotalWeight: number = 1.0
): WeightAllocationResult {
  const totalWeight = Array.from(assetWeights.values()).reduce((sum, w) => sum + w, 0);

  const adjustedWeights = new Map<string, number>();

  if (totalWeight > maxTotalWeight) {
    // 按比例缩放
    const scale = maxTotalWeight / totalWeight;
    for (const [assetId, weight] of assetWeights.entries()) {
      adjustedWeights.set(assetId, weight * scale);
    }
  } else {
    // 直接使用原权重
    for (const [assetId, weight] of assetWeights.entries()) {
      adjustedWeights.set(assetId, weight);
    }
  }

  return {
    assetWeights,
    totalWeight,
    adjustedWeights,
  };
}

/**
 * 生成权重分配建议
 */
export function generateWeightAllocation(
  assetScores: Array<{ assetId: string; scores: FactorScores }>,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): WeightAllocationResult {
  const assetWeights = new Map<string, number>();

  // 计算每个资产的目标权重
  for (const { assetId, scores } of assetScores) {
    const weight = calculateTargetWeight(scores, rules);
    if (weight > 0) {
      assetWeights.set(assetId, weight);
    }
  }

  // 归一化权重
  return normalizeWeights(assetWeights);
}




