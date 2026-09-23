import { HouseIcon, LogInIcon, LogOutIcon, WandSparklesIcon } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import type { PublicUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
    isActive ? "text-foreground" : "text-muted-foreground",
  );

export function Navbar() {
  const { user, loading } = useAuth();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HouseIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">KiezHomes</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Listings
          </NavLink>
          {user?.role === "agent" && (
            <NavLink to="/agent/generate" className={navLinkClass}>
              <WandSparklesIcon className="size-4" />
              <span>Write listing</span>
            </NavLink>
          )}
        </nav>

        <div className="ml-auto">
          {user ? (
            <AccountMenu user={user} />
          ) : (
            !loading && (
              <Button asChild size="sm">
                <Link to="/login" state={{ from: location.pathname }}>
                  <LogInIcon /> Sign in
                </Link>
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  );
}

function AccountMenu({ user }: { user: PublicUser }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm md:inline">{user.name}</span>
          <Badge variant={user.role === "agent" ? "default" : "secondary"}>{user.role === "agent" ? "Agent" : "Buyer"}</Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{user.name}</div>
          <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            navigate("/", { replace: true });
          }}
        >
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
