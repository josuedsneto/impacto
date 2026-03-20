module.exports = {
  apps: [
    {
      name: "frontend",
      cwd: "/opt/impacto/frontend",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
    },
    {
      name: "backend",
      cwd: "/opt/impacto/backend",
      script: ".venv/bin/uvicorn",
      args: "main:app --host 127.0.0.1 --port 8000 --workers 4",
      interpreter: "none",
      env: { PYTHONUNBUFFERED: "1" },
    },
  ],
};
