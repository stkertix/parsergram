const { spawn } = require('child_process');
const apps = require('./apps.config.js');

console.log('🚀 Starting all applications...\n');

const processes = [];

apps.forEach(app => {
  console.log(`📱 Starting ${app.name} on port ${app.port}...`);

  const proc = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: app.port.toString() },
    stdio: 'inherit'
  });

  processes.push({
    name: app.name,
    port: app.port,
    process: proc
  });

  proc.on('error', (error) => {
    console.error(`❌ Error starting ${app.name}:`, error.message);
  });

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ ${app.name} exited with code ${code}`);
    }
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down all applications...');
  processes.forEach(({ name, process: proc }) => {
    console.log(`   Stopping ${name}...`);
    proc.kill();
  });
  setTimeout(() => {
    console.log('✅ All applications stopped');
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down all applications...');
  processes.forEach(({ process: proc }) => {
    proc.kill();
  });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

console.log('\n✅ All applications started!');
console.log('\n📋 Running applications:');
apps.forEach(app => {
  console.log(`   • ${app.name}: http://localhost:${app.port}`);
});
console.log('\n💡 Press Ctrl+C to stop all applications\n');

