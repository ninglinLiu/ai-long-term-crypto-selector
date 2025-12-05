/**
 * 主 Dashboard 页面
 * 展示资产池表格和组合概览
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

async function getAssets() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/assets`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

async function getPortfolio() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/portfolio`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export default async function Home() {
  const assets = await getAssets();
  const portfolio = await getPortfolio();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">AI Long-Term Crypto Selector</h1>
          <p className="text-muted-foreground">基于 AI 的长期加密货币选币管家</p>
        </div>

        <Tabs defaultValue="assets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="assets">资产池</TabsTrigger>
            <TabsTrigger value="portfolio">组合建议</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>资产池概览</CardTitle>
                <CardDescription>
                  所有白名单资产的最新因子得分和建议权重
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>资产</TableHead>
                      <TableHead>价格</TableHead>
                      <TableHead>市值</TableHead>
                      <TableHead>估值得分</TableHead>
                      <TableHead>动量得分</TableHead>
                      <TableHead>流动性得分</TableHead>
                      <TableHead>风险得分</TableHead>
                      <TableHead>总分</TableHead>
                      <TableHead>建议权重</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          暂无数据，请先运行 <code className="bg-muted px-2 py-1 rounded">pnpm update-data</code> 和 <code className="bg-muted px-2 py-1 rounded">pnpm recompute-factors</code>
                        </TableCell>
                      </TableRow>
                    ) : (
                      assets.map((asset: any) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="font-semibold">{asset.symbol}</div>
                              <div className="text-sm text-muted-foreground">{asset.name}</div>
                            </div>
                          </TableCell>
                          <TableCell>${asset.price?.toFixed(4) || '-'}</TableCell>
                          <TableCell>
                            {asset.marketCap
                              ? `$${(asset.marketCap / 1e9).toFixed(2)}B`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {asset.valuationScore !== null
                              ? asset.valuationScore.toFixed(2)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {asset.momentumScore !== null
                              ? asset.momentumScore.toFixed(2)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {asset.liquidityScore !== null
                              ? asset.liquidityScore.toFixed(2)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {asset.riskScore !== null
                              ? asset.riskScore.toFixed(2)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              {asset.totalScore !== null
                                ? asset.totalScore.toFixed(2)
                                : '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {asset.targetWeight > 0
                              ? `${(asset.targetWeight * 100).toFixed(1)}%`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Link href={`/assets/${asset.id}`}>
                              <Button variant="outline" size="sm">
                                详情
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-4">
            {portfolio ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>组合建议概览</CardTitle>
                    <CardDescription>
                      生成日期: {new Date(portfolio.date).toLocaleDateString('zh-CN')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <div className="text-sm text-muted-foreground">选中资产</div>
                        <div className="text-2xl font-bold">
                          {portfolio.summary.selectedAssets} / {portfolio.summary.totalAssets}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">平均得分</div>
                        <div className="text-2xl font-bold">
                          {portfolio.summary.averageScore.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">总配置权重</div>
                        <div className="text-2xl font-bold">
                          {(portfolio.adjustedTotalWeight * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>资产</TableHead>
                          <TableHead>得分</TableHead>
                          <TableHead>权重</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {portfolio.allocations.map((alloc: any) => (
                          <TableRow key={alloc.assetId}>
                            <TableCell className="font-medium">
                              {alloc.symbol} ({alloc.name})
                            </TableCell>
                            <TableCell>{alloc.totalScore.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className="font-semibold">
                                {(alloc.adjustedWeight * 100).toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    暂无组合建议，请先运行 <code className="bg-muted px-2 py-1 rounded">pnpm recompute-factors</code>
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
