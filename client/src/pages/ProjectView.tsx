import { useState } from "react";
import { useRoute } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { useProjectFull } from "@/hooks/use-projects";
import { useCreateTask, useGenerateSchedule } from "@/hooks/use-tasks";
import { useCreateTeamMember, useDeleteTeamMember } from "@/hooks/use-team";
import { GanttChart } from "@/components/gantt/GanttChart";
import { ResourceChart } from "@/components/charts/ResourceChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, ListTodo, BarChart3, Settings2, Trash2, Wand2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function ProjectView() {
  const [, params] = useRoute("/projects/:id");
  const projectId = Number(params?.id);
  
  const { data: project, isLoading } = useProjectFull(projectId);
  const generateSchedule = useGenerateSchedule();
  const { toast } = useToast();

  const handleGenerateSchedule = async () => {
    try {
      await generateSchedule.mutateAsync(projectId);
      toast({ title: "Success", description: "Schedule generated and dates optimized." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading || !project) {
    return (
      <div className="min-h-screen bg-background/50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/50 flex flex-col">
      <Navbar />
      
      {/* Project Header */}
      <header className="bg-card border-b py-8">
        <div className="container mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground mb-2">
              <span>Projects</span>
              <span>/</span>
              <span className="text-primary">{project.name}</span>
            </div>
            <h1 className="text-3xl font-extrabold">{project.name}</h1>
            <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full">
                <Calendar className="w-4 h-4" />
                <span>Start: {format(parseISO(project.startDate), 'MMM d, yyyy')}</span>
              </div>
              {project.endDate && (
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4" />
                  <span>Target: {format(parseISO(project.endDate), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
          </div>
          
          <Button 
            onClick={handleGenerateSchedule}
            disabled={generateSchedule.isPending}
            className="rounded-xl shadow-lg shadow-primary/20"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {generateSchedule.isPending ? "Calculating..." : "Auto-Generate Schedule"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-8 py-8 flex-1">
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="h-14 bg-muted/50 p-1 mb-8 rounded-xl w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="tasks" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <ListTodo className="w-4 h-4 mr-2" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="gantt" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <BarChart3 className="w-4 h-4 mr-2 rotate-90" /> Gantt Chart
            </TabsTrigger>
            <TabsTrigger value="resources" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" /> Resources
            </TabsTrigger>
            <TabsTrigger value="team" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" /> Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
            <TaskManagementTab project={project} />
          </TabsContent>
          
          <TabsContent value="gantt" className="mt-0 focus-visible:outline-none">
            <GanttChart project={project} />
          </TabsContent>

          <TabsContent value="resources" className="mt-0 focus-visible:outline-none">
            <ResourceChart project={project} />
          </TabsContent>

          <TabsContent value="team" className="mt-0 focus-visible:outline-none">
            <TeamManagementTab project={project} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Sub-components for Tabs to keep file manageable

function TaskManagementTab({ project }: { project: any }) {
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", duration: 1, priority: "Medium" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      await createTask.mutateAsync({
        projectId: project.id,
        data: {
          name: formData.name,
          duration: Number(formData.duration),
          priority: formData.priority,
          bufferTime: 0,
        }
      });
      setIsOpen(false);
      setFormData({ name: "", duration: 1, priority: "Medium" });
      toast({ title: "Task added successfully" });
    } catch(err:any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 shadow-sm border border-border/50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Project Tasks</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage deliverables and execution steps.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">Add Task</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Task Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-xl h-11" required />
              </div>
              <div className="space-y-2">
                <Label>Duration (Days)</Label>
                <Input type="number" min="1" value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} className="rounded-xl h-11" required />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full rounded-xl h-11" disabled={createTask.isPending}>
                {createTask.isPending ? "Adding..." : "Add Task"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
            <tr>
              <th className="px-6 py-4">Task Name</th>
              <th className="px-6 py-4">Duration</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Dates</th>
              <th className="px-6 py-4">Dependencies</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {project.tasks.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No tasks defined yet.</td></tr>
            ) : (
              project.tasks.map((task: any) => (
                <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium">{task.name}</td>
                  <td className="px-6 py-4">{task.duration} days</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      task.priority === 'High' ? 'bg-destructive/10 text-destructive' : 
                      task.priority === 'Medium' ? 'bg-primary/10 text-primary' : 
                      'bg-muted text-muted-foreground'
                    }`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {task.startDate ? `${format(parseISO(task.startDate), 'MMM d')} - ${format(parseISO(task.endDate), 'MMM d')}` : 'Unscheduled'}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {task.dependencies?.length || 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamManagementTab({ project }: { project: any }) {
  const createMember = useCreateTeamMember();
  const deleteMember = useDeleteTeamMember();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", role: "", maxCapacity: 100, costPerDay: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      await createMember.mutateAsync({
        projectId: project.id,
        data: {
          name: formData.name,
          role: formData.role,
          maxCapacity: Number(formData.maxCapacity),
          costPerDay: Number(formData.costPerDay),
        }
      });
      setIsOpen(false);
      setFormData({ name: "", role: "", maxCapacity: 100, costPerDay: 0 });
      toast({ title: "Team member added" });
    } catch(err:any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 shadow-sm border border-border/50">
       <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Team Members</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage project resources and capacities.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">Add Member</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-xl h-11" required />
              </div>
              <div className="space-y-2">
                <Label>Role (Optional)</Label>
                <Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="rounded-xl h-11" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Capacity (%)</Label>
                  <Input type="number" min="0" max="100" value={formData.maxCapacity} onChange={e => setFormData({...formData, maxCapacity: Number(e.target.value)})} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Daily Cost ($)</Label>
                  <Input type="number" min="0" value={formData.costPerDay} onChange={e => setFormData({...formData, costPerDay: Number(e.target.value)})} className="rounded-xl h-11" />
                </div>
              </div>
              <Button type="submit" className="w-full rounded-xl h-11" disabled={createMember.isPending}>
                {createMember.isPending ? "Adding..." : "Add Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {project.teamMembers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl border-dashed">
            No team members added yet.
          </div>
        ) : (
          project.teamMembers.map((member: any) => (
            <div key={member.id} className="p-4 rounded-xl border bg-card flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold">{member.name}</h4>
                    <p className="text-xs text-muted-foreground">{member.role || 'No role defined'}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10 -mt-2 -mr-2"
                  onClick={() => deleteMember.mutate({ id: member.id, projectId: project.id })}
                  disabled={deleteMember.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Capacity</span>
                  <span className="font-medium">{member.maxCapacity}%</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-muted-foreground text-xs">Cost/Day</span>
                  <span className="font-medium">${member.costPerDay || 0}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
