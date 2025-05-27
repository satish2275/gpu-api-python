from flask import Flask, request, jsonify
import asyncio
import logging
import os
import time
from azure.identity import DefaultAzureCredential
from azure.mgmt.containerservice import ContainerServiceClient
from azure.mgmt.containerservice.models import ManagedClusterAgentPoolProfile
import threading
from datetime import datetime

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
SUBSCRIPTION_ID = os.getenv('AZURE_SUBSCRIPTION_ID')
RESOURCE_GROUP = os.getenv('AZURE_RESOURCE_GROUP')
CLUSTER_NAME = os.getenv('AKS_CLUSTER_NAME')
GPU_NODEPOOL_NAME = os.getenv('GPU_NODEPOOL_NAME', 'gpupool')

# Azure client
credential = DefaultAzureCredential()
aks_client = ContainerServiceClient(credential, SUBSCRIPTION_ID)

class GPUNodepoolManager:
    def __init__(self):
        self.active_jobs = {}
        
    def scale_nodepool(self, node_count):
        """Scale the GPU nodepool to specified count"""
        try:
            logger.info(f"Scaling GPU nodepool to {node_count} nodes")
            
            # Get current nodepool configuration
            nodepool = aks_client.agent_pools.get(
                RESOURCE_GROUP, 
                CLUSTER_NAME, 
                GPU_NODEPOOL_NAME
            )
            
            # Update node count
            nodepool.count = node_count
            
            # Start the scaling operation
            operation = aks_client.agent_pools.begin_create_or_update(
                RESOURCE_GROUP,
                CLUSTER_NAME,
                GPU_NODEPOOL_NAME,
                nodepool
            )
            
            # Wait for completion
            result = operation.result()
            logger.info(f"Nodepool scaled successfully to {node_count} nodes")
            return True
            
        except Exception as e:
            logger.error(f"Error scaling nodepool: {str(e)}")
            return False
    
    def wait_for_nodes_ready(self, expected_count):
        """Wait for nodes to be ready"""
        max_wait_minutes = 10
        start_time = time.time()
        
        while time.time() - start_time < max_wait_minutes * 60:
            try:
                nodepool = aks_client.agent_pools.get(
                    RESOURCE_GROUP, 
                    CLUSTER_NAME, 
                    GPU_NODEPOOL_NAME
                )
                
                if nodepool.count == expected_count and nodepool.provisioning_state == "Succeeded":
                    logger.info("Nodes are ready")
                    return True
                    
                time.sleep(30)  # Wait 30 seconds before checking again
                
            except Exception as e:
                logger.error(f"Error checking node status: {str(e)}")
                
        return False
    
    def execute_gpu_job(self, job_id, job_config):
        """Execute GPU job and scale down when complete"""
        try:
            # Scale up nodepool
            if not self.scale_nodepool(job_config.get('node_count', 1)):
                self.active_jobs[job_id]['status'] = 'failed'
                self.active_jobs[job_id]['error'] = 'Failed to scale up nodepool'
                return
            
            # Wait for nodes to be ready
            if not self.wait_for_nodes_ready(job_config.get('node_count', 1)):
                self.active_jobs[job_id]['status'] = 'failed'
                self.active_jobs[job_id]['error'] = 'Nodes not ready within timeout'
                return
            
            self.active_jobs[job_id]['status'] = 'running'
            self.active_jobs[job_id]['nodes_ready_at'] = datetime.now().isoformat()
            
            # Simulate GPU job execution (replace with your actual job logic)
            job_duration = job_config.get('duration', 300)  # Default 5 minutes
            logger.info(f"Executing GPU job {job_id} for {job_duration} seconds")
            
            # Here you would typically:
            # 1. Submit job to Kubernetes
            # 2. Monitor job status
            # 3. Wait for completion
            time.sleep(job_duration)  # Simulate job execution
            
            self.active_jobs[job_id]['status'] = 'completed'
            self.active_jobs[job_id]['completed_at'] = datetime.now().isoformat()
            
        except Exception as e:
            logger.error(f"Error executing job {job_id}: {str(e)}")
            self.active_jobs[job_id]['status'] = 'failed'
            self.active_jobs[job_id]['error'] = str(e)
            
        finally:
            # Always scale down nodepool
            logger.info(f"Scaling down nodepool for job {job_id}")
            self.scale_nodepool(0)
            self.active_jobs[job_id]['scaled_down_at'] = datetime.now().isoformat()

gpu_manager = GPUNodepoolManager()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/api/gpu/jobs', methods=['POST'])
def create_gpu_job():
    """Create and start a new GPU job"""
    try:
        data = request.get_json()
        
        # Validate request
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        job_id = data.get('job_id', f"job_{int(time.time())}")
        job_config = {
            'node_count': data.get('node_count', 1),
            'duration': data.get('duration', 300),
            'gpu_type': data.get('gpu_type', 'Standard_NC6s_v3'),
            'task_type': data.get('task_type', 'training')
        }
        
        # Initialize job tracking
        gpu_manager.active_jobs[job_id] = {
            'status': 'starting',
            'created_at': datetime.now().isoformat(),
            'config': job_config
        }
        
        # Start job execution in background thread
        job_thread = threading.Thread(
            target=gpu_manager.execute_gpu_job,
            args=(job_id, job_config)
        )
        job_thread.daemon = True
        job_thread.start()
        
        return jsonify({
            'job_id': job_id,
            'status': 'starting',
            'message': 'GPU job started successfully'
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating GPU job: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gpu/jobs/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Get status of a specific GPU job"""
    if job_id not in gpu_manager.active_jobs:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify(gpu_manager.active_jobs[job_id])

@app.route('/api/gpu/jobs', methods=['GET'])
def list_jobs():
    """List all GPU jobs"""
    return jsonify({
        'jobs': gpu_manager.active_jobs,
        'total_jobs': len(gpu_manager.active_jobs)
    })

@app.route('/api/gpu/nodepool/status', methods=['GET'])
def get_nodepool_status():
    """Get current nodepool status"""
    try:
        nodepool = aks_client.agent_pools.get(
            RESOURCE_GROUP, 
            CLUSTER_NAME, 
            GPU_NODEPOOL_NAME
        )
        
        return jsonify({
            'name': nodepool.name,
            'count': nodepool.count,
            'vm_size': nodepool.vm_size,
            'provisioning_state': nodepool.provisioning_state,
            'power_state': nodepool.power_state.code if nodepool.power_state else None
        })
        
    except Exception as e:
        logger.error(f"Error getting nodepool status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gpu/nodepool/scale', methods=['POST'])
def manual_scale_nodepool():
    """Manually scale the nodepool"""
    try:
        data = request.get_json()
        node_count = data.get('node_count', 0)
        
        if not isinstance(node_count, int) or node_count < 0:
            return jsonify({'error': 'Invalid node_count'}), 400
        
        success = gpu_manager.scale_nodepool(node_count)
        
        if success:
            return jsonify({
                'message': f'Nodepool scaling to {node_count} nodes initiated',
                'node_count': node_count
            })
        else:
            return jsonify({'error': 'Failed to scale nodepool'}), 500
            
    except Exception as e:
        logger.error(f"Error scaling nodepool: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Validate environment variables
    required_env_vars = [
        'AZURE_SUBSCRIPTION_ID',
        'AZURE_RESOURCE_GROUP', 
        'AKS_CLUSTER_NAME'
    ]
    
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        exit(1)
    
    app.run(host='0.0.0.0', port=5000, debug=False)