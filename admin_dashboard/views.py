from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from chatbot.models import Conversation, Message
from datetime import datetime, timedelta

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_analytics(request):
    total_users = User.objects.count()
    total_conversations = Conversation.objects.count()
    total_messages = Message.objects.count()
    emergency_count = Message.objects.filter(is_emergency=True).count()
    
    today = datetime.now().date()
    active_users_today = Conversation.objects.filter(
        updated_at__date=today
    ).values('user').distinct().count()
    
    return Response({
        'total_users': total_users,
        'total_conversations': total_conversations,
        'total_messages': total_messages,
        'emergency_count': emergency_count,
        'active_users': active_users_today
    })
