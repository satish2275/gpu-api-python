# gpu-api-python

#### frontend react served with nginx and backend node in azure AKS
### We want create separate service in python as API which should trigger a GPU nodepool and once process completes it should bring it down to 0
#### We should to make and configure a API route through nginx frontend react

#####
Job Creation Form - with inputs for duration, node count, and task type
Active Jobs Display - showing all running/completed jobs with their status
Proper JSX structure - with all necessary closing tags and proper syntax

The component now provides a complete interface for:

Viewing GPU nodepool status
Manually scaling the nodepool up/down
Creating new GPU jobs with custom parameters
Monitoring active jobs and their progress
Auto-refreshing data every 10 seconds

You can integrate this component into your React frontend to manage GPU jobs through the Python API service.