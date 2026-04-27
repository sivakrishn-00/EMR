from .models import User, AuditLog, Notification, UserRole
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.db.models import Q

class UserRoleSerializer(serializers.ModelSerializer):
    users = serializers.PrimaryKeyRelatedField(many=True, queryset=User.objects.all(), required=False)
    
    class Meta:
        model = UserRole
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    user_roles_details = UserRoleSerializer(source='user_roles', many=True, read_only=True)
    permissions = serializers.SerializerMethodField()
    data_isolation = serializers.SerializerMethodField()
    project_name = serializers.ReadOnlyField(source='project.name')
    branding = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'phone', 'address', 'first_name', 'last_name', 'is_active', 'date_joined', 'user_roles', 'user_roles_details', 'permissions', 'data_isolation', 'project', 'project_name', 'branding', 'is_password_set')

    def get_permissions(self, obj):
        if obj.role == 'ADMIN':
            return ['ADMIN_ALL']
        perms = []
        for r in obj.user_roles.all():
            if isinstance(r.permissions, list):
                perms.extend(r.permissions)
        return list(set(perms))

    def get_data_isolation(self, obj):
        roles = obj.user_roles.all()
        if roles.exists():
            return all(r.data_isolation for r in roles)
        return True if obj.role != 'ADMIN' else False

    def get_branding(self, obj):
        if obj.project:
            first_logo = obj.project.header_logos.first()
            return {
                'primary_color': obj.project.primary_color,
                'secondary_color': obj.project.secondary_color,
                'accent_color': obj.project.accent_color,
                'project_name': obj.project.name,
                'project_logo': first_logo.image.url if first_logo and first_logo.image else None
            }
        return None

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    user_roles = serializers.PrimaryKeyRelatedField(queryset=UserRole.objects.all(), many=True, required=False)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'role', 'first_name', 'last_name', 'phone', 'user_roles', 'project')

    def create(self, validated_data):
        user_roles_data = validated_data.pop('user_roles', [])
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data.get('role', 'PATIENT'),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone=validated_data.get('phone', ''),
            project=validated_data.get('project', None)
        )
        if user_roles_data:
            user.user_roles.set(user_roles_data)
        return user

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    
    class Meta:
        model = AuditLog
        fields = '__all__'

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Primary role for legacy support
        token['role'] = user.role
        token['project'] = user.project_id
        # List of all assigned dynamic roles
        roles = user.user_roles.all()
        token['roles'] = [r.name for r in roles]
        
        # Determine Data Isolation: If ALL assigned roles have data_isolation=True, enforce it.
        # If any role is global (data_isolation=False), they get global access.
        # If no roles are assigned, fallback to primary 'role' (e.g. basic PATIENT isolation)
        if roles.exists():
            token['data_isolation'] = all(r.data_isolation for r in roles)
        else:
            token['data_isolation'] = True if user.role != 'ADMIN' else False

        # Compute combined permissions array
        all_perms = []
        for r in roles:
            if isinstance(r.permissions, list):
                all_perms.extend(r.permissions)
        # Admins get bypass global access to everything
        if user.role == 'ADMIN':
            token['permissions'] = ['ADMIN_ALL']
        else:
            token['permissions'] = list(set(all_perms))

        token['username'] = user.username
        token['name'] = f"{user.first_name} {user.last_name}"
        return token

    def validate(self, attrs):
        identifier = attrs.get("username")
        password = attrs.get("password")

        # 🚀 MULTI-IDENTIFIER LOGIC: Resolve User by ID (Username) or mobile number (Phone)
        user = User.objects.filter(Q(username=identifier) | Q(phone=identifier)).first()
        
        if user and not user.is_active:
            raise serializers.ValidationError({"error": "Your account is deactivated. Please contact the clinical administrator."})

        if user and user.check_password(password):
            # Map the resolved username back to keep JWT built-in validation happy
            attrs['username'] = user.username
        
        data = super().validate(attrs)

        # 🛡️ SECURITY: ZERO-ROLE BLOCK (MNC Standard)
        if not self.user.is_superuser and not self.user.user_roles.exists():
             raise serializers.ValidationError({"error": "Access Restricted: Your account has no assigned permissions. Please contact clinical administration to link your role."})
        
        # 🚀 PORTAL SYNC: Include user info in the response body for immediate frontend use
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'role': self.user.role if hasattr(self.user, 'role') else 'PATIENT',
            'is_password_set': self.user.is_password_set
        }
        
        return data
