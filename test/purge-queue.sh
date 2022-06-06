#!/bin/sh

aws sqs purge-queue --queue-url https://sqs.us-west-2.amazonaws.com/297410919161/keda-test
echo "All the messages are deleted from the queue cohort-keda-sqs-queue"