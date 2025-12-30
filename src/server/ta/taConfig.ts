/**
 * 技术分析配置参数
 * 集中管理所有阈值和权重，便于后期调参
 */

/**
 * 均线密集区判定阈值
 */
export const CLUSTER_TIGHT_THRESHOLD = 0.015; // 1.5%
export const D_MAX = 0.03; // 3%，用于计算密集度评分
export const S_MAX = 0.02; // 斜率标准差最大值（可选，用于平坦度评分）

/**
 * 突破信号判定参数
 */
export const BREAKOUT_BUFFER = 0.002; // 0.2% 容差，过滤假突破
export const MIN_DENSITY_SCORE_FOR_BREAKOUT = 0.5; // 突破所需的最小密集度评分

/**
 * 突破力度评分参数
 */
export const DIST_MAX = 2.0; // 距离比最大值（突破距离 / 密集区宽度）
export const MOVE_MAX = 2.0; // ATR 倍数最大值（突破幅度 / ATR）
export const VOL_MAX = 3.0; // 成交量比最大值（当前成交量 / 平均成交量）

/**
 * 突破力度评分权重
 */
export const BREAKOUT_SCORE_WEIGHTS = {
  distance: 0.4, // 距离权重
  move: 0.3, // 幅度权重（ATR）
  volume: 0.3, // 成交量权重
};

/**
 * MACD 辅助确认参数
 */
export const MACD_CONFIRMATION_BARS = 3; // 检查最近 N 根 K 线内的 MACD 变化

/**
 * 回踩/回顶信号参数
 */
export const RETEST_TOLERANCE_MULTIPLIER = 1.0; // 回踩容差倍数（相对于密集区宽度）
export const RETEST_MIN_PRICE_OFFSET = 0.005; // 最小价格偏移（0.5%）
export const RETEST_WINDOW_BARS = 20; // 突破后检查回踩的 K 线数量

/**
 * 止损止盈参数
 */
export const STOP_LOSS_CLUSTER_OFFSET = 0.5; // 止损在密集区外的偏移倍数（相对于密集区宽度）
export const STOP_LOSS_MIN_OFFSET = 0.005; // 止损最小偏移（0.5%）
export const TAKE_PROFIT_R1 = 1.0; // 第一止盈位：1R
export const TAKE_PROFIT_R2 = 2.0; // 第二止盈位：2R

/**
 * 入场价格规则
 */
export const USE_BREAKOUT_CLOSE_PRICE = true; // 使用突破 K 线收盘价作为入场价（true）或下一根开盘价（false）

/**
 * 信号综合评分权重
 */
export const SIGNAL_SCORE_WEIGHTS = {
  // 非回踩信号
  breakout: {
    density: 0.4,
    breakout: 0.6,
  },
  // 回踩信号
  retest: {
    density: 0.3,
    breakout: 0.4,
    retest: 0.3,
  },
};

/**
 * 信号强度等级阈值
 */
export const SIGNAL_STRENGTH_THRESHOLDS = {
  strong: 0.8,
  medium: 0.6,
  weak: 0.4,
};

/**
 * 扫描参数
 */
export const SCAN_LOOKBACK_BARS = 100; // 扫描最近 N 根 K 线寻找突破信号
export const DEFAULT_KLINE_LIMIT = 300; // 默认获取的 K 线数量



