import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Plus, Trash2 } from 'lucide-react';

interface CreateWorkflowModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

// --- Constants & Helpers ---
// --- Constants & Helpers ---
const DEFAULT_ACTION_TYPES = [
    'LOCK_WALLET', 'UNLOCK_WALLET',
    'GAME_LOCK', 'GAME_UNLOCK',
    'SET_BONUS_ELIGIBILITY', 'SET_DEPOSIT_ELIGIBILITY', 'SET_WITHDRAWAL_ELIGIBILITY', 'SET_BANK_MGMT_LEVEL',
    'SEND_EMAIL', 'CREATE_TICKET', 'LOG_AUDIT'
];
const MEMBER_STATUSES = ['Active', 'Inactive', 'Suspended', 'Confiscated', 'Deleted'];

const TRIGGER_FIELD_OPTIONS = [
    { label: 'Member Status', value: 'NewStatus' },
    { label: 'Wallet Status', value: 'WalletStatus' },
    { label: 'Compliance Status', value: 'ComplianceStatus' },
    { label: 'Risk Level', value: 'RiskLevel' },
    { label: 'KYC Level', value: 'KYC_Level' },
    { label: 'Bonus Eligibility', value: 'BonusEligibility' },
    { label: 'Deposit Eligibility', value: 'DepositEligibility' },
    { label: 'Withdrawal Eligibility', value: 'WithdrawalEligibility' },
    { label: 'Bank Account Level', value: 'BankAccountMgmtLevel' }
];

const CriteriaValueInput = ({ field, value, onChange }: { field: string, value: string, onChange: (val: string) => void }) => {
    let options: string[] = [];
    // Safety check for null/undefined field
    const f = (field || '').toLowerCase().trim();

    // specific matching to avoid overlap
    if (f === 'newstatus' || f === 'member.status') options = MEMBER_STATUSES;
    else if (f === 'walletstatus' || f === 'wallet.status') options = ['Unlocked', 'Locked', 'Frozen'];
    else if (f === 'compliancestatus') options = ['Compliant', 'NonCompliant', 'UnderReview'];
    else if (f === 'risklevel' || f === 'risk_level') options = ['Low', 'Medium', 'High'];
    else if (f === 'kyc_level' || f === 'kyclevel') options = ['Pending', 'Verified', 'Rejected'];
    // Booleans for Eligibility
    else if (f.includes('eligibility')) options = ['true', 'false'];
    // Bank Level
    else if (f.includes('bank')) options = ['Standard', 'Restricted', 'VIP', 'SuperAdmin'];

    if (options.length > 0) {
        return (
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 p-2 border rounded text-sm"
            >
                <option value="">Select Value...</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        );
    }

    return (
        <input
            placeholder="Value"
            className="flex-1 p-2 border rounded text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    );
};

const API_URL = 'http://localhost:5200/api/workflows/definitions';

// Helper types for UI Builder
interface CriteriaItem {
    id: string; // for React key
    field: string;
    operator: string;
    value: string;
}

interface ActionItem {
    id: string;
    type: string;
    params: { [key: string]: string };
}

export const CreateWorkflowModal = ({ isOpen, onClose, onSuccess, initialData }: CreateWorkflowModalProps) => {
    const [name, setName] = useState('');
    const [triggerEvent, setTriggerEvent] = useState('MemberStatusChanged');
    const [ruleSet, setRuleSet] = useState('');
    const [contextProfile, setContextProfile] = useState('');
    const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);

    // [NEW] Dynamic Action Types
    const [availableActionTypes, setAvailableActionTypes] = useState<string[]>(DEFAULT_ACTION_TYPES);

    // --- UI Builder State ---
    const [logicOperator, setLogicOperator] = useState('AND');
    const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>([]);
    const [matchActions, setMatchActions] = useState<ActionItem[]>([]);
    const [noMatchActions, setNoMatchActions] = useState<ActionItem[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Context Profiles AND Action Routes
    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const [profRes, routeRes] = await Promise.all([
                    axios.get('http://localhost:5200/api/context/profiles').catch(() => ({ data: [] })),
                    axios.get('http://localhost:5200/api/routes').catch(() => ({ data: [] }))
                ]);

                setAvailableProfiles(profRes.data);

                // Merge Defaults with Routes
                const routeActions = (routeRes.data || []).map((r: any) => r.actionType);
                const merged = Array.from(new Set([...DEFAULT_ACTION_TYPES, ...routeActions]));
                setAvailableActionTypes(merged);
            } catch (err) {
                console.error("Failed to fetch meta data", err);
            }
        };
        fetchMeta();
    }, []);

    // Load Initial Data
    useEffect(() => {
        setError(null);
        if (initialData) {
            setName(initialData.name ?? '');
            setTriggerEvent(initialData.triggerEvent ?? 'MemberStatusChanged');
            setRuleSet(initialData.ruleSet ?? '');
            setContextProfile(initialData.contextProfile ?? 'Standard');

            // Parse Trigger JSON or Legacy Fields
            if (initialData.triggerConditionJson) {
                try {
                    const parsed = JSON.parse(initialData.triggerConditionJson);
                    setLogicOperator(parsed.Logic || 'AND');
                    setCriteriaList(parsed.Criteria.map((c: any) => ({
                        id: Math.random().toString(36).substr(2, 9),
                        field: c.Field,
                        operator: c.Operator,
                        value: c.Value
                    })));
                } catch (e) { console.warn("Failed to parse Trigger JSON", e); }
            } else if (initialData.conditionCriteria) {
                // Fallback Legacy Parsing
                const criteria = initialData.conditionCriteria;
                const knownOperators = ['==', '!=', '>=', '<=', '>', '<'];
                const op = knownOperators.find((o: string) => criteria.includes(o)) || '==';
                const parts = criteria.split(op);
                setCriteriaList([{
                    id: 'legacy-1',
                    field: parts[0]?.trim() || 'NewStatus',
                    operator: op,
                    value: parts[1]?.trim().replace(/"/g, '') || ''
                }]);
            } else {
                setCriteriaList([{ id: 'default-1', field: 'NewStatus', operator: '==', value: '' }]);
            }

            // Parse Match Actions
            if (initialData.onMatchActionsJson) {
                try {
                    const parsed = JSON.parse(initialData.onMatchActionsJson);
                    setMatchActions(parsed.map((a: any) => ({
                        id: Math.random().toString(36).substr(2, 9),
                        type: a.Type,
                        params: a.Params || {}
                    })));
                } catch (e) { }
            } else if (initialData.actionType) {
                setMatchActions([{ id: 'legacy-match', type: initialData.actionType, params: {} }]);
            } else {
                setMatchActions([]);
            }

            // Parse No Match Actions (New Only)
            if (initialData.onNoMatchActionsJson) {
                try {
                    const parsed = JSON.parse(initialData.onNoMatchActionsJson);
                    setNoMatchActions(parsed.map((a: any) => ({
                        id: Math.random().toString(36).substr(2, 9),
                        type: a.Type,
                        params: a.Params || {}
                    })));
                } catch (e) { }
            } else {
                setNoMatchActions([]);
            }

        } else {
            // Defaults for Create
            setName('');
            setTriggerEvent('MemberStatusChanged');
            setRuleSet('');
            setContextProfile('Standard');
            setLogicOperator('AND');
            setCriteriaList([{ id: 'new-1', field: 'NewStatus', operator: '==', value: '' }]);
            setMatchActions([{ id: 'new-match-1', type: 'LOCK_WALLET', params: {} }]);
            setNoMatchActions([]);
        }
    }, [initialData, isOpen]);


    // --- Handlers ---
    const addCriteria = () => {
        setCriteriaList([...criteriaList, { id: Math.random().toString(36), field: 'NewStatus', operator: '==', value: '' }]);
    };
    const removeCriteria = (id: string) => {
        setCriteriaList(criteriaList.filter(c => c.id !== id));
    };
    const updateCriteria = (id: string, field: keyof CriteriaItem, value: string) => {
        setCriteriaList(criteriaList.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addAction = (isMatch: boolean) => {
        const newItem = { id: Math.random().toString(36), type: 'LOCK_WALLET', params: {} };
        if (isMatch) setMatchActions([...matchActions, newItem]);
        else setNoMatchActions([...noMatchActions, newItem]);
    };
    const removeAction = (isMatch: boolean, id: string) => {
        if (isMatch) setMatchActions(matchActions.filter(a => a.id !== id));
        else setNoMatchActions(noMatchActions.filter(a => a.id !== id));
    };
    const updateActionType = (isMatch: boolean, id: string, type: string) => {
        const updater = (list: ActionItem[]) => list.map(a => a.id === id ? { ...a, type } : a);
        if (isMatch) setMatchActions(updater(matchActions));
        else setNoMatchActions(updater(noMatchActions));
    };
    const updateActionParam = (isMatch: boolean, id: string, key: string, value: any) => {
        const setter = isMatch ? setMatchActions : setNoMatchActions;
        setter(prev => prev.map(a =>
            a.id === id ? { ...a, params: { ...a.params, [key]: value } } : a
        ));
    };

    const updateActionParamsObject = (isMatch: boolean, id: string, newParams: Record<string, any>) => {
        const setter = isMatch ? setMatchActions : setNoMatchActions;
        setter(prev => prev.map(a =>
            a.id === id ? { ...a, params: newParams } : a
        ));
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        console.log("DEBUG: Preparing Payload...");

        // Serialize to JSON
        const triggerJsonRaw = {
            Logic: logicOperator,
            Criteria: criteriaList.map(({ field, operator, value }) => ({ Field: field, Operator: operator, Value: value }))
        };
        const matchJsonRaw = matchActions.map(({ type, params }) => ({ Type: type, Params: params }));
        const noMatchJsonRaw = noMatchActions.map(({ type, params }) => ({ Type: type, Params: params }));

        // Legacy Fallback (First Condition)
        const firstC = criteriaList[0] || { field: 'NewStatus', operator: '==', value: '' };
        const conditionCriteria = `${firstC.field} ${firstC.operator} ${firstC.value}`;
        const actionType = matchActions[0]?.type || '';

        const payload = {
            name,
            triggerEvent,
            conditionCriteria, // Legacy
            actionType,        // Legacy
            ruleSet,
            contextProfile,
            isActive: true,
            triggerConditionJson: JSON.stringify(triggerJsonRaw),
            onMatchActionsJson: JSON.stringify(matchJsonRaw),
            onNoMatchActionsJson: JSON.stringify(noMatchJsonRaw)
        };

        console.log("DEBUG PAYLOAD:", JSON.stringify(payload));

        try {
            if (initialData && initialData.id) {
                await axios.put(`${API_URL}/${initialData.id}`, { ...payload, id: Number(initialData.id) });
            } else {
                await axios.post(API_URL, payload);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Workflow Save Error:", err);
            const backendMsg = err.response?.data?.Message || err.response?.data?.Detailed;
            setError(backendMsg || err.message || 'Failed to create/update workflow');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Constants


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose}></div>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 relative z-10 max-h-[95vh] overflow-y-auto">

                <button type="button" className="absolute top-4 right-4 text-gray-400 hover:text-gray-500" onClick={onClose}>
                    <X className="h-6 w-6" />
                </button>

                <h3 className="text-xl font-bold text-gray-900 mb-6">
                    {initialData ? 'Edit Workflow Policy' : 'Create New Workflow Policy'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">{error}</div>}

                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Policy Name</label>
                            <input
                                type="text"
                                required
                                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Trigger Event</label>
                            <select
                                value={triggerEvent}
                                onChange={(e) => setTriggerEvent(e.target.value)}
                                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
                            >
                                <option value="MemberStatusChanged">MemberStatusChanged</option>
                                <option value="WalletUpdated">WalletUpdated</option>
                                <option value="ComplianceStatusChanged">ComplianceStatusChanged</option>
                                <option value="Scheduled">Scheduled (Daily)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Context Profile</label>
                            <select
                                value={contextProfile}
                                onChange={(e) => setContextProfile(e.target.value)}
                                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
                            >
                                <option value="Standard">Standard (Default)</option>
                                {availableProfiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Rule Logic</label>
                            <input type="text" value={ruleSet || '(System Assigned)'} disabled className="mt-1 block w-full bg-gray-100 border p-2 rounded text-gray-500" />
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Conditions Builder */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-md font-semibold text-gray-800">Trigger Conditions</h4>
                            <select
                                value={logicOperator}
                                onChange={(e) => setLogicOperator(e.target.value)}
                                className="text-sm border-gray-300 rounded shadow-sm p-1 border"
                            >
                                <option value="AND">Match ALL (AND)</option>
                                <option value="OR">Match ANY (OR)</option>
                            </select>
                        </div>

                        <div className="space-y-2 bg-gray-50 p-4 rounded border border-gray-200">
                            {criteriaList.map((c) => (
                                <div key={c.id} className="flex gap-2 items-center">
                                    <select
                                        className="flex-1 p-2 border rounded text-sm"
                                        value={c.field}
                                        onChange={(e) => updateCriteria(c.id, 'field', e.target.value)}
                                    >
                                        <option value="">Select Field...</option>
                                        {TRIGGER_FIELD_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="w-24 p-2 border rounded text-sm"
                                        value={c.operator}
                                        onChange={(e) => updateCriteria(c.id, 'operator', e.target.value)}
                                    >
                                        <option value="==">Equals</option>
                                        <option value="!=">Not Equals</option>
                                        <option value=">">&gt;</option>
                                        <option value="<">&lt;</option>
                                    </select>
                                    <CriteriaValueInput
                                        field={c.field}
                                        value={c.value}
                                        onChange={(val) => updateCriteria(c.id, 'value', val)}
                                    />
                                    <button type="button" onClick={() => removeCriteria(c.id)} className="text-red-500 hover:text-red-700 px-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={addCriteria} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 mt-2">
                                <Plus className="w-4 h-4 mr-1" /> Add Condition
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Match Actions */}
                        <div>
                            <h4 className="text-md font-semibold text-green-700 mb-2">On Match Actions</h4>
                            <div className="space-y-2 bg-green-50 p-3 rounded border border-green-100 min-h-[150px]">
                                {matchActions.map((a) => (
                                    <div key={a.id} className="border bg-white rounded p-3 shadow-sm relative">
                                        <button type="button" onClick={() => removeAction(true, a.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                                            <X className="w-3 h-3" />
                                        </button>
                                        <select
                                            className="w-full mb-2 p-1 border rounded text-sm font-medium"
                                            value={a.type}
                                            onChange={(e) => updateActionType(true, a.id, e.target.value)}
                                        >
                                            {availableActionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        {Object.keys(a.params).length > 0 && <div className="text-xs text-gray-500 mb-1">Params:</div>}
                                        <div className="space-y-1">
                                            {a.type.startsWith('SET_') && a.type.endsWith('_ELIGIBILITY') ? (
                                                <select
                                                    className="flex-1 p-2 border rounded text-sm"
                                                    value={a.params.value?.toString() || ''}
                                                    onChange={(e) => updateActionParam(true, a.id, 'value', e.target.value)}
                                                >
                                                    <option value="true">True</option>
                                                    <option value="false">False</option>
                                                </select>
                                            ) : a.type === 'SET_BANK_MGMT_LEVEL' ? (
                                                <select
                                                    className="flex-1 p-2 border rounded text-sm"
                                                    value={a.params.level || ''}
                                                    onChange={(e) => updateActionParam(true, a.id, 'level', e.target.value)}
                                                >
                                                    <option value="Standard">Standard</option>
                                                    <option value="Restricted">Restricted</option>
                                                    <option value="VIP">VIP</option>
                                                    <option value="SuperAdmin">SuperAdmin</option>
                                                </select>
                                            ) : (
                                                <input
                                                    placeholder="Params (JSON)"
                                                    className="flex-1 p-2 border rounded text-sm"
                                                    value={JSON.stringify(a.params || {})}
                                                    onChange={(e) => {
                                                        try {
                                                            const parsed = JSON.parse(e.target.value);
                                                            updateActionParamsObject(true, a.id, parsed);
                                                        } catch {
                                                            // Allow typing invalid json momentarily or handle string
                                                        }
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <button type="button" onClick={() => addAction(true)} className="flex items-center text-xs text-green-600 font-bold hover:text-green-800 mt-2">
                                    <Plus className="w-3 h-3 mr-1" /> Add Action
                                </button>
                            </div>
                        </div>

                        {/* No Match Actions */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-600 mb-2">On No-Match Actions</h4>
                            <div className="space-y-2 bg-gray-50 p-3 rounded border border-gray-200 min-h-[150px]">
                                {noMatchActions.map((a) => (
                                    <div key={a.id} className="border bg-white rounded p-3 shadow-sm relative">
                                        <button type="button" onClick={() => removeAction(false, a.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                                            <X className="w-3 h-3" />
                                        </button>
                                        <select
                                            className="w-full mb-2 p-1 border rounded text-sm font-medium"
                                            value={a.type}
                                            onChange={(e) => updateActionType(false, a.id, e.target.value)}
                                        >
                                            {availableActionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                ))}
                                <button type="button" onClick={() => addAction(false)} className="flex items-center text-xs text-gray-600 font-bold hover:text-gray-800 mt-2">
                                    <Plus className="w-3 h-3 mr-1" /> Add Action
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-2 px-4 rounded mr-3"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded shadow-sm disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Policy'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};


