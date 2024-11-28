import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  scenarios: {
    postPhase: {
      executor: 'shared-iterations',
      vus: 4, // Number of virtual users
      iterations: 4, // Total iterations (e.g., 50 entries * 2 VUs)
      exec: 'postRequests', // Function to execute
    },
    getPhase: {
      executor: 'shared-iterations',
      startTime: '1m', // Start after postPhase is complete
      vus: 4,
      iterations: 4,
      exec: 'getRequests',
    },
    putPhase: {
      executor: 'shared-iterations',
      startTime: '2m', // Start after getPhase is complete
      vus: 4,
      iterations: 4,
      exec: 'putRequests',
    },
    deletePhase: {
      executor: 'shared-iterations',
      startTime: '3m', // Start after putPhase is complete
      vus: 1,
      iterations: 1,
      exec: 'deleteRequests',
    },
  },
};

// Log function for logging response time with a timestamp
function logResponseTime(method, url, response) {
  let timestamp = new Date().toISOString();
  let logMessage = `INFO ${timestamp} ${method} Response Time: ${response.timings.duration.toFixed(3)} ms and status ${response.status}`;
  console.log(logMessage);

  if (response.status >= 300) {
    console.error(`ERROR ${timestamp} ${method} ${response.status} ${response.body}`);
  }
}

// POST requests (create entries)
export function postRequests() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'k6/0.55.0',
    'Accept': 'application/json',
  };
  let baseUrl = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev';
  for (let i = 1; i <= 25; i++) {
    let postUrl = `${baseUrl}/ric-post`;
    let postData = JSON.stringify({
      id: i.toString(),
      pps: (1000 + i).toString(),
      position: 'Developer',
      age: 25 + (i % 5),
      name: `User_${i}`,
    });
    let postRes = http.post(postUrl, postData, { headers });
    check(postRes, { 'POST request status is 200': (r) => r.status === 200 });
    logResponseTime('POST', postUrl, postRes);
    sleep(0.1);
  }
}

// GET requests (retrieve all entries)
export function getRequests() {
  const headers = {
    'User-Agent': 'k6/0.55.0',
    'Accept': 'application/json',
  };
  let baseUrl = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev';
  for (let i = 1; i <= 25; i++) {
    let getUrl = `${baseUrl}/ric-get?id=${i}&pps=${1000 + i}`;
    let getRes = http.get(getUrl, { headers });
    check(getRes, {
      'GET request status is 200': (r) => r.status === 200,
      'GET request returns data': (r) => r.body && r.body.length > 0,
    });
    logResponseTime('GET', getUrl, getRes);
    sleep(0.1);
  }
}

// PUT requests (update all entries)
export function putRequests() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'k6/0.55.0',
    'Accept': 'application/json',
  };
  let baseUrl = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev';
  for (let i = 1; i <= 25; i++) {
    let putUrl = `${baseUrl}/ric-put`;
    let putData = JSON.stringify({
      id: i.toString(),
      pps: (1000 + i).toString(),
      position: 'Updated Developer',
      age: 30 + (i % 5),
      name: `Updated_User_${i}`,
    });
    let putRes = http.put(putUrl, putData, { headers });
    check(putRes, { 'PUT request status is 200': (r) => r.status === 200 });
    logResponseTime('PUT', putUrl, putRes);
    sleep(0.1);
  }
}

// DELETE requests (delete all entries)
export function deleteRequests() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'k6/0.55.0',
    'Accept': 'application/json',
  };
  let baseUrl = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev';
  for (let i = 1; i <= 25; i++) {
    let deleteUrl = `${baseUrl}/ric-delete`;
    let deleteData = JSON.stringify({
      id: i.toString(),
      pps: (1000 + i).toString(),
    });
    let deleteRes = http.del(deleteUrl, deleteData, { headers });
    check(deleteRes, { 'DELETE request status is 200': (r) => r.status === 200 });
    logResponseTime('DELETE', deleteUrl, deleteRes);
    sleep(0.1);
  }
}
