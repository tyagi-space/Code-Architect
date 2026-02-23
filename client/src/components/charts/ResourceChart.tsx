import { useMemo } from "react";
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

interface ResourceChartProps {
  project: FullProjectResponse;
}

export function ResourceChart({ project }: ResourceChartProps) {
  const data = useMemo(() => {
    if (!project.startDate || !project.tasks.length || !project.teamMembers.length) {
      return [];
    }

    const start = parseISO(project.startDate);
    const maxEnd = project.tasks.reduce((latest, task) => {
      if (!task.endDate) return latest;
      const taskEnd = parseISO(task.endDate);
      return taskEnd > latest ? taskEnd : latest;
    }, parseISO(project.endDate || project.startDate));

    const totalDays = differenceInDays(maxEnd, start) + 1;
    
    // Create an array of daily utilization data
    const dailyData = Array.from({ length: totalDays }).map((_, i) => {
      const currentDay = addDays(start, i);
      const dayRecord: any = { 
        date: format(currentDay, 'MMM d'),
        fullDate: currentDay 
      };

      // Initialize all members to 0 for this day
      project.teamMembers.forEach(member => {
        dayRecord[member.name] = 0;
      });

      // Calculate utilization from active tasks on this day
      project.tasks.forEach(task => {
        if (!task.startDate || !task.endDate) return;
        const taskStart = parseISO(task.startDate);
        const taskEnd = parseISO(task.endDate);

        if (isWithinInterval(currentDay, { start: taskStart, end: taskEnd })) {
          task.assignments.forEach(assignment => {
            if (dayRecord[assignment.teamMember.name] !== undefined) {
               // Add the utilization percentage
               dayRecord[assignment.teamMember.name] += assignment.utilization;
            }
          });
        }
      });

      return dayRecord;
    });

    return dailyData;
  }, [project]);

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-2xl bg-muted/20 border-dashed">
        <h3 className="text-lg font-semibold">Not enough data</h3>
        <p className="text-muted-foreground mt-2">Assign team members to scheduled tasks to see resource utilization.</p>
      </div>
    );
  }

  // Generate distinct colors for team members using HSL
  const colors = project.teamMembers.map((_, i) => {
    const hue = (i * 137.508) % 360; // Use golden angle approximation for distinct colors
    return `hsl(${hue}, 70%, 50%)`;
  });

  return (
    <div className="glass-card rounded-2xl p-6 h-[500px] border border-border/50 shadow-xl shadow-black/5">
      <div className="mb-6">
        <h3 className="text-lg font-display font-semibold">Daily Resource Utilization (%)</h3>
        <p className="text-sm text-muted-foreground">Values over 100% indicate overallocation on that day.</p>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              borderRadius: '0.75rem',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ fontWeight: 500 }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {project.teamMembers.map((member, i) => (
            <Bar 
              key={member.id} 
              dataKey={member.name} 
              stackId="a" 
              fill={colors[i]} 
              radius={i === project.teamMembers.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={60}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
