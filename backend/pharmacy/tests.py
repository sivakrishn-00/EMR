from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from patients.models import Project
from pharmacy.models import FacilityRoom, UserRoomAssignment, Indent

User = get_user_model()

class FacilityRoomTests(APITestCase):
    def setUp(self):
        # Create Projects
        self.project_a = Project.objects.create(name="Project A")
        self.project_b = Project.objects.create(name="Project B")

        # Create Users
        self.user_admin = User.objects.create_superuser(
            username="superadmin", email="admin@test.com", password="password123"
        )
        self.user_a = User.objects.create_user(
            username="user_a", email="user_a@test.com", password="password123",
            project=self.project_a
        )
        self.user_b = User.objects.create_user(
            username="user_b", email="user_b@test.com", password="password123",
            project=self.project_b
        )

        # Create Rooms
        self.room_a1 = FacilityRoom.objects.create(
            project=self.project_a, name="Nurse Room A1", room_type="NURSE_ROOM"
        )
        self.room_a2 = FacilityRoom.objects.create(
            project=self.project_a, name="Lab Room A2", room_type="LABORATORY"
        )
        self.room_b1 = FacilityRoom.objects.create(
            project=self.project_b, name="OHC Room B1", room_type="OHC"
        )

        # Assign user_a to room_a1
        self.assignment_a = UserRoomAssignment.objects.create(
            user=self.user_a, assigned_room=self.room_a1
        )

    def test_facility_room_list_project_isolation(self):
        # Log in as user_a (Project A)
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/pharmacy/facility-rooms/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should only see rooms in Project A
        results = response.data.get('results', response.data)
        room_names = [room['name'] for room in results]
        self.assertIn("Nurse Room A1", room_names)
        self.assertIn("Lab Room A2", room_names)
        self.assertNotIn("OHC Room B1", room_names)

    def test_user_room_assignment_serialization(self):
        # Log in as user_a
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/accounts/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check that room assignment details are included
        self.assertIsNotNone(response.data.get('room_assignment'))
        self.assertEqual(response.data['room_assignment']['room_name'], "Nurse Room A1")
        self.assertEqual(response.data['room_assignment']['room_type'], "NURSE_ROOM")

    def test_user_without_assignment(self):
        # Log in as user_b (who has no assignment)
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/accounts/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data.get('room_assignment'))

