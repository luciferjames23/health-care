@echo off
cd /d %~dp0backend
if not exist venv (
    C:\Users\Bsoft137\AppData\Local\Programs\Python\Python311\python.exe -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

