import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Trophy,
  LogOut,
  Moon,
  Sun,
  Users,
  ClipboardCheck,
  BookOpen,
  Megaphone,
  Menu,
  X,
  GraduationCap,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  getStudentNoticesServerFn,
  getAdminsListServerFn,
} from "@/services/student.functions";
import { AdminRecruitmentPopup } from "@/components/AdminRecruitmentPopup";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const studentNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tests", label: "Tests", icon: FileText },
  { to: "/submissions", label: "Submissions", icon: Upload },
  { to: "/syllabus", label: "Syllabus", icon: BookOpen },
  { to: "/notices", label: "Notices", icon: Megaphone },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/tests", label: "Tests", icon: BookOpen },
  { to: "/admin/submissions", label: "Evaluations", icon: ClipboardCheck },
  { to: "/admin/notices", label: "Notices", icon: Megaphone },
  { to: "/admin/users", label: "Students", icon: Users },
];

export function AppLayout() {
  const { user, role, token, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [newNotice, setNewNotice] = useState<{
    id: string;
    text: string;
    adminName: string;
  } | null>(null);

  // Use the current URL for the first render so SSR and hydration produce the same nav.
  const isAdminArea = pathname.startsWith("/admin");
  const nav = isAdminArea ? adminNav : studentNav;
  const portalRole = isAdminArea ? "admin" : "student";

  const { data: noticeData } = useQuery({
    queryKey: ["layout-student-notices", token],
    queryFn: async () => getStudentNoticesServerFn({ data: { token: token || "" } }),
    enabled: Boolean(token && role === "student"),
  });

  const { data: adminsData } = useQuery({
    queryKey: ["layout-admins", token],
    queryFn: async () => getAdminsListServerFn({ data: { token: token || "" } }),
    enabled: Boolean(token && role === "student"),
  });



  const latestNotice = useMemo(() => noticeData?.notices?.[0] || null, [noticeData]);

  useEffect(() => {
    if (!latestNotice || role !== "student" || !user?.id || pathname === "/notices") {
      setNewNotice(null);
      return;
    }

    const key = `lt_grade_seen_notice.${user.id}`;
    const seenId = localStorage.getItem(key);
    if (seenId !== latestNotice.id) {
      setNewNotice({
        id: latestNotice.id,
        text: latestNotice.text,
        adminName: latestNotice.adminName,
      });
    }
  }, [latestNotice, pathname, role, user?.id]);

  const dismissNotice = () => {
    if (user?.id && newNotice?.id) {
      localStorage.setItem(`lt_grade_seen_notice.${user.id}`, newNotice.id);
    }
    setNewNotice(null);
  };

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/login" });
  };

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-sidebar-border">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">UP LT Grade</p>
            <p className="text-xs text-muted-foreground capitalize">Computer {portalRole} portal</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1 overflow-y-auto p-3 border-t border-sidebar-border space-y-3">
          {/* Admins section for students */}
          {role === "student" && adminsData?.admins && adminsData.admins.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wide">Admins</p>
              <div className="space-y-1">
                {adminsData.admins.map((admin) => (
                  <div key={admin.id} className="rounded-md bg-sidebar-accent/40 px-3 py-2">
                    <p className="text-xs font-medium text-sidebar-foreground">{admin.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* User info section */}
          {user && (
            <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2.5">
              <div className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium leading-tight">{user.name}</p>
                <p className="text-[10px] text-muted-foreground">{user.id}</p>
              </div>
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={toggle}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                  <GraduationCap className="size-4" />
                </div>
                <p className="font-semibold">LT Grade Prep</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <nav className="space-y-1 px-4 pt-4">
                {nav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-sidebar-accent"
                  >
                    <item.icon className="size-4" /> {item.label}
                  </Link>
                ))}
              </nav>

              {/* Admins section for students in mobile */}
              {role === "student" && adminsData?.admins && adminsData.admins.length > 0 && (
                <div className="px-4 pt-6 pb-4 border-t border-sidebar-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wide">Admins</p>
                  <div className="space-y-1">
                    {adminsData.admins.map((admin) => (
                      <div key={admin.id} className="rounded-md bg-sidebar-accent/40 px-3 py-2">
                        <p className="text-xs font-medium text-sidebar-foreground">{admin.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-sidebar-border space-y-1 p-4 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={toggle}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                Toggle theme
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <GraduationCap className="size-4" />
            </div>
            <span className="font-semibold text-sm">LT Grade Prep</span>
          </div>
          <Button variant="ghost" size="icon" onClick={toggle}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            {newNotice && (
              <Alert className="mb-4 border-primary/30 bg-primary/5">
                <Megaphone className="size-4" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <AlertTitle>New notice from {newNotice.adminName}</AlertTitle>
                    <AlertDescription className="line-clamp-2">
                      {newNotice.text}
                    </AlertDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm">
                      <Link to="/notices" onClick={dismissNotice}>
                        Open
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={dismissNotice}
                      aria-label="Dismiss notice"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              </Alert>
            )}
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${nav.filter((item) => !["Notices", "Leaderboard"].includes(item.label)).length}, minmax(0, 1fr))` }}
          >
            {nav.filter((item) => !["Notices", "Leaderboard"].includes(item.label)).map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-xs",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      
      <AdminRecruitmentPopup />
    </div>
  );
}
