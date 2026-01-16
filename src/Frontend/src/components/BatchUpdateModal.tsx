import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2 } from 'lucide-react';
import axios from 'axios';
import type { Member } from '../types/Member';

interface BatchUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    selectedMembers: Member[];
}

export const BatchUpdateModal = ({ isOpen, onClose, onSuccess, selectedMembers }: BatchUpdateModalProps) => {
    const [status, setStatus] = useState<string>('');
    const [walletStatus, setWalletStatus] = useState<string>('');
    const [complianceStatus, setComplianceStatus] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [results, setResults] = useState<{ id: string; success: boolean; error?: string }[]>([]);

    const handleUpdate = async () => {
        setIsUpdating(true);
        setResults([]);

        const newResults = [];

        // Process sequentially to avoid overwhelming server if many items
        for (const member of selectedMembers) {
            const intId = member.id;
            const membershipId = member.membershipId;
            let success = true;
            let errorMessage = '';

            try {
                // 1. Update Member Status
                // USE INTEGER ID HERE to match the working "Single Update" logic exactly
                if (status) {
                    console.log(`Batch Updating Member ${intId} (${membershipId}) status to ${status}`);
                    try {
                        await axios.put(`http://localhost:5119/api/members/${intId}/status`, { status });
                    } catch (e: any) {
                        throw new Error(`Member Service: ${e.response?.data?.message || e.message}`);
                    }
                }

                // 2. Update Wallet Status
                // Use MembershipId for External Services
                if (walletStatus) {
                    try {
                        await axios.put(`http://localhost:5250/api/wallets/${membershipId}/status`, { status: walletStatus });
                    } catch (e: any) {
                        throw new Error(`Wallet Service: ${e.response?.data?.message || e.message}`);
                    }
                }

                // 3. Update Compliance Status
                if (complianceStatus) {
                    try {
                        await axios.put(`http://localhost:5300/api/compliance/${membershipId}/status`, { status: complianceStatus });
                    } catch (e: any) {
                        throw new Error(`Compliance Service: ${e.response?.data?.message || e.message}`);
                    }
                }

            } catch (error: any) {
                console.error(`Failed to update ${membershipId}:`, error);
                success = false;
                errorMessage = error.message;
            }
            newResults.push({ id: membershipId, success, error: errorMessage });
        } // End of for loop

        setResults(newResults);
        setIsUpdating(false);

        // Always trigger refresh if we processed anything, to reflect partial successes (e.g. Member updated, Wallet failed)
        if (newResults.length > 0) {
            // Add small delay to ensure DB propagation
            await new Promise(resolve => setTimeout(resolve, 500));
            onSuccess(); // Refresh the table behind the modal
        }

        const allSuccess = newResults.every(r => r.success);
        if (allSuccess) {
            onClose();
            // Reset form
            setStatus('');
            setWalletStatus('');
            setComplianceStatus('');
            setResults([]);
        }
    };

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-20" onClose={() => !isUpdating && onClose()}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                                        onClick={onClose}
                                        disabled={isUpdating}
                                    >
                                        <span className="sr-only">Close</span>
                                        <X className="h-6 w-6" aria-hidden="true" />
                                    </button>
                                </div>

                                <div>
                                    <h3 className="text-base font-semibold leading-6 text-gray-900">
                                        Batch Update Members
                                    </h3>
                                    <p className="mt-2 text-sm text-gray-500">
                                        Updating {selectedMembers.length} selected members.
                                        Fields left empty will remain unchanged.
                                    </p>
                                </div>

                                <div className="mt-6 space-y-4">
                                    {/* Member Status */}
                                    <div>
                                        <label className="block text-sm font-medium leading-6 text-gray-900">
                                            New Member Status
                                        </label>
                                        <select
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value)}
                                            className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                        >
                                            <option value="">(No Change)</option>
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                            <option value="Suspended">Suspended</option>
                                            <option value="Confiscated">Confiscated</option>
                                        </select>
                                    </div>

                                    {/* Wallet Status */}
                                    <div>
                                        <label className="block text-sm font-medium leading-6 text-gray-900">
                                            New Wallet Status
                                        </label>
                                        <select
                                            value={walletStatus}
                                            onChange={(e) => setWalletStatus(e.target.value)}
                                            className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                        >
                                            <option value="">(No Change)</option>
                                            <option value="Unlocked">Unlocked</option>
                                            <option value="Locked">Locked</option>
                                            <option value="Frozen">Frozen</option>
                                        </select>
                                    </div>

                                    {/* Compliance Status - Placeholder as Backend might not support arbitrary updates yet */}
                                    {/* Assuming update logic is similar to Member/Wallet for now based on Plan */}
                                    <div>
                                        <label className="block text-sm font-medium leading-6 text-gray-900">
                                            New Compliance Status
                                        </label>
                                        <select
                                            value={complianceStatus}
                                            onChange={(e) => setComplianceStatus(e.target.value)}
                                            className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                        >
                                            <option value="">(No Change)</option>
                                            <option value="Verified">Verified</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Rejected">Rejected</option>
                                            <option value="UnderReview">Under Review</option>
                                        </select>
                                    </div>
                                </div>

                                {results.length > 0 && !results.every(r => r.success) && (
                                    <div className="mt-4 rounded-md bg-red-50 p-3">
                                        <h4 className="text-sm font-medium text-red-800">Update Completed with Errors</h4>
                                        <ul className="mt-1 text-xs text-red-700 list-disc list-inside h-24 overflow-y-auto">
                                            {results.filter(r => !r.success).map(r => (
                                                <li key={r.id}>ID {r.id}: {r.error}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        onClick={onClose}
                                        disabled={isUpdating}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={handleUpdate}
                                        disabled={isUpdating || (!status && !walletStatus && !complianceStatus)}
                                    >
                                        {isUpdating && <Loader2 className="animate-spin -ml-0.5 mr-2 h-4 w-4" />}
                                        {isUpdating ? 'Updating...' : 'Update Selected'}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
};
