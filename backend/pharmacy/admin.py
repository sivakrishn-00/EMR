from django.contrib import admin
from .models import (
    Prescription, DrugBatch, DispensingRecord, 
    Indent, IndentItem, RoomStock, RoomStockTransfer, 
    RoomStockDispensation, FacilityRoom, UserRoomAssignment
)

@admin.register(FacilityRoom)
class FacilityRoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'room_type', 'project', 'is_active', 'created_at')
    list_filter = ('room_type', 'project', 'is_active')
    search_fields = ('name',)

@admin.register(UserRoomAssignment)
class UserRoomAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'assigned_room', 'can_raise_indent', 'can_log_dispensation')
    list_filter = ('assigned_room__project', 'assigned_room')
    search_fields = ('user__username', 'assigned_room__name')

admin.site.register(Prescription)
admin.site.register(DrugBatch)
admin.site.register(DispensingRecord)
admin.site.register(Indent)
admin.site.register(IndentItem)
admin.site.register(RoomStock)
admin.site.register(RoomStockTransfer)
admin.site.register(RoomStockDispensation)

