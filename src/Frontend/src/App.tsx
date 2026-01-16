import { useState } from 'react';
import { MemberTable } from './components/MemberTable';
import { CreateMemberModal } from './components/CreateMemberModal';
import { WorkflowDashboard } from './components/WorkflowDashboard';
import { AuditDashboard } from './components/AuditDashboard';
import ContextProfiles from './components/ContextProfiles';
import IntegrationsPage from './pages/IntegrationsPage';
import { LayoutDashboard, Users, Activity } from 'lucide-react';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'workflows' | 'audit' | 'profiles' | 'integrations'>('members');
  // We need a way to refresh the table. Simple way: key prop or context.
  // For POC, let's just force a reload, or pass a refresh trigger to MemberTable.
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="bg-indigo-600 p-1.5 rounded-lg">
                  <LayoutDashboard className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight text-indigo-900">Orchestrator</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('members')}
                  className={`${activeTab === 'members' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Members
                </button>
                <button
                  onClick={() => setActiveTab('workflows')}
                  className={`${activeTab === 'workflows' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Workflows
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`${activeTab === 'audit' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Observability
                </button>
                <button
                  onClick={() => setActiveTab('profiles')}
                  className={`${activeTab === 'profiles' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Profiles
                </button>
                <button
                  onClick={() => setActiveTab('integrations')}
                  className={`${activeTab === 'integrations' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Integrations
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs ring-2 ring-white">
                JS
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-10">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between mb-8">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                {activeTab === 'members' ? 'Member Management' :
                  activeTab === 'workflows' ? 'Workflow Orchestration' :
                    activeTab === 'audit' ? 'System Observability' :
                      activeTab === 'profiles' ? 'Context Registry' :
                        'Integrations'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'members' ? 'View and update member statuses to trigger workflows.' :
                  activeTab === 'workflows' ? 'Monitor active rules and real-time execution logs.' :
                    activeTab === 'audit' ? 'Centralized audit logs and error troubleshooting.' :
                      activeTab === 'profiles' ? 'View available Data Scopes/profiles for Rules.' :
                        'Configure external adapters (n8n, Team Notify) and Webhooks.'}
              </p>
            </div>
            {activeTab === 'members' && (
              <div className="mt-4 flex md:ml-4 md:mt-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all">
                  Create Member
                </button>
              </div>
            )}
          </div>

          {activeTab === 'members' && <MemberTable key={refreshTrigger} />}
          {activeTab === 'workflows' && <WorkflowDashboard />}
          {activeTab === 'audit' && <AuditDashboard />}
          {activeTab === 'profiles' && <ContextProfiles />}
          {activeTab === 'integrations' && <IntegrationsPage />}
        </div>
      </main>

      <CreateMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
}

export default App;
