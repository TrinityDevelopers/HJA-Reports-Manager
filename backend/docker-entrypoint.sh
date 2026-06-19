#!/bin/sh
set -eu

wait_for_database() {
  if [ -z "${DB_HOST:-}" ]; then
    return 0
  fi

  echo "Waiting for database at ${DB_HOST}:${DB_PORT:-3306}..."

  node <<'EOF'
const net = require('net');

const host = process.env.DB_HOST;
const defaultPort = process.env.DB_TYPE === 'postgres' ? '5432' : '3306';
const port = Number.parseInt(process.env.DB_PORT || defaultPort, 10);
const maxAttempts = 60;

function attempt(tryNumber) {
  if (tryNumber >= maxAttempts) {
    console.error(`Database not reachable at ${host}:${port} after ${maxAttempts} attempts`);
    process.exit(1);
  }

  const socket = net.createConnection({ host, port });

  socket.on('connect', () => {
    socket.end();
    console.log(`Database reachable at ${host}:${port}`);
    process.exit(0);
  });

  socket.on('error', () => {
    setTimeout(() => attempt(tryNumber + 1), 2000);
  });
}

attempt(0);
EOF
}

run_bootstrap_migration() {
  echo "Running database bootstrap migration..."

  attempt=1
  while [ "$attempt" -le 10 ]; do
    if node dist/src/database/runMigrations.js; then
      echo "Database bootstrap migration completed"
      return 0
    fi

    echo "Migration attempt ${attempt}/10 failed; retrying in 3s..."
    attempt=$((attempt + 1))
    sleep 3
  done

  echo "Database bootstrap migration failed after 10 attempts"
  return 1
}

wait_for_database
run_bootstrap_migration

exec "$@"
