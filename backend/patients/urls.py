from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PatientViewSet, EmployeeMasterViewSet, FamilyMemberViewSet,
    ProjectViewSet, ProjectCategoryMappingViewSet, ProjectFieldConfigViewSet,
    RegistryTypeViewSet, RegistryDataViewSet, RegistryFieldViewSet, RegistryReportView, ProjectLogoViewSet,
    RegistryUploadSessionViewSet, serve_mongo_media
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
router.register(r'upload-sessions', RegistryUploadSessionViewSet, basename='upload-session')
router.register(r'reports', RegistryReportView, basename='report')

urlpatterns = [
    path('mongo-media/<str:file_id>/', serve_mongo_media, name='serve-mongo-media'),
    path('', include(router.urls)),
]

