'use client';

import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Plus, 
  RefreshCw, 
  User, 
  Calendar, 
  Check, 
  X, 
  Info, 
  Users, 
  FileText, 
  Award, 
  HelpCircle, 
  Layers,
  ArrowRight,
  Sun,
  Moon,
  Copy,
  Edit,
  Trash2,
  ClipboardList,
  AlertCircle,
  CheckSquare,
  Activity,
  Mail,
  Layers3,
  Eye,
  Smile
} from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { analyzeExpectations } from '@/lib/nlp.js';

const isConvexEnabled = !!process.env.NEXT_PUBLIC_CONVEX_URL;

export default function Home() {
  const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState('');

  if (isConvexEnabled) {
    return (
      <HomeConvex 
        selectedWorkshopId={selectedWorkshopId}
        setSelectedWorkshopId={setSelectedWorkshopId}
        selectedParticipantId={selectedParticipantId}
        setSelectedParticipantId={setSelectedParticipantId}
      />
    );
  } else {
    return (
      <HomeREST 
        selectedWorkshopId={selectedWorkshopId}
        setSelectedWorkshopId={setSelectedWorkshopId}
        selectedParticipantId={selectedParticipantId}
        setSelectedParticipantId={setSelectedParticipantId}
      />
    );
  }
}

function HomeConvex({
  selectedWorkshopId,
  setSelectedWorkshopId,
  selectedParticipantId,
  setSelectedParticipantId
}) {
  const workshops = useQuery(api.workshops.list) || [];
  const facilitators = useQuery(api.facilitators.list) || [];
  const recommendations = useQuery(api.agent.listRecommendations) || [];
  const participants = useQuery(api.participants.list, selectedWorkshopId ? { workshopId: selectedWorkshopId } : {}) || [];
  const notifications = useQuery(api.participants.listNotifications) || [];

  // Auto-select first workshop if none selected
  useEffect(() => {
    if (workshops.length > 0 && !selectedWorkshopId) {
      setSelectedWorkshopId(workshops[0].id);
    }
  }, [workshops, selectedWorkshopId, setSelectedWorkshopId]);

  // Auto-select first participant if none selected
  useEffect(() => {
    if (participants.length > 0) {
      if (!selectedParticipantId || !participants.some(p => p.id === selectedParticipantId)) {
        setSelectedParticipantId(participants[0].id);
      }
    } else {
      setSelectedParticipantId('');
    }
  }, [participants, selectedParticipantId, setSelectedParticipantId]);

  // Mutations
  const createW = useMutation(api.workshops.create);
  const updateW = useMutation(api.workshops.update);
  const createF = useMutation(api.facilitators.create);
  const updateF = useMutation(api.facilitators.update);
  const removeF = useMutation(api.facilitators.remove);
  const runReasoning = useMutation(api.agent.runReasoning);
  const executeAction = useMutation(api.agent.executeAction);
  const dismissAction = useMutation(api.agent.dismissAction);
  const createPart = useMutation(api.participants.create);
  const updatePart = useMutation(api.participants.update);
  const createFeedback = useMutation(api.feedback.create);

  const handleCreateWorkshop = async (title, description, facilitatorId, dateTime, capacity) => {
    return await createW({ title, description, facilitatorId, dateTime, capacity: capacity !== undefined ? Number(capacity) : undefined });
  };

  const handleUpdateStatus = async (id, status) => {
    return await updateW({ id, status });
  };

  const handleDuplicateWorkshop = async (workshop) => {
    return await createW({
      title: `${workshop.title} (Copy)`,
      description: workshop.description || '',
      facilitatorId: workshop.facilitatorId,
      dateTime: workshop.dateTime || '',
      capacity: workshop.capacity !== undefined ? Number(workshop.capacity) : 20
    });
  };

  const handleEditWorkshop = async (id, title, description, facilitatorId, dateTime, capacity) => {
    return await updateW({ id, title, description, facilitatorId, dateTime, capacity: capacity !== undefined ? Number(capacity) : undefined });
  };

  const handleCreateFacilitator = async (name, email) => {
    return await createF({ name, email });
  };

  const handleUpdateFacilitator = async (id, name, email) => {
    return await updateF({ id, name, email });
  };

  const handleDeleteFacilitator = async (id) => {
    return await removeF({ id });
  };

  const handleRunAgent = async () => {
    const res = await runReasoning();
    return { success: true, recommendations: res };
  };

  const handleExecuteRec = async (id) => {
    return await executeAction({ id });
  };

  const handleDismissRec = async (id) => {
    return await dismissAction({ id });
  };

  const handleRegisterParticipant = async (name, email, workshopId, expectations) => {
    return await createPart({ name, email, workshopId, expectations: expectations || '' });
  };

  const handleAttendance = async (participantId, status) => {
    return await updatePart({ id: participantId, status });
  };

  const handleOnboarding = async (participantId) => {
    return await updatePart({ id: participantId, onboardingStatus: 'completed' });
  };

  const handleSubmitFeedback = async (workshopId, participantId, rating, comments) => {
    return await createFeedback({ workshopId, participantId, rating, comments });
  };

  return (
    <Dashboard
      isConvex={true}
      workshops={workshops}
      facilitators={facilitators}
      recommendations={recommendations}
      participants={participants}
      notifications={notifications}
      selectedWorkshopId={selectedWorkshopId}
      setSelectedWorkshopId={setSelectedWorkshopId}
      selectedParticipantId={selectedParticipantId}
      setSelectedParticipantId={setSelectedParticipantId}
      onCreateWorkshop={handleCreateWorkshop}
      onUpdateWorkshopStatus={handleUpdateStatus}
      onDuplicateWorkshop={handleDuplicateWorkshop}
      onEditWorkshop={handleEditWorkshop}
      onCreateFacilitator={handleCreateFacilitator}
      onUpdateFacilitator={handleUpdateFacilitator}
      onDeleteFacilitator={handleDeleteFacilitator}
      onRunAgent={handleRunAgent}
      onExecuteRec={handleExecuteRec}
      onDismissRec={handleDismissRec}
      onRegisterParticipant={handleRegisterParticipant}
      onAttendance={handleAttendance}
      onOnboarding={handleOnboarding}
      onSubmitFeedback={handleSubmitFeedback}
    />
  );
}

function HomeREST({
  selectedWorkshopId,
  setSelectedWorkshopId,
  selectedParticipantId,
  setSelectedParticipantId
}) {
  const [workshops, setWorkshops] = useState([]);
  const [facilitators, setFacilitators] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const wRes = await fetch('/api/workshops');
      const wData = await wRes.json();
      setWorkshops(wData);
      if (wData.length > 0 && !selectedWorkshopId) {
        setSelectedWorkshopId(wData[0].id);
      }

      const fRes = await fetch('/api/facilitators');
      const fData = await fRes.json();
      setFacilitators(fData);

      const rRes = await fetch('/api/agent-recommendations');
      const rData = await rRes.json();
      setRecommendations(rData);

      const nRes = await fetch('/api/notifications');
      const nData = await nRes.json();
      setNotifications(nData);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch participants for selected workshop
  useEffect(() => {
    if (selectedWorkshopId) {
      fetch(`/api/participants?workshopId=${selectedWorkshopId}`)
        .then(res => res.json())
        .then(data => {
          setParticipants(data);
          if (data.length > 0) {
            if (!selectedParticipantId || !data.some(p => p.id === selectedParticipantId)) {
              setSelectedParticipantId(data[0].id);
            }
          } else {
            setSelectedParticipantId('');
          }
        });
    } else {
      setParticipants([]);
      setSelectedParticipantId('');
    }
  }, [selectedWorkshopId, workshops]);

  const handleCreateWorkshop = async (title, description, facilitatorId, dateTime, capacity) => {
    const res = await fetch('/api/workshops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, facilitatorId, dateTime, capacity: capacity !== undefined ? Number(capacity) : undefined })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create workshop');
    }
    const newW = await res.json();
    setWorkshops([newW, ...workshops]);
    fetchData(); // Sync notifications
    return newW;
  };

  const handleUpdateStatus = async (id, status) => {
    const res = await fetch(`/api/workshops/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update status');
    }
    const updated = await res.json();
    setWorkshops(workshops.map(w => w.id === id ? { ...w, status: updated.status } : w));
    fetchData(); // Sync notifications
    return updated;
  };

  const handleDuplicateWorkshop = async (workshop) => {
    const res = await fetch('/api/workshops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${workshop.title} (Copy)`,
        description: workshop.description,
        facilitatorId: workshop.facilitatorId,
        dateTime: workshop.dateTime || '',
        capacity: workshop.capacity !== undefined ? Number(workshop.capacity) : 20
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to duplicate workshop');
    }
    const newW = await res.json();
    setWorkshops([newW, ...workshops]);
    fetchData(); // Sync notifications
    return newW;
  };

  const handleEditWorkshop = async (id, title, description, facilitatorId, dateTime, capacity) => {
    const res = await fetch(`/api/workshops/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, facilitatorId, dateTime, capacity: capacity !== undefined ? Number(capacity) : undefined })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update workshop');
    }
    const updated = await res.json();
    setWorkshops(workshops.map(w => w.id === id ? updated : w));
    fetchData(); // Sync notifications
    return updated;
  };

  const handleCreateFacilitator = async (name, email) => {
    const res = await fetch('/api/facilitators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add facilitator');
    }
    const newFac = await res.json();
    setFacilitators([...facilitators, newFac]);
    return newFac;
  };

  const handleUpdateFacilitator = async (id, name, email) => {
    const res = await fetch(`/api/facilitators/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update facilitator');
    }
    const updated = await res.json();
    setFacilitators(facilitators.map(f => f.id === id ? updated : f));
    fetchData(); // Reload names for workshops list
    return updated;
  };

  const handleDeleteFacilitator = async (id) => {
    const res = await fetch(`/api/facilitators/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete facilitator');
    }
    setFacilitators(facilitators.filter(f => f.id !== id));
    return data;
  };

  const handleRunAgent = async () => {
    const res = await fetch('/api/run-agent', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Agent scan failed');
    }
    const data = await res.json();
    setRecommendations(data.recommendations);
    fetchData(); // Sync logs
    return data;
  };

  const handleExecuteRec = async (id) => {
    const res = await fetch(`/api/agent-recommendations/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'execute' })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Execution failed');
    }
    // Refresh recommendations and other data
    const rRes = await fetch('/api/agent-recommendations');
    const rData = await rRes.json();
    setRecommendations(rData);
    fetchData();
    return data;
  };

  const handleDismissRec = async (id) => {
    const res = await fetch(`/api/agent-recommendations/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss' })
    });
    if (!res.ok) {
      throw new Error('Dismissal failed');
    }
    setRecommendations(recommendations.map(r => r.id === id ? { ...r, status: 'dismissed' } : r));
    return { success: true };
  };

  const handleRegisterParticipant = async (name, email, workshopId, expectations) => {
    const res = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, workshopId, expectations: expectations || '' })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    fetchData();
    return data;
  };

  const handleAttendance = async (participantId, status) => {
    const res = await fetch(`/api/participants/${participantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      throw new Error('Failed to update attendance');
    }
    const data = await res.json();
    fetchData();
    return data;
  };

  const handleOnboarding = async (participantId) => {
    const res = await fetch(`/api/participants/${participantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingStatus: 'completed' })
    });
    if (!res.ok) {
      throw new Error('Failed to update onboarding');
    }
    const data = await res.json();
    fetchData();
    return data;
  };

  const handleSubmitFeedback = async (workshopId, participantId, rating, comments) => {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshopId, participantId, rating: Number(rating), comments })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit feedback');
    }
    const data = await res.json();
    fetchData();
    return data;
  };

  return (
    <Dashboard
      isConvex={false}
      workshops={workshops}
      facilitators={facilitators}
      recommendations={recommendations}
      participants={participants}
      notifications={notifications}
      selectedWorkshopId={selectedWorkshopId}
      setSelectedWorkshopId={setSelectedWorkshopId}
      selectedParticipantId={selectedParticipantId}
      setSelectedParticipantId={setSelectedParticipantId}
      onCreateWorkshop={handleCreateWorkshop}
      onUpdateWorkshopStatus={handleUpdateStatus}
      onDuplicateWorkshop={handleDuplicateWorkshop}
      onEditWorkshop={handleEditWorkshop}
      onCreateFacilitator={handleCreateFacilitator}
      onUpdateFacilitator={handleUpdateFacilitator}
      onDeleteFacilitator={handleDeleteFacilitator}
      onRunAgent={handleRunAgent}
      onExecuteRec={handleExecuteRec}
      onDismissRec={handleDismissRec}
      onRegisterParticipant={handleRegisterParticipant}
      onAttendance={handleAttendance}
      onOnboarding={handleOnboarding}
      onSubmitFeedback={handleSubmitFeedback}
    />
  );
}

function Dashboard({
  isConvex,
  workshops,
  facilitators,
  recommendations,
  participants,
  notifications = [],
  selectedWorkshopId,
  setSelectedWorkshopId,
  selectedParticipantId,
  setSelectedParticipantId,
  onCreateWorkshop,
  onUpdateWorkshopStatus,
  onDuplicateWorkshop,
  onEditWorkshop,
  onCreateFacilitator,
  onUpdateFacilitator,
  onDeleteFacilitator,
  onRunAgent,
  onExecuteRec,
  onDismissRec,
  onRegisterParticipant,
  onAttendance,
  onOnboarding,
  onSubmitFeedback
}) {
  // Navigation & Role states
  const [activeRole, setActiveRole] = useState('admin'); // 'admin', 'facilitator', 'participant'
  const [theme, setTheme] = useState('dark');
  
  // Admin form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFacilitatorId, setNewFacilitatorId] = useState('');
  const [newDateTime, setNewDateTime] = useState('');
  const [newCapacity, setNewCapacity] = useState(20);

  // Workshop edit states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editWorkshopId, setEditWorkshopId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFacilitatorId, setEditFacilitatorId] = useState('');
  const [editDateTime, setEditDateTime] = useState('');
  const [editCapacity, setEditCapacity] = useState(20);

  // Participant expectations
  const [regExpectations, setRegExpectations] = useState('');

  // HR Admin tabs
  const [adminTab, setAdminTab] = useState('workshops'); // 'workshops', 'facilitators'

  // Facilitator CRUD states
  const [showFacModal, setShowFacModal] = useState(false);
  const [isFacEditMode, setIsFacEditMode] = useState(false);
  const [editFacId, setEditFacId] = useState('');
  const [facName, setFacName] = useState('');
  const [facEmail, setFacEmail] = useState('');
  
  // Participant portal states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');

  // Status message
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  // Auto-select facilitator inside Add Workshop modal if not set
  useEffect(() => {
    if (facilitators.length > 0 && !newFacilitatorId) {
      setNewFacilitatorId(facilitators[0].id);
    }
  }, [facilitators, newFacilitatorId]);

  const showAlert = (text, type = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg({ text: '', type: '' }), 5000);
  };

  // Toggle Theme
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  };

  // Action handlers wrapped with loader/alerts
  const handleCreateWorkshop = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newFacilitatorId) return;

    try {
      await onCreateWorkshop(newTitle, newDescription, newFacilitatorId, newDateTime, newCapacity);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewDateTime('');
      setNewCapacity(20);
      showAlert('Workshop created in Draft state!');
    } catch (err) {
      showAlert(err.message || 'Failed to create workshop', 'error');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await onUpdateWorkshopStatus(id, status);
      showAlert(`Workshop status updated to ${status}!`);
    } catch (err) {
      showAlert(err.message || 'Failed to update status', 'error');
    }
  };

  const handleDuplicateWorkshop = async (workshop) => {
    try {
      await onDuplicateWorkshop(workshop);
      showAlert('Workshop duplicated successfully as Draft!');
    } catch (err) {
      showAlert(err.message || 'Failed to duplicate workshop', 'error');
    }
  };

  const openEditWorkshopModal = (workshop) => {
    setEditWorkshopId(workshop.id);
    setEditTitle(workshop.title);
    setEditDescription(workshop.description || '');
    setEditFacilitatorId(workshop.facilitatorId);
    setEditDateTime(workshop.dateTime || '');
    setEditCapacity(workshop.capacity !== undefined ? workshop.capacity : 20);
    setShowEditModal(true);
  };

  const handleEditWorkshop = async (e) => {
    e.preventDefault();
    if (!editTitle.trim() || !editFacilitatorId) return;

    try {
      await onEditWorkshop(editWorkshopId, editTitle, editDescription, editFacilitatorId, editDateTime, editCapacity);
      setShowEditModal(false);
      showAlert('Workshop updated successfully!');
    } catch (err) {
      showAlert(err.message || 'Failed to update workshop', 'error');
    }
  };

  const openAddFacModal = () => {
    setIsFacEditMode(false);
    setEditFacId('');
    setFacName('');
    setFacEmail('');
    setShowFacModal(true);
  };

  const openEditFacModal = (fac) => {
    setIsFacEditMode(true);
    setEditFacId(fac.id);
    setFacName(fac.name);
    setFacEmail(fac.email);
    setShowFacModal(true);
  };

  const handleCreateOrUpdateFacilitator = async (e) => {
    e.preventDefault();
    if (!facName.trim() || !facEmail.trim()) return;

    try {
      if (isFacEditMode) {
        await onUpdateFacilitator(editFacId, facName, facEmail);
        setShowFacModal(false);
        showAlert('Facilitator updated successfully!');
      } else {
        await onCreateFacilitator(facName, facEmail);
        setShowFacModal(false);
        showAlert('Facilitator added successfully!');
      }
    } catch (err) {
      showAlert(err.message || 'Failed to process facilitator', 'error');
    }
  };

  const handleDeleteFac = async (id) => {
    if (!confirm('Are you sure you want to delete this facilitator?')) return;
    try {
      const res = await onDeleteFacilitator(id);
      showAlert(res.message || 'Facilitator deleted successfully.');
    } catch (err) {
      showAlert(err.message || 'Failed to delete facilitator', 'error');
    }
  };

  const handleRunAgent = async () => {
    showAlert('Agentic AI scanning system and reasoning...', 'info');
    try {
      await onRunAgent();
      showAlert('AI completed scan. New recommendations added!');
    } catch (err) {
      showAlert(err.message || 'Agent scan failed', 'error');
    }
  };

  const handleExecuteRec = async (id) => {
    try {
      const res = await onExecuteRec(id);
      if (res.success) {
        showAlert(res.message || 'Action executed successfully.');
      } else {
        showAlert(res.error, 'error');
      }
    } catch (err) {
      showAlert(err.message || 'Execution failed', 'error');
    }
  };

  const handleDismissRec = async (id) => {
    try {
      await onDismissRec(id);
      showAlert('Recommendation dismissed');
    } catch (err) {
      showAlert(err.message || 'Dismissal failed', 'error');
    }
  };

  const handleRegisterParticipant = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !selectedWorkshopId) return;

    try {
      await onRegisterParticipant(regName, regEmail, selectedWorkshopId, regExpectations);
      showAlert('Successfully registered for the workshop!');
      setRegName('');
      setRegEmail('');
      setRegExpectations('');
    } catch (err) {
      showAlert(err.message || 'Registration failed', 'error');
    }
  };

  const handleAttendance = async (participantId, status) => {
    try {
      await onAttendance(participantId, status);
      showAlert(`Attendance marked as: ${status}`);
    } catch (err) {
      showAlert(err.message || 'Failed to update attendance', 'error');
    }
  };

  const handleOnboarding = async (participantId) => {
    try {
      await onOnboarding(participantId);
      showAlert('Onboarding checklist completed!');
    } catch (err) {
      showAlert(err.message || 'Failed to update onboarding', 'error');
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!selectedWorkshopId || !selectedParticipantId) {
      showAlert('Please select participant first', 'error');
      return;
    }

    try {
      await onSubmitFeedback(selectedWorkshopId, selectedParticipantId, feedbackRating, feedbackComments);
      showAlert('Feedback submitted successfully. Thank you!');
      setFeedbackComments('');
    } catch (err) {
      showAlert(err.message || 'Failed to submit feedback', 'error');
    }
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* Header Panel */}
      <header className="glass" style={{ sticky: 'top', zIndex: 10, padding: '16px 0', borderBottom: '1px solid hsl(var(--card-border))', marginBottom: '40px' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.25rem', color: 'hsl(var(--foreground))', margin: 0 }}>AetherFlow</h1>
                {isConvex ? (
                  <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', boxShadow: '0 0 10px rgba(52, 211, 153, 0.1)' }}>
                    <Activity size={10} className="animate-pulse" /> Convex Active
                  </span>
                ) : (
                  <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)' }}>
                    <Layers size={10} /> Local SQLite
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))' }}>Agentic Workshop Management</span>
            </div>
          </div>

          {/* Role and Theme Switchers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="glass" style={{ padding: '4px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '4px' }}>
              {[
                { id: 'admin', label: 'HR Admin' },
                { id: 'facilitator', label: 'Facilitator' },
                { id: 'participant', label: 'Participant' }
              ].map(role => (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: activeRole === role.id ? 'hsl(var(--primary))' : 'transparent',
                    color: activeRole === role.id ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground) / 0.7)',
                    fontWeight: activeRole === role.id ? 600 : 500,
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {role.label}
                </button>
              ))}
            </div>

            <button 
              onClick={toggleTheme} 
              className="btn btn-secondary" 
              style={{ width: '40px', height: '40px', padding: 0 }}
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container">
        
        {/* Toast Alert Message */}
        {alertMsg.text && (
          <div 
            className="animate-fade-in glass" 
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px',
              borderLeft: `4px solid ${
                alertMsg.type === 'error' ? 'hsl(var(--destructive))' :
                alertMsg.type === 'info' ? 'hsl(var(--accent))' : 'hsl(var(--success))'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <Info size={18} style={{ color: alertMsg.type === 'error' ? 'hsl(var(--destructive))' : alertMsg.type === 'info' ? 'hsl(var(--accent))' : 'hsl(var(--success))' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{alertMsg.text}</span>
          </div>
        )}

        {/* -------------------- ROLE: HR ADMIN -------------------- */}
        {activeRole === 'admin' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
            {/* Left Column: Workshops / Facilitators Management */}
            <div>
              {/* Tabs navigation */}
              <div className="tabs">
                <button 
                  className={`tab-btn ${adminTab === 'workshops' ? 'active' : ''}`}
                  onClick={() => setAdminTab('workshops')}
                >
                  Workshops
                </button>
                <button 
                  className={`tab-btn ${adminTab === 'facilitators' ? 'active' : ''}`}
                  onClick={() => setAdminTab('facilitators')}
                >
                  Facilitators
                </button>
                <button 
                  className={`tab-btn ${adminTab === 'sandbox' ? 'active' : ''}`}
                  onClick={() => setAdminTab('sandbox')}
                >
                  System Integrations & Sandbox
                </button>
              </div>

              {/* Workshops Tab */}
              {adminTab === 'workshops' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Workshop Lifecycle</h2>
                      <p style={{ color: 'hsl(var(--muted))', fontSize: '0.9rem' }}>Create, publish, and manage active corporate training tracks.</p>
                    </div>
                    <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                      <Plus size={18} /> Add Workshop
                    </button>
                  </div>

                  {/* Create Workshop Modal Form */}
                  {showCreateModal && (
                    <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '30px', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1.2rem' }}>New Training Session</h3>
                        <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', cursor: 'pointer', color: 'hsl(var(--foreground))' }}><X size={18} /></button>
                      </div>
                      <form onSubmit={handleCreateWorkshop}>
                        <div className="form-group">
                          <label className="form-label">Workshop Title</label>
                          <input 
                             type="text" 
                             className="form-input" 
                             value={newTitle} 
                             onChange={(e) => setNewTitle(e.target.value)} 
                             placeholder="e.g. Architecting Distributed AI Agents" 
                             required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Description</label>
                          <textarea 
                             className="form-input" 
                             style={{ minHeight: '80px', resize: 'vertical' }}
                             value={newDescription} 
                             onChange={(e) => setNewDescription(e.target.value)} 
                             placeholder="Details of the workshop learning tracks..." 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Assigned Facilitator</label>
                          <select 
                             className="form-input" 
                             value={newFacilitatorId} 
                             onChange={(e) => setNewFacilitatorId(e.target.value)}
                          >
                            {facilitators.map(f => (
                              <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Scheduled Date & Time</label>
                          <input 
                             type="text" 
                             className="form-input" 
                             value={newDateTime} 
                             onChange={(e) => setNewDateTime(e.target.value)} 
                             placeholder="e.g. June 15, 2026, 10:00 AM" 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Capacity Limit</label>
                          <input 
                             type="number" 
                             className="form-input" 
                             value={newCapacity} 
                             onChange={(e) => setNewCapacity(e.target.value)} 
                             min="1"
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                          <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Create Draft</button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Edit Workshop Modal Form */}
                  {showEditModal && (
                    <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '30px', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1.2rem' }}>Edit Training Session</h3>
                        <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', cursor: 'pointer', color: 'hsl(var(--foreground))' }}><X size={18} /></button>
                      </div>
                      <form onSubmit={handleEditWorkshop}>
                        <div className="form-group">
                          <label className="form-label">Workshop Title</label>
                          <input 
                             type="text" 
                             className="form-input" 
                             value={editTitle} 
                             onChange={(e) => setEditTitle(e.target.value)} 
                             required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Description</label>
                          <textarea 
                             className="form-input" 
                             style={{ minHeight: '80px', resize: 'vertical' }}
                             value={editDescription} 
                             onChange={(e) => setEditDescription(e.target.value)} 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Assigned Facilitator</label>
                          <select 
                             className="form-input" 
                             value={editFacilitatorId} 
                             onChange={(e) => setEditFacilitatorId(e.target.value)}
                          >
                            {facilitators.map(f => (
                              <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Scheduled Date & Time</label>
                          <input 
                             type="text" 
                             className="form-input" 
                             value={editDateTime} 
                             onChange={(e) => setEditDateTime(e.target.value)} 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Capacity Limit</label>
                          <input 
                             type="number" 
                             className="form-input" 
                             value={editCapacity} 
                             onChange={(e) => setEditCapacity(e.target.value)} 
                             min="1"
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                          <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Save Changes</button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Workshops Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {workshops.length === 0 ? (
                      <div className="glass" style={{ padding: '40px', textAlign: 'center', borderRadius: 'var(--radius-lg)', color: 'hsl(var(--muted))' }}>
                        No workshops found. Create your first workshop session above.
                      </div>
                    ) : (
                      workshops.map(w => (
                        <div key={w.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                              <span className={`badge badge-${w.status}`}>{w.status.replace('_', ' ')}</span>
                              {(() => {
                                const cap = w.capacity || 20;
                                const regCount = w.participantCount || 0;
                                const left = cap - regCount;
                                if (left <= 0) {
                                  return <span className="badge" style={{ backgroundColor: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}>FULL - JOIN WAITLIST</span>;
                                } else {
                                  return <span className="badge" style={{ backgroundColor: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}>{left} / {cap} seats left</span>;
                                }
                              })()}
                              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted))' }}>ID: {w.id}</span>
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '6px' }}>{w.title}</h3>
                            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted))', marginBottom: '12px' }}>{w.description || 'No description provided.'}</p>
                            
                            <div style={{ display: 'flex', gap: '24px', fontSize: '0.85rem', color: 'hsl(var(--foreground) / 0.8)', marginBottom: '12px', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={14} style={{ color: 'hsl(var(--primary))' }} /> {w.facilitatorName}
                              </span>
                              {w.dateTime && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Calendar size={14} style={{ color: 'hsl(var(--accent))' }} /> {w.dateTime}
                                </span>
                              )}
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Users size={14} style={{ color: 'hsl(var(--accent))' }} /> {w.participantCount} registered ({w.confirmedCount || 0} confirmed)
                              </span>
                              {w.feedbackCount > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Award size={14} style={{ color: 'hsl(var(--success))' }} /> Avg Rating: {Number(w.avgRating).toFixed(1)}/5 ({w.feedbackCount} feedback)
                                </span>
                              )}
                            </div>

                            {/* Workshop edit / duplicate actions */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => openEditWorkshopModal(w)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Edit size={14} /> Edit
                              </button>
                              <button onClick={() => handleDuplicateWorkshop(w)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Copy size={14} /> Duplicate
                              </button>
                            </div>
                          </div>

                          {/* Administrative Action Control Panel */}
                          <div className="glass" style={{ padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted))', fontWeight: 600 }}>Change State</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {w.status === 'draft' && (
                                <button onClick={() => handleUpdateStatus(w.id, 'published')} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Publish</button>
                              )}
                              {w.status === 'published' && (
                                <button onClick={() => handleUpdateStatus(w.id, 'registration_closed')} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Close Reg</button>
                              )}
                              {w.status === 'registration_closed' && (
                                <button onClick={() => handleUpdateStatus(w.id, 'completed')} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Complete</button>
                              )}
                              {w.status === 'completed' && (
                                <button onClick={() => handleUpdateStatus(w.id, 'archived')} className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Archive</button>
                              )}
                              {w.status === 'archived' && (
                                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted))' }}>Archived</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Facilitators Tab */}
              {adminTab === 'facilitators' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Facilitator Registry</h2>
                      <p style={{ color: 'hsl(var(--muted))', fontSize: '0.9rem' }}>Manage instructors, assignments, and account details.</p>
                    </div>
                    <button onClick={openAddFacModal} className="btn btn-primary">
                      <Plus size={18} /> Add Facilitator
                    </button>
                  </div>

                  {/* Create / Edit Facilitator Modal Form */}
                  {showFacModal && (
                    <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '30px', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1.2rem' }}>{isFacEditMode ? 'Edit Facilitator' : 'Add Facilitator'}</h3>
                        <button onClick={() => setShowFacModal(false)} style={{ background: 'transparent', cursor: 'pointer', color: 'hsl(var(--foreground))' }}><X size={18} /></button>
                      </div>
                      <form onSubmit={handleCreateOrUpdateFacilitator}>
                        <div className="form-group">
                          <label className="form-label">Full Name</label>
                          <input 
                             type="text" 
                             className="form-input" 
                             value={facName} 
                             onChange={(e) => setFacName(e.target.value)} 
                             placeholder="e.g. Priyanjali Sen" 
                             required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Email Address</label>
                          <input 
                             type="email" 
                             className="form-input" 
                             value={facEmail} 
                             onChange={(e) => setFacEmail(e.target.value)} 
                             placeholder="e.g. priyanjali.s@example.com" 
                             required 
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                          <button type="button" onClick={() => setShowFacModal(false)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">{isFacEditMode ? 'Save Changes' : 'Add Facilitator'}</button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Facilitators List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {facilitators.length === 0 ? (
                      <div className="glass" style={{ padding: '40px', textAlign: 'center', borderRadius: 'var(--radius-lg)', color: 'hsl(var(--muted))' }}>
                        No facilitators found. Click "Add Facilitator" above to create one.
                      </div>
                    ) : (
                      facilitators.map(f => (
                        <div key={f.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{f.name}</h4>
                            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted))' }}>{f.email} | ID: {f.id}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => openEditFacModal(f)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Edit size={14} /> Edit
                            </button>
                            <button onClick={() => handleDeleteFac(f.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Sandbox Tab */}
              {adminTab === 'sandbox' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>System Integrations & Sandbox</h2>
                      <p style={{ color: 'hsl(var(--muted))', fontSize: '0.9rem' }}>Monitor outbound communication, calendar invitations, and system-wide automated event flows.</p>
                    </div>
                  </div>

                  <div className="card">
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={18} style={{ color: 'hsl(var(--primary))' }} /> Communication & Calendar Logs
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--muted))', fontSize: '0.9rem' }}>
                          No notifications or calendar events have been sent or simulated yet.
                        </div>
                      ) : (
                        notifications.map(n => {
                          const formatTime = (ts) => {
                            if (!ts) return '';
                            const date = new Date(ts);
                            return isNaN(date.getTime()) ? String(ts) : date.toLocaleString();
                          };
                          return (
                            <div key={n.id} style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid hsl(var(--card-border))' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ 
                                    backgroundColor: n.type === 'email' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                                    color: n.type === 'email' ? '#60a5fa' : '#fbbf24',
                                    fontSize: '0.7rem',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    border: `1px solid ${n.type === 'email' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                  }}>
                                    {n.type === 'email' ? 'Gmail Simulation' : 'Google Calendar Invite'}
                                  </span>
                                  <span className={`badge badge-${n.status}`}>{n.status}</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))' }}>{formatTime(n.createdAt)}</span>
                              </div>
                              <div style={{ marginBottom: '8px', fontSize: '0.85rem' }}>
                                <strong>Recipient:</strong> <span style={{ color: 'hsl(var(--primary))' }}>{n.recipient}</span>
                              </div>
                              <div style={{ marginBottom: '12px', fontSize: '0.9rem', fontWeight: 600 }}>
                                <strong>Subject:</strong> {n.subject}
                              </div>
                              <div style={{ 
                                padding: '12px', 
                                borderRadius: 'var(--radius-sm)', 
                                background: 'rgba(0,0,0,0.2)', 
                                border: '1px solid hsl(var(--card-border))',
                                fontSize: '0.8rem',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                lineHeight: '1.4',
                                color: 'hsl(var(--foreground) / 0.85)'
                              }}>
                                {n.body}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Agentic AI Recommendations */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                  <Sparkles size={18} style={{ color: 'hsl(var(--primary))' }} /> Agent Recommendations
                </h3>
                <button 
                  onClick={handleRunAgent} 
                  className="btn btn-secondary" 
                  style={{ padding: '6', width: '32px', height: '32px' }}
                  title="Run Reasoning Engine Scan"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {recommendations.filter(r => r.status === 'proposed').length === 0 ? (
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: '0.85rem', color: 'hsl(var(--muted))' }}>
                    No active suggestions. Click the scan button above to run the agentic reasoning loop.
                  </div>
                ) : (
                  recommendations.filter(r => r.status === 'proposed').map(rec => (
                    <div key={rec.id} className="glass" style={{ padding: '16px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid hsl(var(--primary))', position: 'relative' }}>
                      <span style={{ fontSize: '0.7rem', color: 'hsl(var(--primary))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                        Proposed Action
                      </span>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '4px', fontWeight: 600 }}>{rec.workshopTitle}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'hsl(var(--foreground) / 0.9)', marginBottom: '8px', lineHeight: 1.4 }}>
                        <strong>Observed:</strong> {rec.observation}
                      </p>
                      <div className="glass" style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'hsl(var(--muted))', marginBottom: '12px', background: 'rgba(255,255,255,0.01)' }}>
                        <strong>Reasoning:</strong> {rec.reasoning}
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--accent))', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        <ArrowRight size={14} style={{ marginTop: '3px' }} />
                        <span>Action: {rec.recommendedAction}</span>
                      </div>

                      {/* Approve / Override options */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handleDismissRec(rec.id)} 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        >
                          Dismiss
                        </button>
                        <button 
                          onClick={() => handleExecuteRec(rec.id)} 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Audit Trail Logs Title */}
                <h4 style={{ fontSize: '1rem', marginTop: '12px', fontWeight: 600, borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '6px', color: 'hsl(var(--foreground) / 0.8)' }}>
                  Explainable Audit Log
                </h4>
                <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recommendations.filter(r => r.status !== 'proposed').length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted))', padding: '10px 0' }}>
                      No items in logs yet. Approved actions will record here.
                    </div>
                  ) : (
                    recommendations.filter(r => r.status !== 'proposed').map(rec => (
                      <div key={rec.id} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.01)', border: '1px solid hsl(var(--card-border))', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{rec.workshopTitle || 'System'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span 
                              className={rec.status === 'failed' ? 'badge badge-failed' : ''}
                              style={{ 
                                textTransform: 'uppercase', 
                                fontSize: '0.65rem', 
                                fontWeight: 700,
                                color: rec.status === 'executed' ? 'hsl(var(--success))' : rec.status === 'failed' ? 'hsl(var(--destructive))' : 'hsl(var(--muted))'
                              }}
                            >
                              {rec.status}
                            </span>
                            {rec.status === 'failed' && (
                              <button 
                                onClick={() => handleExecuteRec(rec.id)} 
                                className="btn btn-secondary" 
                                style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                title="Retry Failed Action"
                              >
                                <RefreshCw size={10} /> Retry
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ color: 'hsl(var(--muted))', lineHeight: '1.2' }}>
                          Recommendation: "{rec.recommendedAction}"
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- ROLE: FACILITATOR -------------------- */}
        {activeRole === 'facilitator' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Facilitator Workspace</h2>
                <p style={{ color: 'hsl(var(--muted))', fontSize: '0.9rem' }}>Select your assigned cohort to audit attendees and view feedback reviews.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label className="form-label" style={{ margin: 0 }}>Active Workshop:</label>
                <select 
                  className="form-input" 
                  style={{ width: '280px' }}
                  value={selectedWorkshopId} 
                  onChange={(e) => setSelectedWorkshopId(e.target.value)}
                >
                  {workshops.map(w => (
                    <option key={w.id} value={w.id}>{w.title} ({w.status})</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedWorkshopId ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                {/* Left Column Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  {/* Onboarding & Attendance Checks */}
                  <div className="card">
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={18} style={{ color: 'hsl(var(--primary))' }} /> Onboarding & Attendance Checks
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {participants.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted))' }}>
                          No participants registered for this workshop yet.
                        </div>
                      ) : (
                        participants.map(p => (
                          <div key={p.id} style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid hsl(var(--card-border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{p.name}</h4>
                              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted))' }}>{p.email}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem' }}>
                              <div>
                                <span style={{ color: 'hsl(var(--muted))', display: 'block', fontSize: '0.7rem' }}>Attendance</span>
                                <span style={{ 
                                  fontWeight: 600, 
                                  color: p.status === 'confirmed' ? 'hsl(var(--success))' : p.status === 'declined' ? 'hsl(var(--destructive))' : 'hsl(var(--warning))'
                                }}>{p.status}</span>
                              </div>
                              <div>
                                <span style={{ color: 'hsl(var(--muted))', display: 'block', fontSize: '0.7rem' }}>Onboarding</span>
                                <span style={{ 
                                  fontWeight: 600, 
                                  color: p.onboardingStatus === 'completed' ? 'hsl(var(--primary))' : 'hsl(var(--muted))'
                                }}>{p.onboardingStatus}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Pre-Workshop NLP Intelligence Card */}
                  {(() => {
                    const expectationsList = participants.map(p => p.expectations).filter(Boolean);
                    const nlpData = analyzeExpectations(expectationsList);
                    return (
                      <div className="card">
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles size={18} style={{ color: 'hsl(var(--primary))' }} /> Pre-Workshop NLP Intelligence
                        </h3>

                        {nlpData.sampleCount === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted))', fontSize: '0.85rem' }}>
                            No expectations captured from participants yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* AI Summary Box */}
                            <div style={{ 
                              padding: '16px', 
                              borderRadius: 'var(--radius-md)', 
                              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--accent) / 0.1) 100%)',
                              border: '1px solid hsl(var(--primary) / 0.15)',
                              fontSize: '0.9rem',
                              lineHeight: '1.5',
                              color: 'hsl(var(--foreground))'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600, color: 'hsl(var(--primary))' }}>
                                <Sparkles size={14} /> AI Insight Summary
                              </div>
                              <p style={{ margin: 0, fontStyle: 'italic' }}>"{nlpData.summary}"</p>
                            </div>

                            {/* Sentiment Cluster Bar Chart */}
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Cohort Sentiment Cluster</span>
                              <div style={{ height: '24px', display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'hsl(var(--secondary))', marginBottom: '12px' }}>
                                {nlpData.sentiment.positive > 0 && (
                                  <div style={{ 
                                    width: `${nlpData.sentiment.positive}%`, 
                                    backgroundColor: '#10b981', // green
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    transition: 'all var(--transition-normal)'
                                  }} title={`Positive: ${nlpData.sentiment.positive}%`}>
                                    {nlpData.sentiment.positive >= 10 ? `${nlpData.sentiment.positive}%` : ''}
                                  </div>
                                )}
                                {nlpData.sentiment.curious > 0 && (
                                  <div style={{ 
                                    width: `${nlpData.sentiment.curious}%`, 
                                    backgroundColor: '#3b82f6', // blue
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    transition: 'all var(--transition-normal)'
                                  }} title={`Curious: ${nlpData.sentiment.curious}%`}>
                                    {nlpData.sentiment.curious >= 10 ? `${nlpData.sentiment.curious}%` : ''}
                                  </div>
                                )}
                                {nlpData.sentiment.concerned > 0 && (
                                  <div style={{ 
                                    width: `${nlpData.sentiment.concerned}%`, 
                                    backgroundColor: '#f59e0b', // orange
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    transition: 'all var(--transition-normal)'
                                  }} title={`Concerned: ${nlpData.sentiment.concerned}%`}>
                                    {nlpData.sentiment.concerned >= 10 ? `${nlpData.sentiment.concerned}%` : ''}
                                  </div>
                                )}
                                {nlpData.sentiment.neutral > 0 && (
                                  <div style={{ 
                                    width: `${nlpData.sentiment.neutral}%`, 
                                    backgroundColor: '#6b7280', // gray
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    transition: 'all var(--transition-normal)'
                                  }} title={`Neutral: ${nlpData.sentiment.neutral}%`}>
                                    {nlpData.sentiment.neutral >= 10 ? `${nlpData.sentiment.neutral}%` : ''}
                                  </div>
                                )}
                              </div>

                              {/* Legend */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Positive ({nlpData.sentiment.positive}%)
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} /> Curious ({nlpData.sentiment.curious}%)
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Concerned ({nlpData.sentiment.concerned}%)
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6b7280' }} /> Neutral ({nlpData.sentiment.neutral}%)
                                </span>
                              </div>
                            </div>

                            {/* Themes Tag Cloud */}
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Extracted Learning Themes</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {nlpData.themes.map((theme, idx) => (
                                  <div key={idx} className="glass" style={{ 
                                    padding: '6px 12px', 
                                    borderRadius: '20px', 
                                    fontSize: '0.8rem', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '6px',
                                    border: '1px solid hsl(var(--card-border))',
                                    background: 'rgba(255,255,255,0.02)'
                                  }}>
                                    <span>{theme.name}</span>
                                    <span style={{ 
                                      fontSize: '0.7rem', 
                                      backgroundColor: 'hsl(var(--primary) / 0.15)', 
                                      color: 'hsl(var(--primary))', 
                                      padding: '1px 6px', 
                                      borderRadius: '10px',
                                      fontWeight: 600
                                    }}>{theme.percentage}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Expectations List */}
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Raw Responses ({nlpData.sampleCount})</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                {participants.filter(p => p.expectations).map(p => (
                                  <div key={p.id} style={{ 
                                    padding: '8px 12px', 
                                    borderRadius: 'var(--radius-sm)', 
                                    background: 'rgba(255,255,255,0.01)', 
                                    border: '1px solid hsl(var(--card-border))', 
                                    fontSize: '0.75rem',
                                    lineHeight: '1.4'
                                  }}>
                                    <div style={{ fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '2px' }}>{p.name}:</div>
                                    <div>"{p.expectations}"</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Right Column Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  
                  {/* Pre-Workshop Cohort Readiness Report */}
                  <div className="card">
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ClipboardList size={18} style={{ color: 'hsl(var(--primary))' }} /> Cohort Readiness Report
                    </h3>
                    
                    {(() => {
                      const total = participants.length;
                      const confirmed = participants.filter(p => p.status === 'confirmed').length;
                      const onboarded = participants.filter(p => p.onboardingStatus === 'completed').length;
                      
                      const confRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
                      const onboardRate = total > 0 ? Math.round((onboarded / total) * 100) : 0;
                      const readiness = Math.round((confRate + onboardRate) / 2);
                      
                      const getReadinessColor = (val) => {
                        if (val < 50) return 'hsl(var(--destructive))';
                        if (val < 80) return 'hsl(var(--warning))';
                        return 'hsl(var(--success))';
                      };

                      const activeW = workshops.find(w => w.id === selectedWorkshopId);
                      
                      return (
                        <div>
                          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{
                              width: '70px',
                              height: '70px',
                              borderRadius: '50%',
                              border: `5px solid ${getReadinessColor(readiness)}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'column',
                              flexShrink: 0
                            }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: getReadinessColor(readiness) }}>{readiness}%</span>
                              <span style={{ fontSize: '0.55rem', color: 'hsl(var(--muted))', textTransform: 'uppercase' }}>Ready</span>
                            </div>
                            <div>
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>Cohort Status: {readiness === 100 ? 'Prepared' : 'In Preparation'}</h4>
                              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))' }}>
                                {total === 0 ? 'No participants registered yet.' : 
                                 readiness === 100 ? 'Cohort is 100% ready for the session!' : 
                                 readiness > 80 ? 'Good readiness, final items pending.' : 
                                 'Needs attention: confirm attendance and complete onboarding.'}
                              </p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                <span>Attendance Confirmation</span>
                                <span style={{ fontWeight: 600 }}>{confirmed}/{total} ({confRate}%)</span>
                              </div>
                              <div style={{ height: '6px', background: 'hsl(var(--secondary))', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${confRate}%`, background: 'hsl(var(--accent))', borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
                              </div>
                            </div>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                <span>Onboarding Checklist</span>
                                <span style={{ fontWeight: 600 }}>{onboarded}/{total} ({onboardRate}%)</span>
                              </div>
                              <div style={{ height: '6px', background: 'hsl(var(--secondary))', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${onboardRate}%`, background: 'hsl(var(--primary))', borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
                              </div>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid hsl(var(--card-border))', paddingTop: '16px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', display: 'block', marginBottom: '10px', fontWeight: 600 }}>Cohort Tasks Checklist</span>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {activeW?.facilitatorId ? 
                                  <CheckSquare size={14} style={{ color: 'hsl(var(--success))' }} /> : 
                                  <AlertCircle size={14} style={{ color: 'hsl(var(--warning))' }} />
                                }
                                <span style={{ textDecoration: activeW?.facilitatorId ? 'line-through' : 'none', color: activeW?.facilitatorId ? 'hsl(var(--muted))' : 'hsl(var(--foreground))' }}>
                                  Facilitator assigned ({activeW?.facilitatorName || 'None'})
                                </span>
                              </li>
                              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {total > 0 ? 
                                  <CheckSquare size={14} style={{ color: 'hsl(var(--success))' }} /> : 
                                  <AlertCircle size={14} style={{ color: 'hsl(var(--warning))' }} />
                                }
                                <span style={{ textDecoration: total > 0 ? 'line-through' : 'none', color: total > 0 ? 'hsl(var(--muted))' : 'hsl(var(--foreground))' }}>
                                  Registrations received (minimum 1)
                                </span>
                              </li>
                              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {confRate >= 80 ? 
                                  <CheckSquare size={14} style={{ color: 'hsl(var(--success))' }} /> : 
                                  <AlertCircle size={14} style={{ color: confRate >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }} />
                                }
                                <span style={{ textDecoration: confRate >= 80 ? 'line-through' : 'none', color: confRate >= 80 ? 'hsl(var(--muted))' : 'hsl(var(--foreground))' }}>
                                  Target &ge;80% Confirmation Rate (Current: {confRate}%)
                                </span>
                              </li>
                              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {onboardRate === 100 && total > 0 ? 
                                  <CheckSquare size={14} style={{ color: 'hsl(var(--success))' }} /> : 
                                  <AlertCircle size={14} style={{ color: 'hsl(var(--warning))' }} />
                                }
                                <span style={{ textDecoration: onboardRate === 100 && total > 0 ? 'line-through' : 'none', color: onboardRate === 100 && total > 0 ? 'hsl(var(--muted))' : 'hsl(var(--foreground))' }}>
                                  Onboarding checklist completion (Current: {onboardRate}%)
                                </span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Feedback & Satisfaction Reports */}
                  <div className="card">
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} style={{ color: 'hsl(var(--accent))' }} /> Post-Workshop Feedback Reports
                    </h3>

                    {(() => {
                      const ws = workshops.find(w => w.id === selectedWorkshopId);
                      if (!ws || !ws.feedbackCount) {
                        return (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted))' }}>
                            No feedback reviews submitted yet. Feedback reports compile when the workshop is completed.
                          </div>
                        );
                      }

                      return (
                        <div>
                          {/* Summary Scorecard */}
                          <div className="glass" style={{ padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Rating</span>
                              <h4 style={{ fontSize: '2rem', fontWeight: 700, color: 'hsl(var(--success))' }}>{Number(ws.avgRating).toFixed(1)}/5.0</h4>
                            </div>
                            <div style={{ width: '1px', height: '40px', background: 'hsl(var(--card-border))' }} />
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reviews Submitted</span>
                              <h4 style={{ fontSize: '2rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{ws.feedbackCount}</h4>
                            </div>
                          </div>

                          {/* Feedback reviews notice */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground) / 0.8)' }}>Recent Participant Reviews:</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                              <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.01)', border: '1px solid hsl(var(--card-border))', fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>Participant Rating: 4/5</span>
                                </div>
                                <p style={{ color: 'hsl(var(--foreground) / 0.9)' }}>"The material was deep and very helpful. Could use some more hands-on labs, but overall great!"</p>
                              </div>
                              <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.01)', border: '1px solid hsl(var(--card-border))', fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>Participant Rating: 5/5</span>
                                </div>
                                <p style={{ color: 'hsl(var(--foreground) / 0.9)' }}>"Superb orchestration, the Agentic AI recommendations panel demo was excellent."</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass" style={{ padding: '40px', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
                No active workshops available to show.
              </div>
            )}
          </div>
        )}

        {/* -------------------- ROLE: PARTICIPANT -------------------- */}
        {activeRole === 'participant' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            {/* Left Column: Workshop Selection & Registration */}
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '6px', fontWeight: 700 }}>Workshop Hub</h3>
              <p style={{ color: 'hsl(var(--muted))', fontSize: '0.85rem', marginBottom: '24px' }}>Register for published training cohorts and manage your onboarding tasks.</p>

              <div className="form-group">
                <label className="form-label">Choose Workshop</label>
                <select 
                  className="form-input" 
                  value={selectedWorkshopId} 
                  onChange={(e) => setSelectedWorkshopId(e.target.value)}
                >
                  {workshops.filter(w => w.status === 'published' || w.status === 'registration_closed').map(w => {
                    const cap = w.capacity || 20;
                    const left = cap - (w.participantCount || 0);
                    const capLabel = left <= 0 ? ' (FULL - JOIN WAITLIST)' : ` (${left}/${cap} seats left)`;
                    return (
                      <option key={w.id} value={w.id}>{w.title} - {w.status.replace('_', ' ')}{capLabel}</option>
                    );
                  })}
                </select>
              </div>

              {/* Registration Section */}
              <div style={{ marginTop: '24px', borderTop: '1px solid hsl(var(--card-border))', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 600 }}>Enroll in Session</h4>
                <form onSubmit={handleRegisterParticipant}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. John Doe"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Corporate Email</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="e.g. john.doe@acme.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Learning Expectations (Free Text)</label>
                    <textarea 
                      className="form-input" 
                      style={{ minHeight: '80px', resize: 'vertical' }}
                      placeholder="What do you expect to learn from this workshop?"
                      value={regExpectations}
                      onChange={(e) => setRegExpectations(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Register
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Attendee Portal Controls (Self-Service) */}
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '6px', fontWeight: 700 }}>Attendee Self-Service Portal</h3>
              <p style={{ color: 'hsl(var(--muted))', fontSize: '0.85rem', marginBottom: '20px' }}>Manage enrollment confirmations and complete checklist tasks.</p>

              {participants.length === 0 ? (
                <div className="glass" style={{ padding: '24px', textAlign: 'center', borderRadius: 'var(--radius-md)', color: 'hsl(var(--muted))', fontSize: '0.85rem' }}>
                  Please register using the left panel to access the portal.
                </div>
              ) : (
                <div>
                  <div className="form-group">
                    <label className="form-label">Select Participant Identity</label>
                    <select 
                      className="form-input"
                      value={selectedParticipantId}
                      onChange={(e) => setSelectedParticipantId(e.target.value)}
                    >
                      {participants.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const currentPart = participants.find(p => p.id === selectedParticipantId);
                    if (!currentPart) return null;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Attendance status control */}
                        <div className="glass" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Attendance Status</span>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Current: <strong style={{ color: currentPart.status === 'confirmed' ? 'hsl(var(--success))' : 'hsl(var(--warning))' }}>{currentPart.status}</strong></span>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                              <button onClick={() => handleAttendance(currentPart.id, 'confirmed')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '4px' }}>
                                <Check size={14} style={{ color: 'hsl(var(--success))' }} /> Confirm
                              </button>
                              <button onClick={() => handleAttendance(currentPart.id, 'declined')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '4px' }}>
                                <X size={14} style={{ color: 'hsl(var(--destructive))' }} /> Decline
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Onboarding status control */}
                        <div className="glass" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Pre-Workshop Onboarding Checklist</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                              Status: <strong style={{ color: currentPart.onboardingStatus === 'completed' ? 'hsl(var(--primary))' : 'hsl(var(--warning))' }}>{currentPart.onboardingStatus}</strong>
                            </span>
                            {currentPart.onboardingStatus === 'pending' && (
                              <button onClick={() => handleOnboarding(currentPart.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                                Complete Onboarding
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Feedback Submission Section */}
                        <div className="glass" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted))', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Submit Post-Workshop Feedback</span>
                          <form onSubmit={handleSubmitFeedback}>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label className="form-label">Rating</label>
                              <select 
                                className="form-input"
                                value={feedbackRating}
                                onChange={(e) => setFeedbackRating(e.target.value)}
                              >
                                <option value="5">5 Stars - Outstanding</option>
                                <option value="4">4 Stars - Very Good</option>
                                <option value="3">3 Stars - Good</option>
                                <option value="2">2 Stars - Satisfactory</option>
                                <option value="1">1 Star - Unsatisfactory</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label className="form-label">Comments</label>
                              <textarea 
                                className="form-input"
                                style={{ minHeight: '60px', resize: 'vertical' }}
                                placeholder="What did you learn? How can we improve this cohort?"
                                value={feedbackComments}
                                onChange={(e) => setFeedbackComments(e.target.value)}
                                required
                              />
                            </div>
                            <button type="submit" className="btn btn-accent" style={{ width: '100%' }}>
                              Submit Feedback
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
