#!/bin/sh
read -p 'Enter the number of messages to send to SQS Queue cohort-keda-sqs-queue: ' x 


a=0
while [ $a -lt $x ]
do
   aws sqs send-message --region us-west-2 --endpoint-url https://sqs.us-west-2.amazonaws.com/ --queue-url https://sqs.us-west-2.amazonaws.com/297410919161/keda-test --message-body '{"key": "value"}'
   a=`expr $a + 1`
done