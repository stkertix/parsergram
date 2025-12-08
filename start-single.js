// Script untuk menjalankan satu aplikasi dengan port tertentu
// Usage: node start-single.js <port>
// Example: node start-single.js 3000

const port = process.argv[2] || process.env.PORT || 3000;

if (isNaN(port)) {
  console.error('❌ Error: Port must be a number');
  console.log('Usage: node start-single.js <port>');
  console.log('Example: node start-single.js 3000');
  process.exit(1);
}

process.env.PORT = port;
require('./server.js');

