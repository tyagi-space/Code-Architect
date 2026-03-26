import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { format, parseISO } from "date-fns";
import { Calendar, Users, ListTodo, BarChart3, Trash2, Wand2, Clock, Download, Pencil } from "lucide-react";
import { type FullProjectResponse } from "@shared/schema";
import { Navbar } from "@/components/layout/Navbar";
import { GanttChart } from "@/components/gantt/GanttChart";
import { ResourceChart } from "@/components/charts/ResourceChart";
import { ProjectAnalytics } from "@/components/charts/ProjectAnalytics";
import {
  useProjectFull,
  useProjectSummary,
  useProjectUtilization,
  useExportProjectExcel,
} from "@/hooks/use-projects";
import {
  useCreateTask,
  useCreateTaskAssignment,
  useCreateTaskDependency,
  useUpdateTask,
  useDeleteTask,
  useGenerateSchedule,
} from "@/hooks/use-tasks";
import { useCreateTeamMember, useDeleteTeamMember } from "@/hooks/use-team";
import { useCreateHoliday, useDeleteHoliday } from "@/hooks/use-holidays";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function ProjectView() {
  const [, params] = useRoute("/projects/:id");
  const projectId = Number(params?.id);
  const { toast } = useToast();

  const { data: project, isLoading, isError } = useProjectFull(projectId);
  const { data: summary } = useProjectSummary(projectId);
  const { data: utilization } = useProjectUtilization(projectId);
  const generateSchedule = useGenerateSchedule();
  const exportExcel = useExportProjectExcel();

  const handleGenerateSchedule = async () => {
    try {
      await generateSchedule.mutateAsync(projectId);
      toast({ title: "Success", description: "Schedule generated and dates optimized." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleExport = async () => {
    try {
      await exportExcel.mutateAsync(projectId);
      toast({ title: "Success", description: "Detailed single-sheet Gantt report exported." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background/50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="min-h-screen bg-background/50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Project not found</h2>
            <p className="text-muted-foreground mt-2">The requested project could not be loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/50 flex flex-col">
      <Navbar />

      <header className="bg-card border-b py-8">
        <div className="container mx-auto px-4 sm:px-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
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
                <span>Start: {format(parseISO(project.startDate), "MMM d, yyyy")}</span>
              </div>
              {project.endDate && (
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4" />
                  <span>Target: {format(parseISO(project.endDate), "MMM d, yyyy")}</span>
                </div>
              )}
              {summary && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold ${
                    summary.isDelayed || summary.isOverdueNow
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  <span>
                    {summary.isDelayed || summary.isOverdueNow
                      ? `Delayed by ${summary.delayDays} day(s)`
                      : "On track"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exportExcel.isPending}
              className="rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              {exportExcel.isPending ? "Exporting..." : "Export Excel Report"}
            </Button>
            <Button
              onClick={handleGenerateSchedule}
              disabled={generateSchedule.isPending}
              className="rounded-xl shadow-lg shadow-primary/20"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {generateSchedule.isPending ? "Calculating..." : "Auto-Generate Schedule"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-8 py-8 flex-1">
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="h-14 bg-muted/50 p-1 mb-8 rounded-xl w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="tasks" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <ListTodo className="w-4 h-4 mr-2" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="gantt" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <BarChart3 className="w-4 h-4 mr-2 rotate-90" /> Gantt
            </TabsTrigger>
            <TabsTrigger value="resources" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" /> Resources
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <BarChart3 className="w-4 h-4 mr-2" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="team" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" /> Team
            </TabsTrigger>
            <TabsTrigger value="holidays" className="rounded-lg h-full px-6 data-[state=active]:shadow-sm">
              <Calendar className="w-4 h-4 mr-2" /> Holidays
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

          <TabsContent value="analytics" className="mt-0 focus-visible:outline-none">
            <ProjectAnalytics project={project} summary={summary} utilization={utilization} />
          </TabsContent>

          <TabsContent value="team" className="mt-0 focus-visible:outline-none">
            <TeamManagementTab project={project} />
          </TabsContent>

          <TabsContent value="holidays" className="mt-0 focus-visible:outline-none">
            <HolidayManagementTab project={project} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TaskManagementTab({ project }: { project: FullProjectResponse }) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createAssignment = useCreateTaskAssignment();
  const createDependency = useCreateTaskDependency();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isDepOpen, setIsDepOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    moduleName: "",
    description: "",
    duration: 1,
    bufferTime: 0,
    estimatedEffort: 8,
    priority: "Medium",
    status: "pending",
  });
  const [assignData, setAssignData] = useState({ taskId: "", teamMemberId: "", utilization: 100 });
  const [depData, setDepData] = useState({ taskId: "", dependsOnTaskId: "" });
  const [editFormData, setEditFormData] = useState({
    name: "",
    moduleName: "",
    description: "",
    duration: 1,
    bufferTime: 0,
    estimatedEffort: 8,
    priority: "Medium",
    status: "pending",
  });

  const taskRows = useMemo(
    () =>
      project.tasks.map((task) => ({
        ...task,
        assignees: task.assignments.map((a) => `${a.teamMember.name} (${a.utilization}%)`).join(", "),
      })),
    [project.tasks],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      await createTask.mutateAsync({
        projectId: project.id,
        data: {
          name: formData.name,
          moduleName: formData.moduleName || null,
          description: formData.description || null,
          duration: Number(formData.duration),
          bufferTime: Number(formData.bufferTime),
          estimatedEffort: Number(formData.estimatedEffort),
          priority: formData.priority,
          status: formData.status,
        },
      });
      setIsOpen(false);
      setFormData({
        name: "",
        moduleName: "",
        description: "",
        duration: 1,
        bufferTime: 0,
        estimatedEffort: 8,
        priority: "Medium",
        status: "pending",
      });
      toast({ title: "Task added with detailed metadata" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignData.taskId || !assignData.teamMemberId) return;
    try {
      await createAssignment.mutateAsync({
        projectId: project.id,
        taskId: Number(assignData.taskId),
        data: {
          teamMemberId: Number(assignData.teamMemberId),
          utilization: Number(assignData.utilization),
        },
      });
      setIsAssignOpen(false);
      setAssignData({ taskId: "", teamMemberId: "", utilization: 100 });
      toast({ title: "Resource assignment created" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depData.taskId || !depData.dependsOnTaskId || depData.taskId === depData.dependsOnTaskId) return;
    try {
      await createDependency.mutateAsync({
        projectId: project.id,
        taskId: Number(depData.taskId),
        data: {
          dependsOnTaskId: Number(depData.dependsOnTaskId),
        },
      });
      setIsDepOpen(false);
      setDepData({ taskId: "", dependsOnTaskId: "" });
      toast({ title: "Task dependency added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openEditTask = (task: FullProjectResponse["tasks"][number]) => {
    setEditingTaskId(task.id);
    setEditFormData({
      name: task.name,
      moduleName: task.moduleName || "",
      description: task.description || "",
      duration: task.duration,
      bufferTime: task.bufferTime || 0,
      estimatedEffort: task.estimatedEffort || 0,
      priority: task.priority,
      status: task.status,
    });
    setIsEditOpen(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskId || !editFormData.name) return;
    try {
      await updateTask.mutateAsync({
        id: editingTaskId,
        projectId: project.id,
        data: {
          name: editFormData.name,
          moduleName: editFormData.moduleName || null,
          description: editFormData.description || null,
          duration: Number(editFormData.duration),
          bufferTime: Number(editFormData.bufferTime),
          estimatedEffort: Number(editFormData.estimatedEffort),
          priority: editFormData.priority,
          status: editFormData.status,
        },
      });
      setIsEditOpen(false);
      setEditingTaskId(null);
      toast({ title: "Task/module updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await deleteTask.mutateAsync({ id: taskId, projectId: project.id });
      toast({ title: "Task deleted successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveModule = async (task: FullProjectResponse["tasks"][number]) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        projectId: project.id,
        data: { moduleName: null },
      });
      toast({ title: "Module removed from task" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 shadow-sm border border-border/50 space-y-6">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Detailed Task Planning</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Capture modules, effort, dependencies, and resource assignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl">Assign Resource</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Assign Resource to Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAssign} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Task</Label>
                  <Select value={assignData.taskId} onValueChange={(v) => setAssignData((p) => ({ ...p, taskId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
                    <SelectContent>
                      {project.tasks.map((task) => (
                        <SelectItem key={task.id} value={String(task.id)}>{task.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Team Member</Label>
                  <Select value={assignData.teamMemberId} onValueChange={(v) => setAssignData((p) => ({ ...p, teamMemberId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>
                      {project.teamMembers.map((member) => (
                        <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Utilization (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={assignData.utilization}
                    onChange={(e) => setAssignData((p) => ({ ...p, utilization: Number(e.target.value) }))}
                  />
                </div>
                <Button type="submit" className="w-full">Save Assignment</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDepOpen} onOpenChange={setIsDepOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl">Add Dependency</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add Task Dependency</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleDependency} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Task</Label>
                  <Select value={depData.taskId} onValueChange={(v) => setDepData((p) => ({ ...p, taskId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Dependent task" /></SelectTrigger>
                    <SelectContent>
                      {project.tasks.map((task) => (
                        <SelectItem key={task.id} value={String(task.id)}>{task.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Depends On</Label>
                  <Select value={depData.dependsOnTaskId} onValueChange={(v) => setDepData((p) => ({ ...p, dependsOnTaskId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Predecessor task" /></SelectTrigger>
                    <SelectContent>
                      {project.tasks.map((task) => (
                        <SelectItem key={task.id} value={String(task.id)}>{task.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Save Dependency</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">Add Detailed Task</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Detailed Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Task Name</Label>
                    <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Module</Label>
                    <Input value={formData.moduleName} onChange={(e) => setFormData((p) => ({ ...p, moduleName: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input type="number" min="1" value={formData.duration} onChange={(e) => setFormData((p) => ({ ...p, duration: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Buffer</Label>
                    <Input type="number" min="0" value={formData.bufferTime} onChange={(e) => setFormData((p) => ({ ...p, bufferTime: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Effort (Hrs)</Label>
                    <Input type="number" min="0" value={formData.estimatedEffort} onChange={(e) => setFormData((p) => ({ ...p, estimatedEffort: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData((p) => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createTask.isPending}>
                  {createTask.isPending ? "Adding..." : "Add Task"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="rounded-2xl sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Task / Module</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateTask} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Task Name</Label>
                    <Input
                      value={editFormData.name}
                      onChange={(e) => setEditFormData((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Module</Label>
                    <div className="flex gap-2">
                      <Input
                        value={editFormData.moduleName}
                        onChange={(e) => setEditFormData((p) => ({ ...p, moduleName: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditFormData((p) => ({ ...p, moduleName: "" }))}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input
                      type="number"
                      min="1"
                      value={editFormData.duration}
                      onChange={(e) => setEditFormData((p) => ({ ...p, duration: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Buffer</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editFormData.bufferTime}
                      onChange={(e) => setEditFormData((p) => ({ ...p, bufferTime: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Effort (Hrs)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editFormData.estimatedEffort}
                      onChange={(e) => setEditFormData((p) => ({ ...p, estimatedEffort: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={editFormData.priority}
                      onValueChange={(v) => setEditFormData((p) => ({ ...p, priority: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(v) => setEditFormData((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={updateTask.isPending}>
                  {updateTask.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
            <tr>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Resources</th>
              <th className="px-4 py-3">Deps</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {taskRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                  No tasks defined yet.
                </td>
              </tr>
            ) : (
              taskRows.map((task) => (
                <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{task.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{task.description || "No description"}</div>
                  </td>
                  <td className="px-4 py-3">{task.moduleName || "Unassigned"}</td>
                  <td className="px-4 py-3 capitalize">{task.status.replace("_", " ")}</td>
                  <td className="px-4 py-3">{task.duration}d + {task.bufferTime || 0}b</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {task.startDate && task.endDate
                      ? `${format(parseISO(task.startDate), "MMM d")} - ${format(parseISO(task.endDate), "MMM d")}`
                      : "Unscheduled"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{task.assignees || "None"}</td>
                  <td className="px-4 py-3">{task.dependencies.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditTask(task)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveModule(task)}
                        disabled={updateTask.isPending || !task.moduleName}
                      >
                        Remove Module
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteTask(task.id)}
                        disabled={deleteTask.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
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

function TeamManagementTab({ project }: { project: FullProjectResponse }) {
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
        },
      });
      setIsOpen(false);
      setFormData({ name: "", role: "", maxCapacity: 100, costPerDay: 0 });
      toast({ title: "Team member added" });
    } catch (err: any) {
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
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Role (Optional)</Label>
                <Input value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Capacity (%)</Label>
                  <Input type="number" min="0" max="100" value={formData.maxCapacity} onChange={(e) => setFormData({ ...formData, maxCapacity: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Daily Cost ($)</Label>
                  <Input type="number" min="0" value={formData.costPerDay} onChange={(e) => setFormData({ ...formData, costPerDay: Number(e.target.value) })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMember.isPending}>
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
          project.teamMembers.map((member) => (
            <div key={member.id} className="p-4 rounded-xl border bg-card flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold">{member.name}</h4>
                    <p className="text-xs text-muted-foreground">{member.role || "No role defined"}</p>
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

function HolidayManagementTab({ project }: { project: FullProjectResponse }) {
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ date: "", name: "", isGlobal: 1 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.name) return;
    try {
      await createHoliday.mutateAsync({
        projectId: project.id,
        data: {
          date: formData.date,
          name: formData.name,
          isGlobal: Number(formData.isGlobal),
        },
      });
      setFormData({ date: "", name: "", isGlobal: 1 });
      toast({ title: "Holiday added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 shadow-sm border border-border/50 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Holiday Calendar</h2>
        <p className="text-sm text-muted-foreground mt-1">Use holidays to improve scheduling realism.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Input type="date" value={formData.date} onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} required />
        <Input placeholder="Holiday name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} required />
        <Select value={String(formData.isGlobal)} onValueChange={(v) => setFormData((p) => ({ ...p, isGlobal: Number(v) }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Global</SelectItem>
            <SelectItem value="0">Project-specific</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={createHoliday.isPending}>{createHoliday.isPending ? "Adding..." : "Add Holiday"}</Button>
      </form>

      <div className="border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {project.holidays.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No holidays configured.</td>
              </tr>
            ) : (
              project.holidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td className="px-4 py-3">{holiday.date}</td>
                  <td className="px-4 py-3">{holiday.name}</td>
                  <td className="px-4 py-3">{holiday.isGlobal ? "Global" : "Project"}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => deleteHoliday.mutate({ id: holiday.id, projectId: project.id })}
                      disabled={deleteHoliday.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
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
