from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PatientViewSet, EmployeeMasterViewSet, FamilyMemberViewSet,
    ProjectViewSet, ProjectCategoryMappingViewSet, ProjectFieldConfigViewSet,
    RegistryTypeViewSet, RegistryDataViewSet, RegistryFieldViewSet, RegistryReportView, ProjectLogoViewSet
)

router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'employee-masters', EmployeeMasterViewSet, basename='employee-master')
router.register(r'family-members', FamilyMemberViewSet, basename='family-member')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'registry-types', RegistryTypeViewSet, basename='registry-type')
router.register(r'registry-data', RegistryDataViewSet, basename='registry-data')
router.register(r'project-category-mappings', ProjectCategoryMappingViewSet, basename='project-category-mapping')
router.register(r'project-field-configs', ProjectFieldConfigViewSet, basename='project-field-config')
router.register(r'registry-fields', RegistryFieldViewSet, basename='registry-field')
router.register(r'project-logos', ProjectLogoViewSet, basename='project-logo')
router.register(r'reports', RegistryReportView, basename='report')

urlpatterns = [
    path('', include(router.urls)),
]
