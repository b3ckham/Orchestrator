import { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw, Database, Eye, X, Inbox } from 'lucide-react';

const API_URL = 'http://localhost:5200/api/queue';

interface QueueInfo {
    name: string;
    messages: number;
    messages_ready: number;
    messages_unacknowledged: number;
    state: string;
}

interface QueueMessage {
    payload_bytes: number;
    redelivered: boolean;
    exchange: string;
    routing_key: string;
    message_count: number;
    properties: any;
    payload: string;
    payload_encoding: string;
}

export const QueueMonitor = () => {
    const [queues, setQueues] = useState<QueueInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
    const [messages, setMessages] = useState<QueueMessage[]>([]);
    const [peekLoading, setPeekLoading] = useState(false);

    const fetchQueues = async () => {
        setLoading(true);
        try {
            const res = await axios.get<QueueInfo[]>(API_URL);
            setQueues(res.data);
        } catch (error) {
            console.error("Failed to fetch queues", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePeek = (queueName: string) => {
        setSelectedQueue(queueName);
    };

    useEffect(() => {
        if (!selectedQueue) {
            setMessages([]);
            return;
        }

        let isMounted = true;
        setPeekLoading(true);
        setMessages([]);

        const fetchMessages = async () => {
            try {
                const res = await axios.get<QueueMessage[]>(`${API_URL}/${encodeURIComponent(selectedQueue)}/messages`);
                if (isMounted) {
                    setMessages(res.data);
                }
            } catch (error) {
                console.error("Failed to peek messages", error);
            } finally {
                if (isMounted) {
                    setPeekLoading(false);
                }
            }
        };

        fetchMessages();

        return () => {
            isMounted = false;
        };
    }, [selectedQueue]);

    useEffect(() => {
        fetchQueues();
        const interval = setInterval(fetchQueues, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center">
                        <Database className="w-5 h-5 mr-2 text-indigo-600" />
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Message Queue Health</h3>
                    </div>
                    <button onClick={fetchQueues} className="p-2 text-gray-400 hover:text-gray-600">
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Queue Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ready</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unacked</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {queues.map((q) => (
                                <tr key={q.name} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{q.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${q.state === 'running' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {q.state}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{q.messages}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{q.messages_ready}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{q.messages_unacknowledged}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button
                                            onClick={() => handlePeek(q.name)}
                                            className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                                            disabled={q.messages === 0}
                                        >
                                            <Eye className="w-4 h-4 mr-1" />
                                            Peek
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {queues.length === 0 && !loading && (
                                <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No queues found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Peek Modal - Moved outside to prevent overflow clipping */}
            {selectedQueue && (
                <div className="fixed inset-0 z-[100]" aria-labelledby="modal-title" role="dialog" aria-modal="true">

                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" onClick={() => setSelectedQueue(null)}></div>

                    {/* Modal Positioning */}
                    <div className="fixed inset-0 z-[101] overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">

                            {/* Modal Panel */}
                            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-4xl border border-gray-200">
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between items-center border-b border-gray-200">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                                        Messages in '{selectedQueue}'
                                    </h3>
                                    <button onClick={() => setSelectedQueue(null)} className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                                        <span className="sr-only">Close</span>
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="px-4 py-5 sm:p-6 max-h-[80vh] overflow-y-auto bg-gray-100">
                                    {peekLoading ? (
                                        <div className="text-center py-12 text-gray-500">Loading messages...</div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                            <Inbox className="w-12 h-12 text-gray-300 mb-3" />
                                            <p className="text-lg font-medium text-gray-900">No Pending Messages</p>
                                            <p className="text-sm mt-1">This queue is either empty or messages are being consumed instantly.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {messages.map((msg, idx) => (
                                                <div key={idx} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-4 transition-shadow hover:shadow-md">
                                                    {/* Header Section */}
                                                    <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                                                        <div>
                                                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Routing Key</span>
                                                            <div className="text-sm font-mono font-medium text-indigo-600 mt-1">{msg.routing_key || '-'}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Exchange</span>
                                                            <div className="text-sm font-medium text-gray-900 mt-1">{msg.exchange || '(Default)'}</div>
                                                        </div>
                                                    </div>

                                                    {/* Metadata Grid */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 bg-gray-50 p-3 rounded-md border border-gray-100">
                                                        <div>
                                                            <span className="text-xs text-gray-500 block mb-1">Size</span>
                                                            <span className="text-sm font-semibold text-gray-900">{msg.payload_bytes} B</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-gray-500 block mb-1">Encoding</span>
                                                            <span className="text-sm font-semibold text-gray-900">{msg.payload_encoding}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-gray-500 block mb-1">Redelivered</span>
                                                            <span className={`text-sm font-bold ${msg.redelivered ? 'text-red-600' : 'text-green-600'}`}>
                                                                {msg.redelivered ? 'Yes' : 'No'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-gray-500 block mb-1">Msg Count</span>
                                                            <span className="text-sm font-semibold text-gray-900">{msg.message_count ?? '-'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Display Properties / Headers */}
                                                    {msg.properties && Object.keys(msg.properties).length > 0 && (
                                                        <div className="mb-4">
                                                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Detailed Properties</h4>
                                                            <pre className="text-xs bg-slate-100 text-slate-800 p-3 rounded border border-slate-200 overflow-x-auto font-mono">
                                                                {JSON.stringify(msg.properties, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Payload Content</h4>
                                                        <pre className="text-xs bg-slate-900 text-emerald-400 p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap break-all shadow-inner border border-slate-700">
                                                            {tryParse(msg.payload)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200">
                                    <button
                                        type="button"
                                        className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                                        onClick={() => setSelectedQueue(null)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const tryParse = (str: string) => {
    try {
        return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
        return str;
    }
}
