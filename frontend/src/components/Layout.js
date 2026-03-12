import Sidebar from './Sidebar';
import { Toaster } from './ui/sonner';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const Layout = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications');
        setNotifications(response.data.notifications || []);
        setHasNew(response.data.notifications?.length > 0);
      } catch (error) {
        console.error('Failed to fetch notifications');
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatAction = (action) => {
    const actions = {
      'status_changed': 'Status changed',
      'assigned': 'Assigned',
      'commented': 'New comment',
      'created': 'Created',
      'attachment_added': 'File attached'
    };
    return actions[action] || action;
  };

  return (
    <div className="flex h-screen bg-background" data-testid="main-layout">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card">
          <div>
            <span className="text-sm text-muted-foreground">Welcome back,</span>
            <span className="text-sm font-medium ml-1">{user?.name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
                <Bell className="h-5 w-5" />
                {hasNew && (
                  <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                notifications.slice(0, 5).map((n, i) => (
                  <DropdownMenuItem key={i} className="flex flex-col items-start gap-1 p-3">
                    <span className="text-sm font-medium">{formatAction(n.action)}</span>
                    <span className="text-xs text-muted-foreground">
                      {n.new_value && `→ ${n.new_value}`}
                    </span>
                    <span className="text-xs text-muted-foreground">by {n.user_name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
};

export default Layout;
