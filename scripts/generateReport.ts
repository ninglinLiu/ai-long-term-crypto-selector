/**
 * 报告生成脚本
 * 调用 DeepSeek 生成 AI 分析报告
 */

import { prisma } from '../src/server/db/client';
import { getDeepSeekClient } from '../src/server/llm/deepseekClient';
import { buildAssetAnalysisPrompt } from '../src/server/llm/prompts/assetAnalysisPrompt';
import { buildPortfolioReportPrompt } from '../src/server/llm/prompts/portfolioReportPrompt';
import { getLatestPortfolioSuggestion, generatePortfolioSuggestion } from '../src/server/strategy/portfolio';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

async function generateReport() {
  console.log('📝 开始生成报告...\n');

  // 检查 DeepSeek API Key
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ 错误: DEEPSEEK_API_KEY 环境变量未设置');
    process.exit(1);
  }

  try {
    const deepSeekClient = getDeepSeekClient();

    // 1. 获取或生成最新的组合建议
    console.log('📊 获取组合建议...');
    let portfolio = await getLatestPortfolioSuggestion();

    if (!portfolio) {
      console.log('  未找到组合建议，正在生成...');
      portfolio = await generatePortfolioSuggestion();
    }

    console.log(`  ✅ 组合建议已就绪 (${portfolio.summary.selectedAssets} 个资产)`);

    // 2. 生成组合整体报告
    console.log('\n🤖 生成组合分析报告...');
    const portfolioPrompt = buildPortfolioReportPrompt(portfolio);
    
    const portfolioReport = await deepSeekClient.chat([
      {
        role: 'system',
        content: '你是一位资深的加密货币投资顾问，擅长长期投资策略和风险分析。',
      },
      {
        role: 'user',
        content: portfolioPrompt,
      },
    ]);

    console.log('  ✅ 组合报告生成完成');

    // 3. （可选）生成单个资产分析
    const generateAssetAnalysis = process.env.GENERATE_ASSET_ANALYSIS === 'true';
    const assetAnalyses: Array<{ symbol: string; analysis: string }> = [];

    if (generateAssetAnalysis) {
      console.log('\n📈 生成单个资产分析...');
      
      for (const allocation of portfolio.allocations.slice(0, 5)) {
        // 只分析前5个资产，避免 API 调用过多
        try {
          console.log(`  分析 ${allocation.symbol}...`);

          // 获取资产的最新数据
          const asset = await prisma.asset.findUnique({
            where: { id: allocation.assetId },
            include: {
              dailyMarketData: {
                orderBy: { date: 'desc' },
                take: 1,
              },
              factorSnapshots: {
                where: { date: portfolio.date },
                take: 1,
              },
            },
          });

          if (!asset || asset.factorSnapshots.length === 0) {
            console.log(`    ⚠️  跳过 ${allocation.symbol}（数据不足）`);
            continue;
          }

          const snapshot = asset.factorSnapshots[0];
          const latestData = asset.dailyMarketData[0];

          const rawFactors = snapshot.rawFactors
            ? JSON.parse(snapshot.rawFactors)
            : {};

          const prompt = buildAssetAnalysisPrompt({
            symbol: asset.symbol,
            name: asset.name,
            currentPrice: latestData.price,
            marketCap: latestData.marketCap || undefined,
            volume24h: latestData.volume || undefined,
            scores: {
              valuationScore: snapshot.valuationScore,
              momentumScore: snapshot.momentumScore,
              liquidityScore: snapshot.liquidityScore,
              riskScore: snapshot.riskScore,
              totalScore: snapshot.totalScore,
            },
            rawFactors,
            historicalReturns: {
              return90d: rawFactors.return90d || 0,
              return180d: rawFactors.return180d || 0,
              return365d: rawFactors.return365d || 0,
            },
          });

          const analysis = await deepSeekClient.chat([
            {
              role: 'system',
              content: '你是一位资深的加密货币分析师，擅长从多维度评估资产的投资价值。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ]);

          assetAnalyses.push({
            symbol: asset.symbol,
            analysis,
          });

          console.log(`    ✅ ${allocation.symbol} 分析完成`);

          // 避免请求过快
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.error(`    ❌ ${allocation.symbol} 分析失败: ${error.message}`);
        }
      }
    }

    // 4. 生成完整的 Markdown 报告
    const reportDate = portfolio.date.toISOString().split('T')[0];
    const reportContent = generateMarkdownReport(
      reportDate,
      portfolio,
      portfolioReport,
      assetAnalyses
    );

    // 5. 保存报告
    const reportsDir = join(process.cwd(), 'reports');
    if (!existsSync(reportsDir)) {
      await mkdir(reportsDir, { recursive: true });
    }

    const reportPath = join(reportsDir, `portfolio-${reportDate}.md`);
    await writeFile(reportPath, reportContent, 'utf-8');

    console.log(`\n✨ 报告生成完成！`);
    console.log(`  保存路径: ${reportPath}`);
    console.log(`  组合报告: ${portfolioReport.length} 字符`);
    if (assetAnalyses.length > 0) {
      console.log(`  资产分析: ${assetAnalyses.length} 个`);
    }

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ 报告生成失败:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

/**
 * 生成 Markdown 格式的完整报告
 */
function generateMarkdownReport(
  date: string,
  portfolio: Awaited<ReturnType<typeof getLatestPortfolioSuggestion>>,
  portfolioReport: string,
  assetAnalyses: Array<{ symbol: string; analysis: string }>
): string {
  if (!portfolio) {
    return '# 报告生成失败\n\n未找到组合数据。';
  }

  let content = `# 投资组合分析报告\n\n`;
  content += `**生成日期**: ${date}\n\n`;
  content += `---\n\n`;

  // 组合概览
  content += `## 📊 组合概览\n\n`;
  content += `- **资产池总数**: ${portfolio.summary.totalAssets} 个\n`;
  content += `- **选中资产数**: ${portfolio.summary.selectedAssets} 个\n`;
  content += `- **平均得分**: ${portfolio.summary.averageScore.toFixed(2)}/5.0\n`;
  content += `- **总配置权重**: ${(portfolio.adjustedTotalWeight * 100).toFixed(1)}%\n\n`;

  // 资产配置表
  content += `### 资产配置详情\n\n`;
  content += `| 资产 | 名称 | 权重 | 得分 |\n`;
  content += `|------|------|------|------|\n`;
  for (const alloc of portfolio.allocations) {
    content += `| ${alloc.symbol} | ${alloc.name} | ${(alloc.adjustedWeight * 100).toFixed(1)}% | ${alloc.totalScore.toFixed(2)}/5.0 |\n`;
  }
  content += `\n---\n\n`;

  // AI 组合分析
  content += `## 🤖 AI 组合分析\n\n`;
  content += portfolioReport;
  content += `\n\n---\n\n`;

  // 单个资产分析
  if (assetAnalyses.length > 0) {
    content += `## 📈 重点资产分析\n\n`;
    for (const { symbol, analysis } of assetAnalyses) {
      content += `### ${symbol}\n\n`;
      content += analysis;
      content += `\n\n---\n\n`;
    }
  }

  // 报告元信息
  content += `## 📝 报告说明\n\n`;
  content += `- 本报告由 AI 自动生成，仅供参考，不构成投资建议。\n`;
  content += `- 因子得分基于历史数据计算，未来表现可能有所不同。\n`;
  content += `- 投资有风险，请谨慎决策。\n`;

  return content;
}

// 运行脚本
generateReport().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
