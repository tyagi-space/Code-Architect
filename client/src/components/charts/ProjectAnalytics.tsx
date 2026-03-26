import { type FullProjectResponse } from "@shared/schema";
import { type ProjectSummaryResponse, type UtilizationResponse } from "@shared/routes";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface ProjectAnalyticsProps {
  project: FullProjectResponse;
  summary?: ProjectSummaryResponse;
  utilization?: UtilizationResponse;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#22c55e",
};

export function ProjectAnalytics({ project, summary, utilization }: ProjectAnalyticsProps) {
  const statusMap = project.tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

  const moduleData = Object.entries(summary?.moduleBreakdown ?? {}).map(([module, count]) => ({
    module,
    count,
  }));

  const overloadData = (utilization ?? []).map((day) => ({
    date: day.date,
    overloadedMembers: day.members.filter((m) => m.isOverloaded).length,
    totalUtilization: day.members.reduce((sum, m) => sum + m.utilization, 0),
  }));

  const totalOverloadedDays = overloadData.filter((d) => d.overloadedMembers > 0).length;
  const memberIdleSummary = project.teamMembers.map((member) => {
    const totalDays = utilization?.length || 0;
    const idleDays = (utilization || []).filter((day) => {
      const m = day.members.find((x) => x.memberId === member.id);
      return !m || m.utilization === 0;
    }).length;
    return {
      member: member.name,
      idlePct: totalDays > 0 ? Number(((idleDays / totalDays) * 100).toFixed(1)) : 0,
      idleDays,
    };
  });
  const avgIdlePct =
    memberIdleSummary.length > 0
      ? Math.round(memberIdleSummary.reduce((sum, m) => sum + m.idlePct, 0) / memberIdleSummary.length)
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard title="Total Tasks" value={summary?.totalTasks ?? project.tasks.length} />
        <MetricCard title="Completed" value={summary?.completedTasks ?? statusMap.completed ?? 0} />
        <MetricCard title="Team Size" value={project.teamMembers.length} />
        <MetricCard title="Plan Delay (Days)" value={summary?.delayDays ?? 0} />
        <MetricCard title="Days To Target" value={summary?.daysRemainingToTarget ?? 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard title="Overloaded Days" value={totalOverloadedDays} />
        <MetricCard title="Avg Team Idle %" value={avgIdlePct} />
        <div className="glass-card rounded-xl p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">Target Tracking</p>
          <p className={`text-2xl font-bold mt-1 ${(summary?.isDelayed || summary?.isOverdueNow) ? "text-red-600" : "text-emerald-600"}`}>
            {(summary?.isDelayed || summary?.isOverdueNow) ? "Delayed" : "On Track"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Planned: {summary?.plannedEndDate ?? "N/A"} | Projected: {summary?.projectedEndDate ?? "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 border border-border/50 h-[420px]">
          <h3 className="text-lg font-semibold mb-4">Task Status Distribution</h3>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={statusData} dataKey="count" nameKey="status" outerRadius={130} label>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#64748b"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border/50 h-[420px]">
          <h3 className="text-lg font-semibold mb-4">Module Breakdown</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={moduleData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="module" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 border border-border/50 h-[420px]">
        <h3 className="text-lg font-semibold mb-4">Day-wise Team Load Trend</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={overloadData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalUtilization" name="Total Utilization (%)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            <Bar dataKey="overloadedMembers" name="Overloaded Members" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card rounded-2xl p-6 border border-border/50 h-[420px]">
        <h3 className="text-lg font-semibold mb-4">Member Idle Percentage</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={memberIdleSummary}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="member" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="idlePct" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="glass-card rounded-xl p-4 border border-border/50">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
