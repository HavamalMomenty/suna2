


## Table of Contents (old readme)

- [Extra fields in .env](#extra-fields-in-env)
- [ Architecture](#project-architecture)
  - [Backend API](#backend-api)
  - [Frontend](#frontend)
  - [Agent Docker](#agent-docker)
  - [Supabase Database](#supabase-database)
- [Run](#run)
- [Manual Setup](#manual-setup)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Extra fields added to env

### LlamaParse Document Parsing
LLAMA_API_KEY
LLAMA_PREMIUM_MODE
### Resights API
RESIGHTS_TOKEN

## Project Architecture

![Architecture Diagram](docs/images/diagram.png)

Suna consists of four main components:

### Backend API

Python/FastAPI service that handles REST endpoints, thread management, and LLM integration with Anthropic, and others via LiteLLM.

### Frontend

Next.js/React application providing a responsive UI with chat interface, dashboard, etc.

### Agent Docker

Isolated execution environment for every agent - with browser automation, code interpreter, file system access, tool integration, and security features.

### Supabase Database

Handles data persistence with authentication, user management, conversation history, file storage, agent state, analytics, and real-time subscriptions.

### Run

#### Terminal 1
```bash
# Navigate to the backend directory
cd suna2/backend
```

```bash
docker compose down && docker compose up --build
```

#### Terminal 2
```bash
# Navigate to the backend directory
cd suna2/backend

# Start the API server
uv run api.py
```

#### Create tunnel
Start by opening a terminal (command prompt) on local machine. Then paste the command and keep window open. The result should show at local localhost:3000.
**ssh -L 3000:localhost:3000 -L 8000:localhost:8000 -L 6379:localhost:6379 momenty2@20.124.90.235**

### Manual Setup

See the [Self-Hosting Guide](./docs/SELF-HOSTING.md) for detailed manual setup instructions.

The wizard will guide you through all necessary steps to get your Suna instance up and running. For detailed instructions, troubleshooting tips, and advanced configuration options, see the [Self-Hosting Guide](./docs/SELF-HOSTING.md).

## Contributing

We welcome contributions from the community! Please see our [Contributing Guide](./CONTRIBUTING.md) for more details.

## Acknowledgements

### Main Contributors

- [Adam Cohen Hillel](https://x.com/adamcohenhillel)
- [Dat-lequoc](https://x.com/datlqqq)
- [Marko Kraemer](https://twitter.com/markokraemer)

### Technologies

- [Daytona](https://daytona.io/) - Secure agent execution environment
- [Supabase](https://supabase.com/) - Database and authentication
- [Playwright](https://playwright.dev/) - Browser automation
- [OpenAI](https://openai.com/) - LLM provider
- [Anthropic](https://www.anthropic.com/) - LLM provider
- [Tavily](https://tavily.com/) - Search capabilities
- [Firecrawl](https://firecrawl.dev/) - Web scraping capabilities
- [QStash](https://upstash.com/qstash) - Background job processing and workflows
- [RapidAPI](https://rapidapi.com/) - API services
- [Smithery](https://smithery.ai/) - Custom agent development

## License

Kortix Suna is licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full license text.



