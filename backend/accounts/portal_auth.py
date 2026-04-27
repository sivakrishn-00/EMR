from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from django.db.models import Q
from patients.models import Patient
from .models import User
from .utils import generate_otp, verify_otp
from rest_framework_simplejwt.tokens import RefreshToken

class RequestOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get('identifier')
        provided_phone = request.data.get('phone_number') # Security Check
        
        if not identifier or not provided_phone:
            return Response({"error": "Registry ID and Mobile Number required"}, status=400)

        # 1. Lookup Patient
        from django.db.models import Q
        patient = Patient.objects.filter(Q(phone=identifier) | Q(patient_id=identifier)).first()
        
        if not patient:
            return Response({"error": "Patient record not found. Please contact administration."}, status=404)

        phone = patient.phone
        if not phone:
            return Response({"error": "No phone number linked to this record. Update at clinic."}, status=400)

        # 🛡️ SECURITY HANDSHAKE: Verify provided phone matches linked registry phone
        if phone != provided_phone:
             return Response({"error": "Entered number does not match our records. Please consult administrator to update your profile."}, status=403)

        # 2. Ensure User account exists & is linked
        user = patient.user
        if not user:
            # Check if a user with this patient_id (username) already exists
            user = User.objects.filter(username=patient.patient_id).first()
            
            if not user:
                user = User.objects.create(
                    username=patient.patient_id,
                    phone=phone,
                    role='PATIENT',
                    first_name=patient.first_name,
                    last_name=patient.last_name
                )
            
            # CRITICAL HANDSHAKE: Bond patient to user
            patient.user = user
            patient.save()
        
        # Ensure the reverse link is also active
        if not hasattr(user, 'patient_profile') or user.patient_profile != patient:
            patient.user = user
            patient.save()

        # 🛑 SECURITY: CHECK IF ACCOUNT IS DEACTIVATED OR LACKS ROLES
        if not user.is_active:
             return Response({"error": "Your portal access is deactivated. Please contact the clinical administrator."}, status=403)
        
        if not user.user_roles.exists():
             return Response({"error": "Account Provisioning Incomplete: No permissions assigned. Contact Admin."}, status=403)

        # 3. Generate OTP
        otp = generate_otp(phone)
        
        from django.conf import settings
        response_data = {
            "status": "OTP_SENT",
            "is_first_time": not user.is_password_set
        }
        
        # EASY TESTING: Return OTP in response only if in Debug mode
        if settings.DEBUG:
            response_data["dev_otp"] = otp
            
        return Response(response_data)

class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get('identifier')
        auth_code = request.data.get('otp')

        if not identifier or not auth_code:
            return Response({"error": "Identifier and OTP required"}, status=400)

        patient = Patient.objects.filter(Q(phone=identifier) | Q(patient_id=identifier)).first()
        if not patient or not patient.user:
             return Response({"error": "Invalid session"}, status=400)

        if verify_otp(patient.phone, auth_code):
            user = patient.user
            
            # Final role check before token generation
            if not user.user_roles.exists():
                 return Response({"error": "Security Restriction: No active roles. Contact clinical admin."}, status=403)

            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'username': user.username,
                    'is_password_set': user.is_password_set,
                    'is_first_time': not user.is_password_set,
                    'role': 'PATIENT'
                }
            })
        
        return Response({"error": "Invalid or expired OTP"}, status=401)

class SetPortalPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        password = request.data.get('password')
        if not password:
             return Response({"error": "Password required"}, status=400)
        
        user = request.user
        # Restricted to PATIENT role for this specific flow
        if user.role != 'PATIENT':
             return Response({"error": "Access denied"}, status=403)

        user.set_password(password)
        user.is_password_set = True
        user.save()
        
        return Response({"success": "Password set successfully. You can now use it for future logins."})

from django.core.cache import cache

class DiscoveryView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get('identifier', '').strip()
        if not identifier:
            return Response({"error": "Registry ID required"}, status=400)

        # ⚡ BILLION-SCALE CACHE LAYER: Redis Discovery Accelerator
        cache_key = f"discovery_{identifier}"
        try:
            cached_data = cache.get(cache_key)
            if cached_data:
                print(f"🚀 IDENTITY_DISCOVERED: Redis Hit for {identifier}")
                return Response(cached_data)
        except Exception as e:
            print(f"⚠️ INFRA: Discovery Cache Offline ({str(e)})")

        patient = Patient.objects.filter(patient_id=identifier).first()
        if patient:
            # Check for deactivation if user account already exists
            if patient.user and not patient.user.is_active:
                return Response({"error": "Identity deactivated. Please contact your clinical administrator."}, status=403)
                
            discovery_data = {
                "identity_type": "PATIENT",
                "is_password_set": patient.user.is_password_set if patient.user else False,
                "is_first_time": not patient.user.is_password_set if patient.user else True,
                "name": identifier 
            }
            try:
                cache.set(cache_key, discovery_data, 3600)
            except Exception:
                pass
            return Response(discovery_data)

        # 2. 🛡️ SEARCH CORE REGISTRY (Employees/Staff)
        user = User.objects.filter(username=identifier).first()
        if user:
            # Check for deactivation
            if not user.is_active:
                return Response({"error": "Staff access deactivated. Please contact the System Administrator."}, status=403)

            discovery_data = {
                "identity_type": user.role, 
                "is_password_set": user.is_password_set,
                "is_first_time": not user.is_password_set,
                "name": identifier 
            }
            try:
                cache.set(cache_key, discovery_data, 3600)
            except Exception:
                pass
            return Response(discovery_data)

        return Response({"error": "ID not recognized. Please verify your credentials."}, status=404)
