/**
 * 数据更新脚本
 * 拉取白名单资产的最新行情数据并写入数据库
 */

import { prisma } from '../src/server/db/client';
import { CryptoDataProvider } from '../src/server/data-providers/crypto/CryptoDataProvider';
import { getAllAssetInfos } from '../src/server/constants/assets';

async function updateData() {
  console.log('🚀 开始更新数据...\n');

  const dataProvider = new CryptoDataProvider();
  const assetInfos = getAllAssetInfos();

  // 1. 确保所有资产在数据库中存在
  console.log('📋 检查资产记录...');
  for (const assetInfo of assetInfos) {
    const existing = await prisma.asset.findUnique({
      where: { symbol: assetInfo.symbol },
    });

    if (!existing) {
      await prisma.asset.create({
        data: {
          symbol: assetInfo.symbol,
          name: assetInfo.name,
          assetClass: assetInfo.assetClass,
          dataSourceId: assetInfo.dataSourceId,
        },
      });
      console.log(`  ✅ 创建资产记录: ${assetInfo.symbol} (${assetInfo.name})`);
    } else {
      // 更新数据源 ID（以防有变化）
      if (existing.dataSourceId !== assetInfo.dataSourceId) {
        await prisma.asset.update({
          where: { id: existing.id },
          data: { dataSourceId: assetInfo.dataSourceId },
        });
        console.log(`  🔄 更新资产数据源 ID: ${assetInfo.symbol}`);
      }
    }
  }

  // 2. 获取所有资产记录
  const assets = await prisma.asset.findMany({
    where: {
      symbol: { in: assetInfos.map((a) => a.symbol) },
    },
  });

  console.log(`\n📊 开始拉取 ${assets.length} 个资产的数据...\n`);

  // 3. 对每个资产拉取历史数据（最近 365 天）
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  let successCount = 0;
  let errorCount = 0;

  for (const asset of assets) {
    try {
      console.log(`📈 处理 ${asset.symbol} (${asset.name})...`);

      // 获取历史数据
      const historicalData = await dataProvider.fetchHistoricalData(
        asset.dataSourceId,
        oneYearAgo,
        today
      );

      if (historicalData.length === 0) {
        console.log(`  ⚠️  未获取到历史数据`);
        errorCount++;
        continue;
      }

      // 获取当前市场数据（用于最新日期）
      let currentMarketData;
      try {
        currentMarketData = await dataProvider.fetchCurrentMarketData(asset.dataSourceId);
      } catch (err) {
        console.log(`  ⚠️  获取当前市场数据失败，仅使用历史数据`);
      }

      // 批量插入/更新日线数据
      let insertedCount = 0;
      let updatedCount = 0;

      for (const data of historicalData) {
        const date = new Date(data.date);
        date.setHours(0, 0, 0, 0);

        const existing = await prisma.dailyMarketData.findUnique({
          where: {
            assetId_date: {
              assetId: asset.id,
              date,
            },
          },
        });

        if (existing) {
          await prisma.dailyMarketData.update({
            where: { id: existing.id },
            data: {
              price: data.price,
              marketCap: data.marketCap,
              volume: data.volume,
              fdv: data.fdv,
              high: data.high,
              low: data.low,
              open: data.open,
            },
          });
          updatedCount++;
        } else {
          await prisma.dailyMarketData.create({
            data: {
              assetId: asset.id,
              date,
              price: data.price,
              marketCap: data.marketCap,
              volume: data.volume,
              fdv: data.fdv,
              high: data.high,
              low: data.low,
              open: data.open,
            },
          });
          insertedCount++;
        }
      }

      // 如果有当前市场数据，更新最新日期
      if (currentMarketData) {
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);

        const existingToday = await prisma.dailyMarketData.findUnique({
          where: {
            assetId_date: {
              assetId: asset.id,
              date: todayDate,
            },
          },
        });

        if (existingToday) {
          await prisma.dailyMarketData.update({
            where: { id: existingToday.id },
            data: {
              price: currentMarketData.price,
              marketCap: currentMarketData.marketCap,
              volume: currentMarketData.volume24h,
              fdv: currentMarketData.fdv,
              high: currentMarketData.high24h,
              low: currentMarketData.low24h,
            },
          });
        } else {
          await prisma.dailyMarketData.create({
            data: {
              assetId: asset.id,
              date: todayDate,
              price: currentMarketData.price,
              marketCap: currentMarketData.marketCap,
              volume: currentMarketData.volume24h,
              fdv: currentMarketData.fdv,
              high: currentMarketData.high24h,
              low: currentMarketData.low24h,
            },
          });
        }
      }

      console.log(
        `  ✅ 完成: 新增 ${insertedCount} 条，更新 ${updatedCount} 条，总计 ${historicalData.length} 条数据`
      );
      successCount++;

      // 避免请求过快，添加延迟（CoinGecko 免费版限制：每分钟约 10-50 次）
      // 设置为 6 秒延迟，确保不超过速率限制
      await new Promise((resolve) => setTimeout(resolve, 6000));
    } catch (error: any) {
      console.error(`  ❌ 处理失败: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n✨ 数据更新完成！`);
  console.log(`  成功: ${successCount} 个资产`);
  console.log(`  失败: ${errorCount} 个资产`);

  await prisma.$disconnect();
}

// 运行脚本
updateData().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
