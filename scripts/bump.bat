@echo off
setlocal

if "%~1"=="" (
    echo usage: bump.bat ^<version^>
    exit /b 1
)

set "version=%~1"
for /f "tokens=1-3 delims=." %%a in ("%version%") do set "short=%%a.%%b.%%c"

jq -bj --indent 4 --arg v "%version%" ".version = $v" package.json > package.json.tmp || exit /b 1
move /y package.json.tmp package.json >nul

for /d %%d in (packages\*) do (
    jq -bj --indent 4 --arg v "%short%" ".version = $v" "%%d\package.json" > "%%d\package.json.tmp" || exit /b 1
    move /y "%%d\package.json.tmp" "%%d\package.json" >nul
)

git commit -am "v%version%" || exit /b 1
git tag "v%version%" || exit /b 1
