# Meridian Prototype V2.1 in health-care

The approved Meridian Prototype V2.1 is served by the existing React/Vite frontend without altering its labels, punctuation, mock data, navigation, or interactions. The existing FastAPI backend is preserved under `backend/`.

## Run backend
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

## Run frontend
cd frontend
npm install
npm run dev

Open http://localhost:5173

## Important
`frontend/public/meridian-prototype-v2.1.html` is the exact prototype master. Do not edit its non-Radiology modules when integrating the Radiology service.
