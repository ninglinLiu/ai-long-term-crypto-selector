/**
 * DeepSeek API 客户端
 * 封装 DeepSeek API 调用
 */

import axios, { AxiosInstance } from 'axios';
import { createHttpClient } from '../utils/httpClient';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekClient {
  private httpClient: AxiosInstance;
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor() {
    this.baseURL = process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com';
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY 环境变量未设置');
    }

    this.defaultModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    // 创建 HTTP 客户端（支持代理）
    this.httpClient = createHttpClient();
  }

  /**
   * 调用 DeepSeek Chat API
   */
  async chat(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.httpClient.post<ChatCompletionResponse>(
          `${this.baseURL}/chat/completions`,
          {
            model: options.model || this.defaultModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2000,
            stream: options.stream ?? false,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000, // 120 秒超时（DeepSeek 生成长报告需要更长时间）
          }
        );

        if (response.data.choices && response.data.choices.length > 0) {
          return response.data.choices[0].message.content;
        }

        throw new Error('API 返回空响应');
      } catch (error: any) {
        lastError = error;
        
        // 如果是网络错误（aborted, timeout等），进行重试
        if (error.code === 'ECONNABORTED' || error.message?.includes('aborted') || error.message?.includes('timeout')) {
          if (attempt < maxRetries) {
            const waitTime = attempt * 2000; // 递增等待时间：2秒、4秒、6秒
            console.warn(`[DeepSeek] 请求中断，${waitTime / 1000} 秒后重试 (${attempt}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
        }

        // 如果是 API 错误（4xx, 5xx），直接抛出
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          throw new Error(
            `DeepSeek API 错误 (${status}): ${data?.error?.message || JSON.stringify(data)}`
          );
        }

        // 最后一次尝试失败，抛出错误
        if (attempt === maxRetries) {
          throw new Error(`DeepSeek API 调用失败 (已重试 ${maxRetries} 次): ${error.message}`);
        }
      }
    }

    // 如果所有重试都失败
    throw lastError || new Error('DeepSeek API 调用失败：未知错误');
  }

  /**
   * 简化调用方法（只传用户消息）
   */
  async chatSimple(userMessage: string, systemMessage?: string): Promise<string> {
    const messages: ChatMessage[] = [];

    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    return this.chat(messages);
  }
}

/**
 * 创建 DeepSeek 客户端单例
 */
let deepSeekClientInstance: DeepSeekClient | null = null;

export function getDeepSeekClient(): DeepSeekClient {
  if (!deepSeekClientInstance) {
    deepSeekClientInstance = new DeepSeekClient();
  }
  return deepSeekClientInstance;
}



