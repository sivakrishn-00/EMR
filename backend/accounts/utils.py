from .models import AuditLog
from django.core.cache import cache
import random
import string
import os
from twilio.rest import Client
from django.conf import settings

def log_action(user, module, action, details, ip_address=None):
    if user and not user.is_authenticated:
        user = None
    AuditLog.objects.create(
        user=user, 
        module=module, 
        action=action, 
        details=details,
        ip_address=ip_address
    )

def send_sms(phone_number, message):
    """
    Sends an SMS via Twilio.
    Ensures the phone number is in E.164 format.
    """
    try:
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        from_number = os.getenv('TWILIO_PHONE_NUMBER')

        if not all([account_sid, auth_token, from_number]):
            print("⚠️ Twilio credentials missing in environment.")
            return False

        # Normalize phone number to E.164 (Assuming India +91 if 10 digits)
        target_phone = str(phone_number).strip()
        if len(target_phone) == 10 and target_phone.isdigit():
            target_phone = f"+91{target_phone}"
        elif not target_phone.startswith('+'):
            target_phone = f"+{target_phone}"

        client = Client(account_sid, auth_token)
        client.messages.create(
            body=message,
            from_=from_number,
            to=target_phone
        )
        print(f"✅ SMS sent successfully to {target_phone}")
        return True
    except Exception as e:
        print(f"❌ Twilio Error: {str(e)}")
        return False

def generate_otp(phone_number):
    otp = ''.join(random.choices(string.digits, k=6))
    cache_key = f"otp_{phone_number}"
    
    # ⚡ RESILIENCE: Save to Global Registry & Primary Cache
    OTP_BACKEND_REGISTRY[phone_number] = otp
    
    # Increased timeout to 300s (5 Minutes) per user request
    try:
        cache.set(cache_key, otp, timeout=300) 
    except Exception:
        print(f"⚠️ INFRA: Redis Link Interrupted. Registry Fallback Active.")
    
    # Real SMS Delivery
    send_sms(phone_number, f"Your EMR Portal code: {otp}")

    # 🚨 VIBRANT CONSOLE LOGGING (Masked for Privacy)
    masked_phone = f"******{phone_number[-4:]}" if len(phone_number) > 4 else phone_number
    print("\n" + "🚀" + "="*60)
    print(f"  INTERNAL EMR SECURITY: PORTAL OTP FOR {masked_phone} IS [{otp}]")
    print("🚀" + "="*60 + "\n")

    return otp

# 🛡️ RESILIENT OTP STORAGE (Memory Fallback if Cache Fails)
OTP_BACKEND_REGISTRY = {}

def verify_otp(phone_number, otp_input):
    # 🔓 HARDENED MASTER BYPASS
    clean_otp = str(otp_input).strip()
    if settings.DEBUG and clean_otp == "000000":
        print(f"🟢 AUTH: Master bypass invoked for {phone_number}")
        return True

    cache_key = f"otp_{phone_number}"
    
    # 1. Try Primary Cache (Now LocMem or Redis)
    try:
        stored_otp = cache.get(cache_key)
        if stored_otp and str(stored_otp) == clean_otp:
            cache.delete(cache_key)
            return True
    except Exception:
        print(f"⚠️ INFRA: Cache access failed. Checking Registry fallback.")
    
    # 2. Check Global Registry Fallback
    if OTP_BACKEND_REGISTRY.get(phone_number) == clean_otp:
        del OTP_BACKEND_REGISTRY[phone_number]
        return True
        
    return False
