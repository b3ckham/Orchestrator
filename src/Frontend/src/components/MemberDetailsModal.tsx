import { useState, useEffect } from 'react';
import { X, Wallet, ShieldCheck, User, Save, RefreshCw } from 'lucide-react';
import axios from 'axios';
import type { Member } from '../types/Member';

interface MemberDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: Member | null;
    wallet: any;
    compliance: any;
    onUpdate: () => void; // Callback to refresh parent data
}

type TabType = 'profile' | 'wallet' | 'compliance' | 'eligibility';

export const MemberDetailsModal: React.FC<MemberDetailsModalProps> = ({ isOpen, onClose, member, wallet, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<TabType>('profile');
    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Wallet adjustment state
    const [adjustmentAmount, setAdjustmentAmount] = useState<string>('0');

    useEffect(() => {
        if (member) {
            setFormData({
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
                phone: member.phone || '',
                email_Verified: member.email_Verified,
                phone_Verified: member.phone_Verified,
                gameStatus: member.gameStatus || 'Unlocked',
                risk_Level: member.risk_Level || 'Low',
                kyc_Level: member.kyc_Level || 'Pending',
                walletStatus: member.walletStatus || 'Unlocked',
                // New Eligibility Fields
                bonusEligibility: member.bonusEligibility ?? true,
                depositEligibility: member.depositEligibility ?? true,
                withdrawalEligibility: member.withdrawalEligibility ?? true,
                bankAccountMgmtLevel: member.bankAccountMgmtLevel || 'Standard'
            });
            setMessage(null);
            setAdjustmentAmount('0');
        }
    }, [member, isOpen]);

    const getErrorMessage = (error: any): string => {
        console.error("MemberDetailsModal Error:", error);

        if (axios.isAxiosError(error)) {
            if (error.response) {
                const data = error.response.data;
                if (typeof data === 'string') return data.length > 0 ? data : `Server Error: ${error.response.status}`;
                if (data?.errors) return Object.entries(data.errors).map(([key, msgs]) => `${key}: ${(msgs as any[]).join(', ')}`).join(' | ');
                if (data?.title) return data.title;
                if (data?.message) return data.message;
                return `Server Error: ${error.response.status} ${error.response.statusText}`;
            }
        }
        return error instanceof Error ? error.message : "An unknown error occurred.";
    };

    if (!isOpen || !member) return null;

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            await axios.put(`http://localhost:5119/api/members/${member.id}/profile`, formData);
            setMessage({ type: 'success', text: 'Profile updated successfully' });
            onUpdate();
        } catch (error) {
            setMessage({ type: 'error', text: getErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    const handleEligibilitySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            await axios.put(`http://localhost:5119/api/members/${member.id}/eligibility`, {
                bonusEligibility: formData.bonusEligibility,
                depositEligibility: formData.depositEligibility,
                withdrawalEligibility: formData.withdrawalEligibility,
                bankAccountMgmtLevel: formData.bankAccountMgmtLevel
            });
            setMessage({ type: 'success', text: 'Eligibility settings updated successfully' });
            onUpdate();
        } catch (error) {
            setMessage({ type: 'error', text: getErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    const handleBalanceAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            await axios.put(`http://localhost:5250/api/wallets/${member.membershipId}/adjust`, {
                amount: parseFloat(adjustmentAmount)
            });
            setMessage({ type: 'success', text: 'Balance adjusted successfully' });
            setAdjustmentAmount('0');
            onUpdate();
        } catch (error) {
            setMessage({ type: 'error', text: getErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ name, label, icon: Icon }: { name: TabType, label: string, icon: any }) => (
        <button
            onClick={() => { setActiveTab(name); setMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === name
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="relative z-50">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                        {/* Header */}
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between items-center border-b border-gray-200">
                            <h3 className="text-lg font-semibold leading-6 text-gray-900">Edit Member: {member.membershipId}</h3>
                            <button onClick={onClose} className="rounded-md bg-transparent text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 px-4 sm:px-6 overflow-x-auto">
                            <TabButton name="profile" label="Profile" icon={User} />
                            <TabButton name="wallet" label="Wallet" icon={Wallet} />
                            <TabButton name="compliance" label="Compliance" icon={ShieldCheck} />
                            <TabButton name="eligibility" label="Eligibility" icon={ShieldCheck} />
                        </div>

                        {/* Content */}
                        <div className="px-4 py-5 sm:p-6">
                            {message && (
                                <div className={`mb-4 p-3 rounded text-sm break-words ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {message.text || "Unknown error (empty message)"}
                                </div>
                            )}

                            {activeTab === 'profile' && (
                                <form onSubmit={handleProfileSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">First Name</label>
                                            <input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Last Name</label>
                                            <input type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Email</label>
                                            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Phone</label>
                                            <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
                                        </div>
                                        <div className="flex items-center gap-2 pt-5">
                                            <input type="checkbox" checked={formData.email_Verified} onChange={e => setFormData({ ...formData, email_Verified: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <label className="text-sm text-gray-700">Email Verified</label>
                                        </div>
                                        <div className="flex items-center gap-2 pt-5">
                                            <input type="checkbox" checked={formData.phone_Verified} onChange={e => setFormData({ ...formData, phone_Verified: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <label className="text-sm text-gray-700">Phone Verified</label>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Game Status</label>
                                            <select value={formData.gameStatus} onChange={e => setFormData({ ...formData, gameStatus: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2">
                                                <option value="Unlocked">Unlocked</option>
                                                <option value="Locked">Locked</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <button type="submit" disabled={loading} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                                            <Save className="w-4 h-4 mr-2" /> Save Profile
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === 'wallet' && (
                                <div className="space-y-6">
                                    <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                                        <div>
                                            <p className="text-sm text-gray-500">Current Balance</p>
                                            <p className="text-2xl font-bold text-gray-900">{wallet?.currency || '???'} {wallet?.balance || 0}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${wallet?.status === 'Locked' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {wallet?.status || 'Unknown'}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-200 pt-4">
                                        <h4 className="text-sm font-medium text-gray-900 mb-3">Adjust Balance</h4>
                                        <form onSubmit={handleBalanceAdjustment} className="flex gap-4 items-end">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-gray-700">Adjustment Amount (+/-)</label>
                                                <input type="number" step="0.01" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
                                            </div>
                                            <button type="submit" disabled={loading || adjustmentAmount === '0'} className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                                                <RefreshCw className="w-4 h-4 mr-2" /> Adjust
                                            </button>
                                        </form>
                                        <p className="mt-2 text-xs text-gray-500">Enter a negative value to deduct funds.</p>
                                    </div>

                                    <div className="border-t border-gray-200 pt-4">
                                        <h4 className="text-sm font-medium text-gray-900 mb-3">Wallet Status (Managed via Member Profile)</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Wallet Status</label>
                                                <select value={formData.walletStatus} onChange={e => setFormData({ ...formData, walletStatus: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2">
                                                    <option value="Unlocked">Unlocked</option>
                                                    <option value="Locked">Locked</option>
                                                </select>
                                            </div>
                                            <div className="flex items-end">
                                                <button onClick={handleProfileSubmit} disabled={loading} className="w-full inline-flex justify-center items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                                                    Update Status
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'compliance' && (
                                <form onSubmit={handleProfileSubmit} className="space-y-6">
                                    <div className="bg-yellow-50 p-4 rounded-md text-yellow-800 text-sm mb-4">
                                        Updating Compliance fields here triggers a sync to the Compliance Service.
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Risk Level</label>
                                            <select value={formData.risk_Level} onChange={e => setFormData({ ...formData, risk_Level: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2">
                                                <option value="Low">Low</option>
                                                <option value="Medium">Medium</option>
                                                <option value="High">High</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">KYC Level</label>
                                            <select value={formData.kyc_Level} onChange={e => setFormData({ ...formData, kyc_Level: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2">
                                                <option value="Pending">Pending</option>
                                                <option value="Verified">Verified</option>
                                                <option value="Rejected">Rejected</option>
                                                <option value="UnderReview">Under Review</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <button type="submit" disabled={loading} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                                            <Save className="w-4 h-4 mr-2" /> Save Compliance
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === 'eligibility' && (
                                <form onSubmit={handleEligibilitySubmit} className="space-y-6">
                                    <div className="bg-indigo-50 p-4 rounded-md text-indigo-800 text-sm mb-4">
                                        Manage member eligibility and banking limits.
                                    </div>
                                    <div className="space-y-4">
                                        {/* Booleans */}
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={formData.bonusEligibility} onChange={e => setFormData({ ...formData, bonusEligibility: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <label className="text-sm text-gray-700">Bonus Eligibility</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={formData.depositEligibility} onChange={e => setFormData({ ...formData, depositEligibility: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <label className="text-sm text-gray-700">Deposit Eligibility</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={formData.withdrawalEligibility} onChange={e => setFormData({ ...formData, withdrawalEligibility: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <label className="text-sm text-gray-700">Withdrawal Eligibility</label>
                                        </div>

                                        {/* Enum */}
                                        <div className="pt-2">
                                            <label className="block text-xs font-medium text-gray-700">Bank Account Management Level</label>
                                            <select value={formData.bankAccountMgmtLevel} onChange={e => setFormData({ ...formData, bankAccountMgmtLevel: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2">
                                                <option value="Standard">Standard</option>
                                                <option value="Restricted">Restricted</option>
                                                <option value="VIP">VIP</option>
                                                <option value="SuperAdmin">SuperAdmin</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <button type="submit" disabled={loading} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                                            <Save className="w-4 h-4 mr-2" /> Save Eligibility
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
