import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  ReferenceDot,
} from 'recharts';
import type { Trend } from '../types';
import { number } from '../api';
const palette = ['#3730a3', '#14b8a6', '#f59e0b', '#ea580c', '#8b5cf6'];
export function TrendChart({ data, height = 245 }: { data: Trend[]; height?: number }) {
  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 15, right: 14, bottom: 0, left: -25 }}>
          <defs>
            <linearGradient id="cycle-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b63cc" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#6b63cc" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) =>
              new Date(v + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            }
            minTickGap={40}
            axisLine={false}
            tickLine={false}
          />
          <YAxis axisLine={false} tickLine={false} unit="h" />
          <Tooltip
            labelFormatter={(v) => String(v)}
            formatter={(v: number, name: string) => [
              `${number(v, 1)} hours`,
              name === 'moving' ? '7-day average' : 'Daily mean',
            ]}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="cycle"
            stroke="#c5c1e7"
            fill="none"
            strokeWidth={1}
            connectNulls
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="moving"
            stroke="#6258be"
            fill="url(#cycle-fill)"
            strokeWidth={2.5}
            connectNulls
          />
          {data
            .filter((r) => r.change && r.moving !== null)
            .map((r) => (
              <ReferenceDot key={r.date} x={r.date} y={r.moving ?? 0} r={3.5} fill="#ea580c" stroke="white" />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Bars({
  data,
  nameKey = 'name',
  valueKey = 'breach',
  unit = '%',
  height = 230,
  horizontal = false,
}: {
  data: object[];
  nameKey?: string;
  valueKey?: string;
  unit?: string;
  height?: number;
  horizontal?: boolean;
}) {
  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 10, right: 20, left: horizontal ? 25 : -22, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 5" horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" unit={unit} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey={nameKey}
                width={105}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                interval={0}
                tickFormatter={(v: string) =>
                  v.replace(' Certificate', '').replace(' Permission', '').replace(' / On-duty', '')
                }
              />
              <YAxis unit={unit} axisLine={false} tickLine={false} />
            </>
          )}
          <Tooltip formatter={(v: number) => [`${number(v, 1)}${unit}`, valueKey.replaceAll('_', ' ')]} />
          <Bar
            isAnimationActive={false}
            dataKey={valueKey}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={36}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function QueueChart({ data, roles }: { data: object[]; roles: string[] }) {
  return (
    <div style={{ height: 235, width: '100%' }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: -20, right: 10, top: 15 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => v.slice(5)}
            minTickGap={45}
            axisLine={false}
            tickLine={false}
          />
          <YAxis axisLine={false} tickLine={false} />
          <Tooltip />
          {roles.map((role, i) => (
            <Line
              isAnimationActive={false}
              key={role}
              type="monotone"
              dataKey={role}
              stroke={palette[i % palette.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
