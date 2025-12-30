/**
 * K 线数据提供器接口
 * 用于从不同交易所获取 OHLCV 数据
 */

export interface KlineData {
  openTime: number; // 开盘时间（Unix 时间戳，毫秒）
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number; // 收盘时间（Unix 时间戳，毫秒）
}

export type Timeframe = '1h' | '4h' | '1d';

export interface IKlineDataProvider {
  /**
   * 获取 K 线数据
   * @param symbol 交易对符号（如 "BTCUSDT"）
   * @param timeframe 时间周期
   * @param limit 获取的 K 线数量（最多 1000）
   */
  fetchKlines(symbol: string, timeframe: Timeframe, limit?: number): Promise<KlineData[]>;
}

/**
 * Binance K 线数据提供器
 * 使用 Binance 公共 API 获取 OHLCV 数据
 */
import { createHttpClient } from '../utils/httpClient';
import { AxiosInstance } from 'axios';

export class BinanceKlineProvider implements IKlineDataProvider {
  private httpClient: AxiosInstance;
  private readonly baseUrl = 'https://api.binance.com/api/v3';

  constructor() {
    this.httpClient = createHttpClient();
  }

  /**
   * 将时间周期转换为 Binance API 的 interval 参数
   */
  private timeframeToInterval(timeframe: Timeframe): string {
    const mapping: Record<Timeframe, string> = {
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
    };
    return mapping[timeframe];
  }

  /**
   * 获取 K 线数据
   */
  async fetchKlines(symbol: string, timeframe: Timeframe, limit: number = 300): Promise<KlineData[]> {
    try {
      const interval = this.timeframeToInterval(timeframe);
      const url = `${this.baseUrl}/klines`;

      const response = await this.httpClient.get<any[]>(url, {
        params: {
          symbol: symbol.toUpperCase(),
          interval,
          limit: Math.min(limit, 1000), // Binance 最多支持 1000 根
        },
      });

      // Binance API 返回格式：
      // [
      //   [
      //     1499040000000,      // 0: 开盘时间
      //     "0.01634790",       // 1: 开盘价
      //     "0.80000000",       // 2: 最高价
      //     "0.01575800",       // 3: 最低价
      //     "0.01577100",       // 4: 收盘价
      //     "148976.11427815",  // 5: 成交量
      //     1499644799999,      // 6: 收盘时间
      //     "2434.19055334",    // 7: 成交额
      //     308,                // 8: 成交笔数
      //     "1756.87402397",    // 9: 主动买入成交量
      //     "28.46694368",      // 10: 主动买入成交额
      //     "17928899.62484339" // 11: 忽略
      //   ]
      // ]
      return response.data.map((kline: any[]) => ({
        openTime: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        closeTime: kline[6],
      }));
    } catch (error: any) {
      console.error(`[BinanceKlineProvider] 获取 K 线数据失败 (${symbol}, ${timeframe}):`, error.message);
      throw new Error(`Failed to fetch klines for ${symbol} on ${timeframe}: ${error.message}`);
    }
  }
}



