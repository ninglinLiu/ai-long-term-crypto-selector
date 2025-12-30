/**
 * 技术面分析市场配置
 * 定义交易对映射和交易所支持情况
 */

import { AssetSymbol } from '../constants/assets';

export type Exchange = 'binance' | 'okx' | 'bitget' | 'unsupported';

export interface TradingPairConfig {
  symbol: AssetSymbol;
  exchange: Exchange;
  tradingPair: string; // 如 "BTCUSDT"
}

/**
 * 交易对映射配置
 * 对于暂不支持的币种，exchange 设为 "unsupported"
 */
export const TRADING_PAIR_CONFIG: Record<AssetSymbol, TradingPairConfig> = {
  BTC: {
    symbol: 'BTC',
    exchange: 'binance',
    tradingPair: 'BTCUSDT',
  },
  ETH: {
    symbol: 'ETH',
    exchange: 'binance',
    tradingPair: 'ETHUSDT',
  },
  SOL: {
    symbol: 'SOL',
    exchange: 'binance',
    tradingPair: 'SOLUSDT',
  },
  LINK: {
    symbol: 'LINK',
    exchange: 'binance',
    tradingPair: 'LINKUSDT',
  },
  ANA: {
    symbol: 'ANA',
    exchange: 'unsupported', // 暂时不支持，后续可添加其他交易所
    tradingPair: '',
  },
  ENA: {
    symbol: 'ENA',
    exchange: 'binance',
    tradingPair: 'ENAUSDT',
  },
  BNB: {
    symbol: 'BNB',
    exchange: 'binance',
    tradingPair: 'BNBUSDT',
  },
  OKB: {
    symbol: 'OKB',
    exchange: 'unsupported', // OKB 主要在 OKX，后续可添加 OKX 支持
    tradingPair: '',
  },
  BGB: {
    symbol: 'BGB',
    exchange: 'unsupported', // BGB 主要在 Bitget，后续可添加 Bitget 支持
    tradingPair: '',
  },
  UNI: {
    symbol: 'UNI',
    exchange: 'binance',
    tradingPair: 'UNIUSDT',
  },
  HYPER: {
    symbol: 'HYPER',
    exchange: 'unsupported', // 暂时不支持
    tradingPair: '',
  },
  SUI: {
    symbol: 'SUI',
    exchange: 'binance',
    tradingPair: 'SUIUSDT',
  },
};

/**
 * 获取资产的技术面配置
 */
export function getTradingPairConfig(symbol: AssetSymbol): TradingPairConfig {
  return TRADING_PAIR_CONFIG[symbol];
}

/**
 * 检查资产是否支持技术面分析
 */
export function isTechnicalAnalysisSupported(symbol: AssetSymbol): boolean {
  const config = TRADING_PAIR_CONFIG[symbol];
  return config.exchange !== 'unsupported';
}



