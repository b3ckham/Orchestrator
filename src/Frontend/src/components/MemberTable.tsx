import { useEffect, useState } from 'react';
import axios from 'axios';
import type { Member } from '../types/Member';
import { BadgeCheck, Ban, Trash2, AlertTriangle, User, RefreshCw, Eye, CheckSquare, Square } from 'lucide-react';
import { MemberDetailsModal } from './MemberDetailsModal';
import { BatchUpdateModal } from './BatchUpdateModal';

const API_URL = 'http://localhost:5119/api/members';

const StatusBadge = ({ status }: { status: string }) => {
    // case-insensitive match
    const s = (status || '').toLowerCase();
    switch (s) {
        case 'active':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><BadgeCheck className="w-3 h-3 mr-1" /> Active</span>;
        case 'inactive':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><User className="w-3 h-3 mr-1" /> Inactive</span>;
        case 'suspended':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Ban className="w-3 h-3 mr-1" /> Suspended</span>;
        case 'confiscated':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" /> Confiscated</span>;
        case 'deleted':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-500"><Trash2 className="w-3 h-3 mr-1" /> Deleted</span>;
        default:
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{status}</span>;
    }
};

const WalletStatusBadge = ({ status }: { status: string }) => {
    const s = (status || '').toLowerCase();
    switch (s) {
        case 'locked':
            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 border border-red-200"><Ban className="w-3 h-3 mr-1" /> Wallet Locked</span>;
        case 'unlocked':
            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200"><BadgeCheck className="w-3 h-3 mr-1" /> Wallet Unlocked</span>;
        default:
            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
};

export const MemberTable = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [wallets, setWallets] = useState<Record<string, any>>({});
    const [compliance, setCompliance] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [sortBy, setSortBy] = useState<string>('joinedDate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBatchOpen, setIsBatchOpen] = useState(false);

    const openDetails = (member: Member) => {
        setSelectedMember(member);
        setIsDetailsOpen(true);
    };

    const fetchMembers = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("Fetching members from:", API_URL);
            // Add cache buster to prevent stale data
            const response = await axios.get<Member[]>(`${API_URL}?t=${Date.now()}`);
            console.log("Fetch success:", response.data.length, "members");
            setMembers(response.data);

            // Fetch Details for each member
            response.data.forEach(m => fetchDetails(m.membershipId));

            // Refresh selected member if open
            if (selectedMember) {
                const fresh = response.data.find(m => m.id === selectedMember.id);
                if (fresh) setSelectedMember(fresh);
            }
        } catch (error: any) {
            console.error("Error fetching members", error);
            let errorMessage = "Failed to load members";
            if (axios.isAxiosError(error) && (error.code === "ERR_NETWORK" || error.message === "Network Error")) {
                errorMessage = "Cannot connect to the Orchestrator service. Please check if the backend is running on port 5119.";
            } else {
                errorMessage = error.message || "Failed to load members";
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetails = async (membershipId: string) => {
        try {
            const walletRes = await axios.get(`http://localhost:5250/api/wallets/${membershipId}?t=${Date.now()}`);
            setWallets(prev => ({ ...prev, [membershipId]: walletRes.data }));
        } catch (e) { console.warn(`Failed to fetch wallet for ${membershipId}`); }

        try {
            const compRes = await axios.get(`http://localhost:5300/api/compliance/${membershipId}?t=${Date.now()}`);
            setCompliance(prev => ({ ...prev, [membershipId]: compRes.data }));
        } catch (e) { console.warn(`Failed to fetch compliance for ${membershipId}`); }
    };

    const updateStatus = async (id: number, newStatus: string) => {
        try {
            await axios.put(`${API_URL}/${id}/status`, { status: newStatus });
            fetchMembers();
        } catch (error) {
            console.error("Error updating status", error);
            alert("Failed to update status");
        }
    };

    const toggleSelection = (membershipId: string) => {
        setSelectedIds(prev =>
            prev.includes(membershipId)
                ? prev.filter(id => id !== membershipId)
                : [...prev, membershipId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === members.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(members.map(m => m.membershipId));
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const sortedMembers = [...members].sort((a, b) => {
        let valA: any, valB: any;

        switch (sortBy) {
            case 'name':
                valA = `${a.firstName} ${a.lastName}`.toLowerCase();
                valB = `${b.firstName} ${b.lastName}`.toLowerCase();
                break;
            case 'id':
                valA = a.membershipId.toLowerCase();
                valB = b.membershipId.toLowerCase();
                break;
            case 'memberStatus':
                valA = a.status.toLowerCase();
                valB = b.status.toLowerCase();
                break;
            case 'walletStatus':
                valA = a.walletStatus.toLowerCase();
                valB = b.walletStatus.toLowerCase();
                break;
            case 'complianceStatus':
                valA = (compliance[a.membershipId]?.kycStatus || 'Pending').toLowerCase();
                valB = (compliance[b.membershipId]?.kycStatus || 'Pending').toLowerCase();
                break;
            case 'balance':
                valA = wallets[a.membershipId]?.balance || 0;
                valB = wallets[b.membershipId]?.balance || 0;
                break;
            case 'risk':
                const riskMap: Record<string, number> = { 'Low': 1, 'Medium': 2, 'High': 3 };
                valA = riskMap[compliance[a.membershipId]?.riskLevel] || 0;
                valB = riskMap[compliance[b.membershipId]?.riskLevel] || 0;
                break;
            default: // joinedDate
                valA = a.id;
                valB = b.id;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    if (loading) return <div className="p-8 text-center text-gray-500">Loading members...</div>;

    if (error) return (
        <div className="rounded-md bg-red-50 p-4 my-4 border border-red-200 shadow-sm">
            <div className="flex">
                <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                    </div>
                    <div className="mt-4">
                        <button
                            onClick={fetchMembers}
                            type="button"
                            className="inline-flex items-center rounded-md bg-red-100 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-200 focus:visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry Connection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-4">
                        {/* Batch Update Button */}
                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => setIsBatchOpen(true)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-opacity"
                            >
                                Batch Update ({selectedIds.length})
                            </button>
                        )}
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Members Directory</h3>
                    </div>

                    <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-2">
                            {/* Select All Checkbox - visual help only, functionality tricky with filtering, stick to loaded list */}
                            <button
                                onClick={toggleSelectAll}
                                className="text-gray-400 hover:text-gray-600 mr-2"
                                title="Select All / None"
                            >
                                {selectedIds.length > 0 && selectedIds.length === members.length
                                    ? <CheckSquare className="w-5 h-5 text-indigo-600" />
                                    : <Square className="w-5 h-5" />
                                }
                            </button>

                            <label htmlFor="sort" className="text-sm font-medium text-gray-700 text-[10px] uppercase tracking-wider">Sort By:</label>
                            <select
                                id="sort"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="text-xs border-gray-300 rounded shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-gray-900 bg-white"
                            >
                                <option value="joinedDate">Joined Date</option>
                                <option value="id">Member ID</option>
                                <option value="name">Full Name</option>
                                <option value="balance">Wallet Balance</option>
                                <option value="memberStatus">Member Status</option>
                                <option value="walletStatus">Wallet Status</option>
                                <option value="complianceStatus">Compliance Status</option>
                                <option value="risk">Risk Level</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                        <span className="text-sm text-gray-500">{members.length} members</span>
                        <button onClick={fetchMembers} className="p-2 text-gray-400 hover:text-gray-600">
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                {members.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No members found.
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                        {sortedMembers.map((member) => {
                            const isSelected = selectedIds.includes(member.membershipId);
                            return (
                                <li key={member.id} className={`px-6 py-4 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        {/* Selection Checkbox */}
                                        <div
                                            onClick={() => toggleSelection(member.membershipId)}
                                            className="cursor-pointer text-gray-400 hover:text-indigo-600"
                                        >
                                            {isSelected
                                                ? <CheckSquare className="w-5 h-5 text-indigo-600" />
                                                : <Square className="w-5 h-5" />
                                            }
                                        </div>

                                        <div className="flex-1 flex items-center justify-between">
                                            <div className="flex items-center min-w-0 gap-x-4">
                                                <div className="h-10 w-10 flex-shrink-0 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold">
                                                    {member.firstName[0]}{member.lastName[0]}
                                                </div>
                                                <div className="min-w-0 flex-auto">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold leading-6 text-gray-900">
                                                            {member.firstName} {member.lastName}
                                                        </p>
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                                            {member.kyc_Level || 'No KYC'}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 truncate text-xs leading-5 text-gray-500">{member.email}</p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <p className="text-xs text-gray-400 font-mono">ID: {member.membershipId}</p>

                                                        {/* Prefer direct WalletService status if available (handling eventual consistency) */}
                                                        <WalletStatusBadge status={wallets[member.membershipId]?.status || member.walletStatus} />

                                                        {/* Game Status Badge */}
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${member.gameStatus === 'Locked' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                                                            }`}>
                                                            Game: {member.gameStatus}
                                                        </span>

                                                        {/* Risk Badge (Direct from Member) */}
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${member.risk_Level === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                                                            member.risk_Level === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                'bg-slate-50 text-slate-600 border-slate-200'
                                                            }`}>
                                                            Risk: {member.risk_Level}
                                                        </span>

                                                        {/* Currency/Balance (from Wallet Service) */}
                                                        {/* Compliance/Risk Badges */}
                                                        {wallets[member.membershipId] ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                {wallets[member.membershipId].currency} {wallets[member.membershipId].balance}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-200">---</span>
                                                        )}

                                                        {/* NEW: Eligibility Badges */}
                                                        <div className="flex gap-1 mt-1 w-full">
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${member.bonusEligibility ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                                Bonus: {member.bonusEligibility ? 'Yes' : 'No'}
                                                            </span>
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${member.depositEligibility ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                                Dep: {member.depositEligibility ? 'Yes' : 'No'}
                                                            </span>
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${member.withdrawalEligibility ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                                W/D: {member.withdrawalEligibility ? 'Yes' : 'No'}
                                                            </span>
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                                                Bank: {member.bankAccountMgmtLevel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <button
                                                        onClick={() => openDetails(member)}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <StatusBadge status={member.status} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        className="text-xs border-gray-300 rounded shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                        value={member.status}
                                                        onChange={(e) => updateStatus(member.id, e.target.value)}
                                                    >
                                                        <option value="Active">Active</option>
                                                        <option value="Inactive">Inactive</option>
                                                        <option value="Suspended">Suspended</option>
                                                        <option value="Confiscated">Confiscated</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <MemberDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                member={selectedMember}
                wallet={selectedMember ? wallets[selectedMember.membershipId] : null}
                compliance={selectedMember ? compliance[selectedMember.membershipId] : null}
                onUpdate={() => {
                    fetchMembers();
                    if (selectedMember) fetchDetails(selectedMember.membershipId);
                }}
            />

            <BatchUpdateModal
                isOpen={isBatchOpen}
                onClose={() => setIsBatchOpen(false)}
                onSuccess={() => {
                    fetchMembers();
                    setSelectedIds([]); // Clear selection on success
                }}
                selectedMembers={members.filter(m => selectedIds.includes(m.membershipId))}
            />
        </>
    );
};
