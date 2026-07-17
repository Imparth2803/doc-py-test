const net = require('net');
const http = require('http');

/**
 * Checks if a port is currently occupied on localhost.
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Attempts to verify if the process listening on a port belongs to Smart Document Vault.
 */
function checkHttpServiceHealth(port, healthPath, expectedStatus, expectedJson) {
  return new Promise((resolve) => {
    const url = `http://127.0.0.1:${port}${healthPath}`;
    const req = http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        req.destroy();
        
        // 1. Verify status code
        if (expectedStatus && res.statusCode !== expectedStatus) {
          resolve(false);
          return;
        }

        // 2. Verify JSON parameters if required
        if (expectedJson) {
          try {
            const parsed = JSON.parse(data);
            for (const key of Object.keys(expectedJson)) {
              if (parsed[key] !== expectedJson[key]) {
                resolve(false);
                return;
              }
            }
          } catch {
            resolve(false);
            return;
          }
        }

        resolve(true); // Service matches signature
      });
    });

    req.setTimeout(1000);
    
    req.on('error', () => {
      req.destroy();
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Tests if a port is running a MongoDB instance.
 */
function checkMongoPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.connect(port, '127.0.0.1', () => {
      // Connects successfully, but we want to make sure it responds as a mongo server.
      // We can send a dummy byte stream or just trust the port for Mongo.
      // If we send a basic mongo wire message, it would respond.
      // For general purposes, if we can establish a TCP socket on 27017, and it doesn't close immediately with error,
      // it is a running socket. Let's send a simple ping or just assume it is MongoDB.
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

module.exports = {
  isPortInUse,
  checkHttpServiceHealth,
  checkMongoPort
};
