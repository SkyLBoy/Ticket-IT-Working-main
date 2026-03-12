import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import api from '../services/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Send, 
  Clock, 
  User, 
  Building, 
  AlertCircle,
  Paperclip,
  History,
  MessageSquare,
  Loader2,
  Upload,
  FileText,
  Image as ImageIcon
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TicketDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('comments');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ticketRes, commentsRes, historyRes] = await Promise.all([
          api.get(`/tickets/${id}`),
          api.get(`/tickets/${id}/comments`),
          api.get(`/tickets/${id}/history`)
        ]);
        setTicket(ticketRes.data);
        setComments(commentsRes.data);
        setHistory(historyRes.data);
        
        if (isAdmin) {
          const techRes = await api.get('/users/technicians');
          setTechnicians(techRes.data);
        }
      } catch (error) {
        toast.error('Failed to load ticket');
        navigate('/tickets');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate, isAdmin]);

  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/tickets/${id}`, { status: newStatus });
      setTicket({ ...ticket, status: newStatus });
      toast.success('Status updated');
      // Refresh history
      const historyRes = await api.get(`/tickets/${id}/history`);
      setHistory(historyRes.data);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleAssign = async (technicianId) => {
    try {
      await api.put(`/tickets/${id}`, { assigned_to: technicianId });
      const techName = technicians.find(t => t.id === technicianId)?.name;
      setTicket({ ...ticket, assigned_to: technicianId, assigned_to_name: techName });
      toast.success('Ticket assigned');
      const historyRes = await api.get(`/tickets/${id}/history`);
      setHistory(historyRes.data);
    } catch (error) {
      toast.error('Failed to assign ticket');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      const response = await api.post(`/tickets/${id}/comments`, { comment: newComment });
      setComments([...comments, response.data]);
      setNewComment('');
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setUploading(true);
    try {
      const response = await api.post(`/tickets/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTicket({
        ...ticket,
        attachments: [...(ticket.attachments || []), response.data.url]
      });
      toast.success('File uploaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAction = (action) => {
    const actions = {
      'status_changed': 'Status changed',
      'assigned': 'Assigned',
      'commented': 'Commented',
      'created': 'Created',
      'attachment_added': 'File attached'
    };
    return actions[action] || action;
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="ticket-details-loading">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-6" data-testid="ticket-details-page">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/tickets')}
            className="mb-4 -ml-2"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tickets
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">{ticket.title}</h1>
              <p className="text-muted-foreground mt-1 font-mono text-sm">#{ticket.id}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className={cn("text-sm py-1 px-3", getPriorityClass(ticket.priority))}>
                {ticket.priority}
              </Badge>
              <Badge variant="outline" className={cn("text-sm py-1 px-3", getStatusClass(ticket.status))}>
                {ticket.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-200 whitespace-pre-wrap">{ticket.description}</p>
              </CardContent>
            </Card>

            {/* Attachments */}
            {ticket.attachments?.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Attachments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {ticket.attachments.map((url, i) => {
                      const isImage = /\.(png|jpg|jpeg|gif)$/i.test(url);
                      return (
                        <a
                          key={i}
                          href={`${BACKEND_URL}${url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
                          data-testid={`attachment-${i}`}
                        >
                          {isImage ? (
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm truncate">Image {i + 1}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm truncate">File {i + 1}</span>
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments / History Tabs */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-0">
                <div className="flex gap-4 border-b border-border">
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={cn(
                      "pb-3 px-1 text-sm font-medium transition-colors flex items-center gap-2",
                      activeTab === 'comments' 
                        ? "text-primary border-b-2 border-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    data-testid="comments-tab"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Comments ({comments.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                      "pb-3 px-1 text-sm font-medium transition-colors flex items-center gap-2",
                      activeTab === 'history' 
                        ? "text-primary border-b-2 border-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    data-testid="history-tab"
                  >
                    <History className="h-4 w-4" />
                    History ({history.length})
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {activeTab === 'comments' ? (
                  <div className="space-y-4">
                    <ScrollArea className="h-[300px] pr-4">
                      {comments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No comments yet</p>
                      ) : (
                        <div className="space-y-4">
                          {comments.map((comment) => (
                            <div 
                              key={comment.id} 
                              className={cn(
                                "p-4 rounded-lg border border-border",
                                comment.user_id === user?.id ? "bg-primary/5 border-primary/20" : "bg-secondary/20"
                              )}
                              data-testid={`comment-${comment.id}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">{comment.user_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(comment.created_at)}
                                </span>
                              </div>
                              <p className="text-gray-200 text-sm whitespace-pre-wrap">{comment.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    
                    <Separator />
                    
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={3}
                        data-testid="comment-input"
                      />
                    </div>
                    <Button 
                      onClick={handleAddComment} 
                      disabled={submitting || !newComment.trim()}
                      data-testid="submit-comment-btn"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    {history.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No history yet</p>
                    ) : (
                      <div className="space-y-3">
                        {history.map((item) => (
                          <div 
                            key={item.id} 
                            className="flex items-start gap-3 p-3 border-l-2 border-primary/30"
                            data-testid={`history-${item.id}`}
                          >
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-medium">{item.user_name}</span>
                                <span className="text-muted-foreground"> {formatAction(item.action)}</span>
                              </p>
                              {item.old_value && item.new_value && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.old_value} → {item.new_value}
                                </p>
                              )}
                              {!item.old_value && item.new_value && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.new_value}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(item.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions Card */}
            {isAdmin && ticket.status !== 'Closed' && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Status</label>
                    <Select value={ticket.status} onValueChange={handleStatusChange}>
                      <SelectTrigger data-testid="status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Assign To</label>
                    <Select value={ticket.assigned_to || ''} onValueChange={handleAssign}>
                      <SelectTrigger data-testid="assign-select">
                        <SelectValue placeholder="Select technician" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Details Card */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created By</p>
                    <p className="text-sm font-medium">{ticket.created_by_name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                    <p className="text-sm font-medium">{ticket.assigned_to_name || 'Unassigned'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="text-sm font-medium">{ticket.department}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <Badge variant="outline" className={cn("mt-1", getPriorityClass(ticket.priority))}>
                      {ticket.priority}
                    </Badge>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm">{formatDate(ticket.created_at)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm">{formatDate(ticket.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upload Card */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Attach File
                </CardTitle>
                <CardDescription>Upload screenshots or documents</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*,.pdf,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                    data-testid="file-upload-input"
                  />
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    disabled={uploading}
                    asChild
                  >
                    <span className="cursor-pointer">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Paperclip className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? 'Uploading...' : 'Choose File'}
                    </span>
                  </Button>
                </label>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TicketDetailsPage;
