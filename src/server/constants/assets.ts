/**
 * 资产白名单配置
 * 定义支持的加密货币符号及其在数据源中的映射
 */

export const WHITELIST_SYMBOLS = [
  'BTC',
  'ETH',
  'SOL',
  'LINK',
  'ANA',
  'ENA',
  'BNB',
  'OKB',
  'BGB',
  'UNI',
  'HYPER',
  'SUI',
] as const;

export type AssetSymbol = typeof WHITELIST_SYMBOLS[number];

/**
 * 资产类别枚举
 */
export enum AssetClass {
  CRYPTO = 'crypto',
  US_EQUITY = 'us_equity',
  CN_EQUITY = 'cn_equity',
}

/**
 * Symbol 到 CoinGecko ID 的映射表
 * 注意：需要根据实际 API 返回的数据进行调整
 * 
 * 参考：https://api.coingecko.com/api/v3/coins/list
 */
export const SYMBOL_TO_COINGECKO_ID: Record<AssetSymbol, string> = {
  BTC: 'bitcoin', // ✅ 已确认：https://www.coingecko.com/en/coins/bitcoin
  ETH: 'ethereum',
  SOL: 'solana', // ✅ 已确认：https://www.coingecko.com/en/coins/solana
  LINK: 'chainlink', // ✅ 已确认：https://www.coingecko.com/en/coins/chainlink
  ANA: 'ana-protocol', // ⚠️ 尝试使用 ana-protocol，如果仍失败请从白名单移除
  ENA: 'ethena', // ✅ 已确认：https://www.coingecko.com/en/coins/ethena
  BNB: 'binancecoin',
  OKB: 'okb', // ✅ 已确认：https://www.coingecko.com/en/coins/okb
  BGB: 'bitget-token',
  UNI: 'uniswap', // ✅ 已确认：https://www.coingecko.com/en/coins/uniswap
  HYPER: 'hyperliquid', // ✅ 已确认：https://www.coingecko.com/en/coins/hyperliquid
  SUI: 'sui', // ✅ 已确认：https://www.coingecko.com/en/coins/sui
};

/**
 * 资产基本信息（用于初始化数据库）
 */
export interface AssetInfo {
  symbol: AssetSymbol;
  name: string;
  dataSourceId: string;
  assetClass: AssetClass;
}

/**
 * 获取所有资产的配置信息
 */
export function getAllAssetInfos(): AssetInfo[] {
  const nameMap: Record<AssetSymbol, string> = {
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    SOL: 'Solana',
    LINK: 'Chainlink',
    ANA: 'ANA',
    ENA: 'Ethena',
    BNB: 'Binance Coin',
    OKB: 'OKB',
    BGB: 'Bitget Token',
    UNI: 'Uniswap',
    HYPER: 'Hyperliquid',
    SUI: 'Sui',
  };

  return WHITELIST_SYMBOLS.map((symbol) => ({
    symbol,
    name: nameMap[symbol],
    dataSourceId: SYMBOL_TO_COINGECKO_ID[symbol],
    assetClass: AssetClass.CRYPTO,
  }));
}



