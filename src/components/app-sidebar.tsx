import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, Boxes, Wind, Scissors, FileBarChart2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Journal (Workbook)", url: "/journal", icon: ClipboardList },
  { title: "Inventaire Bulk", url: "/journal?tab=inventory", icon: Boxes, plain: true },
  { title: "Curing Logs", url: "/curing", icon: Wind },
  { title: "Arvest / Packaging", url: "/harvest", icon: Scissors },
  { title: "Rapports", url: "/reports", icon: FileBarChart2 },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground grid place-items-center font-bold">
            P
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm">PostHarvest</span>
            <span className="text-xs text-muted-foreground">Central</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const base = item.url.split("?")[0];
                const active = pathname === base;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={base} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
