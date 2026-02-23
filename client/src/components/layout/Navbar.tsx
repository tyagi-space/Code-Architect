import { Link } from "wouter";
import { LayoutDashboard, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="bg-primary/10 p-2 rounded-xl">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-foreground">
            PlanFlow
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
              <LayoutDashboard className="h-4 w-4" />
              All Projects
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
