import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, AlertTriangle, Info, RefreshCw, Server, Database, Activity, Filter, X, ChevronDown, ChevronRight, Terminal, History, ArrowRight } from 'lucide-react';

// Types
interface SystemError {
    id: number;
    traceId: string;
    serviceName: string;
    timestamp: string;
    severity: 'Critical' | 'Error' | 'Warning' | 'Info';
    category: string;
    errorCode: string;
    message: string;
    stackTrace?: string;
    contextJson?: string;
}

interface AuditLog {
    id: number;
    entityId: string;
    entityType: string;
    action: string;
    previousState: string;
    newState: string;
    source: string;
    timestamp: string;
}

const ERROR_API_URL = 'http://localhost:5400/api/errors';
const AUDIT_LOG_API_URL = 'http://localhost:5400/api/audit/logs';

// Helper: Parse Context JSON safely
const parseContext = (json?: string) => {
    if (!json) return null;
    try {
        return JSON.parse(json);
    } catch {
        return { raw: json };
    }
};

// Component: Severity Badge
const SeverityBadge = ({ severity }: { severity: string }) => {
    switch (severity?.toLowerCase()) {
        case 'critical':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200"><AlertCircle className="w-3 h-3 mr-1" /> Critical</span>;
        case 'error':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200"><AlertTriangle className="w-3 h-3 mr-1" /> Error</span>;
        case 'warning':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200"><AlertTriangle className="w-3 h-3 mr-1" /> Warning</span>;
        default:
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"><Info className="w-3 h-3 mr-1" /> Info</span>;
    }
};

// Component: Category Icon
const CategoryIcon = ({ category }: { category: string }) => {
    const c = (category || '').toLowerCase();
    if (c.includes('database')) return <Database className="w-4 h-4 text-purple-500" />;
    if (c.includes('connect')) return <Activity className="w-4 h-4 text-blue-500" />;
    if (c.includes('security')) return <AlertCircle className="w-4 h-4 text-red-500" />;
    return <Server className="w-4 h-4 text-slate-500" />;
};

export const AuditDashboard = () => {
    const [viewMode, setViewMode] = useState<'errors' | 'logs'>('errors');
    const [loading, setLoading] = useState(true);

    // Error State
    const [errors, setErrors] = useState<SystemError[]>([]);
    const [filterService, setFilterService] = useState<string>('All');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    // Audit Log State
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [filterMembershipId, setFilterMembershipId] = useState<string>('');
    const [filterDomain, setFilterDomain] = useState<string>('All');

    // Fetch Errors
    const fetchErrors = async () => {
        setLoading(true);
        try {
            const response = await axios.get<SystemError[]>(ERROR_API_URL);
            const sorted = response.data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setErrors(sorted);
        } catch (error) {
            console.error("Failed to fetch errors", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Audit Logs
    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (filterMembershipId) params.entityId = filterMembershipId;
            if (filterDomain !== 'All') params.entityType = filterDomain;

            const response = await axios.get<AuditLog[]>(AUDIT_LOG_API_URL, { params });
            // Sort client side to be sure (though API does it too)
            const sorted = response.data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setAuditLogs(sorted);
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'errors') fetchErrors();
        else fetchAuditLogs();
        
        const interval = setInterval(() => {
            if (viewMode === 'errors') fetchErrors();
            else fetchAuditLogs();
        }, 10000); // 10s refresh
        return () => clearInterval(interval);
    }, [viewMode, filterMembershipId, filterDomain]); 
    // Trigger fetch on filter change immediately for logs, errors handled client side filtering

    // Unique Facets for Errors
    const services = ['All', ...Array.from(new Set(errors.map(e => e.serviceName))).sort()];
    const categories = ['All', ...Array.from(new Set(errors.map(e => e.category))).sort()];
    const domains = ['All', 'Member', 'Wallet', 'Compliance'];

    // Filtering Errors
    const filteredErrors = errors.filter(e => {
        if (filterService !== 'All' && e.serviceName !== filterService) return false;
        if (filterCategory !== 'All' && e.category !== filterCategory) return false;
        return true;
    });

    const toggleRow = (id: number) => {
        setExpandedRow(prev => prev === id ? null : id);
    };

    // Format GMT+8
    const formatTime = (ts: string) => {
        return new Date(ts).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', hour12: false }).replace(',', '');
    };

    return (
        <div className="space-y-6">
            {/* View Switcher */}
            <div className="flex space-x-4 border-b border-gray-200">
                <button
                    onClick={() => setViewMode('errors')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        viewMode === 'errors' 
                            ? 'border-indigo-500 text-indigo-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <AlertTriangle className="w-4 h-4" /> System Errors
                </button>
                <button
                    onClick={() => setViewMode('logs')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        viewMode === 'logs' 
                            ? 'border-indigo-500 text-indigo-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <History className="w-4 h-4" /> Change Logs
                </button>
            </div>

            {/* ERROR VIEW */}
            {viewMode === 'errors' && (
                <>
                    {/* Filters */}
                    <div className="bg-white shadow rounded-lg p-4 border border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-700">Filters:</span>
                            </div>

                            <select
                                value={filterService}
                                onChange={(e) => setFilterService(e.target.value)}
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                            >
                                {services.map(s => <option key={s} value={s}>{s === 'All' ? 'All Services' : s}</option>)}
                            </select>

                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                            >
                                {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
                            </select>

                            {(filterService !== 'All' || filterCategory !== 'All') && (
                                <button
                                    onClick={() => { setFilterService('All'); setFilterCategory('All'); }}
                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> Clear
                                </button>
                            )}
                        </div>

                        <button
                            onClick={fetchErrors}
                            className={`p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-all ${loading ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Error Table */}
                    <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time (GMT+8)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredErrors.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No errors found.</td>
                                        </tr>
                                    ) : (
                                        filteredErrors.map((error) => (
                                            <>
                                                <tr
                                                    key={error.id}
                                                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${expandedRow === error.id ? 'bg-indigo-50/30' : ''}`}
                                                    onClick={() => toggleRow(error.id)}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                                                        {expandedRow === error.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                        {formatTime(error.timestamp)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {error.serviceName}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <SeverityBadge severity={error.severity} />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <div className="flex items-center gap-2">
                                                            <CategoryIcon category={error.category} />
                                                            {error.category}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono bg-gray-50 rounded px-2 py-1">
                                                        {error.errorCode}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate">
                                                        {error.message}
                                                    </td>
                                                </tr>
                                                {/* Expanded Details Row would go here (omitted for brevity, same as previous) */}
                                                {expandedRow === error.id && (
                                                    <tr className="bg-gray-50/50">
                                                        <td colSpan={7} className="px-6 py-4">
                                                            <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm space-y-4">
                                                                <div className="text-sm text-gray-800 font-mono">{error.stackTrace || 'No Stack Trace'}</div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* AUDIT LOG VIEW */}
            {viewMode === 'logs' && (
                <>
                    {/* Filters */}
                    <div className="bg-white shadow rounded-lg p-4 border border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-700">Filters:</span>
                            </div>

                            <input 
                                type="text"
                                placeholder="Membership ID..."
                                value={filterMembershipId}
                                onChange={(e) => setFilterMembershipId(e.target.value)}
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 w-48"
                            />

                            <select
                                value={filterDomain}
                                onChange={(e) => setFilterDomain(e.target.value)}
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                            >
                                {domains.map(d => <option key={d} value={d}>{d === 'All' ? 'All Domains' : d}</option>)}
                            </select>

                            {(filterMembershipId || filterDomain !== 'All') && (
                                <button
                                    onClick={() => { setFilterMembershipId(''); setFilterDomain('All'); }}
                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> Clear
                                </button>
                            )}
                        </div>

                        <button
                            onClick={fetchAuditLogs}
                            className={`p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-all ${loading ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Logs Table */}
                    <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time (GMT+8)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous State</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New State</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {auditLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500">No logs found.</td>
                                        </tr>
                                    ) : (
                                        auditLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                    {formatTime(log.timestamp)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                        log.entityType === 'Member' ? 'bg-indigo-100 text-indigo-800' : 
                                                        log.entityType === 'Wallet' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {log.entityType}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {log.entityId}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {log.source}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                                    {log.action}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 bg-red-50 rounded-l-md font-medium">
                                                    {log.previousState}
                                                </td>
                                                <td className="px-0 py-4 text-center">
                                                    <ArrowRight className="w-4 h-4 text-gray-400 mx-auto" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 bg-green-50 rounded-r-md font-medium">
                                                    {log.newState}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
