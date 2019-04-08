@echo off
echo {} > files\rooms.json
echo {} > files\users.json
:loop
node index.js
goto loop