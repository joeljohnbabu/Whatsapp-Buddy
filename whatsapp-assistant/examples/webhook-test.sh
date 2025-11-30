#!/bin/bash

# Sample webhook test script for WhatsApp Assistant
# Usage: ./webhook-test.sh

BASE_URL="${1:-http://localhost:3000}"

echo "Testing WhatsApp Assistant Webhook at $BASE_URL"
echo ""

# Test 1: Twilio webhook - First message (opt-in)
echo "Test 1: First-time user message (should trigger opt-in)"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+1234567890",
    "Body": "Hello",
    "MessageSid": "test-msg-1"
  }'
echo -e "\n\n"

# Test 2: Twilio webhook - Opt-in
echo "Test 2: User opts in"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+1234567890",
    "Body": "YES",
    "MessageSid": "test-msg-2"
  }'
echo -e "\n\n"

# Test 3: Create reminder
echo "Test 3: Create reminder"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+1234567890",
    "Body": "Remind me tomorrow at 9am to call mom",
    "MessageSid": "test-msg-3"
  }'
echo -e "\n\n"

# Test 4: Snooze reminder
echo "Test 4: Snooze reminder"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+1234567890",
    "Body": "Snooze this for 30 minutes",
    "MessageSid": "test-msg-4"
  }'
echo -e "\n\n"

# Test 5: Cancel reminder
echo "Test 5: Cancel reminder"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+1234567890",
    "Body": "Cancel my reminder about call mom",
    "MessageSid": "test-msg-5"
  }'
echo -e "\n\n"

# Test 6: Summarize thread
echo "Test 6: Summarize thread"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+1234567890",
    "Body": "Summarize this thread",
    "MessageSid": "test-msg-6"
  }'
echo -e "\n\n"

echo "All tests completed!"

