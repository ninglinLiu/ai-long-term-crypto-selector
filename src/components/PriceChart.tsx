/**
 * 价格走势图表组件
 */

'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceChartProps {
  data: Array<{
    date: string;
    price: number;
  }>;
}

export function PriceChart({ data }: PriceChartProps) {
  // 格式化数据供 Recharts 使用
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    }),
    price: item.price,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <Tooltip
          formatter={(value: number) => [`$${value.toFixed(4)}`, '价格']}
          labelStyle={{ color: '#000' }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}




