@echo off
chcp 65001 >nul
title ServisPro - Yayinla
cd /d "%~dp0"
echo.
echo  ServisPro yayina aliniyor (Firebase Hosting, ucretsiz)
echo  ----------------------------------------------------
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js bulunamadi. Indirme sayfasi aciliyor...
  echo  "LTS" surumunu kurun, sonra bu dosyaya tekrar cift tiklayin.
  start https://nodejs.org/tr/download
  pause
  exit /b 1
)
echo  [1/2] Firebase hesabina giris (tarayicida Izin Ver deyin)...
call npx -y firebase-tools@13 login
if errorlevel 1 goto hata
echo.
echo  [2/2] Site yukleniyor...
call npx -y firebase-tools@13 deploy --only hosting --project servispro-b7732 --config firebase.hosting.json
if errorlevel 1 goto hata
echo.
echo  TAMAM! Siteniz yayinda:  https://servispro-b7732.web.app
start https://servispro-b7732.web.app
pause
exit /b 0
:hata
echo.
echo  Bir hata olustu. Bu pencerenin ekran goruntusunu Claudea gonderin.
pause
exit /b 1
