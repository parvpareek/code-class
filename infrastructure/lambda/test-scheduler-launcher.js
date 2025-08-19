/**
 * AWS Lambda Function: Test Scheduler Launcher
 * Part of Phase 3 - Integration Layer with Lambda Alternatives
 * 
 * This function provides a serverless alternative to direct EC2 launching
 * for Judge0 test infrastructure.
 */

const AWS = require('aws-sdk');

// Initialize AWS services
const ec2 = new AWS.EC2();
const ssm = new AWS.SSM();
const lambda = new AWS.Lambda();

// Configuration
const DEFAULT_INSTANCE_TYPE = 't3.medium';
const DEFAULT_AMI_ID = 'ami-0c02fb55956c7d316'; // Ubuntu 20.04 LTS
const DEFAULT_SECURITY_GROUP = 'sg-judge0-automation';
const DEFAULT_SUBNET_ID = process.env.SUBNET_ID;
const IAM_INSTANCE_PROFILE = process.env.IAM_INSTANCE_PROFILE || 'Judge0InstanceProfile';

/**
 * Sanitize testId to prevent command injection
 * Allows only alphanumeric, dash, and underscore characters
 */
function sanitizeTestId(testId) {
  if (typeof testId !== 'string') {
    throw new Error('Invalid testId type');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(testId)) {
    throw new Error('Invalid testId: only alphanumeric, dash, and underscore characters are allowed');
  }
  return testId;
}

/**
 * Lambda handler function
 */
exports.handler = async (event, context) => {
  console.log('Test Scheduler Lambda triggered:', JSON.stringify(event, null, 2));
  
  try {
    const { testId, expectedStudents, duration, problems } = event;
    
    if (!testId || !expectedStudents || !duration) {
      throw new Error('Missing required parameters');
    }

    // Sanitize testId before use
    const safeTestId = sanitizeTestId(testId);
    
    console.log(`Launching infrastructure for test ${safeTestId}`);
    
    // Generate user data script
    const userData = generateUserDataScript(safeTestId);
    
    // Launch EC2 instance
    const instanceResult = await launchEC2Instance(safeTestId, userData);
    
    // Store metadata
    await storeInstanceMetadata(safeTestId, instanceResult);
    
    return {
      statusCode: 200,
      testId: safeTestId,
      instanceId: instanceResult.instanceId,
      publicIp: instanceResult.publicIp,
      judgeUrl: `http://${instanceResult.publicIp}:2358`,
      message: 'Infrastructure launch initiated successfully'
    };
    
  } catch (error) {
    console.error('Lambda execution failed:', error);
    throw error;
  }
};

/**
 * Generate user data script for EC2 instance
 */
function generateUserDataScript(testId) {
  const script = `#!/bin/bash
set -e

echo "Starting Judge0 setup for test ${testId}"
export TEST_ID="${testId}"

# System setup
apt-get update -y
apt-get install -y docker.io docker-compose jq curl wget python3-pip

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

systemctl start docker
systemctl enable docker

# Download Judge0
cd /opt
wget -q https://github.com/judge0/judge0/releases/download/v1.13.0/judge0-v1.13.0.zip
unzip -q judge0-v1.13.0.zip
cd judge0-v1.13.0

# Start services
docker-compose up -d

# Wait for API
for i in {1..60}; do
  if curl -f http://localhost:2358/languages >/dev/null 2>&1; then
    echo "Judge0 ready!"
    aws ssm put-parameter --name "/judge0/$TEST_ID/status" --value "READY" --overwrite
    exit 0
  fi
  sleep 10
done

echo "Setup failed"
aws ssm put-parameter --name "/judge0/$TEST_ID/status" --value "FAILED" --overwrite
exit 1`;

  return Buffer.from(script).toString('base64');
}

/**
 * Launch EC2 instance with Judge0
 */
async function launchEC2Instance(testId, userData) {
  const params = {
    ImageId: DEFAULT_AMI_ID,
    InstanceType: DEFAULT_INSTANCE_TYPE,
    MinCount: 1,
    MaxCount: 1,
    UserData: userData,
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: `Judge0-${testId}` },
          { Key: 'TestId', Value: testId },
          { Key: 'Purpose', Value: 'Judge0-Automation' }
        ]
      }
    ]
  };
  
  const result = await ec2.runInstances(params).promise();
  const instance = result.Instances[0];
  
  // Wait for instance to get public IP
  await new Promise(resolve => setTimeout(resolve, 30000));
  const publicIp = await getInstancePublicIp(instance.InstanceId);
  
  return {
    instanceId: instance.InstanceId,
    publicIp: publicIp
  };
}

/**
 * Get public IP of running instance
 */
async function getInstancePublicIp(instanceId) {
  const result = await ec2.describeInstances({
    InstanceIds: [instanceId]
  }).promise();
  
  const instance = result.Reservations[0].Instances[0];
  return instance.PublicIpAddress;
}

/**
 * Store instance metadata in SSM
 */
async function storeInstanceMetadata(testId, instanceResult) {
  const metadata = {
    instanceId: instanceResult.instanceId,
    publicIp: instanceResult.publicIp,
    judgeUrl: `http://${instanceResult.publicIp}:2358`,
    launchedAt: new Date().toISOString()
  };
  
  await ssm.putParameter({
    Name: `/judge0/${testId}/metadata`,
    Value: JSON.stringify(metadata),
    Type: 'String',
    Overwrite: true
  }).promise();
}

/**
 * Schedule health monitoring
 */
async function scheduleHealthMonitoring(testId, instanceId) {
  try {
    // Schedule health check Lambda to run every 2 minutes
    const payload = {
      testId,
      instanceId,
      action: 'health_check'
    };
    
    await lambda.invoke({
      FunctionName: process.env.HEALTH_MONITOR_LAMBDA || 'judge0-health-monitor',
      InvocationType: 'Event',
      Payload: JSON.stringify(payload)
    }).promise();
    
    console.log(`Scheduled health monitoring for ${testId}`);
  } catch (error) {
    console.warn('Failed to schedule health monitoring:', error.message);
  }
}

/**
 * Schedule auto-shutdown
 */
async function scheduleAutoShutdown(testId, instanceId, durationMinutes) {
  try {
    // Add 30 minutes buffer for final submissions
    const shutdownDelayMs = (durationMinutes + 30) * 60 * 1000;
    
    // Schedule shutdown Lambda
    const payload = {
      testId,
      instanceId,
      action: 'auto_shutdown',
      scheduledFor: new Date(Date.now() + shutdownDelayMs).toISOString()
    };
    
    await lambda.invoke({
      FunctionName: process.env.AUTO_SHUTDOWN_LAMBDA || 'judge0-auto-shutdown',
      InvocationType: 'Event',
      Payload: JSON.stringify(payload)
    }).promise();
    
    console.log(`Scheduled auto-shutdown for ${testId} in ${durationMinutes + 30} minutes`);
  } catch (error) {
    console.warn('Failed to schedule auto-shutdown:', error.message);
  }
}

/**
 * Store error state in SSM
 */
async function storeErrorState(testId, errorMessage) {
  try {
    await ssm.putParameter({
      Name: `/judge0/${testId}/status`,
      Value: 'FAILED',
      Overwrite: true
    }).promise();
    
    await ssm.putParameter({
      Name: `/judge0/${testId}/error`,
      Value: errorMessage,
      Overwrite: true
    }).promise();
    
    console.log(`Stored error state for test ${testId}`);
  } catch (error) {
    console.error('Failed to store error state:', error);
  }
} 