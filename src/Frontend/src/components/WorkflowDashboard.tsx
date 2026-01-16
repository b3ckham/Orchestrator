import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import type { WorkflowDefinition, WorkflowExecution } from '../types/Workflow';
import { RefreshCw, CheckCircle, Clock, Plus, Edit2, Play, FileText } from 'lucide-react';
import { CreateWorkflowModal } from './CreateWorkflowModal';
import { LogDetailsModal } from './LogDetailsModal';
import { QueueMonitor } from './QueueMonitor';

const API_URL = 'http://localhost:5200/api/workflows';

export const WorkflowDashboard = () => {
    const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
    const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null);

    const [viewLogData, setViewLogData] = useState<{ content: string, traceId: string, executionId?: number } | null>(null);

    const [activeTab, setActiveTab] = useState<'workflows' | 'queues'>('workflows');

    // Run Modal State
    const [isRunModalOpen, setIsRunModalOpen] = useState(false);
    const [selectedWorkflowForRun, setSelectedWorkflowForRun] = useState<WorkflowDefinition | null>(null);
    const [runMemberId, setRunMemberId] = useState('');
    const [runAll, setRunAll] = useState(false);

    const handleCreate = () => {
        setEditingWorkflow(null); // Ensure creation mode
        setIsModalOpen(true);
    };

    const handleEdit = (def: WorkflowDefinition) => {
        setEditingWorkflow(def);
        setIsModalOpen(true);
    };

    const handleRunClick = (def: WorkflowDefinition) => {
        setSelectedWorkflowForRun(def);
        setIsRunModalOpen(true);
    };

    const confirmRun = async () => {
        if (!selectedWorkflowForRun) return;
        if (!runAll && !runMemberId.trim()) return;

        try {
            const memberIds = runMemberId.split(',').map(s => s.trim()).filter(s => s.length > 0);

            await axios.post(`${API_URL}/trigger`, {
                workflowId: selectedWorkflowForRun.id,
                targetMemberIds: memberIds,
                runAll: runAll
            });
            alert(`Workflow executed. Check logs below.`);
            fetchData();
            setIsRunModalOpen(false);
            setRunAll(false);
            setRunMemberId('');
        } catch (error: any) {
            alert(`Failed: ${error.response?.data?.Message || error.message}`);
        }
    };

    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        if (definitions.length === 0) setLoading(true);
        setError(null);
        try {
            const [defRes, execRes] = await Promise.all([
                axios.get<WorkflowDefinition[]>(`${API_URL}/definitions`),
                axios.get<WorkflowExecution[]>(`${API_URL}/executions`)
            ]);
            setDefinitions(defRes.data);
            setExecutions(execRes.data);
        } catch (error: any) {
            console.error("Error fetching workflow data", error);
            setError(error.message || "Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    const isModalOpenRef = useRef(isModalOpen);

    // Sync ref with state
    useEffect(() => {
        isModalOpenRef.current = isModalOpen;
    }, [isModalOpen]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            if (!isModalOpenRef.current) {
                fetchData();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading && definitions.length === 0) return <div className="p-8 text-center text-gray-500">Loading workflows...</div>;

    return (
        <div className="space-y-8">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                    <strong>Error loading data:</strong> {error}
                </div>
            )}
            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('workflows')}
                        className={`${activeTab === 'workflows'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Workflows & Logs
                    </button>
                    <button
                        onClick={() => setActiveTab('queues')}
                        className={`${activeTab === 'queues'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        System Health (RabbitMQ)
                    </button>
                </nav>
            </div>

            {activeTab === 'workflows' ? (
                <>
                    {/* Active Rules Section */}
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Active Policies (Rules)</h3>
                            <button
                                onClick={handleCreate}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Create Policy
                            </button>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trigger</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rules / Context</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {definitions.map((def) => (
                                    <tr key={def.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{def.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{def.triggerEvent}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono bg-gray-50 rounded">{def.conditionCriteria}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                            <div>Rule: {def.ruleSet || 'default'}</div>
                                            <div>Ctx: {def.contextProfile || 'default'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-semibold">{def.actionType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleRunClick(def)}
                                                className="text-green-600 hover:text-green-900 mr-4 inline-flex items-center"
                                                title="Manually Trigger this Policy"
                                            >
                                                <Play className="w-4 h-4 mr-1" />
                                                Run
                                            </button>
                                            <button
                                                onClick={() => handleEdit(def)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4 inline-flex items-center"
                                            >
                                                <Edit2 className="w-4 h-4 mr-1" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm('Delete this policy?')) {
                                                        await axios.delete(`${API_URL}/definitions/${def.id}`);
                                                        fetchData();
                                                    }
                                                }}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Execution Logs Section */}
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Live Execution Log</h3>
                            <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600">
                                <RefreshCw className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trace ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {executions.map((exec) => (
                                        <tr key={exec.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center">
                                                    <Clock className="w-4 h-4 mr-1 text-gray-400" />
                                                    {new Date(exec.executedAt).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                                                {exec.membershipId || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {exec.workflowName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono" title={exec.traceId}>
                                                {exec.traceId.substring(0, 8)}...
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${exec.status === 'Failed' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                                    }`}>
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    {exec.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <button
                                                    onClick={() => setViewLogData({ content: exec.logs, traceId: exec.traceId, executionId: exec.id })}
                                                    className="text-indigo-600 hover:text-indigo-900 inline-flex items-center font-medium"
                                                >
                                                    <FileText className="w-4 h-4 mr-1" />
                                                    View Logs
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {executions.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                                No executions yet. Try changing a member's status!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <CreateWorkflowModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={fetchData}
                        initialData={editingWorkflow}
                    />

                    <LogDetailsModal
                        isOpen={!!viewLogData}
                        onClose={() => setViewLogData(null)}
                        logContent={viewLogData?.content || ''}
                        traceId={viewLogData?.traceId || ''}
                        executionId={viewLogData?.executionId}
                    />

                    {/* Run Modal */}
                    {isRunModalOpen && selectedWorkflowForRun && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75">
                            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Run "{selectedWorkflowForRun.name}"</h3>

                                <div className="mb-4">
                                    <div className="flex items-center mb-4">
                                        <input
                                            id="run-all"
                                            type="checkbox"
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                            checked={runAll}
                                            onChange={(e) => setRunAll(e.target.checked)}
                                        />
                                        <label htmlFor="run-all" className="ml-2 block text-sm text-gray-900 font-bold">
                                            Run for ALL Members
                                        </label>
                                    </div>

                                    {!runAll && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Target Member ID(s)
                                            </label>
                                            <div className="text-xs text-gray-500 mb-1">Comma separated (e.g. M100, M101)</div>
                                            <input
                                                type="text"
                                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border p-2"
                                                value={runMemberId}
                                                onChange={(e) => setRunMemberId(e.target.value)}
                                                placeholder="M100, M102..."
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={() => setIsRunModalOpen(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmRun}
                                        disabled={!runAll && !runMemberId.trim()}
                                        className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white ${(!runAll && !runMemberId.trim()) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                                            }`}
                                    >
                                        Execute
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <QueueMonitor />
            )
            }
        </div >
    );
};
