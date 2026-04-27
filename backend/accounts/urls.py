from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, CurrentUserView, CustomTokenObtainPairView, 
    UserViewSet, UserRoleViewSet, AuditLogViewSet, NotificationViewSet, DashboardStatsView
)
from .portal_auth import RequestOTPView, VerifyOTPView, SetPortalPasswordView, DiscoveryView
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'user-roles', UserRoleViewSet, basename='userrole')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', CurrentUserView.as_view(), name='me'),
    path('stats/', DashboardStatsView.as_view(), name='stats'),
    
    # Patient Portal Specific URLs
    path('portal/discover/', DiscoveryView.as_view(), name='portal_discover'),
    path('portal/request-otp/', RequestOTPView.as_view(), name='portal_request_otp'),
    path('portal/verify-otp/', VerifyOTPView.as_view(), name='portal_verify_otp'),
    path('portal/set-password/', SetPortalPasswordView.as_view(), name='portal_set_password'),
]
