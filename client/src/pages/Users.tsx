import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useCreateUser, useCurrentUser, useUsers } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function UsersPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: users, isLoading } = useUsers(currentUser?.role === "admin");
  const createUser = useCreateUser();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    phone: "",
    password: "",
    role: "user" as "admin" | "manager" | "user",
  });

  const onCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync(formData);
      setFormData({ fullName: "", username: "", phone: "", password: "", role: "user" });
      toast({ title: "User created" });
    } catch (err: any) {
      toast({ title: "Create user failed", description: err.message, variant: "destructive" });
    }
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background/50">
        <Navbar />
        <main className="container mx-auto px-4 sm:px-8 py-12">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="text-muted-foreground mt-2">Only admin can manage users.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/50">
      <Navbar />
      <main className="container mx-auto px-4 sm:px-8 py-10 space-y-8">
        <section className="glass-card rounded-2xl p-6 border border-border/50">
          <h2 className="text-xl font-bold mb-4">Add User</h2>
          <form onSubmit={onCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input value={formData.fullName} onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Username</Label>
              <Input value={formData.username} onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v: "admin" | "manager" | "user") => setFormData((p) => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="manager">manager</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </section>

        <section className="glass-card rounded-2xl p-6 border border-border/50">
          <h2 className="text-xl font-bold mb-4">Users</h2>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Username</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(users || []).map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3">{user.fullName}</td>
                      <td className="px-4 py-3">{user.username}</td>
                      <td className="px-4 py-3">{user.phone}</td>
                      <td className="px-4 py-3">{user.role}</td>
                      <td className="px-4 py-3">{user.isActive ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
