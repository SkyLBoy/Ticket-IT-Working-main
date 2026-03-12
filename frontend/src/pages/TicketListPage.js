import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import api from '../services/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  CheckCircle,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Ticket,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

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

const TicketListPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [departments, setDepartments] = useState([]);
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('department') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const limit = 10;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const [ticketsRes, countRes] = await Promise.all([
        api.get(`/tickets?${params.toString()}`),
        api.get(`/tickets/count?${params.toString()}`)
      ]);
      
      setTickets(ticketsRes.data);
      setTotalCount(countRes.data.count);
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, departmentFilter, page]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await api.get('/departments');
        setDepartments(response.data.departments);
      } catch (error) {
        console.error('Failed to fetch departments');
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (departmentFilter) params.set('department', departmentFilter);
    if (page > 1) params.set('page', page.toString());
    setSearchParams(params);
  }, [search, statusFilter, priorityFilter, departmentFilter, page, setSearchParams]);

  const handleCloseTicket = async (ticketId) => {
    try {
      await api.put(`/tickets/${ticketId}`, { status: 'Closed' });
      toast.success('Ticket closed');
      fetchTickets();
    } catch (error) {
      toast.error('Failed to close ticket');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setDepartmentFilter('');
    setPage(1);
  };

  const hasFilters = search || statusFilter || priorityFilter || departmentFilter;
  const totalPages = Math.ceil(totalCount / limit);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6" data-testid="ticket-list-page">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Tickets</h1>
            <p className="text-muted-foreground mt-1">
              {totalCount} ticket{totalCount !== 1 ? 's' : ''} found
            </p>
          </div>
          <Button onClick={() => navigate('/tickets/create')} data-testid="create-ticket-btn">
            <Plus className="h-4 w-4 mr-2" />
            Create Ticket
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tickets..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]" data-testid="status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]" data-testid="priority-filter">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]" data-testid="department-filter">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters-btn">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="no-tickets">
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No tickets found</p>
                {hasFilters && (
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">ID</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Title</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Priority</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Department</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Created By</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Assigned To</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow 
                      key={ticket.id} 
                      className="hover:bg-white/5 border-border"
                      data-testid={`ticket-row-${ticket.id}`}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{ticket.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px]">
                        <span className="truncate block" title={ticket.title}>
                          {ticket.title}
                        </span>
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
                      <TableCell className="text-muted-foreground text-sm">
                        {ticket.department}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {ticket.created_by_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {ticket.assigned_to_name || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(ticket.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`ticket-actions-${ticket.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/tickets/${ticket.id}`)} data-testid={`view-ticket-${ticket.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/tickets/${ticket.id}/edit`)} data-testid={`edit-ticket-${ticket.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {isAdmin && ticket.status !== 'Closed' && (
                              <DropdownMenuItem 
                                onClick={() => handleCloseTicket(ticket.id)}
                                data-testid={`close-ticket-${ticket.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Close
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="prev-page-btn"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  data-testid="next-page-btn"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default TicketListPage;
