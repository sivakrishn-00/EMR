from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LabRequestViewSet, LabResultViewSet

router = DefaultRouter()
router.register(r'requests', LabRequestViewSet, basename='labrequest')
router.register(r'results', LabResultViewSet, basename='labresult')

urlpatterns = [
    path('', include(router.urls)),
]
