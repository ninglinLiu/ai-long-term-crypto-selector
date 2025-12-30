/**
 * 组合建议生成
 * 根据因子得分生成投资组合建议
 */

import { prisma } from '../db/client';
import { FactorScores } from '../factors/factorDefinitions';
import {
  calculateTargetWeight,
  generateWeightAllocation,
  DEFAULT_SCORING_RULES,
  WeightAllocationResult,
} from './scoring';

/**
 * 组合建议结果
 */
export interface PortfolioSuggestionResult {
  date: Date;
  allocations: Array<{
    assetId: string;
    symbol: string;
    name: string;
    totalScore: number;
    targetWeight: number;
    adjustedWeight: number;
  }>;
  totalWeight: number;
  adjustedTotalWeight: number;
  summary: {
    totalAssets: number;
    selectedAssets: number;
    averageScore: number;
  };
}

/**
 * 生成组合建议
 * @param date 建议日期（默认使用最新因子快照的日期）
 */
export async function generatePortfolioSuggestion(
  date?: Date
): Promise<PortfolioSuggestionResult> {
  // 如果没有指定日期，使用最新因子快照的日期
  if (!date) {
    const latestSnapshot = await prisma.factorSnapshot.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (!latestSnapshot) {
      throw new Error('未找到因子快照数据，请先运行 recompute-factors');
    }

    date = new Date(latestSnapshot.date);
    date.setHours(0, 0, 0, 0);
  } else {
    date = new Date(date);
    date.setHours(0, 0, 0, 0);
  }

  console.log(`📊 生成组合建议，日期: ${date.toISOString().split('T')[0]}`);

  // 获取该日期的所有因子快照
  const snapshots = await prisma.factorSnapshot.findMany({
    where: { date },
    include: {
      asset: {
        select: {
          id: true,
          symbol: true,
          name: true,
        },
      },
    },
  });

  if (snapshots.length === 0) {
    throw new Error(`未找到日期 ${date.toISOString().split('T')[0]} 的因子快照`);
  }

  // 构建资产得分数组
  const assetScores = snapshots.map((snapshot) => ({
    assetId: snapshot.assetId,
    scores: {
      valuationScore: snapshot.valuationScore,
      momentumScore: snapshot.momentumScore,
      liquidityScore: snapshot.liquidityScore,
      riskScore: snapshot.riskScore,
      totalScore: snapshot.totalScore,
    } as FactorScores,
  }));

  // 生成权重分配
  const weightAllocation = generateWeightAllocation(assetScores, DEFAULT_SCORING_RULES);

  // 构建结果
  const allocations = snapshots
    .map((snapshot) => {
      const targetWeight = calculateTargetWeight(
        {
          valuationScore: snapshot.valuationScore,
          momentumScore: snapshot.momentumScore,
          liquidityScore: snapshot.liquidityScore,
          riskScore: snapshot.riskScore,
          totalScore: snapshot.totalScore,
        },
        DEFAULT_SCORING_RULES
      );
      const adjustedWeight = weightAllocation.adjustedWeights.get(snapshot.assetId) || 0;

      return {
        assetId: snapshot.assetId,
        symbol: snapshot.asset.symbol,
        name: snapshot.asset.name,
        totalScore: snapshot.totalScore,
        targetWeight,
        adjustedWeight,
      };
    })
    .filter((a) => a.targetWeight > 0) // 只包含有权重的资产
    .sort((a, b) => b.totalScore - a.totalScore); // 按总分降序排序

  // 计算统计信息
  const selectedAssets = allocations.length;
  const averageScore =
    allocations.length > 0
      ? allocations.reduce((sum, a) => sum + a.totalScore, 0) / allocations.length
      : 0;

  // 保存到数据库
  await savePortfolioSuggestionToDB(date, allocations);

  return {
    date,
    allocations,
    totalWeight: weightAllocation.totalWeight,
    adjustedTotalWeight: Array.from(weightAllocation.adjustedWeights.values()).reduce(
      (sum, w) => sum + w,
      0
    ),
    summary: {
      totalAssets: snapshots.length,
      selectedAssets,
      averageScore,
    },
  };
}

/**
 * 保存组合建议到数据库
 */
async function savePortfolioSuggestionToDB(
  date: Date,
  allocations: Array<{
    assetId: string;
    targetWeight: number;
    adjustedWeight: number;
  }>
): Promise<void> {
  for (const allocation of allocations) {
    const existing = await prisma.portfolioSuggestion.findUnique({
      where: {
        assetId_date: {
          assetId: allocation.assetId,
          date,
        },
      },
    });

    if (existing) {
      await prisma.portfolioSuggestion.update({
        where: { id: existing.id },
        data: {
          targetWeight: allocation.adjustedWeight, // 使用调整后的权重
        },
      });
    } else {
      await prisma.portfolioSuggestion.create({
        data: {
          assetId: allocation.assetId,
          date,
          targetWeight: allocation.adjustedWeight,
        },
      });
    }
  }
}

/**
 * 获取最新的组合建议
 */
export async function getLatestPortfolioSuggestion(): Promise<PortfolioSuggestionResult | null> {
  const latestSuggestion = await prisma.portfolioSuggestion.findFirst({
    orderBy: { date: 'desc' },
    include: {
      asset: {
        select: {
          id: true,
          symbol: true,
          name: true,
        },
      },
    },
  });

  if (!latestSuggestion) {
    return null;
  }

  const date = new Date(latestSuggestion.date);
  date.setHours(0, 0, 0, 0);

  // 获取该日期的所有建议
  const suggestions = await prisma.portfolioSuggestion.findMany({
    where: { date },
    include: {
      asset: {
        select: {
          id: true,
          symbol: true,
          name: true,
        },
      },
    },
  });

  // 获取对应的因子快照
  const snapshots = await prisma.factorSnapshot.findMany({
    where: {
      date,
      assetId: { in: suggestions.map((s) => s.assetId) },
    },
  });

  const snapshotMap = new Map(snapshots.map((s) => [s.assetId, s]));

  const allocations = suggestions
    .map((suggestion) => {
      const snapshot = snapshotMap.get(suggestion.assetId);
      return {
        assetId: suggestion.assetId,
        symbol: suggestion.asset.symbol,
        name: suggestion.asset.name,
        totalScore: snapshot?.totalScore || 0,
        targetWeight: suggestion.targetWeight,
        adjustedWeight: suggestion.targetWeight,
      };
    })
    .filter((a) => a.targetWeight > 0)
    .sort((a, b) => b.totalScore - a.totalScore);

  const totalWeight = allocations.reduce((sum, a) => sum + a.adjustedWeight, 0);
  const averageScore =
    allocations.length > 0
      ? allocations.reduce((sum, a) => sum + a.totalScore, 0) / allocations.length
      : 0;

  return {
    date,
    allocations,
    totalWeight,
    adjustedTotalWeight: totalWeight,
    summary: {
      totalAssets: suggestions.length,
      selectedAssets: allocations.length,
      averageScore,
    },
  };
}








