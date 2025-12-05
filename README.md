# AI Long-Term Crypto Selector

🚀 一个基于 AI 的长期加密货币选币管家，支持因子分析、组合建议和 AI 解读。

> ⚠️ **重要提示**：本项目仅供技术研究和学习使用，不构成任何投资建议。请查看 [风险声明](./RISK_DISCLOSURE.md) 了解详细信息。

## 项目定位

第一版专注于主流加密货币的长期投资筛选，代码架构支持未来扩展到「A 股 + 美股 + 加密」的多资产全流程 AI 选股管家。

## 投资风格

- 低频 / 长期投资（按天或按周手动运行）
- 不做高频交易
- 不过度调仓

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **ORM**: Prisma
- **UI**: TailwindCSS + shadcn/ui
- **图表**: Recharts
- **LLM**: DeepSeek API
- **包管理**: pnpm

## 支持的资产池

当前白名单（11 个代币）：
- BTC, ETH, SOL, LINK, ANA, ENA, BNB, OKB, BGB, UNI, HYPER, SUI

## 环境配置

1. 复制 `.env.example` 为 `.env`
2. 配置以下环境变量：

```bash
# 数据库（SQLite，开发环境）
DATABASE_URL="file:./dev.db"

# DeepSeek API Key
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 代理配置（可选，用于中国境内网络环境）
# 如果使用 Clash / 飞鱼等代理，设置：
HTTPS_PROXY=http://127.0.0.1:7897
HTTP_PROXY=http://127.0.0.1:7897
```

## 安装与初始化

```bash
# 安装依赖
pnpm install

# 初始化数据库
pnpm prisma generate
pnpm prisma migrate dev --name init

# 启动开发服务器
pnpm dev
```

## 使用方式

### 手动运行脚本（CLI）

所有任务都是手动触发，不包含自动定时调度。

```bash
# 1. 更新数据：拉取最新行情数据
pnpm update-data

# 2. 重算因子：计算因子得分和评分
pnpm recompute-factors

# 3. 生成报告：调用 DeepSeek 生成 AI 分析报告
pnpm generate-report

# 4. 一键执行：顺序执行上述三个脚本（推荐一天跑一次）
pnpm daily
```

### 前端 Dashboard

访问 `http://localhost:3000` 查看：
- 资产池表格（价格、市值、因子得分、建议权重）
- 单个资产详情页（K 线图、因子分析、AI 解读）
- 组合建议概览（权重分布、AI 报告）

## 项目结构

```
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── page.tsx      # 主 Dashboard
│   │   ├── assets/       # 资产详情页
│   │   └── api/          # API 路由
│   ├── server/           # 服务端逻辑
│   │   ├── db/           # Prisma client
│   │   ├── data-providers/  # 数据提供器
│   │   ├── factors/      # 因子计算
│   │   ├── strategy/     # 策略逻辑
│   │   └── llm/          # DeepSeek 集成
│   └── components/       # UI 组件
├── scripts/              # CLI 脚本
│   ├── updateData.ts
│   ├── recomputeFactors.ts
│   └── generateReport.ts
├── prisma/               # Prisma schema
└── reports/              # 生成的报告（Markdown）
```

## 开发阶段

- ✅ Phase 1: 初始化项目 & DB 结构
- ✅ Phase 2: Crypto 数据拉取 & 代理支持
- ✅ Phase 3: 因子计算与打分
- ✅ Phase 4: 策略与组合建议
- ✅ Phase 5: 集成 DeepSeek (LLM)
- ✅ Phase 6: 前端 Dashboard

## 注意事项

1. **代理配置**：如果在中国境内，需要配置代理才能访问 CoinGecko 等 API
2. **手动触发**：所有任务都是手动触发，不包含自动定时调度
3. **DeepSeek API**：使用 DeepSeek API 而非 OpenAI，需要配置 `DEEPSEEK_API_KEY`

