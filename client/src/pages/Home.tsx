import { useState } from "react";
import { Link } from "wouter";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Clock, Plus, ArrowRight, FolderKanban } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", startDate: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate) {
       toast({ title: "Validation Error", description: "Name and start date are required", variant: "destructive" });
       return;
    }
    
    try {
      await createProject.mutateAsync({
        name: formData.name,
        startDate: formData.startDate,
        workingDays: [1, 2, 3, 4, 5], // Default Mon-Fri
      });
      setIsDialogOpen(false);
      setFormData({ name: "", startDate: "" });
      toast({ title: "Success", description: "Project created successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background/50">
      <Navbar />
      
      <main className="container mx-auto px-4 sm:px-8 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Your Projects</h1>
            <p className="text-muted-foreground mt-2 text-lg">Manage timelines, resources, and dependencies.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                <Plus className="w-5 h-5 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl">Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-6 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Q4 Website Redesign" 
                    className="h-12 rounded-xl"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Target Start Date</Label>
                  <Input 
                    id="startDate" 
                    type="date"
                    className="h-12 rounded-xl"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl text-md" disabled={createProject.isPending}>
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card h-48 rounded-3xl border border-border/50"></div>
            ))}
          </div>
        ) : projects?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center glass-card rounded-3xl border-dashed">
            <div className="bg-primary/10 p-6 rounded-full mb-6">
              <FolderKanban className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">No projects yet</h2>
            <p className="text-muted-foreground mt-2 max-w-sm text-balance">
              Get started by creating your first project to plan tasks and visualize your timeline.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-8 rounded-xl" variant="outline">
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="group bg-card rounded-3xl p-6 border border-border/60 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-primary/10 text-primary p-2.5 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  
                  <div className="mt-auto pt-6 space-y-3">
                    <div className="flex items-center text-sm text-muted-foreground font-medium">
                      <Calendar className="w-4 h-4 mr-2 opacity-70" />
                      Starts: {format(parseISO(project.startDate), 'MMM d, yyyy')}
                    </div>
                    {project.endDate && (
                      <div className="flex items-center text-sm text-muted-foreground font-medium">
                        <Clock className="w-4 h-4 mr-2 opacity-70" />
                        Ends: {format(parseISO(project.endDate), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
