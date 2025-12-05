/**
 * 因子重算脚本
 * 从最新市场数据计算因子得分并写入数据库
 */

import { prisma } from '../src/server/db/client';
import { computeRawFactors, normalizeFactorScores } from '../src/server/factors/computeFactors';
import { RawFactors } from '../src/server/factors/factorDefinitions';
import { getAllAssetInfos } from '../src/server/constants/assets';

async function recomputeFactors() {
  console.log('🧮 开始重算因子...\n');

  // 获取所有资产
  const assetInfos = getAllAssetInfos();
  const assets = await prisma.asset.findMany({
    where: {
      symbol: { in: assetInfos.map((a) => a.symbol) },
    },
  });

  if (assets.length === 0) {
    console.log('⚠️  未找到资产记录，请先运行 update-data');
    await prisma.$disconnect();
    return;
  }

  console.log(`📊 处理 ${assets.length} 个资产...\n`);

  // 计算日期（使用最新有数据的日期）
  const latestData = await prisma.dailyMarketData.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  if (!latestData) {
    console.log('⚠️  未找到市场数据，请先运行 update-data');
    await prisma.$disconnect();
    return;
  }

  const calculationDate = new Date(latestData.date);
  calculationDate.setHours(0, 0, 0, 0);

  console.log(`📅 计算日期: ${calculationDate.toISOString().split('T')[0]}\n`);

  // 第一步：计算所有资产的原始因子
  const allRawFactors: Array<{ assetId: string; factors: RawFactors }> = [];

  for (const asset of assets) {
    try {
      console.log(`📈 计算 ${asset.symbol} (${asset.name}) 的因子...`);
      const rawFactors = await computeRawFactors(asset.id, calculationDate);

      if (!rawFactors) {
        console.log(`  ⚠️  数据不足，跳过`);
        continue;
      }

      allRawFactors.push({ assetId: asset.id, factors: rawFactors });
      console.log(`  ✅ 完成`);
    } catch (error: any) {
      console.error(`  ❌ 计算失败: ${error.message}`);
    }
  }

  if (allRawFactors.length === 0) {
    console.log('⚠️  没有可用的因子数据');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📊 开始标准化得分（基于 ${allRawFactors.length} 个资产）...\n`);

  // 第二步：标准化得分（需要所有资产的因子用于分位数计算）
  const allFactorsArray = allRawFactors.map((item) => item.factors);
  let successCount = 0;
  let errorCount = 0;

  for (const { assetId, factors } of allRawFactors) {
    try {
      const asset = assets.find((a: { id: string }) => a.id === assetId);
      if (!asset) continue;

      console.log(`📊 标准化 ${asset.symbol} 的得分...`);

      const scores = normalizeFactorScores(factors, allFactorsArray);

      // 保存因子快照
      const existing = await prisma.factorSnapshot.findUnique({
        where: {
          assetId_date: {
            assetId,
            date: calculationDate,
          },
        },
      });

      const rawFactorsJson = JSON.stringify(factors);

      if (existing) {
        await prisma.factorSnapshot.update({
          where: { id: existing.id },
          data: {
            valuationScore: scores.valuationScore,
            momentumScore: scores.momentumScore,
            liquidityScore: scores.liquidityScore,
            riskScore: scores.riskScore,
            totalScore: scores.totalScore,
            rawFactors: rawFactorsJson,
          },
        });
        console.log(`  ✅ 更新因子快照`);
      } else {
        await prisma.factorSnapshot.create({
          data: {
            assetId,
            date: calculationDate,
            valuationScore: scores.valuationScore,
            momentumScore: scores.momentumScore,
            liquidityScore: scores.liquidityScore,
            riskScore: scores.riskScore,
            totalScore: scores.totalScore,
            rawFactors: rawFactorsJson,
          },
        });
        console.log(`  ✅ 创建因子快照`);
      }

      console.log(
        `    估值得分: ${scores.valuationScore.toFixed(2)}, ` +
        `动量得分: ${scores.momentumScore.toFixed(2)}, ` +
        `流动性得分: ${scores.liquidityScore.toFixed(2)}, ` +
        `风险得分: ${scores.riskScore.toFixed(2)}, ` +
        `总分: ${scores.totalScore.toFixed(2)}`
      );

      successCount++;
    } catch (error: any) {
      console.error(`  ❌ 保存失败: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n✨ 因子重算完成！`);
  console.log(`  成功: ${successCount} 个资产`);
  console.log(`  失败: ${errorCount} 个资产`);

  // 生成组合建议
  console.log(`\n💼 生成组合建议...`);
  try {
    const { generatePortfolioSuggestion } = await import('../src/server/strategy/portfolio');
    const portfolioResult = await generatePortfolioSuggestion(calculationDate);
    
    console.log(`  ✅ 组合建议生成完成`);
    console.log(`  选中资产: ${portfolioResult.summary.selectedAssets} / ${portfolioResult.summary.totalAssets}`);
    console.log(`  平均得分: ${portfolioResult.summary.averageScore.toFixed(2)}`);
    console.log(`  总权重: ${(portfolioResult.adjustedTotalWeight * 100).toFixed(1)}%`);
    console.log(`\n  权重分配:`);
    portfolioResult.allocations.forEach((alloc) => {
      console.log(
        `    ${alloc.symbol.padEnd(6)} ${(alloc.adjustedWeight * 100).toFixed(1).padStart(5)}% ` +
        `(得分: ${alloc.totalScore.toFixed(2)})`
      );
    });
  } catch (error: any) {
    console.error(`  ⚠️  生成组合建议失败: ${error.message}`);
  }

  await prisma.$disconnect();
}

// 运行脚本
recomputeFactors().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
