from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.conf import settings
from openai import OpenAI
from .models import Conversation, Message, HealthTip
from .serializers import ConversationSerializer, MessageSerializer, HealthTipSerializer
import re

client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

EMERGENCY_KEYWORDS = [
    'chest pain', 'heart attack', 'stroke', 'bleeding', 'unconscious',
    'suicide', 'overdose', 'severe pain', 'can\'t breathe', 'choking',
    'seizure', 'severe allergic', 'broken bone'
]

MEDICAL_SYSTEM_PROMPT = """You are MediBot, a helpful AI healthcare assistant. Your role is to:
1. Listen to symptoms and provide general health information
2. Suggest possible conditions based on symptoms (always with disclaimer)
3. Provide basic self-care advice when appropriate
4. Recommend seeking medical attention when necessary
5. Be empathetic and supportive

Important guidelines:
- Always remind users you're an AI and can't replace professional medical advice
- For serious symptoms, strongly recommend seeing a doctor
- Provide clear, simple explanations
- Be supportive and non-judgmental
- Never diagnose definitively - only suggest possibilities
- Always prioritize user safety"""

def detect_emergency(text):
    text_lower = text.lower()
    for keyword in EMERGENCY_KEYWORDS:
        if keyword in text_lower:
            return True
    return False

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_conversation(request):
    conversation = Conversation.objects.create(
        user=request.user,
        title=request.data.get('title', 'New Conversation')
    )
    return Response(ConversationSerializer(conversation).data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversations(request):
    conversations = Conversation.objects.filter(user=request.user, is_active=True)
    return Response(ConversationSerializer(conversations, many=True).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversation(request, conversation_id):
    try:
        conversation = Conversation.objects.get(id=conversation_id, user=request.user)
        return Response(ConversationSerializer(conversation).data)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request, conversation_id):
    try:
        conversation = Conversation.objects.get(id=conversation_id, user=request.user)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

    user_message = request.data.get('content')
    if not user_message:
        return Response({'error': 'Message content is required'}, status=status.HTTP_400_BAD_REQUEST)

    is_emergency = detect_emergency(user_message)
    
    Message.objects.create(
        conversation=conversation,
        role='user',
        content=user_message,
        is_emergency=is_emergency
    )

    conversation_history = []
    for msg in conversation.messages.all():
        conversation_history.append({
            'role': msg.role,
            'content': msg.content
        })

    if not client:
        ai_response = "I apologize, but I'm currently unable to process your request. Please ensure the OpenAI API key is configured."
    else:
        try:
            if is_emergency:
                emergency_prefix = "⚠️ EMERGENCY DETECTED: This appears to be a medical emergency. Please call emergency services (911 or your local emergency number) immediately. While waiting for help:\n\n"
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": MEDICAL_SYSTEM_PROMPT},
                        *conversation_history
                    ],
                    max_tokens=300,
                    temperature=0.7
                )
                ai_response = emergency_prefix + response.choices[0].message.content
            else:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": MEDICAL_SYSTEM_PROMPT},
                        *conversation_history
                    ],
                    max_tokens=300,
                    temperature=0.7
                )
                ai_response = response.choices[0].message.content
        except Exception as e:
            ai_response = f"I apologize, but I encountered an error processing your request. Please try again later."

    ai_message = Message.objects.create(
        conversation=conversation,
        role='assistant',
        content=ai_response,
        is_emergency=is_emergency
    )

    conversation.updated_at = ai_message.created_at
    conversation.save()

    return Response({
        'user_message': MessageSerializer(conversation.messages.filter(role='user').last()).data,
        'ai_message': MessageSerializer(ai_message).data
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def get_health_tips(request):
    category = request.GET.get('category')
    if category:
        tips = HealthTip.objects.filter(category=category, is_active=True)
    else:
        tips = HealthTip.objects.filter(is_active=True)[:10]
    return Response(HealthTipSerializer(tips, many=True).data)
