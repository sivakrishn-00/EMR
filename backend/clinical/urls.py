from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VisitViewSet, VitalsViewSet, ConsultationViewSet, AppointmentViewSet

router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')
router.register(r'vitals', VitalsViewSet, basename='vitals')
router.register(r'consultations', ConsultationViewSet, basename='consultation')
router.register(r'appointments', AppointmentViewSet, basename='appointment')

urlpatterns = [
    path('', include(router.urls)),
]
