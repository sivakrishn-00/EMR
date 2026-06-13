from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PrescriptionViewSet, 
    DispensingRecordViewSet, 
    ConsumptionReportView,
    IndentViewSet,
    RoomStockViewSet,
    RoomStockDispensationViewSet
)

router = DefaultRouter()
router.register(r'prescriptions', PrescriptionViewSet, basename='prescription')
router.register(r'dispensing', DispensingRecordViewSet)
router.register(r'indents', IndentViewSet, basename='indent')
router.register(r'room-stock', RoomStockViewSet, basename='room-stock')
router.register(r'room-dispensation', RoomStockDispensationViewSet, basename='room-dispensation')

urlpatterns = [
    path('audit-export/', ConsumptionReportView.as_view(), name='audit-export'),
    path('consumption-report/', ConsumptionReportView.as_view(), name='consumption-report'),
    path('', include(router.urls)),
]
