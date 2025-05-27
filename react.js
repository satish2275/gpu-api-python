import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Cpu, Activity, Clock, CheckCircle, XCircle } from 'lucide-react';

const GPUJobManager = () => {
  const [jobs, setJobs] = useState({});
  const [nodepoolStatus, setNodepoolStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch jobs and nodepool status
  const fetchData = async () => {
    try {
      const [jobsResponse, statusResponse] = await Promise.all([
        fetch('/api/gpu/jobs'),
        fetch('/api/gpu/nodepool/status')
      ]);

      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setJobs(jobsData.jobs || {});
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setNodepoolStatus(statusData);
      }
    } catch (err) {
      setError('Failed to fetch data: ' + err.message);
    }
  };

  // Create new GPU job
  const createJob = async (jobConfig) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/gpu/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobConfig)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Job created:', result);
        fetchData(); // Refresh data
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create job');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Scale nodepool manually
  const scaleNodepool = async (nodeCount) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/gpu/nodepool/scale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ node_count: nodeCount })
      });

      if (response.ok) {
        console.log('Nodepool scaling initiated');
        setTimeout(fetchData, 2000); // Refresh after delay
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to scale nodepool');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh data
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">GPU Job Manager</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Nodepool Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Cpu className="w-6 h-6 mr-2" />
            GPU Nodepool Status
          </h2>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
        {nodepoolStatus ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Node Count</p>
              <p className="text-2xl font-bold text-gray-900">{nodepoolStatus.count}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">VM Size</p>
              <p className="text-lg font-semibold text-gray-900">{nodepoolStatus.vm_size}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Provisioning State</p>
              <p className="text-lg font-semibold text-gray-900">{nodepoolStatus.provisioning_state}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Power State</p>
              <p className="text-lg font-semibold text-gray-900">{nodepoolStatus.power_state || 'N/A'}</p>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Loading nodepool status...</div>
        )}
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => scaleNodepool(1)}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            <Play className="w-4 h-4 mr-2" />
            Scale Up (1 node)
          </button>
          <button
            onClick={() => scaleNodepool(0)}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            <Square className="w-4 h-4 mr-2" />
            Scale Down (0 nodes)
          </button>
        </div>
      </div>

      {/* Create New Job */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Create GPU Job</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Duration (seconds)
            </label>
            <input
              type="number"
              defaultValue={300}
              min={60}
              max={3600}
              id="job-duration"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Node Count
            </label>
            <select
              id="node-count"
              defaultValue={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 Node</option>
              <option value={2}>2 Nodes</option>
              <option value={3}>3 Nodes</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Type
            </label>
            <select
              id="task-type"
              defaultValue="training"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="training">ML Training</option>
              <option value="inference">Inference</option>
              <option value="processing">Data Processing</option>
            </select>
          </div>
        </div>
        
        <button
          onClick={() => {
            const duration = parseInt(document.getElementById('job-duration').value);
            const nodeCount = parseInt(document.getElementById('node-count').value);
            const taskType = document.getElementById('task-type').value;
            
            createJob({
              duration,
              node_count: nodeCount,
              task_type: taskType,
              job_id: `job_${Date.now()}`
            });
          }}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          <Play className="w-4 h-4 mr-2" />
          {loading ? 'Creating...' : 'Create GPU Job'}
        </button>
      </div>

      {/* Active Jobs */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Active Jobs</h2>
        
        {Object.keys(jobs).length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No active jobs. Create a new job to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(jobs).map(([jobId, job]) => (
              <div key={jobId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    {getStatusIcon(job.status)}
                    <h3 className="text-lg font-medium text-gray-900 ml-2">{jobId}</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Created</p>
                    <p className="font-medium">
                      {job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Node Count</p>
                    <p className="font-medium">{job.config?.node_count || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Duration</p>
                    <p className="font-medium">{job.config?.duration || 'N/A'}s</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Task Type</p>
                    <p className="font-medium">{job.config?.task_type || 'N/A'}</p>
                  </div>
                </div>
                
                {job.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-800 text-sm">{job.error}</p>
                  </div>
                )}
                
                {job.completed_at && (
                  <div className="mt-3 text-sm text-green-600">
                    Completed: {new Date(job.completed_at).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GPUJobManager;