@echo off
if "%1" == "" (
  start clients.bat 0
  start clients.bat 1
  start clients.bat 2
  exit
)
   
node clients.js %1 1>c.%1.txt 2>&1

  
