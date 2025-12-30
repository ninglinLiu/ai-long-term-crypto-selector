/**
 * CoinGecko 数据提供器
 * 实现加密货币数据拉取，支持代理
 */

import { IDataProvider, HistoricalPriceData, AssetMarketData } from '../IDataProvider';
import { createHttpClient } from '../../utils/httpClient';
import { SYMBOL_TO_COINGECKO_ID, getAllAssetInfos } from '../../constants/assets';

interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  fully_diluted_valuation?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_percentage_24h?: number;
}

interface CoinGeckoHistoryData {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][]; // [timestamp, market_cap]
  total_volumes: [number, number][]; // [timestamp, volume]
}

export class CryptoDataProvider implements IDataProvider {
  private httpClient = createHttpClient();
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  /**
   * 获取资产池列表
   */
  async fetchUniverse(): Promise<Array<{ symbol: string; name: string; dataSourceId: string }>> {
    return getAllAssetInfos().map((info) => ({
      symbol: info.symbol,
      name: info.name,
      dataSourceId: info.dataSourceId,
    }));
  }

  /**
   * 获取历史价格数据
   */
  async fetchHistoricalData(
    dataSourceId: string,
    from: Date,
    to: Date
  ): Promise<HistoricalPriceData[]> {
    try {
      const fromTimestamp = Math.floor(from.getTime() / 1000);
      const toTimestamp = Math.floor(to.getTime() / 1000);

      const url = `${this.baseUrl}/coins/${dataSourceId}/market_chart/range`;
      const response = await this.httpClient.get<CoinGeckoHistoryData>(url, {
        params: {
          vs_currency: 'usd',
          from: fromTimestamp,
          to: toTimestamp,
        },
      });

      const data = response.data;
      const result: HistoricalPriceData[] = [];

      // CoinGecko 返回的数据是数组，需要按日期聚合为日线数据
      const dailyDataMap = new Map<string, HistoricalPriceData>();

      // 处理价格数据
      if (data.prices && data.prices.length > 0) {
        for (const [timestamp, price] of data.prices) {
          const date = new Date(timestamp);
          const dateKey = this.getDateKey(date);

          if (!dailyDataMap.has(dateKey)) {
            dailyDataMap.set(dateKey, {
              date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
              price,
            });
          } else {
            // 如果同一天有多条数据，取最后一条（收盘价）
            dailyDataMap.get(dateKey)!.price = price;
          }
        }
      }

      // 处理市值数据
      if (data.market_caps && data.market_caps.length > 0) {
        for (const [timestamp, marketCap] of data.market_caps) {
          const date = new Date(timestamp);
          const dateKey = this.getDateKey(date);
          const dailyData = dailyDataMap.get(dateKey);
          if (dailyData) {
            dailyData.marketCap = marketCap;
          }
        }
      }

      // 处理成交量数据
      if (data.total_volumes && data.total_volumes.length > 0) {
        for (const [timestamp, volume] of data.total_volumes) {
          const date = new Date(timestamp);
          const dateKey = this.getDateKey(date);
          const dailyData = dailyDataMap.get(dateKey);
          if (dailyData) {
            dailyData.volume = volume;
          }
        }
      }

      // 转换为数组并按日期排序
      return Array.from(dailyDataMap.values()).sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
    } catch (error: any) {
      console.error(`[CryptoDataProvider] 获取历史数据失败 (${dataSourceId}):`, error.message);
      throw new Error(`Failed to fetch historical data for ${dataSourceId}: ${error.message}`);
    }
  }

  /**
   * 获取当前市场数据
   */
  async fetchCurrentMarketData(dataSourceId: string): Promise<AssetMarketData> {
    try {
      const url = `${this.baseUrl}/coins/${dataSourceId}`;
      const response = await this.httpClient.get<CoinGeckoMarketData>(url, {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: false,
          developer_data: false,
          sparkline: false,
        },
      });

      const marketData = response.data.market_data || (response.data as any);

      return {
        price: marketData.current_price?.usd || response.data.current_price || 0,
        marketCap: marketData.market_cap?.usd || marketData.market_cap || undefined,
        volume24h: marketData.total_volume?.usd || marketData.total_volume || undefined,
        fdv: marketData.fully_diluted_valuation?.usd || marketData.fully_diluted_valuation || undefined,
        high24h: marketData.high_24h?.usd || marketData.high_24h || undefined,
        low24h: marketData.low_24h?.usd || marketData.low_24h || undefined,
      };
    } catch (error: any) {
      console.error(`[CryptoDataProvider] 获取当前市场数据失败 (${dataSourceId}):`, error.message);
      throw new Error(`Failed to fetch current market data for ${dataSourceId}: ${error.message}`);
    }
  }

  /**
   * 批量获取多个资产的当前市场数据（优化 API 调用）
   */
  async fetchBatchMarketData(dataSourceIds: string[]): Promise<Map<string, AssetMarketData>> {
    try {
      const ids = dataSourceIds.join(',');
      const url = `${this.baseUrl}/simple/price`;
      const response = await this.httpClient.get(url, {
        params: {
          ids,
          vs_currencies: 'usd',
          include_market_cap: true,
          include_24hr_vol: true,
          include_24hr_change: true,
          include_last_updated_at: true,
        },
      });

      const result = new Map<string, AssetMarketData>();
      const data = response.data;

      for (const [id, marketData] of Object.entries(data)) {
        const m = marketData as any;
        result.set(id, {
          price: m.usd || 0,
          marketCap: m.usd_market_cap,
          volume24h: m.usd_24h_vol,
        });
      }

      return result;
    } catch (error: any) {
      console.error('[CryptoDataProvider] 批量获取市场数据失败:', error.message);
      // 如果批量获取失败，回退到单个获取
      const result = new Map<string, AssetMarketData>();
      for (const id of dataSourceIds) {
        try {
          const data = await this.fetchCurrentMarketData(id);
          result.set(id, data);
          // 避免请求过快，添加小延迟
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`[CryptoDataProvider] 单个获取失败 (${id}):`, err);
        }
      }
      return result;
    }
  }

  /**
   * 获取日期键（YYYY-MM-DD 格式）
   */
  private getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}








