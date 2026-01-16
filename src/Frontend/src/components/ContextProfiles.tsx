import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface ContextProfile {
    name: string;
    description: string;
    dataSources: string[];
}

const ContextProfiles: React.FC = () => {
    const [profiles, setProfiles] = useState<ContextProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Use hardcoded URL for POC, ideally from config
        axios.get('http://localhost:5222/api/context/profiles')
            .then(response => {
                setProfiles(response.data);
                setLoading(false);
            })
            .catch(() => {
                setError('Failed to fetch profiles');
                setLoading(false);
            });
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Context Profiles Registry</h1>
            <p className="mb-6 text-gray-600">
                These profiles define the data scope fetched for each workflow execution.
            </p>

            {loading && <div>Loading...</div>}
            {error && <div className="text-red-600">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map(profile => (
                    <div key={profile.name} className="bg-white p-6 rounded-lg shadow border border-gray-200">
                        <h2 className="text-xl font-bold text-indigo-600 mb-2">{profile.name}</h2>
                        <p className="text-gray-700 mb-4">{profile.description}</p>

                        <div>
                            <span className="font-semibold text-sm text-gray-500 uppercase">Data Sources</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {profile.dataSources.map((ds, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded border border-gray-300">
                                        {ds}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContextProfiles;
