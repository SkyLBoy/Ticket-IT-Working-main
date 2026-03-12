import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Ticket, 
  Plus, 
  Users, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Server
} from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { cn } from '../lib/utils';

const Sidebar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/tickets', icon: Ticket, label: 'Tickets' },
    { to: '/tickets/create', icon: Plus, label: 'Create Ticket' },
    ...(isAdmin ? [{ to: '/users', icon: Users, label: 'Users' }] : []),
  ];

  return (
    <aside 
      data-testid="sidebar"
      className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">HelpDesk</span>
          </div>
        )}
        {collapsed && <Server className="h-6 w-6 text-primary mx-auto" />}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8"
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                "hover:bg-white/5 hover:text-white",
                isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        {!collapsed && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <span className={cn(
              "inline-block mt-1 px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wider",
              user?.role === 'admin' 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "bg-muted text-muted-foreground"
            )}>
              {user?.role}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed && "justify-center px-0"
          )}
          data-testid="logout-btn"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
