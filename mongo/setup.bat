@echo off
set PATH=%PATH%;c:\mongo\bin

rd /s /q c:\mongo\data\webicq
mkdir c:\mongo\data\webicq\logs
start mongod --config mongo.cfg
ping 127.0.0.1 -n 3 -w 1000 > nul
mongo admin < setup.js


