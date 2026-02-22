#!/bin/bash
mkdir -p .streamlit
cat > .streamlit/secrets.toml << EOF
login_username = "${LOGIN_USERNAME}"
login_password = "${LOGIN_PASSWORD}"
EOF
streamlit run Painel.py --server.port $PORT --server.address 0.0.0.0
