import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Barangay, Plan } from "../types";
import { colors } from "./ui";
const chartStyle = {
  borderRadius: 12,
  border: "1px solid #e4eaf0",
  fontSize: 12,
};
export function RankingChart({
  barangays,
  limit = 10,
}: {
  barangays: Barangay[];
  limit?: number;
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Barangays ranked by calculated healthcare need"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={barangays
            .slice(0, limit)
            .map((b) => ({ name: b.name.replace("Demo ", ""), Need: b.score }))}
          layout="vertical"
          margin={{ left: 5, right: 25 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#edf1f4"
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={95}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={chartStyle} />
          <Bar
            dataKey="Need"
            fill="#238e86"
            radius={[0, 4, 4, 0]}
            barSize={13}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function RiskDistribution({ barangays }: { barangays: Barangay[] }) {
  const data = Object.keys(colors).map((name) => ({
    name,
    value: barangays.filter((b) => b.level === name).length,
  }));
  return (
    <div
      className="chart donut"
      role="img"
      aria-label="Healthcare need distribution"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={67}
            outerRadius={92}
            paddingAngle={4}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={colors[d.name as keyof typeof colors]} />
            ))}
          </Pie>
          <Tooltip contentStyle={chartStyle} />
          <Legend iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center">
        <strong>{barangays.length}</strong>
        <span>barangays</span>
      </div>
    </div>
  );
}
export function ComparisonChart({ plan }: { plan: Plan }) {
  const data = [
    {
      name: "Appointments",
      OMCM: plan.optimized.metrics.residents_served,
      Baseline: plan.baseline.metrics.residents_served,
    },
    {
      name: "Priority-weighted",
      OMCM: plan.optimized.metrics.weighted_demand,
      Baseline: plan.baseline.metrics.weighted_demand,
    },
  ];
  return (
    <div
      className="chart"
      role="img"
      aria-label="OMCM and population baseline comparison"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 25, right: 15 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#edf1f4"
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={chartStyle} />
          <Legend iconType="circle" iconSize={8} />
          <Bar
            dataKey="OMCM"
            fill="#208d83"
            radius={[5, 5, 0, 0]}
            maxBarSize={45}
          />
          <Bar
            dataKey="Baseline"
            fill="#b7c9d6"
            radius={[5, 5, 0, 0]}
            maxBarSize={45}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function VulnerabilityChart({ barangays }: { barangays: Barangay[] }) {
  return (
    <div className="chart" role="img" aria-label="Population vulnerability">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={barangays
            .slice(0, 8)
            .map((b) => ({
              name: b.name.replace("Demo ", ""),
              Vulnerable: b.vulnerable_residents,
              Other: b.population - b.vulnerable_residents,
            }))}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            angle={-20}
            height={50}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={chartStyle} />
          <Legend />
          <Bar stackId="a" dataKey="Vulnerable" fill="#208d83" />
          <Bar stackId="a" dataKey="Other" fill="#dce6ed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DiseaseDistribution({ barangays }: { barangays: Barangay[] }) {
  const data = [[0,25],[25,50],[50,75],[75,Infinity]].map(([low,high]) => ({
    name: Number.isFinite(high) ? `${low}–<${high}` : '75+',
    Barangays: barangays.filter(b => b.disease_per_1000 >= low && b.disease_per_1000 < high).length,
  }));
  return <div className="chart" role="img" aria-label="Disease burden distribution by cases per 1,000 residents"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f4"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis allowDecimals={false} tick={{fontSize:11}}/><Tooltip contentStyle={chartStyle}/><Bar dataKey="Barangays" fill="#dc9a54" radius={[5,5,0,0]} maxBarSize={50}/></BarChart></ResponsiveContainer></div>;
}

export function TravelChart({ plan }: { plan: Plan }) {
  const data=[{name:'OMCM',Minutes:plan.optimized.metrics.average_travel_minutes},{name:'Population baseline',Minutes:plan.baseline.metrics.average_travel_minutes}];
  return <div className="chart" role="img" aria-label="Average travel minutes for OMCM versus population baseline"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{left:10,right:20}}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#edf1f4"/><XAxis type="number" tick={{fontSize:11}}/><YAxis type="category" dataKey="name" width={120} tick={{fontSize:10}}/><Tooltip contentStyle={chartStyle}/><Bar dataKey="Minutes" fill="#678b9e" radius={[0,5,5,0]} barSize={32}/></BarChart></ResponsiveContainer></div>;
}
