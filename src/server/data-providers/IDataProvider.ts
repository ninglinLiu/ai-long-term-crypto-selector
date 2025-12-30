/**
 * 数据提供器接口
 * 定义统一的数据获取接口，支持未来扩展 A 股、美股等
 */

export interface HistoricalPriceData {
  date: Date;
  price: number;
  marketCap?: number;
  volume?: number;
  fdv?: number;
  high?: number;
  low?: number;
  open?: number;
}

export interface AssetMarketData {
  price: number;
  marketCap?: number;
  volume24h?: number;
  fdv?: number;
  high24h?: number;
  low24h?: number;
}

/**
 * 数据提供器接口
 */
export interface IDataProvider {
  /**
   * 获取资产池列表
   */
  fetchUniverse(): Promise<Array<{ symbol: string; name: string; dataSourceId: string }>>;

  /**
   * 获取历史价格数据
   * @param dataSourceId 数据源中的资产 ID
   * @param from 开始日期
   * @param to 结束日期
   */
  fetchHistoricalData(
    dataSourceId: string,
    from: Date,
    to: Date
  ): Promise<HistoricalPriceData[]>;

  /**
   * 获取当前市场数据
   * @param dataSourceId 数据源中的资产 ID
   */
  fetchCurrentMarketData(dataSourceId: string): Promise<AssetMarketData>;
}








