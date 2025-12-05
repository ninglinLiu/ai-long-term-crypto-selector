/**
 * 资产详情页
 * 展示单个资产的 K 线图、因子分析和 AI 解读
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PriceChart } from '@/components/PriceChart';
import { FactorRadarChart } from '@/components/FactorRadarChart';
import ReactMarkdown from 'react-markdown';

async function getAssetData(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/asset/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export default async function AssetDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const asset = await getAssetData(params.id);

  if (!asset) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              资产未找到
            </p>
            <div className="mt-4 text-center">
              <Link href="/">
                <Button variant="outline">返回首页</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2">
            {asset.symbol} - {asset.name}
          </h1>
          {asset.latestData && (
            <div className="text-2xl font-semibold text-muted-foreground">
              ${asset.latestData.price.toFixed(4)}
            </div>
          )}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="chart">价格走势</TabsTrigger>
            <TabsTrigger value="factors">因子分析</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>基本信息</CardTitle>
                </CardHeader>
                <CardContent>
                  {asset.latestData ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">当前价格</span>
                        <span className="font-semibold">
                          ${asset.latestData.price.toFixed(4)}
                        </span>
                      </div>
                      {asset.latestData.marketCap && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">市值</span>
                          <span>
                            ${(asset.latestData.marketCap / 1e9).toFixed(2)}B
                          </span>
                        </div>
                      )}
                      {asset.latestData.volume && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">24h 成交量</span>
                          <span>
                            ${(asset.latestData.volume / 1e6).toFixed(2)}M
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">建议权重</span>
                        <span className="font-semibold">
                          {asset.targetWeight > 0
                            ? `${(asset.targetWeight * 100).toFixed(1)}%`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">暂无数据</p>
                  )}
                </CardContent>
              </Card>

              {asset.scores && (
                <Card>
                  <CardHeader>
                    <CardTitle>因子得分</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">估值得分</span>
                        <span>{asset.scores.valuationScore.toFixed(2)}/5.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">动量得分</span>
                        <span>{asset.scores.momentumScore.toFixed(2)}/5.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">流动性得分</span>
                        <span>{asset.scores.liquidityScore.toFixed(2)}/5.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">风险得分</span>
                        <span>{asset.scores.riskScore.toFixed(2)}/5.0</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-semibold">总分</span>
                        <span className="font-bold text-lg">
                          {asset.scores.totalScore.toFixed(2)}/5.0
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="chart" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>价格走势</CardTitle>
                <CardDescription>最近 365 天的价格历史</CardDescription>
              </CardHeader>
              <CardContent>
                {asset.priceHistory && asset.priceHistory.length > 0 ? (
                  <PriceChart data={asset.priceHistory} />
                ) : (
                  <p className="text-muted-foreground">暂无价格数据</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="factors" className="space-y-4">
            {asset.scores && (
              <Card>
                <CardHeader>
                  <CardTitle>因子雷达图</CardTitle>
                  <CardDescription>多维度因子得分可视化</CardDescription>
                </CardHeader>
                <CardContent>
                  <FactorRadarChart scores={asset.scores} />
                </CardContent>
              </Card>
            )}

            {asset.rawFactors && (
              <Card>
                <CardHeader>
                  <CardTitle>原始因子值</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 text-sm">
                    <div>
                      <h4 className="font-semibold mb-2">估值因子</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">log(市值)</span>
                          <span>{asset.rawFactors.logMarketCap?.toFixed(2) || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">FDV/市值比</span>
                          <span>{asset.rawFactors.fdvToMarketCapRatio?.toFixed(2) || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">价格/365天高点</span>
                          <span>
                            {asset.rawFactors.priceToHigh365d
                              ? `${(asset.rawFactors.priceToHigh365d * 100).toFixed(2)}%`
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">动量因子</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">90天收益率</span>
                          <span>
                            {asset.rawFactors.return90d
                              ? `${(asset.rawFactors.return90d * 100).toFixed(2)}%`
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">180天收益率</span>
                          <span>
                            {asset.rawFactors.return180d
                              ? `${(asset.rawFactors.return180d * 100).toFixed(2)}%`
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">365天收益率</span>
                          <span>
                            {asset.rawFactors.return365d
                              ? `${(asset.rawFactors.return365d * 100).toFixed(2)}%`
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">流动性因子</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">成交量/市值比</span>
                          <span>
                            {asset.rawFactors.volumeToMarketCapRatio
                              ? `${(asset.rawFactors.volumeToMarketCapRatio * 100).toFixed(2)}%`
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">30天平均成交量</span>
                          <span>
                            {asset.rawFactors.avgDailyVolume30d
                              ? `$${(asset.rawFactors.avgDailyVolume30d / 1e6).toFixed(2)}M`
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">风险因子</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">365天波动率</span>
                          <span>
                            {asset.rawFactors.volatility365d
                              ? `${(asset.rawFactors.volatility365d * 100).toFixed(2)}%`
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">最大回撤</span>
                          <span>
                            {asset.rawFactors.maxDrawdown365d
                              ? `${(asset.rawFactors.maxDrawdown365d * 100).toFixed(2)}%`
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}




