import { useMemo } from "react";
import { differenceInDays, addDays, format, parseISO, isSameDay } from "date-fns";
import { type FullProjectResponse } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GanttChartProps {
  project: FullProjectResponse;
}

export function GanttChart({ project }: GanttChartProps) {
  const { timeline, totalDays } = useMemo(() => {
    if (!project.tasks.length || !project.startDate) {
      return { timeline: [], totalDays: 0 };
    }

    const start = parseISO(project.startDate);
    // Find the latest end date among all tasks, or fallback to project end date
    const maxEnd = project.tasks.reduce((latest, task) => {
      if (!task.endDate) return latest;
      const taskEnd = parseISO(task.endDate);
      return taskEnd > latest ? taskEnd : latest;
    }, parseISO(project.endDate || project.startDate));
    
    // Add a 14-day buffer at the end for visual breathing room
    const visualEnd = addDays(maxEnd, 14);
    const totalDays = Math.max(differenceInDays(visualEnd, start) + 1, 30); // At least 30 days
    
    const timeline = Array.from({ length: totalDays }).map((_, i) => addDays(start, i));
    
    return { timeline, totalDays };
  }, [project]);

  if (!project.tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-2xl bg-muted/20 border-dashed">
        <h3 className="text-lg font-semibold">No tasks scheduled</h3>
        <p className="text-muted-foreground mt-2">Add tasks to see your Gantt chart timeline.</p>
      </div>
    );
  }

  const projectStart = parseISO(project.startDate);

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-border/50 shadow-xl shadow-black/5">
      <div className="overflow-x-auto gantt-scroll p-6">
        <div className="min-w-[800px]">
          {/* Timeline Header (Months/Days) */}
          <div 
            className="grid gap-px border-b border-border/50 pb-2 mb-4 sticky top-0 bg-card/80 backdrop-blur z-10"
            style={{ gridTemplateColumns: `250px repeat(${totalDays}, minmax(32px, 1fr))` }}
          >
            <div className="font-semibold text-sm text-muted-foreground pt-6 pl-2">Task Name</div>
            {timeline.map((day, i) => (
              <div key={i} className="flex flex-col items-center justify-end">
                {/* Only show month name if it's the 1st of the month or the very first column */}
                {(day.getDate() === 1 || i === 0) && (
                  <span className="text-xs font-medium text-muted-foreground mb-1 whitespace-nowrap">
                    {format(day, 'MMM')}
                  </span>
                )}
                <span className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full ${isSameDay(day, new Date()) ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground/70'}`}>
                  {format(day, 'd')}
                </span>
              </div>
            ))}
          </div>

          {/* Tasks Rows */}
          <div className="flex flex-col gap-3">
            {project.tasks.map((task) => {
              if (!task.startDate || !task.endDate) return null;
              
              const taskStart = parseISO(task.startDate);
              const taskEnd = parseISO(task.endDate);
              
              const startOffset = Math.max(0, differenceInDays(taskStart, projectStart));
              const duration = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
              
              return (
                <div 
                  key={task.id}
                  className="grid gap-px items-center group hover:bg-muted/30 rounded-lg transition-colors pr-4"
                  style={{ gridTemplateColumns: `250px repeat(${totalDays}, minmax(32px, 1fr))` }}
                >
                  <div className="pl-2 pr-4 truncate font-medium text-sm text-foreground/90 group-hover:text-foreground">
                    {task.name}
                  </div>
                  
                  {/* The Bar Container */}
                  <div 
                    className="relative h-8 w-full"
                    style={{ 
                      gridColumnStart: startOffset + 2, // +2 because 1st col is Task Name
                      gridColumnEnd: `span ${duration}` 
                    }}
                  >
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute inset-0 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded-md transition-all duration-200 cursor-pointer overflow-hidden flex items-center shadow-sm">
                             {/* Progress indicator could go here, for now solid fill */}
                             <div className="h-full bg-primary/40 w-full" />
                             
                             <div className="absolute inset-0 px-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-mono font-medium text-primary-foreground mix-blend-difference">{duration}d</span>
                             </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="flex flex-col gap-1 p-3 shadow-xl border-border/50">
                          <p className="font-bold text-sm">{task.name}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span>Start:</span>
                            <span className="font-mono text-foreground">{format(taskStart, 'MMM d, yyyy')}</span>
                            <span>End:</span>
                            <span className="font-mono text-foreground">{format(taskEnd, 'MMM d, yyyy')}</span>
                            <span>Duration:</span>
                            <span className="font-mono text-foreground">{duration} days</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
