import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 1, // Number of virtual users
  duration: '6s', // Duration of the test
  iterations: 1
};

// Log function for logging response time with a timestamp
function logResponseTime(method, url, response) {
  let timestamp = new Date().toISOString(); // Add timestamp for clarity
  let logMessage = `INFO ${method}  Response Time: ${response.timings.duration.toFixed(3)} ms and status ${response.status}`;
  console.log(logMessage); // Print response time to the console

  if (response.status >= 300) {
    console.error(`ERROR ${method} ${response.status} ${response.body}`);
  }
}

export default function () {
  // Custom headers to match Axios behavior
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'k6/0.55.0', // Mimic Axios User-Agent
    'Accept': 'application/json', // Add any headers Axios might send by default
  };

  // POST request
  // let postUrl = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-post';
  let postUrl = 'http://localhost:3000/ric'
  let postData = JSON.stringify({
    id: '75',
    pps: '999',
    position: 'Developer Lead',
    age: '28',
    name: 'anilgka',
  });
  let postRes = http.post(postUrl, postData, { headers });
  check(postRes, {
    'POST request status is 200': (r) => r.status === 200,
  });
  logResponseTime('POST', postUrl, postRes);



  // GET request
  // let getUrl = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-get?id=75&pps=999';
  let getUrl = 'http://localhost:3000/ric?id=75&pps=999';

  let getRes = http.get(getUrl, { headers });
  check(getRes, {
    'GET request status is 200': (r) => r.status === 200,
    'GET request returns data': (r) => r.body && r.body.length > 0,
  });
  logResponseTime('GET', getUrl, getRes);

  
  

  // PUT request
  // let putUrl = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-put';
  let putUrl = 'http://localhost:3000/ric';

  let putData = JSON.stringify({
    id: '75',
    pps: '999',
    position: 'Developer',
    age: 26,
    name: 'govind',
  });
  let putRes = http.put(putUrl, putData, { headers });
  check(putRes, {
    'PUT request status is 200': (r) => r.status === 200,
  });
  logResponseTime('PUT', putUrl, putRes);

  // DELETE request
  // let deleteUrl = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-delete';
  let deleteUrl = 'http://localhost:3000/ric';

  let deleteData = JSON.stringify({
    id: '75',
    pps: '999',
  });
  let deleteRes = http.del(deleteUrl, deleteData, { headers });
  check(deleteRes, {
    'DELETE request status is 200': (r) => r.status === 200,
  });
  logResponseTime('DELETE', deleteUrl, deleteRes);
}