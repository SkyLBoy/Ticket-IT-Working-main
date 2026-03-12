import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import api from '../services/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Ticket, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Plus,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
  >
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={cn("text-4xl font-black mt-2", color)}>{value}</p>
          </div>
          <div className={cn("p-3 rounded-lg", color.replace('text-', 'bg-') + '/10')}>
            <Icon className={cn("h-6 w-6", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const getPriorityClass = (priority) => {
  const classes = {
    'Low': 'priority-low',
    'Medium': 'priority-medium',
    'High': 'priority-high',
    'Critical': 'priority-critical'
  };
  return classes[priority] || 'priority-medium';
};

const getStatusClass = (status) => {
  const classes = {
    'Open': 'status-open',
    'In Progress': 'status-in-progress',
    'Closed': 'status-closed'
  };
  return classes[status] || 'status-open';
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ticketsRes] = await Promise.all([
          api.get('/tickets/stats'),
          api.get('/tickets/recent')
        ]);
        setStats(statsRes.data);
        setRecentTickets(ticketsRes.data);
      } catch (error) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your IT support tickets</p>
        </div>
        <Button onClick={() => navigate('/tickets/create')} data-testid="create-ticket-btn">
          <Plus className="h-4 w-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Tickets" 
          value={stats?.total_tickets || 0}
          icon={Ticket}
          color="text-primary"
          delay={0}
        />
        <StatCard 
          title="Open Tickets" 
          value={stats?.open_tickets || 0}
          icon={AlertCircle}
          color="text-red-500"
          delay={0.1}
        />
        <StatCard 
          title="In Progress" 
          value={stats?.in_progress_tickets || 0}
          icon={Clock}
          color="text-yellow-500"
          delay={0.2}
        />
        <StatCard 
          title="Closed" 
          value={stats?.closed_tickets || 0}
          icon={CheckCircle2}
          color="text-emerald-500"
          delay={0.3}
        />
      </div>

      {/* Recent Tickets */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">Recent Tickets</CardTitle>
            <Link to="/tickets">
              <Button variant="ghost" size="sm" data-testid="view-all-tickets-btn">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="no-tickets">
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tickets yet</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/tickets/create')}
                >
                  Create your first ticket
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">ID</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Title</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Priority</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Created By</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.map((ticket) => (
                    <TableRow 
                      key={ticket.id} 
                      className="hover:bg-white/5 cursor-pointer border-border"
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      data-testid={`ticket-row-${ticket.id}`}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{ticket.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {ticket.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("font-mono text-xs", getPriorityClass(ticket.priority))}>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("font-mono text-xs", getStatusClass(ticket.status))}>
                          {ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ticket.created_by_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(ticket.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DashboardPage;
