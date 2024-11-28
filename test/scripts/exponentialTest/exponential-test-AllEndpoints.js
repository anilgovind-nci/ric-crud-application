import http from 'k6/http';
import { check } from 'k6';

// Scenarios configuration
export let options = {
  scenarios: {
    ...Array.from({ length: 3 }, (_, i) => i + 1).reduce((acc, vu) => {
      // acc[`postPhase${vu}`] = {
      //   executor: 'shared-iterations',
      //   vus: vu*vu,
      //   iterations: vu*vu,
      //   startTime: `${(vu - 1) * 25}s`, // Adjust start time for each VU set
      //   exec: 'postRequests',
      // };
      acc[`getPhase${vu}`] = {
        executor: 'shared-iterations',
        startTime: `${(vu - 1) * 25 + 5}s`, // Offset for GET phase
        vus: vu*vu,
        iterations: vu*vu,
        exec: 'getRequests',
      };
      // acc[`putPhase${vu}`] = {
      //   executor: 'shared-iterations',
      //   startTime: `${(vu - 1) * 25 + 10}s`, // Offset for PUT phase
      //   vus: vu*vu,
      //   iterations: vu*vu,
      //   exec: 'putRequests',
      // };
      // acc[`deletePhase${vu}`] = {
      //   executor: 'shared-iterations',
      //   startTime: `${(vu - 1) * 25 + 15}s`, // Offset for DELETE phase
      //   vus: 1,
      //   iterations: 1,
      //   exec: 'deleteRequests',
      // };
      return acc;
    }, {}),
  },
};


// Function to log response time and status
function logResponseTime(method, url, response) {
  let timestamp = new Date().toISOString();
  console.log(`${timestamp} INFO ${method} Response Time: ${response.timings.duration.toFixed(3)} ms and Status: ${response.status}`);
  if (response.status >= 300) {
    console.error(`${timestamp} ERROR ${method} ${response.status} ${response.body}`);
  }
}

// POST requests
export function postRequests() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'k6/0.55.0',
    'Accept': 'application/json',
  };
  // let url = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-post';
  let url = 'http://localhost:3000/ric';
  let data = JSON.stringify({
    id: '75',
    pps: '999',
    position: 'Developer Lead',
    age: '28',
    name: 'exampleUser',
  });
  let res = http.post(url, data, { headers });
  logResponseTime('POST', url, res);
  check(res, { 'POST request status is 200': (r) => r.status === 200 });
}

// GET requests
export function getRequests() {
  const headers = {
    'User-Agent': 'k6/0.55.0',
    'Accept': 'application/json',
  };
  // let url = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-get?id=75&pps=999';
  let url = 'http://localhost:3000/ric?id=75&pps=999';

  let res = http.get(url, { headers });
  logResponseTime('GET', url, res);
  check(res, { 'GET request status is 200': (r) => r.status === 200 });
}

// PUT requests
export function putRequests() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'k6/0.55.0',
    'Accept': 'application/json',
  };
  // let url = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-put';
  let url = 'http://localhost:3000/ric';

  let data = JSON.stringify({
    id: '75',
    pps: '999',
    position: 'Senior Developer',
    age: 29,
    name: 'exampleUserUpdated',
  });
  let res = http.put(url, data, { headers });
  logResponseTime('PUT', url, res);
  check(res, { 'PUT request status is 200': (r) => r.status === 200 });
}

// DELETE requests
export function deleteRequests() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'k6/0.55.0',
    'Accept': 'application/json',
  };
  // let url = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-delete';
  let url = 'http://localhost:3000/ric';

  let data = JSON.stringify({ id: '75', pps: '999' });
  let res = http.del(url, data, { headers });
  logResponseTime('DELETE', url, res);
  check(res, { 'DELETE request status is 200': (r) => r.status === 200 });
}
