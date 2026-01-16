import React, { useState, useEffect } from 'react';

interface AdapterConfig {
    id: number;
    adapterName: string;
    baseUrl: string;
    authToken: string;
    defaultHeadersJson: string;
    apiKey?: string; // [NEW]
    isActive: boolean;
}

interface ActionRouteConfig {
    actionType: string;
    targetUrl: string;
    httpMethod: string; // [NEW]
    payloadTemplate: string;
    authSecret: string;
}

interface N8nWorkflow { id: string; name: string; tags: string[]; webhooks: string[]; }

const ADAPTER_API_URL = 'http://localhost:5200/api/adapters';
const ROUTE_API_URL = 'http://localhost:5200/api/routes';

const SYSTEM_TEMPLATES: Record<string, { type: string, method: string, path: string, payload: string }[]> = {
    'MemberService': [
        // Adapter Base URL includes /api/members, so we only need relative paths
        { type: 'GAME_LOCK', method: 'PUT', path: '/{{membershipId}}/game-lock', payload: '{"isLocked": true}' },
        { type: 'GAME_UNLOCK', method: 'PUT', path: '/{{membershipId}}/game-lock', payload: '{"isLocked": false}' },
        { type: 'SET_BONUS_ELIGIBILITY', method: 'PUT', path: '/{{membershipId}}/eligibility', payload: '{"bonusEligibility": true}' },
        { type: 'SET_DEPOSIT_ELIGIBILITY', method: 'PUT', path: '/{{membershipId}}/eligibility', payload: '{"depositEligibility": true}' },
        { type: 'SET_WITHDRAWAL_ELIGIBILITY', method: 'PUT', path: '/{{membershipId}}/eligibility', payload: '{"withdrawalEligibility": true}' },
        { type: 'SET_BANK_MGMT_LEVEL', method: 'PUT', path: '/{{membershipId}}/eligibility', payload: '{"bankAccountMgmtLevel": "VIP"}' },
    ],
    'WalletService': [
        // Adapter Base URL includes /api/wallets
        { type: 'LOCK_WALLET', method: 'PUT', path: '/{{membershipId}}/status', payload: '{"status": "Locked"}' },
        { type: 'UNLOCK_WALLET', method: 'PUT', path: '/{{membershipId}}/status', payload: '{"status": "Unlocked"}' }
    ],
    'ComplianceService': [
        // Adapter Base URL includes /api/compliance
        { type: 'SET_KYC_LEVEL', method: 'PUT', path: '/{{membershipId}}/status', payload: '{"status": "Verified"}' },
        { type: 'SET_RISK_LEVEL', method: 'PUT', path: '/{{membershipId}}/status', payload: '{"riskLevel": "High"}' }
    ]
};

const IntegrationsPage: React.FC = () => {
    const [adapters, setAdapters] = useState<AdapterConfig[]>([]);
    const [routes, setRoutes] = useState<ActionRouteConfig[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingAdapterId, setEditingAdapterId] = useState<number | null>(null);
    const [adapterForm, setAdapterForm] = useState<AdapterConfig | null>(null);

    const [editingRouteType, setEditingRouteType] = useState<string | null>(null);
    const [routeForm, setRouteForm] = useState<ActionRouteConfig | null>(null);
    const [isNewRoute, setIsNewRoute] = useState(false);

    // [NEW] Template Selection State
    const [selectedTemplateAdapter, setSelectedTemplateAdapter] = useState<string>('');

    const [testModalOpen, setTestModalOpen] = useState(false);
    const [testForm, setTestForm] = useState({
        actionType: 'LOCK_WALLET',
        membershipId: 'MEM001',
        paramsJson: '{}'
    });
    const [testResult, setTestResult] = useState<any>(null);

    // [NEW] Discovery State
    const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
    const [n8nWorkflows, setN8nWorkflows] = useState<N8nWorkflow[]>([]);
    const [loadingWorkflows, setLoadingWorkflows] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [adaptRes, routeRes] = await Promise.all([
                fetch(ADAPTER_API_URL),
                fetch(ROUTE_API_URL)
            ]);
            setAdapters(await adaptRes.json());
            setRoutes(await routeRes.json());
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Adapter Handlers ---
    const handleEditAdapter = (adapter: AdapterConfig) => {
        setEditingAdapterId(adapter.id);
        setAdapterForm({ ...adapter });
    };

    const handleSaveAdapter = async () => {
        if (!adapterForm) return;
        try {
            await fetch(`${ADAPTER_API_URL}/${adapterForm.adapterName}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(adapterForm)
            });
            setEditingAdapterId(null);
            fetchData();
        } catch (error) {
            console.error('Save failed', error);
        }
    };

    // --- Route Handlers ---
    const handleEditRoute = (route: ActionRouteConfig) => {
        setEditingRouteType(route.actionType);
        setRouteForm({ ...route });
        setIsNewRoute(false);

        // [New] Auto-detect adapter relationship
        const matchedAdapter = adapters.find(a => route.targetUrl.startsWith(a.baseUrl));
        if (matchedAdapter) {
            setSelectedTemplateAdapter(matchedAdapter.adapterName);
        } else {
            setSelectedTemplateAdapter('');
        }
    };

    const handleCreateRoute = () => {
        setRouteForm({
            actionType: '',
            targetUrl: 'http://localhost:5678/webhook/new',
            httpMethod: 'POST',
            payloadTemplate: '{}',
            authSecret: ''
        });
        setEditingRouteType('NEW');
        setIsNewRoute(true);
    };

    const handleSaveRoute = async () => {
        if (!routeForm) return;
        try {
            if (isNewRoute) {
                await fetch(ROUTE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(routeForm)
                });
            } else {
                await fetch(`${ROUTE_API_URL}/${routeForm.actionType}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(routeForm)
                });
            }
            setEditingRouteType(null);
            fetchData();
        } catch (error) {
            console.error('Save route failed', error);
        }
    };

    const handleDeleteRoute = async (actionType: string) => {
        if (!confirm(`Using default N8n adapter for ${actionType}?`)) return;
        try {
            await fetch(`${ROUTE_API_URL}/${actionType}`, { method: 'DELETE' });
            fetchData();
        } catch (error) {
            console.error('Delete failed', error);
        }
    };

    // --- Discovery Handlers ---
    const handleOpenDiscovery = async () => {
        setDiscoveryModalOpen(true);
        setLoadingWorkflows(true);
        try {
            // Fetch workflows (optionally projects later)
            const res = await fetch(`${ROUTE_API_URL}/n8n-workflows`);
            if (res.ok) {
                setN8nWorkflows(await res.json());
            } else {
                console.error("Failed to fetch workflows");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingWorkflows(false);
        }
    };

    const handleSelectWorkflow = (webhookUrl: string) => {
        // Extract method and url if formatted like "POST: url"
        let method = "POST";
        let url = webhookUrl;

        if (webhookUrl.includes(": ")) {
            const parts = webhookUrl.split(": ");
            method = parts[0];
            url = parts[1].split(" ")[0]; // remove (Node Name) if present
        }

        setRouteForm(prev => prev ? { ...prev, targetUrl: url, httpMethod: method } : null);
        setDiscoveryModalOpen(false);
    };

    // --- Test Handler ---
    const [testVariables, setTestVariables] = useState<Record<string, string>>({});
    const [showRawParams, setShowRawParams] = useState(false);

    // --- Test Handler ---
    const extractVariables = (text: string): string[] => {
        if (!text) return [];
        // Regex allows: spaces, dots, variable names
        const regex = /{{\s*([\w\d_.-]+)\s*}}/g;
        const matches = [...text.matchAll(regex)];
        return matches.map(m => m[1]);
    };

    const handleOpenTestModal = (route: ActionRouteConfig) => {
        // Find vars in URL and Payload
        const varsUrl = extractVariables(route.targetUrl);
        const varsPayload = extractVariables(route.payloadTemplate);
        const uniqueVars = Array.from(new Set([...varsUrl, ...varsPayload]));

        // Initialize state
        const initialVars: Record<string, string> = {};
        uniqueVars.forEach(v => {
            initialVars[v] = v === 'membershipId' ? 'MEM001' : ''; // Default for membershipId
        });

        setTestVariables(initialVars);
        setTestForm({
            actionType: route.actionType,
            membershipId: 'MEM001',
            paramsJson: '{}'
        });
        setTestModalOpen(true);
    };

    const handleVariableChange = (key: string, value: string) => {
        setTestVariables(prev => ({ ...prev, [key]: value }));
    };

    const handleRunTest = async () => {
        setTestResult(null);
        try {
            const rawParams = JSON.parse(testForm.paramsJson);

            // Merge dynamic variables into params. 
            // Priority: Raw Params overrides Dynamic Vars (or vice-versa, depending on preference. Here merging.)
            const finalParams = { ...testVariables, ...rawParams };

            const res = await fetch('http://localhost:5200/api/test/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actionType: testForm.actionType,
                    membershipId: testVariables['membershipId'] || testForm.membershipId, // Use var if present
                    params: finalParams
                })
            });
            const data = await res.json();
            setTestResult(data);
        } catch (error: any) {
            setTestResult({ error: error.message });
        }
    };

    // const PAYLOAD_EXAMPLES = ... (removed unused)

    // const currentExample = ... (removed unused)

    if (loading) return <div className="p-8">Loading Integrations...</div>;

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Integration Adapters</h1>
                    <p className="text-gray-600">Configure connection details for external execution adapters.</p>
                </div>
                <button
                    onClick={() => setTestModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                    Run Test Action
                </button>
            </div>

            {/* Legacy Adapters Grid */}
            <h2 className="text-xl font-bold text-gray-800 mb-4">Core Adapters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {adapters.map((adapter) => (
                    <div key={adapter.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                {adapter.adapterName}
                                <span className={`text-xs px-2 py-1 rounded-full ${adapter.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {adapter.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </h2>
                            {editingAdapterId !== adapter.id && (
                                <button onClick={() => handleEditAdapter(adapter)} className="text-blue-600 hover:text-blue-800 text-sm">
                                    Edit Settings
                                </button>
                            )}
                        </div>

                        {editingAdapterId === adapter.id ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Webhook Base URL</label>
                                    <input
                                        type="text"
                                        className="mt-1 w-full border rounded px-3 py-2 text-sm"
                                        value={adapterForm?.baseUrl || ''}
                                        onChange={e => setAdapterForm(prev => prev ? { ...prev, baseUrl: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">n8n API Key (Optional)</label>
                                    <input
                                        type="password"
                                        className="mt-1 w-full border rounded px-3 py-2 text-sm"
                                        placeholder="Specific to n8n management"
                                        value={adapterForm?.apiKey || ''}
                                        onChange={e => setAdapterForm(prev => prev ? { ...prev, apiKey: e.target.value } : null)}
                                    />
                                </div>
                                <div className="flex gap-2 justify-end mt-4">
                                    <button onClick={() => setEditingAdapterId(null)} className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm">Cancel</button>
                                    <button onClick={handleSaveAdapter} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 text-sm text-gray-600">
                                <code className="block bg-gray-100 p-2 rounded break-all text-xs">{adapter.baseUrl}</code>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* New Action Router Grid */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Action Router (Overrides)</h2>
                <button onClick={handleCreateRoute} className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-gray-800">
                    + Add Route
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {routes.map((route) => (
                    <div key={route.actionType} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-indigo-700">{route.actionType}</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleOpenTestModal(route)}
                                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                >
                                    Test
                                </button>
                                {editingRouteType !== route.actionType && (
                                    <>
                                        <button onClick={() => handleEditRoute(route)} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                                        <button onClick={() => handleDeleteRoute(route.actionType)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                                    </>
                                )}
                            </div>
                        </div>

                        {editingRouteType === route.actionType ? (
                            <div className="space-y-3">
                                {/* [NEW] Edit Mode - Link to Adapter */}
                                <div className="mb-2 p-2 bg-indigo-50 rounded border border-indigo-100">
                                    <label className="block text-xs font-bold text-indigo-800 mb-1">Update from Adapter</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="flex-1 border rounded px-2 py-1 text-xs"
                                            value={selectedTemplateAdapter}
                                            onChange={e => setSelectedTemplateAdapter(e.target.value)}
                                        >
                                            <option value="">Select Adapter to Re-bind...</option>
                                            {adapters.filter(a => a.isActive).map(a => (
                                                <option key={a.id} value={a.adapterName}>{a.adapterName}</option>
                                            ))}
                                        </select>

                                        {selectedTemplateAdapter === 'N8n' ? (
                                            <button onClick={handleOpenDiscovery} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">
                                                Browse
                                            </button>
                                        ) : selectedTemplateAdapter && SYSTEM_TEMPLATES[selectedTemplateAdapter] ? (
                                            <select
                                                className="flex-1 border rounded px-2 py-1 text-xs"
                                                onChange={e => {
                                                    const tmpl = SYSTEM_TEMPLATES[selectedTemplateAdapter].find(t => t.type === e.target.value);
                                                    if (tmpl) {
                                                        const adapter = adapters.find(a => a.adapterName === selectedTemplateAdapter);
                                                        const baseUrl = adapter?.baseUrl || '';
                                                        setRouteForm(prev => prev ? {
                                                            ...prev,
                                                            actionType: prev.actionType || tmpl.type, // Keep existing type unless needed? User might want to switch template for same type. Actually, usually we re-bind logic, so let's overwrite fields but keep ActionType readonly in Edit?
                                                            // Wait, if I re-bind, I want to update URL/Payload. Action Type is the key.
                                                            targetUrl: `${baseUrl}${tmpl.path}`,
                                                            httpMethod: tmpl.method,
                                                            payloadTemplate: tmpl.payload,
                                                            authSecret: adapter?.authToken || ''
                                                        } : null);
                                                    }
                                                }}
                                            >
                                                <option value="">Select Template...</option>
                                                {SYSTEM_TEMPLATES[selectedTemplateAdapter].map(t => (
                                                    <option key={t.type} value={t.type}>{t.type}</option>
                                                ))}
                                            </select>
                                        ) : null}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Target URL</label>
                                    <input
                                        className="w-full border rounded px-2 py-1 text-sm"
                                        value={routeForm?.targetUrl || ''}
                                        onChange={e => setRouteForm(prev => prev ? { ...prev, targetUrl: e.target.value } : null)}
                                    />
                                    <button onClick={handleOpenDiscovery} className="text-xs text-indigo-600 underline mt-1">
                                        Browse n8n Workflows
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-1/3">
                                        <label className="block text-xs font-medium text-gray-700">Method</label>
                                        <select
                                            className="w-full border rounded px-2 py-1 text-sm"
                                            value={routeForm?.httpMethod || 'POST'}
                                            onChange={e => setRouteForm(prev => prev ? { ...prev, httpMethod: e.target.value } : null)}
                                        >
                                            <option value="POST">POST</option>
                                            <option value="GET">GET</option>
                                            <option value="PUT">PUT</option>
                                            <option value="DELETE">DELETE</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Payload Template</label>
                                    <textarea
                                        className="w-full border rounded px-2 py-1 text-xs font-mono h-24"
                                        value={routeForm?.payloadTemplate || ''}
                                        onChange={e => setRouteForm(prev => prev ? { ...prev, payloadTemplate: e.target.value } : null)}
                                    />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setEditingRouteType(null)} className="px-3 py-1 text-gray-600 text-xs">Cancel</button>
                                    <button onClick={handleSaveRoute} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 text-sm text-gray-600">
                                <div className='flex flex-col gap-1'>
                                    <span className="text-xs font-bold text-gray-400 uppercase">Endpoint</span>
                                    <code className="block bg-gray-50 p-1.5 rounded break-all text-xs">{route.targetUrl}</code>
                                </div>
                                <div className='flex flex-col gap-1'>
                                    <span className="text-xs font-bold text-gray-400 uppercase">Template</span>
                                    <pre className="block bg-gray-50 p-1.5 rounded overflow-hidden text-xs h-16">{route.payloadTemplate}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* New Route Form */}
                {editingRouteType === 'NEW' && (
                    <div className="bg-white rounded-xl shadow-sm border-2 border-indigo-100 p-6">
                        <h2 className="text-lg font-semibold text-indigo-700 mb-4">New Route</h2>

                        {/* [NEW] Template Loader */}
                        <div className="mb-4 p-3 bg-indigo-50 rounded border border-indigo-100">
                            <label className="block text-xs font-bold text-indigo-800 mb-1">Load from Adapter Template</label>
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 border rounded px-2 py-1 text-xs"
                                    value={selectedTemplateAdapter}
                                    onChange={e => setSelectedTemplateAdapter(e.target.value)}
                                >
                                    <option value="">Select Adapter...</option>
                                    {adapters.filter(a => a.isActive).map(a => (
                                        <option key={a.id} value={a.adapterName}>{a.adapterName}</option>
                                    ))}
                                </select>

                                {selectedTemplateAdapter === 'N8n' ? (
                                    <button onClick={handleOpenDiscovery} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">
                                        Browse Workflows
                                    </button>
                                ) : selectedTemplateAdapter && SYSTEM_TEMPLATES[selectedTemplateAdapter] ? (
                                    <select
                                        className="flex-1 border rounded px-2 py-1 text-xs"
                                        onChange={e => {
                                            const tmpl = SYSTEM_TEMPLATES[selectedTemplateAdapter].find(t => t.type === e.target.value);
                                            if (tmpl) {
                                                const adapter = adapters.find(a => a.adapterName === selectedTemplateAdapter);
                                                const baseUrl = adapter?.baseUrl || '';
                                                setRouteForm({
                                                    actionType: tmpl.type,
                                                    targetUrl: `${baseUrl}${tmpl.path}`,
                                                    httpMethod: tmpl.method,
                                                    payloadTemplate: tmpl.payload,
                                                    authSecret: adapter?.authToken || ''
                                                });
                                            }
                                        }}
                                    >
                                        <option value="">Select Action Template...</option>
                                        {SYSTEM_TEMPLATES[selectedTemplateAdapter].map(t => (
                                            <option key={t.type} value={t.type}>{t.type}</option>
                                        ))}
                                    </select>
                                ) : null}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Action Type</label>
                                <input
                                    className="w-full border rounded px-2 py-1 text-sm font-bold"
                                    placeholder="e.g. TEAM_NOTIFY"
                                    value={routeForm?.actionType || ''}
                                    onChange={e => setRouteForm(prev => prev ? { ...prev, actionType: e.target.value } : null)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Target URL</label>
                                <input
                                    className="w-full border rounded px-2 py-1 text-sm"
                                    value={routeForm?.targetUrl || ''}
                                    onChange={e => setRouteForm(prev => prev ? { ...prev, targetUrl: e.target.value } : null)}
                                />
                                <button onClick={handleOpenDiscovery} className="text-xs text-indigo-600 underline mt-1">
                                    Browse n8n Workflows
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <div className="w-1/3">
                                    <label className="block text-xs font-medium text-gray-700">Method</label>
                                    <select
                                        className="w-full border rounded px-2 py-1 text-sm"
                                        value={routeForm?.httpMethod || 'POST'}
                                        onChange={e => setRouteForm(prev => prev ? { ...prev, httpMethod: e.target.value } : null)}
                                    >
                                        <option value="POST">POST</option>
                                        <option value="GET">GET</option>
                                        <option value="PUT">PUT</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Payload Template</label>
                                <textarea
                                    className="w-full border rounded px-2 py-1 text-xs font-mono h-24"
                                    value={routeForm?.payloadTemplate || ''}
                                    onChange={e => setRouteForm(prev => prev ? { ...prev, payloadTemplate: e.target.value } : null)}
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditingRouteType(null)} className="px-3 py-1 text-gray-600 text-xs">Cancel</button>
                                <button onClick={handleSaveRoute} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Create Route</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Test Action Modal */}
            {testModalOpen && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Test Workflow Action</h3>
                            <button onClick={() => setTestModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="space-y-4">
                            {/* Dynamic Variable Inputs */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">Template Variables</h4>
                                {Object.keys(testVariables).length === 0 ? (
                                    <p className="text-xs text-gray-500 italic">No variables detected inside {'{{...}}'}. You can add custom params below.</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.entries(testVariables).map(([key, val]) => (
                                            <div key={key}>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">{key}</label>
                                                <input
                                                    className="w-full border rounded px-2 py-1 text-sm bg-white"
                                                    value={val}
                                                    onChange={e => handleVariableChange(key, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Raw JSON Override */}
                            <div className="mt-4">
                                <button
                                    onClick={() => setShowRawParams(!showRawParams)}
                                    className="text-xs text-indigo-600 underline mb-1"
                                >
                                    {showRawParams ? 'Hide' : 'Show'} Raw Parameters JSON
                                </button>
                                {showRawParams && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Additional Parameters (JSON)</label>
                                        <textarea
                                            className="w-full border rounded px-3 py-2 font-mono text-sm h-24"
                                            value={testForm.paramsJson}
                                            onChange={e => setTestForm({ ...testForm, paramsJson: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {testResult && (
                                <div className={`p-3 rounded text-sm overflow-auto max-h-40 ${testResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                    <pre>{JSON.stringify(testResult, null, 2)}</pre>
                                </div>
                            )}
                            <div className="flex justify-end gap-2">
                                <button onClick={handleRunTest} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Execute Action</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Discovery Modal */}
            {
                discoveryModalOpen && (
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Select n8n Workflow</h3>
                                <button onClick={() => setDiscoveryModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                            {loadingWorkflows ? (
                                <div className="flex-1 flex justify-center items-center">Loading from n8n...</div>
                            ) : (
                                <div className="flex-1 overflow-auto space-y-2">
                                    {n8nWorkflows.length === 0 ? (
                                        <p className="text-center text-gray-500">No active workflows with Webhooks found.</p>
                                    ) : (
                                        n8nWorkflows.map(w => (
                                            <div key={w.id} className="border p-3 rounded hover:bg-gray-50">
                                                <div className="flex justify-between">
                                                    <span className="font-bold">{w.name}</span>
                                                    <div className="flex gap-1">
                                                        {w.tags.map(t => <span key={t} className="text-xs bg-gray-200 px-1 rounded">{t}</span>)}
                                                    </div>
                                                </div>
                                                <div className="mt-2 text-xs space-y-1">
                                                    {w.webhooks.map(wh => (
                                                        <button
                                                            key={wh}
                                                            onClick={() => handleSelectWorkflow(wh)}
                                                            className="block w-full text-left bg-indigo-50 hover:bg-indigo-100 p-2 rounded text-indigo-700 truncate"
                                                        >
                                                            {wh}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default IntegrationsPage;
