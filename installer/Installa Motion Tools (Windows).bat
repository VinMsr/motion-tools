@echo off
rem Installa Motion Tools nella cartella dell'utente, senza diritti di amministratore.
set "SRC=%~dp0motion-tools"
set "DEST=%APPDATA%\Adobe\CEP\extensions\tools.inflect.panel"
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "%SRC%" "%DEST%\" /e /i /q /y >nul
rem Cache dei pannelli di CEP: senza pulirla After Effects puo' usare i file vecchi.
for /d %%d in ("%TEMP%\cep_cache\*tools.inflect.panel*") do rmdir /s /q "%%d"
for %%v in (9 10 11 12 13 14) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo Fatto. Chiudi After Effects del tutto, riaprilo e apri Finestra ^> Estensioni ^> Motion Tools.
pause
