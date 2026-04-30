import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Box, 
  List, 
  Wrench, 
  ClipboardCheck, 
  Package, 
  FileText, 
  Settings, 
  LogOut 
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "DASHBOARD", href: "/dashboard" },
  { icon: Box, label: "3D MODEL", href: "/" },
  { icon: List, label: "PARTS", href: "/parts" },
  { icon: Wrench, label: "TOOLS", href: "/tools" },
  { icon: ClipboardCheck, label: "MAINTENANCE", href: "/maintenance" },
  { icon: Package, label: "INVENTORY", href: "/inventory" },
  { icon: FileText, label: "DOCUMENTS", href: "/documents" },
  { icon: Settings, label: "SETTINGS", href: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-16 md:w-20 bg-sidebar flex flex-col items-center py-4 border-r border-sidebar-border shrink-0 h-screen sticky top-0 overflow-y-auto">
      <div className="mb-8 px-2 flex justify-center w-full">
        <div className="w-10 h-10 bg-primary/20 flex items-center justify-center rounded">
          <Box className="w-6 h-6 text-primary" />
        </div>
      </div>
      
      <nav className="flex-1 w-full flex flex-col gap-2 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div 
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded cursor-pointer transition-colors duration-200 group",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                title={item.label}
              >
                <item.icon className="w-5 h-5 mb-1" />
                <span className="text-[10px] leading-none font-medium tracking-wider text-center hidden md:block opacity-0 group-hover:opacity-100 transition-opacity h-0 group-hover:h-auto overflow-hidden">
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 w-full pt-4">
        <div className="flex flex-col items-center justify-center p-2 rounded cursor-pointer text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group">
          <LogOut className="w-5 h-5 mb-1" />
          <span className="text-[10px] leading-none font-medium tracking-wider text-center hidden md:block opacity-0 group-hover:opacity-100 transition-opacity h-0 group-hover:h-auto overflow-hidden">
            LOGOUT
          </span>
        </div>
      </div>
    </aside>
  );
}
