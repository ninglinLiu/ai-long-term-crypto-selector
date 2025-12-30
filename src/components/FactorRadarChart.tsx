/**
 * 因子雷达图组件
 */

'use client';

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

interface FactorRadarChartProps {
  scores: {
    valuationScore: number;
    momentumScore: number;
    liquidityScore: number;
    riskScore: number;
  };
}

export function FactorRadarChart({ scores }: FactorRadarChartProps) {
  const data = [
    {
      factor: '估值',
      score: scores.valuationScore,
      fullMark: 5,
    },
    {
      factor: '动量',
      score: scores.momentumScore,
      fullMark: 5,
    },
    {
      factor: '流动性',
      score: scores.liquidityScore,
      fullMark: 5,
    },
    {
      factor: '风险',
      score: scores.riskScore,
      fullMark: 5,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="factor" tick={{ fontSize: 14 }} />
        <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 12 }} />
        <Radar
          name="得分"
          dataKey="score"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.6}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}








