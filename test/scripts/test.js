import http from 'k6/http';
import { check } from 'k6';
import { sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

let requestDuration = new Trend('request_duration');

export let options = {
  vus: 10,         // Number of virtual users 
  iterations: 10,   // Total number of requests
};

export default async function () {
  // const url = 'http://localhost:3000/test';
  const url = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-get?id=75&pps=999';


  const response = http.get(url);

  requestDuration.add(response.timings.duration);

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  console.log(`Request duration: ${response.timings.duration} ms`);

//   sleep(randomIntBetween(1, 2));
}
