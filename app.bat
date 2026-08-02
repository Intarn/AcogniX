@echo off
echo ===================================================
echo KHOI DONG HE THONG ACOGNIX
echo ===================================================

:: 1. Khởi động Backend (chạy ngầm)
echo 1. Dang bat Core Backend...
start "AcogniX Backend" cmd /k "cd D:\PYTHON\AcogniX\backend && npm start"

:: 2. Khởi động Frontend (ReactJS sẽ tự động mở trang web)
echo 2. Dang bat React Frontend...
start "AcogniX Frontend" cmd /k "cd D:\PYTHON\AcogniX\frontend && npm start"