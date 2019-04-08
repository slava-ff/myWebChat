@echo off
set PATH=%PATH%;c:\mongo\bin

start mongod --config mongo.cfg
