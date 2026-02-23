import { useMemo, useState } from "react";
import { type FullProjectResponse } from "@shared/schema";
import { parseISO, differenceInDays, addDays, isWithinInterval, format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";

interface ResourceChartProps {
  project: FullProjectResponse;
}

type ViewMode = "graph" | "table";

export function ResourceChart({ project }: ResourceChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("graph");

  const analytics = useMemo(() => {
    if (!project.startDate || !project.teamMembers.length) {
      return null;
    }

    const start = parseISO(project.startDate);
    const maxEnd = project.tasks.reduce((latest, task) => {
      if (!task.endDate) return latest;
      const taskEnd = parseISO(task.endDate);
      return taskEnd > latest ? taskEnd : latest;
    }, parseISO(project.endDate || project.startDate));

    const totalDays = Math.max(1, differenceInDays(maxEnd, start) + 1);
    const dates = Array.from({ length: totalDays }).map((_, i) => addDays(start, i));

    const dailyRows = dates.map((currentDay) => {
      const dayUtilizationByMemberId: Record<number, number> = {};
      const dayTasksByMemberId: Record<number, string[]> = {};

      project.tasks.forEach((task) => {
        if (!task.startDate || !task.endDate) return;
        const taskStart = parseISO(task.startDate);
        const taskEnd = parseISO(task.endDate);

        if (isWithinInterval(currentDay, { start: taskStart, end: taskEnd })) {
          task.assignments.forEach((assignment) => {
            dayUtilizationByMemberId[assignment.teamMember.id] =
              (dayUtilizationByMemberId[assignment.teamMember.id] || 0) + assignment.utilization;
            dayTasksByMemberId[assignment.teamMember.id] = [
              ...(dayTasksByMemberId[assignment.teamMember.id] || []),
              task.name,
            ];
          });
        }
      });

      const members = project.teamMembers.map((member) => {
        const utilization = dayUtilizationByMemberId[member.id] || 0;
        const idlePct = Math.max(0, member.maxCapacity - utilization);
        return {
          memberId: member.id,
          name: member.name,
          utilization,
          idlePct,
          tasks: dayTasksByMemberId[member.id] || [],
          hasNoTask: utilization === 0,
          isOverloaded: utilization > member.maxCapacity,
        };
      });

      const graphRow: Record<string, string | number> = {
        date: format(currentDay, "MMM d"),
        dateFull: format(currentDay, "yyyy-MM-dd"),
      };
      members.forEach((m) => {
        graphRow[`util_${m.memberId}`] = m.utilization;
      });

      return { date: currentDay, members, graphRow };
    });

    const memberSummary = project.teamMembers.map((member) => {
      const perDay = dailyRows.map((day) => day.members.find((m) => m.memberId === member.id)!);
      const idleDays = perDay.filter((d) => d.hasNoTask).length;
      const assignedDays = totalDays - idleDays;
      const avgUtilization = perDay.reduce((sum, d) => sum + d.utilization, 0) / totalDays;
      const avgIdlePct = perDay.reduce((sum, d) => sum + d.idlePct, 0) / totalDays;
      const overloadDays = perDay.filter((d) => d.isOverloaded).length;
      const hasAnyAssignment = project.tasks.some((task) =>
        task.assignments.some((a) => a.teamMember.id === member.id),
      );

      return {
        memberId: member.id,
        name: member.name,
        role: member.role || "N/A",
        assignedDays,
        idleDays,
        idleDaysPct: (idleDays / totalDays) * 100,
        avgUtilization,
        avgIdlePct,
        overloadDays,
        hasAnyAssignment,
      };
    });

    const idleChartData = memberSummary.map((m) => ({
      member: m.name,
      idleDaysPct: Number(m.idleDaysPct.toFixed(1)),
      avgUtilization: Number(m.avgUtilization.toFixed(1)),
    }));

    return {
      totalDays,
      dailyRows,
      memberSummary,
      utilizationGraphData: dailyRows.map((d) => d.graphRow),
      idleChartData,
    };
  }, [project]);

  if (!analytics || !analytics.utilizationGraphData.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-2xl bg-muted/20 border-dashed">
        <h3 className="text-lg font-semibold">Not enough data</h3>
        <p className="text-muted-foreground mt-2">
          Assign team members to scheduled tasks to see utilization and idle analytics.
        </p>
      </div>
    );
  }

  const colors = project.teamMembers.map((_, i) => {
    const hue = (i * 137.508) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  });

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50 shadow-xl shadow-black/5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-display font-semibold">Team Utilization and Idle Insights</h3>
          <p className="text-sm text-muted-foreground">
            Toggle between graphical and tabular views with member-wise idle metrics.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={viewMode === "graph" ? "default" : "outline"}
            onClick={() => setViewMode("graph")}
            className="rounded-xl"
          >
            Graph View
          </Button>
          <Button
            type="button"
            variant={viewMode === "table" ? "default" : "outline"}
            onClick={() => setViewMode("table")}
            className="rounded-xl"
          >
            Table View
          </Button>
        </div>
      </div>

      {viewMode === "graph" ? (
        <div className="space-y-6">
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.utilizationGraphData} margin={{ top: 20, right: 20, left: 20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} unit="%" />
                <Tooltip />
                <Legend />
                {project.teamMembers.map((member, i) => (
                  <Bar
                    key={member.id}
                    dataKey={`util_${member.id}`}
                    name={member.name}
                    stackId="util"
                    fill={colors[i]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.idleChartData} margin={{ top: 20, right: 20, left: 20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="member" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="idleDaysPct" name="Idle Days (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgUtilization" name="Avg Utilization (%)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border rounded-xl overflow-hidden bg-card">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Assigned Days</th>
                  <th className="px-4 py-3">Idle Days</th>
                  <th className="px-4 py-3">Idle %</th>
                  <th className="px-4 py-3">Avg Util %</th>
                  <th className="px-4 py-3">Avg Idle %</th>
                  <th className="px-4 py-3">Overload Days</th>
                  <th className="px-4 py-3">Assignment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analytics.memberSummary.map((member) => (
                  <tr key={member.memberId}>
                    <td className="px-4 py-3 font-medium">{member.name}</td>
                    <td className="px-4 py-3">{member.role}</td>
                    <td className="px-4 py-3">{member.assignedDays}</td>
                    <td className="px-4 py-3">{member.idleDays}</td>
                    <td className="px-4 py-3">{member.idleDaysPct.toFixed(1)}%</td>
                    <td className="px-4 py-3">{member.avgUtilization.toFixed(1)}%</td>
                    <td className="px-4 py-3">{member.avgIdlePct.toFixed(1)}%</td>
                    <td className="px-4 py-3">{member.overloadDays}</td>
                    <td className="px-4 py-3">
                      {member.hasAnyAssignment ? "Assigned" : "No tasks assigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border rounded-xl overflow-hidden bg-card max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Utilization %</th>
                  <th className="px-4 py-3">Idle %</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analytics.dailyRows.flatMap((day) =>
                  day.members.map((member) => (
                    <tr key={`${format(day.date, "yyyy-MM-dd")}-${member.memberId}`}>
                      <td className="px-4 py-3">{format(day.date, "yyyy-MM-dd")}</td>
                      <td className="px-4 py-3">{member.name}</td>
                      <td className="px-4 py-3">{member.utilization}%</td>
                      <td className="px-4 py-3">{member.idlePct}%</td>
                      <td className="px-4 py-3">
                        {member.isOverloaded ? "Overloaded" : member.hasNoTask ? "Idle" : "Allocated"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {member.tasks.length ? member.tasks.join(", ") : "No task"}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
