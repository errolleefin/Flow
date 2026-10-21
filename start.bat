@echo off
chcp 65001 >nul
title Flow - æœ¬åœ°ä¸€é”®å¯åŠ¨å™¨
cd /d "%~dp0"

echo ============================================================
echo   Flow â€” AI é©±åŠ¨çš„æœ¬åœ°å…¨æ ˆå¤šç»´ Todo ä¸Žçœ‹æ¿å·¥ä½œå°
echo ============================================================
echo.

if not exist "node_modules\" (
    echo [1/4] æ£€æµ‹åˆ°é¦–æ¬¡è¿è¡Œï¼Œæ­£åœ¨å®‰è£…ä¾èµ–åŒ…...
    call npm install
) else (
    echo [1/4] æœ¬åœ°ä¾èµ–çŽ¯å¢ƒæ£€æŸ¥é€šè¿‡ã€‚
)

echo [2/4] æ­£åœ¨æ¸…ç†æ®‹ç•™ç«¯å£å ç”¨ (3001 / 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [3/4] å·²é¢„çº¦æœåŠ¡å°±ç»ªåŽè‡ªåŠ¨æ‰“å¼€æµè§ˆå™¨: http://localhost:5173
start /b "" cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:5173"

echo [4/4] æ­£åœ¨å¯åŠ¨ SQLite åŽç«¯æœåŠ¡ä¸Ž Flow å‰ç«¯å·¥ä½œå°...
echo       (æç¤ºï¼šä¿æŒæ­¤çª—å£å¼€å¯ï¼Œå…³é—­çª—å£å³å¯åœæ­¢æœ¬åœ°æœåŠ¡)
echo ============================================================
echo.

call npm run dev
pause
