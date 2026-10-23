@echo off
chcp 65001 >nul
title Flow - 本地一键启动器
cd /d "%~dp0"

echo ============================================================
echo   Flow — AI 驱动的本地全栈多维 Todo 与看板工作台
echo ============================================================
echo.

if not exist "node_modules\" (
    echo [1/4] 检测到首次运行，正在安装依赖包...
    call npm install
) else (
    echo [1/4] 本地依赖环境检查通过。
)

echo [2/4] 正在清理残留端口占用 (3001 / 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [3/4] 已预约服务就绪后自动打开浏览器: http://localhost:5173
start /b "" cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:5173"

echo [4/4] 正在启动 SQLite 后端服务与 Flow 前端工作台...
echo       (提示：保持此窗口开启，关闭窗口即可停止本地服务)
echo ============================================================
echo.

call npm run dev
pause
