@echo off
set PATH=%PATH%;c:\mongo\bin

rem start mongod --config mongo.cfg
rem ping 127.0.0.1 -n 3 -w 1000 > nul
mongo webicq < reset.js




