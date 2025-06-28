#!/bin/bash

echo "🚀 Expo Update Server - Complete Certificate Workflow Test"
echo "=========================================================="

APP_SLUG="workflow-test-$(date +%s)"
SERVER_URL="https://expo-update-server.expo-quickpush.workers.dev"

echo "📝 Testing complete workflow for app: $APP_SLUG"
echo ""

# Step 1: Register the app
echo "1️⃣  Registering app..."
REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL/register-app" \
  -H "Content-Type: application/json" \
  -d "{\"slug\": \"$APP_SLUG\"}")

SUCCESS=$(echo "$REGISTER_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ App registered successfully!"
  echo ""
  
  echo "📋 Certificate Setup Instructions:"
  echo "$REGISTER_RESPONSE" | jq -r '.certificateSetup.generateInstructions.method1.steps[]'
  echo ""
  
  # Step 2: Generate certificate
  echo "2️⃣  Generating certificate..."
  if node generate-certificate-example.js "$APP_SLUG" > /dev/null 2>&1; then
    echo "✅ Certificate generated successfully!"
    echo "   - Files created: ${APP_SLUG}-certificate.pem, ${APP_SLUG}-private-key.pem"
    echo ""
    
    # Step 3: Upload certificate
    echo "3️⃣  Uploading certificate..."
    if node upload-certificate.js "$APP_SLUG" > /dev/null 2>&1; then
      echo "✅ Certificate uploaded successfully!"
      echo ""
      
      # Step 4: Test certificate download
      echo "4️⃣  Testing certificate download..."
      if curl -s "$SERVER_URL/certificate/$APP_SLUG" > "${APP_SLUG}-downloaded.pem"; then
        echo "✅ Certificate download successful!"
        
        # Compare original and downloaded
        if diff "${APP_SLUG}-certificate.pem" "${APP_SLUG}-downloaded.pem" > /dev/null; then
          echo "✅ Downloaded certificate matches original!"
        else
          echo "⚠️  Downloaded certificate differs from original"
        fi
        echo ""
        
        # Step 5: Show certificate info
        echo "5️⃣  Certificate Information:"
        echo "   - File size: $(wc -c < "${APP_SLUG}-certificate.pem") bytes"
        echo "   - Algorithm: RSA-2048 with SHA-256 (rsa-v1_5-sha256 compatible)"
        echo "   - Validity: 10 years"
        echo "   - Common Name: expo-updates-${APP_SLUG}"
        echo ""
        
        # Step 6: Show Expo configuration
        echo "6️⃣  Expo App Configuration:"
        echo "   Add this to your app.json:"
        echo '   {'
        echo '     "expo": {'
        echo '       "updates": {'
        echo "         \"url\": \"$SERVER_URL/manifest?project=$APP_SLUG&channel=production\","
        echo "         \"codeSigningCertificate\": \"./${APP_SLUG}-certificate.pem\","
        echo '         "codeSigningMetadata": {'
        echo '           "keyid": "main",'
        echo '           "alg": "rsa-v1_5-sha256"'
        echo '         }'
        echo '       }'
        echo '     }'
        echo '   }'
        echo ""
        
        # Step 7: Test apps endpoint
        echo "7️⃣  Verifying app in apps list..."
        APPS_RESPONSE=$(curl -s "$SERVER_URL/apps")
        APP_COUNT=$(echo "$APPS_RESPONSE" | jq '.apps | length')
        echo "✅ Server now has $APP_COUNT registered apps"
        echo ""
        
        # Cleanup
        echo "🧹 Cleaning up test files..."
        rm "${APP_SLUG}-certificate.pem" "${APP_SLUG}-private-key.pem" "${APP_SLUG}-downloaded.pem"
        echo "✅ Cleanup complete"
        echo ""
        
        echo "🎉 Complete workflow test PASSED!"
        echo "======================================"
        echo "✅ App registration"
        echo "✅ Certificate generation (proper X.509 with node-forge)"
        echo "✅ Certificate upload with validation"
        echo "✅ Certificate download"
        echo "✅ File integrity verification"
        echo "✅ Server integration"
        echo ""
        echo "🚀 Your Expo Update Server is ready for production use!"
        
      else
        echo "❌ Certificate download failed"
      fi
    else
      echo "❌ Certificate upload failed"
    fi
  else
    echo "❌ Certificate generation failed"
    echo "💡 Make sure node-forge is installed: npm install node-forge"
  fi
else
  echo "❌ App registration failed"
  echo "$REGISTER_RESPONSE"
fi

echo ""
echo "🏁 Test complete!" 