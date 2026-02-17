import http from 'http';

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/posts',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

async function run() {
  console.log('Sending 25 requests to POST /posts (Limit is 20)...');
  
  const makeRequest = (i) => new Promise((resolve) => {
    const req = http.request(options, (res) => {
      console.log(`Req ${i+1}: Status ${res.statusCode} | Remaining: ${res.headers['ratelimit-remaining']}`);
      res.resume();
      resolve();
    });
    
    req.on('error', (e) => {
      console.error(`Req ${i+1} Error: ${e.message}`);
      resolve();
    });
    
    // Invalid body is fine, we just want to hit the rate limiter
    req.write(JSON.stringify({ test: true }));
    req.end();
  });

  for (let i = 0; i < 25; i++) {
    await makeRequest(i);
  }
}

run();
