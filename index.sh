#!/bin/sh

mkdir -p logs

while true
do
   dt=`date +%s`
   log="logs/$dt.log"
   echo "$dt starting..."
   node index.js 1>>$log 2>>$log
   res=$?
   echo "exit code: $res"
   if [ $res -ne 0 ]; then
       sleep 10
   fi
done

