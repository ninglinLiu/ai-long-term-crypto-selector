/**
 * HTTP 客户端工具
 * 支持从环境变量读取代理配置
 */

import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

/**
 * 创建支持代理的 Axios 实例
 */
export function createHttpClient(): AxiosInstance {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const proxy = httpsProxy || httpProxy;

  const config: any = {
    timeout: 30000, // 30 秒超时
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  };

  // 如果配置了代理，则使用代理
  if (proxy) {
    console.log(`[HTTP Client] 使用代理: ${proxy}`);
    try {
      if (proxy.startsWith('https://') || proxy.startsWith('http://')) {
        config.httpsAgent = new HttpsProxyAgent(proxy);
        config.httpAgent = new HttpProxyAgent(proxy);
      } else {
        // 如果代理地址没有协议前缀，自动添加
        const proxyUrl = proxy.startsWith('http') ? proxy : `http://${proxy}`;
        config.httpsAgent = new HttpsProxyAgent(proxyUrl);
        config.httpAgent = new HttpProxyAgent(proxyUrl);
      }
    } catch (error) {
      console.warn('[HTTP Client] 代理配置失败，将使用直连:', error);
    }
  } else {
    console.log('[HTTP Client] 未配置代理，使用直连');
  }

  return axios.create(config);
}




