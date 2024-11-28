const axios = require('axios');
let data = JSON.stringify({
  "id": "75",
  "pps": "999",
  "position": "Developer",
  "age": 26,
  "name": "govind"
});

let config = {
  method: 'put',
  maxBodyLength: Infinity,
  url: 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-put',
  headers: { 
    'Content-Type': 'application/json'
  },
  data : data
};
(async ()=> {
    axios.request(config)
    .then((response) => {
      console.log(JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log(error);
    });
})()

