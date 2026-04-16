# EMR V1: Laboratory Sync & Management System

## Project Overview
EMR V1 is a high-performance, professional Electronic Medical Record (EMR) ecosystem specifically designed to bridge the gap between localized laboratory diagnostic stations and a centralized healthcare management portal. The core value proposition lies in its **Laboratory Sync Bridge**, which ensures seamless, HIPAA-compliant data transmission from remote lab hardware to the cloud-native EMR dashboard.

---

## Technical Stack

### Core Technologies
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 (Vite) | High-performance SPA with modern React patterns. |
| **Backend** | Django 5.x | Robust Python-based web framework for business logic. |
| **API** | Django REST Framework | RESTful architecture with JWT authentication. |
| **Database** | MySQL 8.0 | Relational data persistence for patient and sync records. |
| **Async Tasks** | Celery + Redis | Multi-lane processing for background data synchronization. |

### UI & UX (Aesthetics)
- **Styling**: TailwindCSS for a premium, responsive design.
- **Animations**: `framer-motion` for fluid micro-interactions and staggered list loadings.
- **Icons**: `lucide-react` for a modern, minimalist iconography set.
- **Charts**: `recharts` for telemetry data visualization and diagnostic analytics.

### Infrastructure & DevOps
- **Containerization**: Docker & Docker Compose for environment parity.
- **Orchestration**: Kubernetes (K3s) for production-scale deployment.
- **Reverse Proxy**: Nginx for static file serving and load balancing.
- **Monitoring**: Celery Flower (task analytics) and Django Prometheus (metrics).

---

## Architectural Highlights

### 1. Laboratory Sync Bridge
The system utilizes a specialized "Sync Agent" architecture consisting of:
- **`sync_core.py`**: The headless engine responsible for data ingestion and transmission.
- **`sync_daemon.py`**: A background service manager that ensures 24/7 uptime on Ubuntu/Windows.
- **Multi-Lane Processing**: 
    - **Urgent Queue**: Fast-tracked processing for critical patient results.
    - **Bulk Queue**: Optimized for high-volume historical data synchronization.
    - **Retry/DLQ Cluster**: Advanced failover logic for recovering from connectivity drops.

### 2. Bridge Hub (Admin Dashboard)
A centralized command center for administrators featuring:
- **Station Telemetry**: Real-time monitoring of sync station health and downtime.
- **Registry Governance**: Management of project-specific machines and API tokens.
- **Security**: Masked sensitive credentials and machine-specific sync keys.

### 3. Data Strategy
- **Redis-AOF Persistence**: Configured for 100% data recovery in case of system crashes.
- **White-Way Integration**: A streamlined UI flow that allows for rapid onboarding of new diagnostic labs.

---

## Getting Started

### Development Mode
1. Ensure Docker Desktop is running.
2. Run `docker-compose up --build`.
3. Backend: `http://localhost:8000`
4. Frontend: `http://localhost:8080`
5. Flower Dashboard: `http://localhost:5555`

### Production Sync Agent
To run the sync agent as a background daemon:
```bash
python sync_daemon.py
```
*Ensure `sync_agent_config.json` is correctly configured with your API credentials.*
