from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LabRequestViewSet, LabResultViewSet, LabTestMasterViewSet, LabSubTestViewSet, LabDepartmentViewSet, LabTestTypeViewSet, LabMachineViewSet, LabMachineDataViewSet

router = DefaultRouter()
router.register(r'requests', LabRequestViewSet, basename='labrequest')
router.register(r'lab-requests', LabRequestViewSet, basename='labrequest_machine')
router.register(r'results', LabResultViewSet, basename='labresult')
router.register(r'lab-tests', LabTestMasterViewSet, basename='labtestmaster')
router.register(r'sub-tests', LabSubTestViewSet, basename='labsubtest')
router.register(r'departments', LabDepartmentViewSet, basename='labdepartment')
router.register(r'test-types', LabTestTypeViewSet, basename='labtesttype')
router.register(r'machines', LabMachineViewSet, basename='labmachine')
router.register(r'machine-data', LabMachineDataViewSet, basename='labmachinedata')


urlpatterns = [
    path('', include(router.urls)),
]
