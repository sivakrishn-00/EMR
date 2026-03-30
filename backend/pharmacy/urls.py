from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PrescriptionViewSet, DispensingRecordViewSet

router = DefaultRouter()
router.register(r'prescriptions', PrescriptionViewSet, basename='prescription')
router.register(r'dispensing', DispensingRecordViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
