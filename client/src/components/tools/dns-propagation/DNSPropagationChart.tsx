import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QueryStats } from "./shared";

interface DNSPropagationChartProps {
  stats: QueryStats;
}

export default function DNSPropagationChart({
  stats,
}: DNSPropagationChartProps) {
  const data = [
    {
      name: "DNS Propagation",
      successfulQueries: stats.successfulQueries,
      failedQueries: stats.failedQueries,
      dnssecEnabled: stats.dnssecEnabled,
    },
  ];

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="successfulQueries" fill="#34D399" name="Successful" />
          <Bar dataKey="failedQueries" fill="#EF4444" name="Failed" />
          <Bar dataKey="dnssecEnabled" fill="#3B82F6" name="DNSSEC Enabled" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
