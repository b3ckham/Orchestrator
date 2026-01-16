import { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface LogDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    logContent: string; // Optional: Initial content (if available)
    traceId: string;
    executionId?: number; // New: For fetching fresh trace data
}

export const LogDetailsModal = ({ isOpen, onClose, logContent, traceId, executionId }: LogDetailsModalProps) => {
    const [fetchedContent, setFetchedContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && executionId) {
            fetchTrace();
        } else {
            setFetchedContent(null);
        }
    }, [isOpen, executionId]);

    const fetchTrace = async () => {
        if (!executionId) return;
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:5200/api/workflows/executions/${executionId}/trace`);
            setFetchedContent(JSON.stringify(res.data));
        } catch (error) {
            console.error("Failed to fetch fresh trace", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Use fetched content if available (fresh), otherwise fall back to passed content
    const contentToDisplay = fetchedContent || logContent;

    let parsedLog: any = null;
    let isJson = false;

    try {
        parsedLog = JSON.parse(contentToDisplay);
        isJson = true;
    } catch {
        // Fallback for plain text logs
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    {/* Header */}
                    <div className="bg-gray-50 px-4 py-4 sm:px-6 border-b border-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    Execution Details
                                </h3>
                                <div className="mt-2 flex items-center space-x-4">
                                    <div className="flex items-center">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">Trace ID</span>
                                        <div className="flex items-center bg-gray-100 rounded border border-gray-200">
                                            <code className="px-2 py-1 text-sm font-mono text-gray-800 select-all">
                                                {traceId}
                                            </code>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(traceId)}
                                                className="p-1 hover:bg-gray-200 text-gray-500 hover:text-gray-700 border-l border-gray-200"
                                                title="Copy Trace ID"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    {executionId && (
                                        <button
                                            onClick={fetchTrace}
                                            className={`text-xs flex items-center text-indigo-600 hover:text-indigo-800 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={loading}
                                        >
                                            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                                            {loading ? 'Refreshing...' : 'Refresh Trace'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 py-5 sm:p-6 max-h-[70vh] overflow-y-auto">
                        {!isJson ? (
                            <div className="bg-gray-50 p-4 rounded text-sm text-gray-700 font-mono whitespace-pre-wrap">
                                {contentToDisplay || "No logs available."}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Trigger Section */}
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                    <div className="flex items-center mb-2">
                                        <ArrowRight className="h-5 w-5 text-blue-500 mr-2" />
                                        <h4 className="text-sm font-semibold text-blue-900">Trigger: {parsedLog.Trigger || parsedLog.trigger || 'N/A'}</h4>
                                    </div>
                                    <details className="cursor-pointer">
                                        <summary className="text-xs text-blue-600 hover:underline">View Trigger Data</summary>
                                        <pre className="mt-2 text-xs bg-white p-2 rounded border border-blue-100 overflow-x-auto">
                                            {JSON.stringify(parsedLog.TriggerData || parsedLog.triggerData || {}, null, 2)}
                                        </pre>
                                    </details>
                                </div>

                                {/* Steps Timeline */}
                                <div className="relative">
                                    <div className="absolute top-0 bottom-0 left-4 w-0.5 bg-gray-200" aria-hidden="true"></div>
                                    <ul className="space-y-6">
                                        {(parsedLog.Steps || parsedLog.steps || []).map((step: any, idx: number) => {
                                            const stepName = step.StepName || step.step;
                                            const status = step.Status || step.status || 'Success'; // Default since seed logs didn't have status field
                                            const details = step.Details || step.details;

                                            return (
                                                <li key={idx} className="relative pl-10">
                                                    {/* Icon */}
                                                    <div className={`absolute left-0 p-1 rounded-full ${status === 'Success' ? 'bg-green-100 text-green-600' :
                                                        status === 'Skipped' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
                                                        }`}>
                                                        {status === 'Success' && <CheckCircle className="h-6 w-6" />}
                                                        {status === 'Skipped' && <AlertCircle className="h-6 w-6" />}
                                                        {(status === 'Failed' || status === 'Error') && <XCircle className="h-6 w-6" />}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <h5 className="text-sm font-bold text-gray-900">{stepName}</h5>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${status === 'Success' ? 'bg-green-100 text-green-800' :
                                                                status === 'Skipped' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                {status}
                                                            </span>
                                                        </div>

                                                        {/* Details Specifics */}
                                                        {stepName === 'Condition Evaluation' && details.RuleName && (
                                                            <div className="text-sm text-gray-600">
                                                                <p>Rule: <span className="font-semibold">{details.RuleName}</span></p>
                                                                <p>Condition: <code className="bg-gray-100 px-1 rounded">{details.Condition}</code></p>
                                                                <p className="mt-1">Result: {details.IsMatch ? 'Matched' : 'Not Matched'}</p>
                                                            </div>
                                                        )}

                                                        {stepName === 'Rule Evaluation' && ( // Added for new log format
                                                            <div className="text-sm text-gray-600 space-y-2">
                                                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded border border-gray-100">
                                                                    <div>
                                                                        <span className="block text-xs font-medium text-gray-500 uppercase">Rule ID</span>
                                                                        <span className="font-semibold text-gray-900">{details.RuleName || 'N/A'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-xs font-medium text-gray-500 uppercase">Rule Set</span>
                                                                        <span>{details.RuleSet || details.details}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-2">
                                                                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Evaluation Outcome</p>
                                                                    <div className={`text-xs p-2 rounded ${details.IsMatch ? 'bg-green-50 text-green-800 border-green-100' : 'bg-yellow-50 text-yellow-800 border-yellow-100'} border`}>
                                                                        <div className="flex justify-between">
                                                                            <span>Condition: <code className="font-mono">{details.Condition || 'N/A'}</code></span>
                                                                            <span className="font-bold">{details.IsMatch ? 'MATCH' : 'NO MATCH'}</span>
                                                                        </div>
                                                                        {details.Reasons && details.Reasons.length > 0 && (
                                                                            <ul className="list-disc list-inside mt-1 ml-1">
                                                                                {details.Reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                                                                            </ul>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {details.Facts && (
                                                                    <div className="mt-3 border-t border-gray-100 pt-2">
                                                                        <div className="text-xs font-medium text-gray-500 uppercase mb-2">Detailed Context (Actual State)</div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                            {details.Facts.Member && (
                                                                                <div className="bg-white p-2 border border-gray-200 rounded text-xs">
                                                                                    <span className="font-semibold text-gray-700 block">Member</span>
                                                                                    <div className="text-gray-600">ID: {details.Facts.Member.membershipId}</div>
                                                                                    <div className="text-gray-600">Status: <span className="font-mono text-indigo-600">{details.Facts.Member.status}</span></div>
                                                                                </div>
                                                                            )}
                                                                            {details.Facts.Compliance && (
                                                                                <div className="bg-white p-2 border border-gray-200 rounded text-xs">
                                                                                    <span className="font-semibold text-gray-700 block">Compliance</span>
                                                                                    <div className="text-gray-600">Risk: <span className={`font-mono ${details.Facts.Compliance.riskLevel === 'High' ? 'text-red-600' : 'text-green-600'}`}>{details.Facts.Compliance.riskLevel}</span></div>
                                                                                </div>
                                                                            )}
                                                                            {details.Facts.Wallet && (
                                                                                <div className="bg-white p-2 border border-gray-200 rounded text-xs">
                                                                                    <span className="font-semibold text-gray-700 block">Wallet</span>
                                                                                    <div className="text-gray-600">Status: {details.Facts.Wallet.status}</div>
                                                                                    <div className="text-gray-600">Balance: {details.Facts.Wallet.balance}</div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {/* Fallback for other facts */}
                                                                        <details className="mt-2 text-xs text-gray-400">
                                                                            <summary className="cursor-pointer hover:text-gray-600">View Raw JSON</summary>
                                                                            <pre className="mt-1 bg-gray-50 p-2 rounded overflow-x-auto">{JSON.stringify(details.Facts, null, 2)}</pre>
                                                                        </details>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {stepName === 'Action Execution' && (
                                                            <div className="text-sm text-gray-600 space-y-2">
                                                                {/* Handle legacy string details */}
                                                                {typeof details === 'string' ? (
                                                                    <div>{details}</div>
                                                                ) : (
                                                                    <>
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            <div>
                                                                                <span className="block text-xs font-medium text-gray-500">Action</span>
                                                                                {details.ActionType}
                                                                            </div>
                                                                            <div>
                                                                                <span className="block text-xs font-medium text-gray-500">Target</span>
                                                                                {details.Target}
                                                                            </div>
                                                                        </div>
                                                                        {/* ... keeping other complex details ... */}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}

                                                        {stepName !== 'Condition Evaluation' && stepName !== 'Rule Evaluation' && stepName !== 'Action Execution' && (
                                                            <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
                                                                {JSON.stringify(details, null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200">
                        <button
                            type="button"
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
